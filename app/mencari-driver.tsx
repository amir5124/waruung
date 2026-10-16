// app/mencari-driver.tsx
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CompletedStep from '@/components/warfood/CompletedStep';
import DriverFoundStep from '@/components/warfood/DriverFoundStep';
import OnTripStep from '@/components/warfood/OnTripStep';
import SearchingDriverStep from '@/components/warfood/SearchingDriverStep';

import LoadingModal from '@/components/LoadingModal';
import { api, type OrderResponse } from '@/lib/api';
import { mapOrderStatus } from '@/lib/orderFlow';
import { useAppAlert } from '@/lib/useAppAlert';

const BLUE = '#2F86EB';

export default function MencariDriverScreen() {
    const { showAlert, alertNode } = useAppAlert();
    const [busy, setBusy] = useState(false);
    return (
        <View style={{ flex: 1 }}>
            <Inner showAlert={showAlert} setBusy={setBusy} />
            {alertNode}
            <LoadingModal visible={busy} />
        </View>
    );
}

type InnerProps = {
    showAlert: ReturnType<typeof useAppAlert>['showAlert'];
    setBusy: (v: boolean) => void;
};

function Inner({ showAlert, setBusy }: InnerProps) {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    const insets = useSafeAreaInsets();

    const [order, setOrder] = useState<OrderResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        setBusy(loading || cancelling);
    }, [loading, cancelling, setBusy]);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    // ============================================================
    // LOAD ORDER (initial)
    // ============================================================
    const loadOrder = useCallback(async () => {
        if (!orderId) return;
        try {
            const o = await api.orders.get(Number(orderId));
            if (!mountedRef.current) return;
            setOrder(o);
            setError(null);
        } catch (e: any) {
            if (!mountedRef.current) return;
            setError(e?.message ?? 'Gagal memuat pesanan');
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        mountedRef.current = true;
        loadOrder();
        return () => {
            mountedRef.current = false;
        };
    }, [loadOrder]);

    // ============================================================
    // POLLING TIAP 3 DETIK — update status driver
    // ============================================================
    useEffect(() => {
        if (!order) return;

        // Kalau sudah selesai/batal, stop polling
        if (['completed', 'cancelled'].includes(order.status)) {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }

        pollRef.current = setInterval(async () => {
            try {
                const o = await api.orders.get(Number(orderId));
                if (!mountedRef.current) return;
                setOrder(o);
            } catch { }
        }, 3000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [order?.status, orderId]);

    // ============================================================
    // CANCEL ORDER
    // ============================================================
    const cancelOrder = async () => {
        showAlert(
            'Batalkan pesanan?',
            'Pesanan akan dibatalkan dan dana (jika ada) akan dikembalikan.',
            [
                { text: 'Tidak', style: 'cancel' },
                {
                    text: 'Ya, batalkan',
                    style: 'destructive',
                    onPress: async () => {
                        setCancelling(true);
                        try {
                            await api.orders.cancel(
                                Number(orderId),
                                'Dibatalkan oleh customer'
                            );
                            router.replace('/(tabs)' as any);
                        } catch (e: any) {
                            showAlert(
                                'Gagal',
                                e?.message ?? 'Coba lagi'
                            );
                        } finally {
                            if (mountedRef.current) setCancelling(false);
                        }
                    },
                },
            ]
        );
    };

    // ============================================================
    // LOADING & ERROR STATE
    // ============================================================
    if (loading) {
        return <View style={[s.center, { paddingTop: insets.top }]} />;
    }

    if (error || !order) {
        return (
            <View style={[s.center, { paddingTop: insets.top }]}>
                <Ionicons
                    name="alert-circle-outline"
                    size={48}
                    color="#DC2626"
                />
                <Text style={s.errorText}>
                    {error ?? 'Pesanan tidak ditemukan'}
                </Text>
                <Pressable style={s.retryBtn} onPress={loadOrder}>
                    <Text style={s.retryText}>Coba lagi</Text>
                </Pressable>
                <Pressable onPress={() => router.replace('/(tabs)' as any)}>
                    <Text style={s.backLink}>Kembali ke beranda</Text>
                </Pressable>
            </View>
        );
    }

    // ============================================================
    // RENDER STEP BERDASARKAN STATUS
    // ============================================================
    const step = mapOrderStatus(order.status);

    const onBack = () => {
        if (step === 'searching') {
            cancelOrder();
        } else {
            // Boleh balik ke home, tracking lanjut via notif
            router.replace('/(tabs)' as any);
        }
    };

    const goToTracking = () => {
        router.push({
            pathname: '/tracking/[orderId]',
            params: { orderId: String(order.id) },
        } as any);
    };

    // 1) SEARCHING
    if (step === 'searching') {
        return (
            <SearchingDriverStep
                order={order}
                onBack={onBack}
                onCancel={cancelOrder}
            />
        );
    }

    // 2) DRIVER FOUND (menuju resto)
    if (step === 'driver_found') {
        return (
            <DriverFoundStep
                order={order}
                onChat={() =>
                    router.push({
                        pathname: '/chat/[orderId]',
                        params: { orderId: String(order.id) },
                    } as any)
                }
                onCall={() => {
                    const phone = order.driver?.phone;
                    if (!phone) {
                        showAlert('Info', 'Nomor driver tidak tersedia');
                        return;
                    }
                    Linking.openURL(`tel:${phone}`);
                }}
                onTrack={goToTracking}
            />
        );
    }

    // 3) PICKUP / DELIVERING / ARRIVED → OnTripStep
    if (
        step === 'picking_up' ||
        step === 'delivering' ||
        step === 'arrived'
    ) {
        return (
            <OnTripStep
                order={order}
                onChat={() =>
                    router.push({
                        pathname: '/chat/[orderId]',
                        params: { orderId: String(order.id) },
                    } as any)
                }
                onCall={() => {
                    const phone = order.driver?.phone;
                    if (!phone) return;
                    Linking.openURL(`tel:${phone}`);
                }}
            />
        );
    }

    // 4) COMPLETED → arahkan ke rating
    if (step === 'completed') {
        return (
            <CompletedStep
                order={order}
                onRate={() =>
                    router.replace({
                        pathname: '/rating/[orderId]',
                        params: { orderId: String(order.id) },
                    } as any)
                }
                onDone={() => router.replace('/(tabs)' as any)}
            />
        );
    }

    // 5) CANCELLED
    return (
        <View style={[s.center, { paddingTop: insets.top }]}>
            <Ionicons
                name="close-circle-outline"
                size={56}
                color="#DC2626"
            />
            <Text style={s.errorText}>Pesanan dibatalkan</Text>
            <Pressable
                style={s.retryBtn}
                onPress={() => router.replace('/(tabs)' as any)}
            >
                <Text style={s.retryText}>Kembali ke beranda</Text>
            </Pressable>
        </View>
    );
}

const s = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 12,
        backgroundColor: '#fff',
    },
    loadingText: { fontSize: 14, color: '#6B7280' },
    errorText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1B1B1B',
        textAlign: 'center',
    },
    retryBtn: {
        backgroundColor: BLUE,
        paddingHorizontal: 22,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 8,
    },
    retryText: { color: '#fff', fontWeight: '800' },
    backLink: {
        color: BLUE,
        fontWeight: '700',
        marginTop: 12,
    },
});