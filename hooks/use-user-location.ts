import type { Coords } from '@/types/ojek';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'blocked' | 'services-off' | 'error';

export function useUserLocation() {
    const [status, setStatus] = useState<LocationStatus>('loading');
    const [coords, setCoords] = useState<Coords | null>(null);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const statusRef = useRef(status);
    statusRef.current = status;

    const apply = (p: Location.LocationObject) => {
        setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setAccuracy(p.coords.accuracy ?? null);
    };

    const refresh = useCallback(async () => {
        setStatus('loading');
        try {
            let perm = await Location.getForegroundPermissionsAsync();
            if (perm.status !== 'granted' && perm.canAskAgain) {
                perm = await Location.requestForegroundPermissionsAsync();
            }
            if (perm.status !== 'granted') {
                setStatus(perm.canAskAgain ? 'denied' : 'blocked');
                return;
            }
            if (!(await Location.hasServicesEnabledAsync())) {
                setStatus('services-off');
                return;
            }
            // tampilkan posisi terakhir dulu biar cepat, lalu perbarui dengan yang akurat
            const last = await Location.getLastKnownPositionAsync();
            if (last) {
                apply(last);
                setStatus('granted');
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            apply(pos);
            setStatus('granted');
        } catch {
            setStatus((s) => (s === 'granted' ? s : 'error'));
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // user balik dari pengaturan HP -> cek ulang
    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active' && ['blocked', 'services-off', 'denied'].includes(statusRef.current)) refresh();
        });
        return () => sub.remove();
    }, [refresh]);

    return { status, coords, accuracy, refresh, openSettings: () => Linking.openSettings() };
}

export type UserLocationState = ReturnType<typeof useUserLocation>;