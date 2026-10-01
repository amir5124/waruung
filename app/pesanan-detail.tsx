import { colors } from '@/constants/ojek-theme';
import { OrderResponse } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

const ORANGE = '#e68515';
const WA_NUMBER = '62812285777';

const TYPE_LABEL: Record<OrderResponse['type'], string> = {
    ride: 'WarJek',
    send: 'WarSend',
    food: 'WarFood',
};

const STATUS_LABEL: Record<OrderResponse['status'], string> = {
    pending: 'Menunggu driver',
    accepted: 'Pesanan diterima',
    arrived: 'Driver di lokasi',
    in_progress: 'Dalam perjalanan',
    completed: 'Pesanan selesai',
    cancelled: 'Pesanan dibatalkan',
};

// Order mobil dikenali dari tariff_code / option_name (sama seperti di daftar pesanan)
const isCarOrder = (o: OrderResponse) => {
    const raw = o as any;
    const key = `${raw.tariff_code ?? ''} ${raw.option_name ?? ''}`.toLowerCase();
    return key.includes('car') || key.includes('mobil');
};

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const formatDate = (iso: string) => {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hh}:${mm}`;
};

const formatRupiah = (n: number) =>
    'Rp' + Math.round(n || 0).toLocaleString('id-ID');

const shortAddress = (name?: string | null) => {
    if (!name) return '—';
    return name.split(',')[0].trim();
};

export default function PesananDetailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { order: orderParam } = useLocalSearchParams<{ order: string }>();

    const order = useMemo(() => {
        try {
            return JSON.parse(orderParam as string) as OrderResponse;
        } catch {
            return null;
        }
    }, [orderParam]);

    if (!order) {
        return (
            <SafeAreaView style={s.container}>
                <Text style={{ padding: 20 }}>Data pesanan tidak ditemukan.</Text>
            </SafeAreaView>
        );
    }

    // Field di bawah ini disesuaikan dengan response API kamu (fallback aman)
    const raw = order as any;
    const isCancelled = order.status === 'cancelled';
    const isSend = order.type === 'send';
    const brandName =
        order.type === 'ride' && isCarOrder(order)
            ? 'WarCar'
            : TYPE_LABEL[order.type];

    // --- Pengiriman (paket): tampilkan pengirim & penerima ---
    // --- Ojek (ride): tampilkan titik jemput & tujuan saja ---
    const pickupTitle = isSend
        ? raw.pickup_contact_name || raw.sender_name || 'Pengirim'
        : shortAddress(order.pickup_name);
    const pickupPhone = isSend ? raw.pickup_phone || raw.sender_phone || '' : '';
    const pickupAddress = raw.pickup_address || order.pickup_name || '—';

    const dropTitle = isSend
        ? raw.dropoff_contact_name || raw.receiver_name || 'Penerima'
        : shortAddress(order.dropoff_name);
    const dropPhone = isSend ? raw.dropoff_phone || raw.receiver_phone || '' : '';
    const dropAddress = raw.dropoff_address || order.dropoff_name || '—';

    const itemType = raw.item_type || 'Dokumen';
    const itemSize = raw.item_size || 'Kecil (1 - 5 kg)';

    const openWhatsApp = async () => {
        const text =
            `Halo, saya butuh bantuan untuk pesanan ${brandName} ` +
            `dengan kode transaksi ${order.order_code}.`;
        const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
        try {
            await Linking.openURL(url);
        } catch (err: any) {
            console.warn('[PESANAN] Gagal buka WhatsApp:', err?.message);
        }
    };

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            {/* Header */}
            <View style={s.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="arrow-back" size={26} color="#1f2933" />
                </Pressable>
                <Text style={s.headerTitle}>Rangkuman transaksi</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
            >
                {/* Info layanan */}
                <View style={s.section}>
                    <View style={s.rowBetween}>
                        <Text style={s.brand}>{brandName}</Text>
                        <Text style={s.date}>{formatDate(order.created_at)}</Text>
                    </View>
                    <View style={[s.rowBetween, { marginTop: 8 }]}>
                        <Text style={s.statusTitle}>
                            {STATUS_LABEL[order.status]}
                        </Text>
                        <Text style={s.code} numberOfLines={1}>
                            Transaksi {order.order_code}
                        </Text>
                    </View>
                </View>

                <View style={s.divider} />

                {/* Rute */}
                <View style={s.routeWrap}>
                    {/* Garis putus-putus penghubung */}
                    <View style={s.dotted} />

                    {/* Titik atas: jemput / pengirim */}
                    <View style={s.routeRow}>
                        <View style={[s.pin, { backgroundColor: colors.primary }]}>
                            <Ionicons name="arrow-up" size={16} color="#fff" />
                        </View>
                        <View style={s.addrCard}>
                            {!isSend && <Text style={s.caption}>Titik jemput</Text>}
                            <Text style={s.personName} numberOfLines={2}>
                                {pickupTitle}
                            </Text>
                            {!!pickupPhone && (
                                <Text style={s.phone}>{pickupPhone}</Text>
                            )}
                            <Text style={s.address} numberOfLines={2}>
                                {pickupAddress}
                            </Text>
                        </View>
                    </View>

                    {/* Titik bawah: tujuan / penerima */}
                    <View style={[s.routeRow, { marginTop: 16 }]}>
                        <View style={[s.pin, { backgroundColor: ORANGE }]}>
                            <Ionicons name="arrow-down" size={16} color="#fff" />
                        </View>
                        <View style={s.addrCard}>
                            {!isSend && <Text style={s.caption}>Tujuan</Text>}
                            <Text style={s.personName} numberOfLines={2}>
                                {dropTitle}
                            </Text>
                            {isCancelled && (
                                <View style={s.badge}>
                                    <Text style={s.badgeText}>Dibatalkan</Text>
                                </View>
                            )}
                            {!!dropPhone && <Text style={s.phone}>{dropPhone}</Text>}
                            <Text style={s.address} numberOfLines={2}>
                                {dropAddress}
                            </Text>

                            {/* Info paket: hanya untuk pengiriman */}
                            {isSend && (
                                <>
                                    <View style={s.dashed} />
                                    <View style={s.metaRow}>
                                        <Ionicons
                                            name="archive"
                                            size={15}
                                            color="#4b5563"
                                        />
                                        <Text style={s.metaText} numberOfLines={1}>
                                            {itemType}
                                        </Text>
                                        <View style={s.dot} />
                                        <Ionicons
                                            name="shield-checkmark"
                                            size={15}
                                            color="#4b5563"
                                        />
                                        <Text
                                            style={[s.metaText, { flexShrink: 1 }]}
                                            numberOfLines={1}
                                        >
                                            Perlindungan Silver
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                <View style={s.divider} />

                {/* Ukuran & berat (hanya pengiriman) */}
                {isSend && (
                    <View style={s.infoCard}>
                        <View style={s.infoLeft}>
                            <Ionicons name="scale" size={22} color={colors.primary} />
                            <Text style={s.infoLabel}>Ukuran & berat</Text>
                        </View>
                        <Text style={s.infoValue}>{itemSize}</Text>
                    </View>
                )}

                {/* Total */}
                <View style={s.infoCard}>
                    <View style={s.infoLeft}>
                        <Ionicons name="wallet" size={22} color={colors.primary} />
                        <Text style={s.infoLabel}>Total</Text>
                    </View>
                    <Text style={s.infoValue}>
                        {isCancelled ? 'Rp0' : formatRupiah(order.total_fare)}
                    </Text>
                </View>
            </ScrollView>

            {/* Tombol Bantuan */}
            <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
                <Pressable
                    style={({ pressed }) => [s.helpBtn, pressed && { opacity: 0.8 }]}
                    onPress={openWhatsApp}
                >
                    <Text style={s.helpText}>Bantuan</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 20,
        paddingVertical: 18,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1f2933' },

    section: { paddingHorizontal: 20, paddingVertical: 14 },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    brand: { fontSize: 24, fontWeight: '800', color: colors.primary },
    date: { fontSize: 15, color: '#6b7280' },
    statusTitle: { fontSize: 16, fontWeight: '800', color: '#1f2933' },
    code: { fontSize: 13, color: '#6b7280', flexShrink: 1 },

    divider: { height: 1, backgroundColor: '#e5e7eb' },

    routeWrap: { padding: 20, position: 'relative' },
    dotted: {
        position: 'absolute',
        left: 34,
        top: 54,
        bottom: 80,
        borderLeftWidth: 2,
        borderLeftColor: '#c9cdd3',
        borderStyle: 'dotted',
    },
    routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    pin: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },

    addrCard: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e1e4e8',
        borderRadius: 18,
        padding: 16,
        backgroundColor: '#fff',
    },
    caption: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8a8f98',
        marginBottom: 4,
    },
    personName: { fontSize: 18, fontWeight: '800', color: '#1f2933' },
    phone: { fontSize: 18, fontWeight: '800', color: '#1f2933', marginTop: 10 },
    address: { fontSize: 14, color: '#6b7280', marginTop: 8 },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: '#c2510a',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginTop: 8,
    },
    badgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },

    dashed: {
        borderTopWidth: 1,
        borderTopColor: '#d5d8dd',
        borderStyle: 'dashed',
        marginTop: 16,
        marginBottom: 12,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#c9cdd3',
        marginHorizontal: 4,
    },

    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 20,
        marginTop: 16,
        padding: 18,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e1e4e8',
    },
    infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    infoLabel: { fontSize: 16, fontWeight: '700', color: '#1f2933' },
    infoValue: { fontSize: 16, fontWeight: '800', color: '#1f2933' },

    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -3 },
        elevation: 12,
    },
    helpBtn: {
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    helpText: { fontSize: 18, fontWeight: '800', color: colors.primary },
});