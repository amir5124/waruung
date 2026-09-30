import { api, NearbyDriver } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useNearbyDrivers(
    coords: { latitude: number; longitude: number } | null,
    options?: { radius?: number; limit?: number; pollMs?: number }
) {
    const radius = options?.radius ?? 5000;
    const limit = options?.limit ?? 50;
    const pollMs = options?.pollMs ?? 5000;

    const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
    const [loading, setLoading] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchOnce = useCallback(async () => {
        if (!coords) return;
        try {
            setLoading(true);
            const data = await api.drivers.nearby(
                coords.latitude,
                coords.longitude,
                radius,
                limit
            );
            console.log('[useNearbyDrivers] dapat', data.length, 'driver');
            setDrivers(data);
        } catch (err: any) {
            console.warn('[useNearbyDrivers] gagal:', err.message);
        } finally {
            setLoading(false);
        }
    }, [coords?.latitude, coords?.longitude, radius, limit]);

    useEffect(() => {
        if (!coords) {
            setDrivers([]);
            return;
        }

        fetchOnce();

        intervalRef.current = setInterval(fetchOnce, pollMs);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [fetchOnce, pollMs, coords?.latitude, coords?.longitude]);

    return { drivers, loading, refresh: fetchOnce };
}