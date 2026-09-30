import type { Coords } from '@/types/ojek';

export type RoadSuggestion = { coords: Coords; name: string; distance: number };

// Key sama dengan yang dipakai google-maps.ts
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? 'AIzaSyCQOfitYRU7iAHMRaj0dwcrI8-UQIiFPWI';

const MIN_DIST = 15;   // < 15 m dianggap sudah di jalan
const MAX_DIST = 300;  // > 300 m terlalu jauh untuk disarankan
const TIMEOUT_MS = 8000;

const log = (...a: unknown[]) => {
    if (__DEV__) console.log('[main-road]', ...a);
};

// Cache per grid ~11 m
const cache = new Map<string, RoadSuggestion | null>();
const keyOf = (c: Coords) => `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`;

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

function haversineMeters(a: Coords, b: Coords): number {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Ambil nama jalan dari koordinat via Geocoding API.
 * Google Roads API tidak mengembalikan nama jalan, jadi kita ambil dari geocode.
 */
async function getRoadName(c: Coords): Promise<string | null> {
    if (!API_KEY) return null;
    try {
        const url =
            `https://maps.googleapis.com/maps/api/geocode/json` +
            `?latlng=${c.latitude},${c.longitude}` +
            `&language=id` +
            `&key=${API_KEY}`;

        const res = await fetch(url);
        const data = await res.json();
        const result = data.results?.[0];
        if (!result) return null;

        // Cari komponen dengan tipe 'route' (nama jalan)
        const route = result.address_components?.find((c: any) =>
            c.types?.includes('route')
        );
        return route?.long_name ?? null;
    } catch (err: any) {
        log('geocode gagal', err?.message);
        return null;
    }
}

/**
 * Cari titik terdekat di jalan raya pakai Google Roads API (`nearestRoads`).
 * Return null kalau:
 *  - Sudah di jalan (jarak < MIN_DIST)
 *  - Tidak ada snapped point
 *  - Terlalu jauh (> MAX_DIST, biasanya artinya tidak ada jalan di sekitar)
 */
export async function findMainRoadSuggestion(
    c: Coords,
    signal?: AbortSignal,
): Promise<RoadSuggestion | null> {
    const key = keyOf(c);
    if (cache.has(key)) {
        log('cache', key);
        return cache.get(key) ?? null;
    }

    if (!API_KEY) {
        log('API key tidak ada');
        return null;
    }

    // Timeout sendiri
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onOuter = () => ctrl.abort();
    signal?.addEventListener('abort', onOuter);

    try {
        const url =
            `https://roads.googleapis.com/v1/nearestRoads` +
            `?points=${c.latitude},${c.longitude}` +
            `&key=${API_KEY}`;

        log('Request ke Google Roads API...');
        const res = await fetch(url, { signal: ctrl.signal });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            log('HTTP', res.status, text);
            cache.set(key, null);
            return null;
        }

        const data = await res.json();
        const snapped = data.snappedPoints?.[0];

        if (!snapped?.location) {
            log('Tidak ada snapped point');
            cache.set(key, null);
            return null;
        }

        const road: Coords = {
            latitude: snapped.location.latitude,
            longitude: snapped.location.longitude,
        };

        const distance = haversineMeters(c, road);
        log('snapped', road, 'distance', Math.round(distance));

        // Sudah di jalan raya
        if (distance < MIN_DIST) {
            log('sudah di jalan');
            cache.set(key, null);
            return null;
        }

        // Terlalu jauh → kemungkinan bukan di jalan yang masuk akal
        if (distance > MAX_DIST) {
            log('terlalu jauh', Math.round(distance));
            cache.set(key, null);
            return null;
        }

        // Ambil nama jalan
        const name = await getRoadName(road);

        const result: RoadSuggestion = {
            coords: road,
            name: name || 'Jalan terdekat',
            distance: Math.round(distance),
        };

        cache.set(key, result);
        return result;
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            log('abort');
        } else {
            log('error', err?.message);
        }
        // Jangan cache kalau abort (biar bisa retry)
        return null;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onOuter);
    }
}