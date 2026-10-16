import { useOrder } from '@/contexts/OrderContext';
import { api, type OrderResponse } from '@/lib/api';
import { ACTIVE_STATUSES, openOrder } from '@/lib/openOrder';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const LABEL: Record<string, string> = {
    pending: 'Menunggu konfirmasi / mencari driver',
    accepted: 'Driver menuju lokasi',
    arrived: 'Driver sudah tiba',
    in_progress: 'Dalam perjalanan',
};
const TYPE: Record<string, string> = { ride: 'Perjalanan', send: 'Pengiriman', food: 'Pesanan makanan' };
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export default function ActiveOrderBanner() {
    const { setActiveOrder } = useOrder();
    const [order, setOrder] = useState<OrderResponse | null>(null);

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            api.listOrders()
                .then((list) => {
                    if (!alive) return;
                    const active = list
                        .filter(
                            (o) =>
                                ACTIVE_STATUSES.includes(o.status) &&
                                Date.now() - new Date(o.created_at).getTime() < MAX_AGE_MS
                        )
                        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
                    setOrder(active ?? null);
                })
                .catch(() => alive && setOrder(null));
            return () => {
                alive = false;
            };
        }, [])
    );

    if (!order) return null;

    return (
        <Pressable style={s.wrap} onPress={() => openOrder(order, setActiveOrder)}>
            <View style={s.icon}>
                <Ionicons name="navigate" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={s.title}>{TYPE[order.type]} sedang berlangsung</Text>
                <Text style={s.sub} numberOfLines={1}>
                    {LABEL[order.status] ?? order.status}
                </Text>
            </View>
            <Text style={s.cta}>Lihat</Text>
        </Pressable>
    );
}

const s = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginHorizontal: 16,
        marginTop: 14,
        padding: 14,
        borderRadius: 18,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#2F86EB',
        shadowColor: '#2F86EB',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2F86EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { fontSize: 14, fontWeight: '800', color: '#1B1B1B' },
    sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    cta: { fontSize: 14, fontWeight: '800', color: '#2F86EB' },
});