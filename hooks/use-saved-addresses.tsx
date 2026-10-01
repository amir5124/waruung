import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

export type SavedKind = 'home' | 'office';

export interface SavedPlace {
    name: string;
    address: string;
    coords: { latitude: number; longitude: number };
    placeId?: string;
}

/**
 * Parse kolom `location` dari Supabase (geography point).
 * Supabase PostgREST bisa mengirim dalam beberapa bentuk:
 *  1. GeoJSON: { type: 'Point', coordinates: [lng, lat] }
 *  2. WKT string: "POINT(lng lat)"
 *  3. Object: { latitude, longitude }
 *  4. String hex EWKB (jarang)
 */
function parseLocation(loc: any): {
    latitude: number;
    longitude: number;
} {
    console.log(
        '[parseLocation] input:',
        typeof loc,
        JSON.stringify(loc)
    );

    if (!loc) {
        console.warn('[parseLocation] loc null/undefined');
        return { latitude: 0, longitude: 0 };
    }

    // 1. GeoJSON: { type: 'Point', coordinates: [lng, lat] }
    if (
        typeof loc === 'object' &&
        loc.type === 'Point' &&
        Array.isArray(loc.coordinates) &&
        loc.coordinates.length >= 2
    ) {
        const [lng, lat] = loc.coordinates;
        if (typeof lat === 'number' && typeof lng === 'number') {
            console.log('[parseLocation] GeoJSON OK:', { lat, lng });
            return { latitude: lat, longitude: lng };
        }
    }

    // 2. Object dengan coordinates array (tanpa type)
    if (
        typeof loc === 'object' &&
        Array.isArray(loc.coordinates) &&
        loc.coordinates.length >= 2
    ) {
        const [lng, lat] = loc.coordinates;
        if (typeof lat === 'number' && typeof lng === 'number') {
            console.log('[parseLocation] coords array OK:', {
                lat,
                lng,
            });
            return { latitude: lat, longitude: lng };
        }
    }

    // 3. WKT string: "POINT(lng lat)"
    if (typeof loc === 'string') {
        const m = loc.match(
            /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i
        );
        if (m) {
            const lng = Number(m[1]);
            const lat = Number(m[2]);
            console.log('[parseLocation] WKT OK:', { lat, lng });
            return { latitude: lat, longitude: lng };
        }
    }

    // 4. Sudah object { latitude, longitude }
    if (
        typeof loc === 'object' &&
        typeof loc.latitude === 'number' &&
        typeof loc.longitude === 'number'
    ) {
        console.log('[parseLocation] object OK:', loc);
        return { latitude: loc.latitude, longitude: loc.longitude };
    }

    console.warn(
        '[parseLocation] FORMAT TIDAK DIKENALI:',
        JSON.stringify(loc)
    );
    return { latitude: 0, longitude: 0 };
}

const ALL_KINDS: SavedKind[] = ['home', 'office'];

function makeEmptyMap(): Record<SavedKind, SavedPlace | null> {
    return { home: null, office: null };
}

export function useSavedAddresses() {
    const [saved, setSaved] = useState<
        Record<SavedKind, SavedPlace | null>
    >(makeEmptyMap());
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            console.log('[SAVED] Fetch list dari backend...');
            const list = await api.savedAddresses.list();
            console.log(
                '[SAVED] Raw list:',
                JSON.stringify(list, null, 2)
            );

            const next = makeEmptyMap();

            for (const item of list) {
                if (ALL_KINDS.includes(item.kind as SavedKind)) {
                    const kind = item.kind as SavedKind;
                    const coords = parseLocation(item.location);
                    console.log(
                        `[SAVED] ${kind} → coords:`,
                        coords
                    );

                    next[kind] = {
                        name: item.name,
                        address: item.address,
                        coords,
                        placeId: item.place_id ?? undefined,
                    };
                }
            }

            console.log(
                '[SAVED] Parsed result:',
                JSON.stringify(next, null, 2)
            );
            setSaved(next);
        } catch (err: any) {
            console.warn('[SAVED] Gagal load:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const save = useCallback(
        async (kind: SavedKind, place: SavedPlace) => {
            console.log(
                '[SAVED] Simpan',
                kind,
                '→',
                JSON.stringify(place)
            );

            if (
                !place.coords ||
                typeof place.coords.latitude !== 'number' ||
                typeof place.coords.longitude !== 'number' ||
                (place.coords.latitude === 0 &&
                    place.coords.longitude === 0)
            ) {
                throw new Error('Koordinat alamat tidak valid');
            }

            await api.savedAddresses.upsert({
                kind,
                name: place.name,
                address: place.address,
                place_id: place.placeId,
                latitude: place.coords.latitude,
                longitude: place.coords.longitude,
            });

            console.log(
                '[SAVED] Tersimpan di backend, refresh...'
            );
            await refresh();
        },
        [refresh]
    );

    const remove = useCallback(
        async (kind: SavedKind) => {
            console.log('[SAVED] Hapus', kind);
            await api.savedAddresses.remove(kind);
            await refresh();
        },
        [refresh]
    );

    return { saved, loading, save, remove, refresh };
}