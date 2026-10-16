// app/riwayat.tsx
import AppAlert from '@/components/AppAlert';
import LoadingModal from '@/components/LoadingModal';
import { api, TransactionItem } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    Easing,
    Pressable,
    RefreshControl,
    ScrollView,
    SectionList,
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================
// CONSTANTS
// ============================================================
const COLORS = {
    primary: '#40a3ea',
    primaryDark: '#2b8ed6',
    primarySoft: '#EAF5FD',
    text: '#111827',
    textMuted: '#6B7280',
    textLight: '#9CA3AF',
    border: '#E5E7EB',
    divider: '#F1F2F4',
    bg: '#F3F4F6',
    card: '#FFFFFF',
    success: '#16A34A',
    successSoft: '#E8F7EE',
    danger: '#DC2626',
    dangerSoft: '#FDEAEA',
    warning: '#D97706',
    warningSoft: '#FEF3C7',
    purple: '#8B5CF6',
    purpleSoft: '#F3E8FF',
    skeleton: '#E5E7EB',
};

const LIMIT = 20;

const MONTHS_LONG = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

type Tab = 'all' | 'topup' | 'withdraw';

const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'topup', label: 'Topup' },
    { key: 'withdraw', label: 'Tarik Saldo' },
];

type Section = { title: string; data: TransactionItem[] };

type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

// ============================================================
// HELPERS
// ============================================================
function formatRp(n: number) {
    return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;

    const now = new Date();
    const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (isToday) return `Hari ini • ${time}`;

    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} • ${time}`;
}

function getMonthTitle(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Lainnya';
    return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function getTransactionMeta(type: string): {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
    label: string;
    isIncoming: boolean;
} {
    switch (type) {
        case 'topup':
            return {
                icon: 'add-circle',
                color: COLORS.success,
                bg: COLORS.successSoft,
                label: 'Topup Saldo',
                isIncoming: true,
            };
        case 'withdraw':
        case 'payout':
            return {
                icon: 'arrow-up-circle',
                color: COLORS.danger,
                bg: COLORS.dangerSoft,
                label: 'Tarik Saldo',
                isIncoming: false,
            };
        case 'order_payment':
            return {
                icon: 'bag-check',
                color: COLORS.primary,
                bg: COLORS.primarySoft,
                label: 'Pembayaran Order',
                isIncoming: false,
            };
        case 'earning_cash':
        case 'earning_gateway':
            return {
                icon: 'cash',
                color: COLORS.success,
                bg: COLORS.successSoft,
                label: 'Pendapatan',
                isIncoming: true,
            };
        case 'commission_cash':
        case 'commission_gateway':
            return {
                icon: 'receipt',
                color: COLORS.warning,
                bg: COLORS.warningSoft,
                label: 'Komisi',
                isIncoming: false,
            };
        case 'refund':
            return {
                icon: 'refresh-circle',
                color: COLORS.warning,
                bg: COLORS.warningSoft,
                label: 'Refund',
                isIncoming: true,
            };
        case 'debt_payment':
            return {
                icon: 'card',
                color: COLORS.purple,
                bg: COLORS.purpleSoft,
                label: 'Bayar Utang',
                isIncoming: false,
            };
        case 'adjustment':
            return {
                icon: 'build',
                color: COLORS.textMuted,
                bg: COLORS.divider,
                label: 'Penyesuaian',
                isIncoming: true,
            };
        default:
            return {
                icon: 'cash-outline',
                color: COLORS.textMuted,
                bg: COLORS.divider,
                label: 'Transaksi',
                isIncoming: true,
            };
    }
}

type StatusKind = 'success' | 'pending' | 'failed' | 'other';

function getStatusMeta(status: string): {
    kind: StatusKind;
    text: string;
    color: string;
    bg: string;
} {
    const s = status?.toUpperCase();
    if (s === 'SUCCESS' || s === 'SETTLED' || s === 'PAID') {
        return { kind: 'success', text: 'Berhasil', color: COLORS.success, bg: COLORS.successSoft };
    }
    if (s === 'PENDING' || s === 'INQUIRY' || s === 'PROCESSING') {
        return { kind: 'pending', text: 'Diproses', color: COLORS.warning, bg: COLORS.warningSoft };
    }
    if (s === 'FAILED' || s === 'EXPIRED' || s === 'REJECTED') {
        return { kind: 'failed', text: 'Gagal', color: COLORS.danger, bg: COLORS.dangerSoft };
    }
    return { kind: 'other', text: status ?? '-', color: COLORS.textMuted, bg: COLORS.divider };
}

// ============================================================
// SHIMMER / SKELETON
// ============================================================
function ShimmerBlock({
    progress,
    style,
}: {
    progress: Animated.Value;
    style?: StyleProp<ViewStyle>;
}) {
    const [w, setW] = useState(0);

    const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-w, w],
    });

    return (
        <View
            style={[sk.base, style]}
            onLayout={(e) => setW(e.nativeEvent.layout.width)}
        >
            {w > 0 && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        sk.shine,
                        { width: w * 0.6, transform: [{ translateX }] },
                    ]}
                />
            )}
        </View>
    );
}

function SkeletonRows({
    count = 6,
    withHeader = false,
}: {
    count?: number;
    withHeader?: boolean;
}) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(progress, {
                toValue: 1,
                duration: 1200,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [progress]);

    return (
        <View style={{ backgroundColor: COLORS.card }}>
            {withHeader && (
                <View style={s.sectionHeader}>
                    <ShimmerBlock
                        progress={progress}
                        style={{ width: 110, height: 12 }}
                    />
                </View>
            )}

            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={s.row}>
                    <ShimmerBlock
                        progress={progress}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            marginTop: 14,
                        }}
                    />
                    <View
                        style={[
                            s.rowBody,
                            i < count - 1 && s.rowBodyDivider,
                        ]}
                    >
                        <View style={s.rowInfo}>
                            <ShimmerBlock
                                progress={progress}
                                style={{ width: '55%', height: 14 }}
                            />
                            <ShimmerBlock
                                progress={progress}
                                style={{ width: '75%', height: 12, marginTop: 8 }}
                            />
                            <ShimmerBlock
                                progress={progress}
                                style={{ width: '40%', height: 11, marginTop: 8 }}
                            />
                        </View>
                        <ShimmerBlock
                            progress={progress}
                            style={{ width: 80, height: 16 }}
                        />
                    </View>
                </View>
            ))}
        </View>
    );
}

// ============================================================
// ROW COMPONENT
// ============================================================
function TransactionRow({
    item,
    isLast,
}: {
    item: TransactionItem;
    isLast: boolean;
}) {
    const meta = getTransactionMeta(item.type);
    const status = getStatusMeta(item.status);
    const amount = item.total_amount || item.amount;

    const failed = status.kind === 'failed';
    // Transaksi gagal tidak mengubah saldo, jadi nominal dibuat netral & dicoret
    const amountColor = failed
        ? COLORS.textLight
        : meta.isIncoming
            ? COLORS.success
            : COLORS.text;

    return (
        <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.icon} size={22} color={meta.color} />
            </View>

            <View style={[s.rowBody, !isLast && s.rowBodyDivider]}>
                <View style={s.rowInfo}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                        {meta.label}
                    </Text>
                    {!!item.description && (
                        <Text style={s.rowDesc} numberOfLines={1}>
                            {item.description}
                        </Text>
                    )}
                    <Text style={s.rowDate}>{formatDate(item.created_at)}</Text>
                </View>

                <View style={s.rowRight}>
                    <Text
                        style={[
                            s.amount,
                            { color: amountColor },
                            failed && s.amountStrike,
                        ]}
                        numberOfLines={1}
                    >
                        {meta.isIncoming ? '+' : '-'}
                        {formatRp(amount)}
                    </Text>

                    {status.kind !== 'success' && (
                        <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
                            <Text style={[s.statusText, { color: status.color }]}>
                                {status.text}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

// ============================================================
// EMPTY STATE
// ============================================================
function EmptyState({
    tab,
    failed,
    onRetry,
}: {
    tab: Tab;
    failed: boolean;
    onRetry: () => void;
}) {
    if (failed) {
        return (
            <View style={s.emptyWrap}>
                <View style={s.emptyIconCircle}>
                    <Ionicons name="cloud-offline-outline" size={44} color={COLORS.primary} />
                </View>
                <Text style={s.emptyTitle}>Gagal memuat transaksi</Text>
                <Text style={s.emptyDesc}>
                    Periksa koneksi internetmu, lalu coba lagi.
                </Text>
                <Pressable style={s.retryBtn} onPress={onRetry}>
                    <Text style={s.retryBtnText}>Muat Ulang</Text>
                </Pressable>
            </View>
        );
    }

    const message =
        tab === 'topup'
            ? 'Belum ada riwayat topup'
            : tab === 'withdraw'
                ? 'Belum ada riwayat penarikan'
                : 'Belum ada transaksi';

    return (
        <View style={s.emptyWrap}>
            <View style={s.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={s.emptyTitle}>{message}</Text>
            <Text style={s.emptyDesc}>
                Semua transaksi saldo kamu akan muncul di sini.
            </Text>
        </View>
    );
}

// ============================================================
// SCREEN
// ============================================================
export default function RiwayatScreen() {
    const insets = useSafeAreaInsets();

    const [tab, setTab] = useState<Tab>('all');
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [retrying, setRetrying] = useState(false); // dipakai LoadingModal
    const [failed, setFailed] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // ref supaya tidak kena stale closure & mencegah response lama menimpa data baru
    const offsetRef = useRef(0);
    const requestRef = useRef(0);
    const loadingMoreRef = useRef(false);

    // ------------------------------------------------------------
    // AppAlert
    // ------------------------------------------------------------
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

    const showAlert = useCallback(
        (title: string, message: string, buttons?: AlertButton[]) => {
            setAlertState({ visible: true, title, message, buttons });
        },
        []
    );

    const hideAlert = useCallback(() => {
        setAlertState((a) => ({ ...a, visible: false }));
    }, []);

    // supaya tombol "Coba Lagi" di alert bisa memanggil load() tanpa circular dependency
    const loadRef = useRef<
        (reset: boolean, tab: Tab, blocking?: boolean) => Promise<void>
    >(async () => { });

    // ------------------------------------------------------------
    // Load data
    // ------------------------------------------------------------
    const load = useCallback(
        async (reset: boolean, currentTab: Tab, blocking = false) => {
            const reqId = ++requestRef.current;
            const nextOffset = reset ? 0 : offsetRef.current;

            if (blocking) setRetrying(true);
            if (reset) setFailed(false);

            try {
                let res: { items: TransactionItem[] };

                if (currentTab === 'topup') {
                    const r = await api.wallet.topups(LIMIT, nextOffset);
                    res = {
                        items: r.items.map((t) => ({
                            id: `topup-${t.id}`,
                            type: 'topup' as const,
                            amount: Number(t.nominal ?? t.amount),
                            total_amount: Number(t.amount),
                            admin_fee: Number(t.admin_fee ?? 0),
                            method: t.method ?? 'va',
                            status: t.status,
                            reference: t.partner_reff,
                            va_number: t.va_number,
                            qris_url: t.qris_url,
                            created_at: t.created_at,
                            description: `Topup via ${t.method?.toUpperCase() ?? 'LinkQu'}`,
                        })),
                    };
                } else if (currentTab === 'withdraw') {
                    const r = await api.wallet.withdrawals(LIMIT, nextOffset);
                    res = {
                        items: r.items.map((w) => ({
                            id: `withdraw-${w.id}`,
                            type: 'withdraw' as const,
                            amount: Number(w.amount),
                            total_amount: Number(w.amount) + Number(w.fee_admin ?? 0),
                            admin_fee: Number(w.fee_admin ?? 0),
                            method: 'va',
                            status: w.status,
                            reference: w.partner_reff,
                            bank_code: w.bank_code,
                            account_number: w.account_number,
                            created_at: w.created_at,
                            description: `Tarik ke ${w.bank_code} ${w.account_number}`,
                        })),
                    };
                } else {
                    const r = await api.wallet.transactions(LIMIT, nextOffset);
                    res = { items: r.items };
                }

                // abaikan response lama (mis. user sudah ganti tab)
                if (reqId !== requestRef.current) return;

                if (reset) {
                    setItems(res.items);
                    offsetRef.current = LIMIT;
                } else {
                    setItems((prev) => [...prev, ...res.items]);
                    offsetRef.current = nextOffset + LIMIT;
                }

                setHasMore(res.items.length === LIMIT);
            } catch (err: any) {
                if (reqId !== requestRef.current) return;
                console.error('[RIWAYAT] Load error:', err?.message);

                // hasMore=false supaya onEndReached tidak memanggil ulang & memunculkan alert berulang
                setHasMore(false);
                if (reset) setFailed(true);

                showAlert(
                    'Gagal memuat transaksi',
                    err?.message ?? 'Coba lagi beberapa saat.',
                    [
                        { text: 'Tutup', style: 'cancel' },
                        {
                            text: 'Coba Lagi',
                            onPress: () => {
                                if (!reset) {
                                    setHasMore(true);
                                    loadingMoreRef.current = true;
                                }
                                loadRef.current(reset, currentTab, true);
                            },
                        },
                    ]
                );
            } finally {
                if (blocking) setRetrying(false);
                if (reqId === requestRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                    loadingMoreRef.current = false;
                }
            }
        },
        [showAlert]
    );

    loadRef.current = load;

    // ------------------------------------------------------------
    // Load saat mount / ganti tab
    // ------------------------------------------------------------
    useEffect(() => {
        setLoading(true);
        setItems([]);
        setFailed(false);
        setHasMore(true);
        offsetRef.current = 0;
        load(true, tab);
    }, [tab, load]);

    const onRefresh = () => {
        setRefreshing(true);
        setHasMore(true);
        load(true, tab);
    };

    const onEndReached = () => {
        if (!hasMore || loadingMoreRef.current || loading || refreshing) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        load(false, tab);
    };

    // ------------------------------------------------------------
    // Kelompokkan per bulan (gaya Gojek/Grab)
    // ------------------------------------------------------------
    const sections = useMemo<Section[]>(() => {
        const map = new Map<string, TransactionItem[]>();
        for (const it of items) {
            const key = getMonthTitle(it.created_at);
            const arr = map.get(key);
            if (arr) arr.push(it);
            else map.set(key, [it]);
        }
        return Array.from(map, ([title, data]) => ({ title, data }));
    }, [items]);

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* ============ HEADER ============ */}
            <View style={s.header}>
                <Pressable
                    onPress={() => router.back()}
                    style={s.backBtn}
                    hitSlop={10}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </Pressable>
                <Text style={s.headerTitle}>Riwayat</Text>
            </View>

            {/* ============ FILTER CHIPS ============ */}
            <View style={s.chipsWrap}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.chipsContent}
                >
                    {TABS.map((t) => {
                        const active = tab === t.key;
                        return (
                            <Pressable
                                key={t.key}
                                onPress={() => setTab(t.key)}
                                style={[s.chip, active && s.chipActive]}
                            >
                                <Text style={[s.chipText, active && s.chipTextActive]}>
                                    {t.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ============ CONTENT ============ */}
            {loading ? (
                <View style={{ flex: 1 }} pointerEvents="none">
                    <SkeletonRows count={7} withHeader />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    stickySectionHeadersEnabled
                    renderSectionHeader={({ section }) => (
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionTitle}>{section.title}</Text>
                        </View>
                    )}
                    renderItem={({ item, index, section }) => (
                        <TransactionRow
                            item={item}
                            isLast={index === section.data.length - 1}
                        />
                    )}
                    contentContainerStyle={[
                        { paddingBottom: insets.bottom + 24 },
                        sections.length === 0 && { flexGrow: 1 },
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={COLORS.primary}
                            colors={[COLORS.primary]}
                        />
                    }
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.3}
                    ListEmptyComponent={
                        <EmptyState
                            tab={tab}
                            failed={failed}
                            onRetry={() => load(true, tab, true)}
                        />
                    }
                    ListFooterComponent={
                        loadingMore ? (
                            <SkeletonRows count={2} />
                        ) : !hasMore && items.length > 0 ? (
                            <View style={s.footerEnd}>
                                <Text style={s.footerEndText}>
                                    Semua transaksi sudah ditampilkan
                                </Text>
                            </View>
                        ) : null
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* ===== APP ALERT ===== */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={hideAlert}
            />

            {/* ===== LOADING MODAL (coba lagi / muat ulang) ===== */}
            <LoadingModal visible={retrying} />
        </View>
    );
}

// ============================================================
// STYLES
// ============================================================
const sk = StyleSheet.create({
    base: {
        backgroundColor: COLORS.skeleton,
        borderRadius: 6,
        overflow: 'hidden',
    },
    shine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
});

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.card },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 56,
        backgroundColor: COLORS.card,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.text,
    },

    // Filter chips
    chipsWrap: {
        backgroundColor: COLORS.card,
        paddingBottom: 12,
    },
    chipsContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    chipActive: {
        backgroundColor: COLORS.primarySoft,
        borderColor: COLORS.primary,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textMuted,
    },
    chipTextActive: {
        color: COLORS.primaryDark,
    },

    // Section header (per bulan)
    sectionHeader: {
        backgroundColor: COLORS.bg,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.textMuted,
    },

    // Row
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingLeft: 16,
        backgroundColor: COLORS.card,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14,
    },
    rowBody: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginLeft: 12,
        paddingRight: 16,
        paddingVertical: 14,
    },
    rowBodyDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    rowInfo: {
        flex: 1,
        minWidth: 0,
        paddingRight: 8,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
    },
    rowDesc: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    rowDate: {
        fontSize: 12,
        color: COLORS.textLight,
        marginTop: 4,
    },
    rowRight: {
        alignItems: 'flex-end',
        maxWidth: 140,
    },
    amount: {
        fontSize: 15,
        fontWeight: '800',
    },
    amountStrike: {
        textDecorationLine: 'line-through',
    },
    statusBadge: {
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
    },

    // Empty
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 32,
        gap: 10,
        backgroundColor: COLORS.card,
    },
    emptyIconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: COLORS.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
    },
    emptyDesc: {
        fontSize: 13,
        color: COLORS.textMuted,
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
    },
    retryBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },

    // Footer
    footerEnd: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    footerEndText: {
        fontSize: 12,
        color: COLORS.textLight,
    },
});