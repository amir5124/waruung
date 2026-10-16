// hooks/use-map-markers.ts
import { useEffect, useState } from 'react';

// ⚠️ SESUAIKAN endpoint ini dengan API kamu (yang mengembalikan file kategori "Marker Map")
const MARKER_ENDPOINT = 'https://warung.siappgo.id/api/map-markers';

export type MarkerIcons = Record<string, string>; // { 'motor_map_1792...-erjqx8': 'https://...' }

let cache: MarkerIcons | null = null;
let inflight: Promise<MarkerIcons> | null = null;

function isActive(r: any): boolean {
    if (r?.is_active === false) return false;
    const st = String(r?.status ?? '').toLowerCase();
    if (st && !['aktif', 'active', 'true', '1'].includes(st)) return false;
    return true;
}

function normalize(json: any): MarkerIcons {
    const rows: any[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
            ? json.data
            : [];
    const out: MarkerIcons = {};
    for (const r of rows) {
        if (!isActive(r)) continue;
        const key = r?.key ?? r?.label ?? r?.marker_key ?? r?.name ?? r?.code;
        const url =
            r?.url ??
            r?.file_url ??
            r?.public_url ??
            r?.image_url ??
            r?.icon_url ??
            r?.icon;
        if (key && typeof url === 'string' && url) out[String(key)] = url;
    }
    return out;
}

/**
 * Ambil icon untuk key dasar (mis. 'motor_map' / 'mobil_map').
 * Key di database punya akhiran unik ("motor_map_1792014859301-erjqx8"),
 * jadi dicocokkan berdasarkan awalan. Kalau ada beberapa, diambil yang terbaru.
 */
export function pickMarkerIcon(
    icons: MarkerIcons,
    baseKey: string
): string | undefined {
    if (icons[baseKey]) return icons[baseKey];
    const matches = Object.keys(icons)
        .filter((k) => k === baseKey || k.startsWith(`${baseKey}_`))
        .sort(); // timestamp di akhiran → urutan terakhir = terbaru
    const latest = matches[matches.length - 1];
    return latest ? icons[latest] : undefined;
}

async function fetchMarkers(): Promise<MarkerIcons> {
    if (cache) return cache;
    if (inflight) return inflight;
    inflight = fetch(MARKER_ENDPOINT)
        .then((r) => r.json())
        .then((j) => {
            console.log('[useMapMarkers] response:', JSON.stringify(j).slice(0, 400)); // debug
            const m = normalize(j);
            console.log('[useMapMarkers] icons:', Object.keys(m)); // debug
            if (Object.keys(m).length > 0) cache = m; // jangan cache hasil kosong
            return m;
        })
        .catch((err) => {
            console.warn('[useMapMarkers] gagal load marker:', err?.message);
            return {} as MarkerIcons;
        })
        .finally(() => {
            inflight = null;
        });
    return inflight;
}

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