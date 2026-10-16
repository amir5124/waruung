import AppAlert from '@/components/AppAlert';
import NetInfo from '@react-native-community/netinfo';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

export default function NetworkGuard() {
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            // isInternetReachable bisa null saat awal, jadi hanya anggap
            // offline jika benar-benar false / tidak terkoneksi
            const isOffline =
                state.isConnected === false ||
                state.isInternetReachable === false;
            setOffline(isOffline);
        });
        return unsubscribe;
    }, []);

    const retry = useCallback(async () => {
        const state = await NetInfo.refresh();
        const isOffline =
            state.isConnected === false ||
            state.isInternetReachable === false;
        setOffline(isOffline);
    }, []);

    const buttons = useMemo<AlertButton[]>(() => {
        const list: AlertButton[] = [
            { text: 'Coba Lagi', onPress: retry },
        ];
        // Exit hanya di Android (iOS tidak boleh menutup app sendiri)
        if (Platform.OS === 'android') {
            list.push({
                text: 'Keluar',
                style: 'destructive',
                onPress: () => BackHandler.exitApp(),
            });
        }
        return list;
    }, [retry]);

    return (
        <AppAlert
            visible={offline}
            title="Tidak Ada Jaringan"
            message="Periksa koneksi internet kamu lalu coba lagi."
            buttons={buttons}
            // visible dikontrol oleh status jaringan, jadi onClose tidak
            // perlu menyembunyikan alert. Alert hilang otomatis saat online.
            onClose={() => { }}
        />
    );
}