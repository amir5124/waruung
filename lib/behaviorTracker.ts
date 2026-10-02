// src/lib/behaviorTracker.ts
// 1) pingPresence() -> catat kapan user terakhir buka app (notifikasi re-engage)
// 2) trackQuote()   -> catat saat harga ditampilkan (notifikasi "tidak jadi pesan")
// Keduanya lewat backend (api.activity), sama seperti request lain di app.
// ─────────────────────────────────────────────────────────────────────────────

import { api, getToken } from '@/lib/api';
import { AppState, AppStateStatus } from 'react-native';

// ── Presence ─────────────────────────────────────────────────────────────────
let lastPingAt = 0;
const PING_INTERVAL = 5 * 60 * 1000; // maks 1x per 5 menit

export async function pingPresence(): Promise<void> {
    const now = Date.now();
    if (now - lastPingAt < PING_INTERVAL) return;
    if (!(await getToken())) return; // belum login

    try {
        await api.activity.ping();
        lastPingAt = now;
    } catch (e) {
        console.warn('[tracker] presence gagal:', e);
    }
}

// Panggil sekali di _layout.tsx setelah user login
export function setupBehaviorTracker(): () => void {
    lastPingAt = 0; // paksa ping pertama, mis. setelah login / ganti akun
    pingPresence();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') pingPresence();
    });
    return () => sub.remove();
}

// ── Quote (cek harga) ────────────────────────────────────────────────────────
// Sama dengan enum order_type. Nama armada (WarJek S / WarCar / WarSend S) lewat optionName.
export type QuoteService = 'ride' | 'send' | 'food';

type Place = {
    name: string;
    coords: { latitude: number; longitude: number };
};

export type QuoteInput = {
    service: QuoteService;
    origin: Place;
    destination: Place;
    optionName?: string;
    price?: number;
    etaMin?: number;
    distanceKm?: number;
};

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Panggil saat daftar harga/armada tampil atau pilihan berubah.
 * Di-debounce 1,5 detik per layanan supaya tidak spam request.
 * Tidak perlu dipanggil saat order dibuat: trigger database menandainya "ordered".
 */
export function trackQuote(q: QuoteInput): void {
    const prev = timers.get(q.service);
    if (prev) clearTimeout(prev);

    timers.set(
        q.service,
        setTimeout(async () => {
            timers.delete(q.service);
            if (!(await getToken())) return;
            try {
                await api.activity.quote({
                    service: q.service,
                    origin_name: q.origin.name,
                    origin_lat: q.origin.coords.latitude,
                    origin_lng: q.origin.coords.longitude,
                    dest_name: q.destination.name,
                    dest_lat: q.destination.coords.latitude,
                    dest_lng: q.destination.coords.longitude,
                    option_name: q.optionName ?? null,
                    price: q.price ?? null,
                    eta_min: q.etaMin ?? null,
                    distance_km: q.distanceKm ?? null,
                });
            } catch (e) {
                console.warn('[tracker] quote gagal:', e);
            }
        }, 1500)
    );
}