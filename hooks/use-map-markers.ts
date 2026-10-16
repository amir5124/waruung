// hooks/use-map-markers.ts
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

// Type: { 'motor_map_1792...-erjqx8': 'https://...' }
export type MarkerIcons = Record<string, string>;

// ============================================================
// CACHE
// ============================================================
let cache: MarkerIcons | null = null;
let inflight: Promise<MarkerIcons> | null = null;

// ============================================================
// FETCH MARKERS dari endpoint PUBLIK (kategori: marker)
// ============================================================
async function fetchMarkers(): Promise<MarkerIcons> {
    if (cache) return cache;
    if (inflight) return inflight;

    inflight = (async () => {
        try {
            console.log('[useMapMarkers] 🟡 fetch marker assets...');

            const res = await api.public.assets({
                category: 'marker',
                limit: 50,
            });

            console.log(
                '[useMapMarkers] 🟢 response items:',
                res.items.length,
                res.items.map((a) => a.key)
            );

            const out: MarkerIcons = {};
            for (const a of res.items ?? []) {
                if (a?.key && a?.url) {
                    out[String(a.key)] = String(a.url);
                }
            }

            console.log(
                '[useMapMarkers] 🟢 icons:',
                Object.keys(out)
            );

            if (Object.keys(out).length > 0) {
                cache = out;
            }
            return out;
        } catch (err: any) {
            console.warn(
                '[useMapMarkers] 🔴 gagal load marker:',
                err?.message
            );
            return {} as MarkerIcons;
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

/**
 * Ambil icon untuk key dasar (mis. 'motor_map' / 'mobil_map').
 * Key di DB punya akhiran unik ("motor_map_1792014859301-erjqx8"),
 * jadi dicocokkan berdasarkan awalan.
 */
export function pickMarkerIcon(
    icons: MarkerIcons,
    baseKey: string
): string | undefined {
    if (!baseKey) return undefined;

    // 1. Exact match
    if (icons[baseKey]) return icons[baseKey];

    // 2. Prefix match — ambil yang paling baru (timestamp di akhir)
    const matches = Object.keys(icons)
        .filter((k) => k.startsWith(`${baseKey}_`))
        .sort(); // timestamp di akhiran → urutan terakhir = terbaru

    const latest = matches[matches.length - 1];
    return latest ? icons[latest] : undefined;
}

// ============================================================
// HOOK
// ============================================================
export function useMapMarkers() {
    const [icons, setIcons] = useState<MarkerIcons>(cache ?? {});
    const [loading, setLoading] = useState(!cache);

    useEffect(() => {
        let alive = true;
        fetchMarkers().then((m) => {
            if (!alive) return;
            setIcons(m);
            setLoading(false);
        });
        return () => {
            alive = false;
        };
    }, []);

    return { icons, loading };
}