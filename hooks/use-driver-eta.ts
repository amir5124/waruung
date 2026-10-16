// hooks/use-driver-eta.ts
//
// Hook untuk menghitung ETA real: driver terdekat → titik jemput.
// - Fetch driver online di sekitar titik jemput
// - Filter driver sesuai layanan yang dipilih (motor / mobil)
// - Cari yang terdekat
// - Hitung jarak haversine + estimasi waktu tempuh
// - Mengembalikan daftar driver untuk ditampilkan sebagai marker di peta

import { api, type NearbyDriver } from '@/lib/api';
import { useEffect, useRef, useState } from 'react';

type LatLng = { latitude: number; longitude: number };

type Options = {
    /** radius pencarian driver (meter) */
    radius?: number;
    /** limit jumlah driver yang di-fetch */
    limit?: number;
    /** polling interval (ms). 0 = tidak polling */
    pollMs?: number;
    /** service type untuk memilih kecepatan rata-rata & filter jenis kendaraan */
    service?: 'motor' | 'mobil' | 'motor_food';
};

type Result = {
    /** ETA real dalam menit (null kalau tidak ada driver) */
    etaMin: number | null;
    /** jarak driver terdekat ke titik jemput (meter) */
    distanceM: number | null;
    /** driver terdekat (untuk debug) */
    nearest: NearbyDriver | null;
    /** jumlah driver online di sekitar (sesuai layanan) */
    driverCount: number;
    /** ✅ daftar driver online (sesuai layanan) untuk marker di peta */
    drivers: NearbyDriver[];
    /** loading state */
    loading: boolean;
};

// Kecepatan rata-rata (km/jam) di area kota
const AVG_SPEED_KMH: Record<string, number> = {
    motor: 25,
    mobil: 20,
    motor_food: 25,
};

// Nilai vehicle_type dari backend yang dianggap cocok dengan tiap layanan
const VEHICLE_MATCH: Record<string, string[]> = {
    motor: ['motor', 'bike', 'ojek'],
    motor_food: ['motor', 'bike', 'ojek'],
    mobil: ['mobil', 'car'],
};

const R = 6371000; // radius bumi (m)
const toRad = (d: number) => (d * Math.PI) / 180;

/** Jarak haversine (meter) */
function haversine(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

/** Apakah driver cocok dengan layanan yang dipilih */
function matchesService(vehicleType: unknown, service: string): boolean {
    if (typeof vehicleType !== 'string') return false;
    const accepted = VEHICLE_MATCH[service] ?? [service];
    return accepted.includes(vehicleType.toLowerCase());
}

export function useDriverEta(
    pickup: LatLng | null,
    opts: Options = {}
): Result {
    const {
        radius = 5000,
        limit = 30,
        pollMs = 0, // default: tidak polling
        service = 'motor',
    } = opts;

    const [etaMin, setEtaMin] = useState<number | null>(null);
    const [distanceM, setDistanceM] = useState<number | null>(null);
    const [nearest, setNearest] = useState<NearbyDriver | null>(null);
    const [driverCount, setDriverCount] = useState(0);
    const [drivers, setDrivers] = useState<NearbyDriver[]>([]); // ✅ BARU
    const [loading, setLoading] = useState(false);

    const reqId = useRef(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Reset saat titik jemput / layanan berubah, supaya driver layanan
        // sebelumnya tidak tampil dengan icon layanan yang baru.
        setDrivers([]);

        if (!pickup) {
            setEtaMin(null);
            setDistanceM(null);
            setNearest(null);
            setDriverCount(0);
            return;
        }

        let alive = true;

        const fetchEta = async () => {
            const my = ++reqId.current;
            setLoading(true);

            try {
                const all = await api.drivers.nearby(
                    pickup.latitude,
                    pickup.longitude,
                    radius,
                    limit
                );

                if (!alive || my !== reqId.current) return;

                // Hanya driver yang punya koordinat & jenis kendaraan sesuai layanan
                const validDrivers = all.filter(
                    (d) =>
                        d.coords &&
                        d.vehicle_type !== null &&
                        matchesService(d.vehicle_type, service)
                );

                setDriverCount(validDrivers.length);
                setDrivers(validDrivers); // ✅ BARU

                if (validDrivers.length === 0) {
                    setEtaMin(null);
                    setDistanceM(null);
                    setNearest(null);
                    return;
                }

                // Cari driver terdekat
                let best: NearbyDriver | null = null;
                let bestDist = Infinity;

                validDrivers.forEach((d) => {
                    if (!d.coords) return;
                    const dist = haversine(pickup, d.coords);
                    if (dist < bestDist) {
                        bestDist = dist;
                        best = d;
                    }
                });

                if (!best) {
                    setEtaMin(null);
                    setDistanceM(null);
                    setNearest(null);
                    return;
                }

                // Hitung ETA
                const speedKmh = AVG_SPEED_KMH[service] ?? 25;
                const distKm = bestDist / 1000;
                const timeHours = distKm / speedKmh;
                const timeMin = Math.max(1, Math.round(timeHours * 60));

                setEtaMin(timeMin);
                setDistanceM(Math.round(bestDist));
                setNearest(best);

                console.log('[useDriverEta] ✅', {
                    driver: (best as NearbyDriver).name,
                    distM: Math.round(bestDist),
                    etaMin: timeMin,
                    totalDrivers: validDrivers.length,
                    service,
                });
            } catch (e: any) {
                if (!alive || my !== reqId.current) return;
                console.warn('[useDriverEta] ❌', e?.message);
                setEtaMin(null);
                setDistanceM(null);
                setNearest(null);
                setDriverCount(0);
                setDrivers([]);
            } finally {
                if (alive && my === reqId.current) setLoading(false);
            }
        };

        fetchEta();

        // Polling jika diminta
        if (pollMs > 0) {
            pollRef.current = setInterval(fetchEta, pollMs);
        }

        return () => {
            alive = false;
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [pickup?.latitude, pickup?.longitude, radius, limit, pollMs, service]);

    return { etaMin, distanceM, nearest, driverCount, drivers, loading };
}