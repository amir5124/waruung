import type { PlaceLoc } from '@/types/ojek';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SavedKind = 'home' | 'office';
type SavedMap = Record<SavedKind, PlaceLoc | null>;

const KEY = 'ojek:saved-addresses:v1';

export function useSavedAddresses() {
    const [saved, setSaved] = useState<SavedMap>({ home: null, office: null });
    const ref = useRef<SavedMap>(saved);

    useEffect(() => {
        AsyncStorage.getItem(KEY)
            .then((v) => {
                if (!v) return;
                const next = { home: null, office: null, ...JSON.parse(v) } as SavedMap;
                ref.current = next;
                setSaved(next);
            })
            .catch(() => { });
    }, []);

    const save = useCallback(async (kind: SavedKind, place: PlaceLoc) => {
        const next = { ...ref.current, [kind]: place };
        ref.current = next;
        setSaved(next);
        try {
            await AsyncStorage.setItem(KEY, JSON.stringify(next));
        } catch { }
    }, []);

    return { saved, save };
}