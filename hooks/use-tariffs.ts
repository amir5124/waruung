import { api, Tariff } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

export function useTariffs(serviceType?: 'motor' | 'mobil' | 'food' | 'send') {
    const [tariffs, setTariffs] = useState<Tariff[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const list = await api.tariffs.list();
            const filtered = serviceType
                ? list.filter((t) => t.service_type === serviceType)
                : list;
            setTariffs(filtered);
        } catch (err: any) {
            console.warn('[useTariffs] gagal load:', err.message);
        } finally {
            setLoading(false);
        }
    }, [serviceType]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const calcPrice = useCallback(
        (code: string, distanceMeters: number): number => {
            const t = tariffs.find((x) => x.code === code);
            if (!t) return 0;
            const km = distanceMeters / 1000;
            const extra = Math.max(0, km - t.base_km);
            return t.min_fare + Math.ceil(extra) * t.per_km;
        },
        [tariffs]
    );

    return { tariffs, loading, calcPrice, refresh };
}