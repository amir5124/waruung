import AppAlert from '@/components/AppAlert';
import LoadingModal from '@/components/LoadingModal';
import { colors } from '@/constants/ojek-theme';
import { api, OrderResponse } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

type TabKey = 'history' | 'active';
type TypeFilter = 'ride' | 'send' | null;
type Status = OrderResponse['status'];

type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

// ============================================================
// Gambar layanan
// ============================================================
const IMG_MOTOR = require('@/assets/images/motor.png');
const IMG_MOBIL = require('@/assets/images/mobil.png');

// Order mobil dikenali dari tariff_code / option_name (sesuaikan kalau perlu)
const isCarOrder = (o: OrderResponse) => {
    const raw = o as any;
    const key = `${raw.tariff_code ?? ''} ${raw.option_name ?? ''}`.toLowerCase();
    return key.includes('car') || key.includes('mobil');
};

const getOrderImage = (o: OrderResponse) =>
    isCarOrder(o) ? IMG_MOBIL : IMG_MOTOR; // ojek & kurir = motor

// ============================================================
// Konfigurasi
// ============================================================
const TYPE_LABEL: Record<OrderResponse['type'], string> = {
    ride: 'Perjalanan',
    send: 'Pengiriman',
    food: 'Pesanan makanan',
};

const STATUS_META: Record<Status, { label: string; color: string }> = {
    pending: { label: 'Menunggu', color: '#f5a623' },
    accepted: { label: 'Diterima', color: '#40a3ea' },
    arrived: { label: 'Di lokasi', color: '#1AAD5B' },
    in_progress: { label: 'Dalam perjalanan', color: '#1AAD5B' },
    completed: { label: 'Selesai', color: '#1AAD5B' },
    cancelled: { label: 'Dibatalkan', color: '#e5484d' },
};

const HISTORY_STATUSES: Status[] = ['completed', 'cancelled'];
const ACTIVE_STATUSES: Status[] = [
    'pending',
    'accepted',
    'arrived',
    'in_progress',
];

const TABS: { key: TabKey; label: string }[] = [
    { key: 'history', label: 'Riwayat' },
    { key: 'active', label: 'Dalam proses' },
];

// ============================================================
// Helper
// ============================================================
const formatRupiah = (n: number) =>
    'Rp' + Math.round(n || 0).toLocaleString('id-ID');

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

// Contoh: "21 Sep, 23:26"
const formatDate = (iso: string) => {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hh}:${mm}`;
};

const shortAddress = (name?: string | null) => {
    if (!name) return '—';
    return name.split(',')[0].trim();
};

// ============================================================
// SCREEN
// ============================================================
export default function PesananScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [orders, setOrders] = useState<OrderResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [tab, setTab] = useState<TabKey>('history');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>(null);
    const [statusFilter, setStatusFilter] = useState<Status | null>(null);
    const [statusOpen, setStatusOpen] = useState(false);

    // AppAlert
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons?: AlertButton[];
    }>({
        visible: false,
        title: '',
        message: '',
        buttons: undefined,
    });

    const hideAlert = () => {
        setAlertState((a) => ({ ...a, visible: false }));
    };

    // ============================================================
    // Load orders
    // ============================================================
    const loadOrders = useCallback(async () => {
        try {
            const list = await api.listOrders();
            setOrders(list);
        } catch (err: any) {
            console.warn('[PESANAN] Gagal load:', err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadOrders();
        }, [loadOrders])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadOrders();
    };

    // ============================================================
    // Filter
    // ============================================================
    const tabStatuses = tab === 'history' ? HISTORY_STATUSES : ACTIVE_STATUSES;

    const filtered = useMemo(() => {
        return orders
            .filter((o) => tabStatuses.includes(o.status))
            .filter((o) => (typeFilter ? o.type === typeFilter : true))
            .filter((o) => (statusFilter ? o.status === statusFilter : true))
            .sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
            );
    }, [orders, tabStatuses, typeFilter, statusFilter]);

    const changeTab = (key: TabKey) => {
        setTab(key);
        setStatusFilter(null);
        setStatusOpen(false);
    };

    const toggleType = (t: 'ride' | 'send') =>
        setTypeFilter((cur) => (cur === t ? null : t));

    // ============================================================
    // Klik order -> halaman detail
    // ============================================================
    const handlePressOrder = (order: OrderResponse) => {
        router.push({
            pathname: '/pesanan-detail',
            params: { order: JSON.stringify(order) },
        });
    };

    // ============================================================
    // Render card
    // ============================================================
    const renderOrder = (order: OrderResponse) => {
        const isCancelled = order.status === 'cancelled';
        const isDone = order.status === 'completed';
        const dim = isCancelled || isDone;

        const title =
            order.type === 'send'
                ? 'Kiriman buatmu'
                : shortAddress(order.dropoff_name);

        const address =
            order.type === 'send'
                ? (order as any).dropoff_address || order.dropoff_name
                : null;

        // Teks status: "Perjalanan dibatalkan", "Pengiriman selesai", dst
        const statusText = `${TYPE_LABEL[order.type]} ${STATUS_META[
            order.status
        ].label.toLowerCase()}`;

        const statusColor = STATUS_META[order.status].color;
        const statusIcon = isCancelled
            ? 'alert-circle'
            : isDone
                ? 'checkmark-circle'
                : 'time';

        return (
            <Pressable
                key={order.id}
                style={({ pressed }) => [
                    s.card,
                    !isCancelled && s.cardActive, // shadow biru kecuali dibatalkan
                    pressed && { opacity: 0.9 },
                ]}
                onPress={() => handlePressOrder(order)}
            >
                <Text style={s.cardDate}>{formatDate(order.created_at)}</Text>

                <View style={s.cardBody}>
                    <View
                        style={[s.imgBox, !isCancelled && s.imgBoxActive]}
                    >
                        <Image
                            source={getOrderImage(order)}
                            style={[s.img, isCancelled && { opacity: 0.55 }]}
                        />
                    </View>

                    <View style={{ flex: 1 }}>
                        <View style={s.titleRow}>
                            <Text
                                style={[s.cardTitle, dim && s.cardTitleDim]}
                                numberOfLines={1}
                            >
                                {title}
                            </Text>
                            <Text style={s.fare}>
                                {isCancelled
                                    ? 'Rp0'
                                    : formatRupiah(order.total_fare)}
                            </Text>
                        </View>

                        {!!address && (
                            <Text style={s.cardAddress} numberOfLines={1}>
                                {address}
                            </Text>
                        )}

                        <View style={s.statusRow}>
                            <Ionicons
                                name={statusIcon as any}
                                size={20}
                                color={statusColor}
                            />
                            <Text style={s.statusText} numberOfLines={1}>
                                {statusText}
                            </Text>
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    };

    // ============================================================
    // Render
    // ============================================================
    return (
        <SafeAreaView style={s.container} edges={['top']}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.headerTitle}>Pesanan</Text>
            </View>

            {/* Tabs */}
            <View style={s.tabsRow}>
                {TABS.map((t) => {
                    const active = tab === t.key;
                    return (
                        <Pressable
                            key={t.key}
                            onPress={() => changeTab(t.key)}
                            style={[s.tab, active && s.tabActive]}
                        >
                            <Text
                                style={[s.tabText, active && s.tabTextActive]}
                            >
                                {t.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <ScrollView
                contentContainerStyle={[
                    s.scrollContent,
                    { paddingBottom: insets.bottom + 100 },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Filter chips */}
                <View style={s.chipsRow}>
                    <Pressable
                        onPress={() => toggleType('ride')}
                        style={[s.chip, typeFilter === 'ride' && s.chipActive]}
                    >
                        <Text
                            style={[
                                s.chipText,
                                typeFilter === 'ride' && s.chipTextActive,
                            ]}
                        >
                            WarJek
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => toggleType('send')}
                        style={[s.chip, typeFilter === 'send' && s.chipActive]}
                    >
                        <Text
                            style={[
                                s.chipText,
                                typeFilter === 'send' && s.chipTextActive,
                            ]}
                        >
                            WarSend
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setStatusOpen((v) => !v)}
                        style={[s.chip, !!statusFilter && s.chipActive]}
                    >
                        <Text
                            style={[
                                s.chipText,
                                !!statusFilter && s.chipTextActive,
                            ]}
                        >
                            {statusFilter
                                ? STATUS_META[statusFilter].label
                                : 'Status'}
                        </Text>
                        <Ionicons
                            name={statusOpen ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={statusFilter ? colors.primary : '#1f2933'}
                        />
                    </Pressable>
                </View>

                {/* Dropdown status */}
                {statusOpen && (
                    <View style={s.dropdown}>
                        <Pressable
                            style={s.dropdownItem}
                            onPress={() => {
                                setStatusFilter(null);
                                setStatusOpen(false);
                            }}
                        >
                            <Text style={s.dropdownText}>Semua status</Text>
                            {!statusFilter && (
                                <Ionicons
                                    name="checkmark"
                                    size={18}
                                    color={colors.primary}
                                />
                            )}
                        </Pressable>
                        {tabStatuses.map((st) => (
                            <Pressable
                                key={st}
                                style={s.dropdownItem}
                                onPress={() => {
                                    setStatusFilter(st);
                                    setStatusOpen(false);
                                }}
                            >
                                <Text style={s.dropdownText}>
                                    {STATUS_META[st].label}
                                </Text>
                                {statusFilter === st && (
                                    <Ionicons
                                        name="checkmark"
                                        size={18}
                                        color={colors.primary}
                                    />
                                )}
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* List */}
                {!loading && filtered.length === 0 ? (
                    <View style={s.emptyWrap}>
                        <View style={s.emptyIcon}>
                            <Ionicons
                                name="receipt-outline"
                                size={40}
                                color={colors.textMuted}
                            />
                        </View>
                        <Text style={s.emptyTitle}>Belum ada aktivitas</Text>
                        <Text style={s.emptyDesc}>
                            {tab === 'history'
                                ? 'Riwayat pesanan kamu akan muncul di sini.'
                                : 'Pesanan yang sedang berjalan akan muncul di sini.'}
                        </Text>
                    </View>
                ) : (
                    filtered.map(renderOrder)
                )}
            </ScrollView>

            {/* AppAlert */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={hideAlert}
            />

            {/* LoadingModal */}
            <LoadingModal visible={loading} />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    // ===== Header =====
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#d9dce1',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1f2933',
    },

    // ===== Tabs =====
    tabsRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 24,
    },
    tab: {
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.primary },
    tabText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#9aa1ac',
    },
    tabTextActive: { color: '#1f2933' },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },

    // ===== Chips =====
    chipsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e1e4e8',
    },
    chipActive: {
        borderColor: colors.primary,
        backgroundColor: '#EAF4FD',
    },
    chipText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1f2933',
    },
    chipTextActive: { color: colors.primary },

    // ===== Dropdown status =====
    dropdown: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e1e4e8',
        marginBottom: 16,
        overflow: 'hidden',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eceef1',
    },
    dropdownText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2933',
    },

    // ===== Card =====
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#eef0f3',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    // Card aktif (bukan dibatalkan): border + shadow biru
    cardActive: {
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOpacity: 0.6,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 18,
    },
    cardDate: {
        fontSize: 14,
        fontWeight: '800',
        color: '#4b5563',
        marginBottom: 12,
    },
    cardBody: {
        flexDirection: 'row',
        gap: 14,
    },
    imgBox: {
        width: 80,
        height: 80,
        borderRadius: 18,
        backgroundColor: '#e3e5e8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Pembungkus icon untuk pesanan yang tidak dibatalkan
    imgBoxActive: { backgroundColor: '#e68515' },
    img: {
        width: 56,
        height: 56,
        resizeMode: 'contain',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
    },
    cardTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '800',
        color: '#1f2933',
    },
    cardTitleDim: { color: '#8a8f98' },
    fare: {
        fontSize: 15,
        fontWeight: '600',
        color: '#8a8f98',
    },
    cardAddress: {
        fontSize: 13,
        color: '#8a8f98',
        marginTop: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    statusText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#4b5563',
    },

    // ===== Empty =====
    emptyWrap: {
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EDEEF0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1f2933',
        marginBottom: 6,
    },
    emptyDesc: {
        fontSize: 13,
        color: '#8a94a6',
        textAlign: 'center',
        lineHeight: 20,
    },
});