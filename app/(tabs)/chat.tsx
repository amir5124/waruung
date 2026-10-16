// app/(tabs)/chat.tsx
import AppAlert from '@/components/AppAlert';
import Avatar from '@/components/Avatar';
import LoadingModal from '@/components/LoadingModal';
import {
    api,
    type ChatRoomListItem,
    type OrderResponse,
} from '@/lib/api';
import {
    Ionicons,
    MaterialCommunityIcons,
} from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    Easing,
    Linking,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ============================================================
// CONSTANTS
// ============================================================
const GREEN = '#40a3ea';
const ORANGE = '#F36C00';
const TEXT = '#222222';
const GRAY = '#777777';
const BORDER = '#E5E5E5';
const SKELETON = '#E5E7EB';

const MAX_RECENT = 5;
const ALL_CHATS_ROUTE = '/pesan';
const WHATSAPP_PHONE = '62812285777';

// ============================================================
// TYPES
// ============================================================
type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

// ============================================================
// HELPERS
// ============================================================
const pad = (n: number) => String(n).padStart(2, '0');

const formatChatTime = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const startOfDay = (x: Date) =>
        new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dayDiff = Math.round(
        (startOfDay(now) - startOfDay(d)) / 86400000
    );

    if (dayDiff <= 0) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (dayDiff === 1) return 'Kemarin';
    if (dayDiff < 7) {
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        return days[d.getDay()];
    }
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(
        d.getFullYear()
    ).slice(-2)}`;
};

const previewMessage = (room: ChatRoomListItem): string => {
    if (room.last_message_type === 'image') return '📷 Foto';
    if (room.last_message_type === 'location') return '📍 Lokasi';
    return room.last_message || 'Belum ada pesan';
};

const timeOf = (iso: string | null) => {
    const t = iso ? new Date(iso).getTime() : 0;
    return isNaN(t) ? 0 : t;
};

const goToRoom = (
    roomId: number,
    peerName: string,
    peerAvatar?: string | null
) => {
    const qs = new URLSearchParams({ peerName });
    if (peerAvatar) qs.set('peerAvatar', peerAvatar);
    router.push(`/chat/${roomId}?${qs.toString()}` as any);
};

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
                        {
                            width: w * 0.6,
                            transform: [{ translateX }],
                        },
                    ]}
                />
            )}
        </View>
    );
}

function SkeletonChatRows({ count = 4 }: { count?: number }) {
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
        <View pointerEvents="none">
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={s.chatItem}>
                    <ShimmerBlock
                        progress={progress}
                        style={{ width: 58, height: 58, borderRadius: 29 }}
                    />
                    <View style={s.chatInfo}>
                        <View style={s.chatTop}>
                            <ShimmerBlock
                                progress={progress}
                                style={{ width: '45%', height: 16 }}
                            />
                            <ShimmerBlock
                                progress={progress}
                                style={{ width: 48, height: 12 }}
                            />
                        </View>
                        <ShimmerBlock
                            progress={progress}
                            style={{
                                width: '70%',
                                height: 12,
                                marginTop: 10,
                            }}
                        />
                    </View>
                </View>
            ))}
        </View>
    );
}

// ============================================================
// SCREEN
// ============================================================
export default function ChatScreen() {
    // ---------- Daftar chat ----------
    const [rooms, setRooms] = useState<ChatRoomListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [failed, setFailed] = useState(false);
    const hasLoadedRef = useRef(false);

    // ---------- FAB: pemilih order ----------
    const [pickerVisible, setPickerVisible] = useState(false);
    const [orders, setOrders] = useState<OrderResponse[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [opening, setOpening] = useState(false);

    // ---------- AppAlert ----------
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

    const showAlert = (
        title: string,
        message: string,
        buttons?: AlertButton[]
    ) => {
        setAlertState({ visible: true, title, message, buttons });
    };

    const hideAlert = () =>
        setAlertState((a) => ({ ...a, visible: false }));

    // ============================================================
    // LOAD CHAT ROOMS
    // ============================================================
    const loadRooms = useCallback(
        async (silent = false) => {
            try {
                const data = await api.chat.listRooms();
                const sorted = [...data].sort(
                    (a, b) =>
                        timeOf(b.last_message_at) -
                        timeOf(a.last_message_at)
                );
                setRooms(sorted);
                setFailed(false);
                hasLoadedRef.current = true;
            } catch (err: any) {
                console.warn(
                    '[CHAT] Gagal load rooms:',
                    err?.message
                );

                // Kalau belum pernah load sukses → tampil layar error
                if (!hasLoadedRef.current) {
                    setFailed(true);
                    setLoading(false);
                    return;
                }

                // Kalau sudah pernah load → alert dengan tombol Retry
                if (!silent) {
                    showAlert(
                        'Gagal Memuat Chat',
                        'Koneksi internetmu mungkin bermasalah. Coba lagi ya.',
                        [
                            { text: 'Nanti', style: 'cancel' },
                            {
                                text: 'Coba Lagi',
                                onPress: () => loadRooms(false),
                            },
                        ]
                    );
                }
            } finally {
                hasLoadedRef.current = true;
                setLoading(false);
                setRefreshing(false);
            }
        },
        []
    );

    useFocusEffect(
        useCallback(() => {
            loadRooms(hasLoadedRef.current);
        }, [loadRooms])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadRooms(false);
    };

    const retry = () => {
        setLoading(true);
        setFailed(false);
        loadRooms(false);
    };

    // ============================================================
    // ACTIONS
    // ============================================================

    // ✅ 1. Buka WhatsApp
    const openWhatsApp = async () => {
        const url = `https://wa.me/${WHATSAPP_PHONE}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (!supported) {
                showAlert(
                    'WhatsApp Tidak Terpasang',
                    `Instal WhatsApp atau hubungi kami di ${WHATSAPP_PHONE}`,
                    [{ text: 'Mengerti' }]
                );
                return;
            }
            await Linking.openURL(url);
        } catch (err: any) {
            console.warn('[CHAT] WhatsApp error:', err?.message);
            showAlert(
                'Gagal Buka WhatsApp',
                `Coba lagi beberapa saat atau hubungi langsung ${WHATSAPP_PHONE}`,
                [{ text: 'Mengerti' }]
            );
        }
    };

    // ✅ 2. Buka chat room
    const openRoom = (room: ChatRoomListItem) => {
        goToRoom(room.id, room.peer_name, room.peer_avatar);
    };

    // ✅ 3. FAB: buka modal pilih order
    const openNewChat = async () => {
        setPickerVisible(true);
        setOrdersLoading(true);
        try {
            const list = await api.listOrders();
            const withDriver = list
                .filter(
                    (o) =>
                        o.driver_id && o.status !== 'cancelled'
                )
                .sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                )
                .slice(0, 10);
            setOrders(withDriver);
        } catch (err: any) {
            setPickerVisible(false);
            showAlert(
                'Gagal Memuat Order',
                'Tidak bisa memuat daftar order. Periksa koneksimu dan coba lagi.',
                [
                    { text: 'Tutup', style: 'cancel' },
                    {
                        text: 'Coba Lagi',
                        onPress: () => openNewChat(),
                    },
                ]
            );
        } finally {
            setOrdersLoading(false);
        }
    };

    // ✅ 4. Mulai chat dari order
    const startChatFromOrder = async (order: OrderResponse) => {
        setPickerVisible(false);
        setOpening(true);
        try {
            const room = await api.chat.openRoom(order.id);
            goToRoom(
                room.id,
                order.driver?.full_name ?? 'Driver',
                order.driver?.avatar_url
            );
        } catch (err: any) {
            const msg = String(err?.message ?? '').toLowerCase();

            // Pesan error spesifik
            if (msg.includes('not found') || msg.includes('404')) {
                showAlert(
                    'Order Tidak Ditemukan',
                    'Order ini mungkin sudah selesai atau dibatalkan. Coba pilih order lain.',
                    [{ text: 'Mengerti' }]
                );
            } else if (
                msg.includes('forbidden') ||
                msg.includes('403')
            ) {
                showAlert(
                    'Akses Ditolak',
                    'Kamu tidak bisa membuka chat untuk order ini.',
                    [{ text: 'Mengerti' }]
                );
            } else if (
                msg.includes('closed') ||
                msg.includes('ditutup')
            ) {
                showAlert(
                    'Chat Sudah Ditutup',
                    'Jendela chat untuk order ini sudah berakhir. Chat dibuka maksimal 30 menit setelah pesanan selesai.',
                    [{ text: 'Mengerti' }]
                );
            } else {
                showAlert(
                    'Gagal Membuka Chat',
                    err?.message ??
                    'Tidak bisa membuka chat. Coba lagi beberapa saat.',
                    [
                        { text: 'Tutup', style: 'cancel' },
                        {
                            text: 'Coba Lagi',
                            onPress: () =>
                                startChatFromOrder(order),
                        },
                    ]
                );
            }
        } finally {
            setOpening(false);
        }
    };

    const recent = rooms.slice(0, MAX_RECENT);

    // ============================================================
    // RENDER CHAT LIST
    // ============================================================
    const renderChats = () => {
        if (loading) return <SkeletonChatRows count={4} />;

        if (failed) {
            return (
                <View style={s.emptyWrap}>
                    <View style={s.emptyIcon}>
                        <Ionicons
                            name="cloud-offline-outline"
                            size={34}
                            color="#9CA3AF"
                        />
                    </View>
                    <Text style={s.emptyText}>
                        Gagal memuat chat kamu
                    </Text>
                    <Pressable style={s.retryBtn} onPress={retry}>
                        <Text style={s.retryBtnText}>Coba Lagi</Text>
                    </Pressable>
                </View>
            );
        }

        if (recent.length === 0) {
            return (
                <View style={s.emptyWrap}>
                    <View style={s.emptyIcon}>
                        <Ionicons
                            name="chatbubbles-outline"
                            size={34}
                            color="#9CA3AF"
                        />
                    </View>
                    <Text style={s.emptyText}>
                        Belum ada chat kamu di sini
                    </Text>
                    <Text style={[s.emptyText, { fontSize: 13, marginTop: 4 }]}>
                        Chat akan muncul setelah driver menerima pesananmu
                    </Text>
                </View>
            );
        }

        return recent.map((room) => (
            <Pressable
                key={String(room.id)}
                style={({ pressed }) => [
                    s.chatItem,
                    pressed && { backgroundColor: '#F9FAFB' },
                ]}
                onPress={() => openRoom(room)}
            >
                <Avatar
                    uri={room.peer_avatar}
                    name={room.peer_name}
                    size={54}
                    backgroundColor={GREEN}
                />
                <View style={s.chatInfo}>
                    <View style={s.chatTop}>
                        <Text
                            style={s.chatName}
                            numberOfLines={1}
                        >
                            {room.peer_name}
                        </Text>
                        <Text style={s.chatDate}>
                            {formatChatTime(room.last_message_at)}
                        </Text>
                    </View>
                    <Text
                        style={s.chatPreview}
                        numberOfLines={1}
                    >
                        {previewMessage(room)}
                    </Text>
                </View>
            </Pressable>
        ));
    };

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <SafeAreaView style={s.safeArea} edges={['top']}>
            <View style={s.container}>
                <View style={s.header}>
                    <Text style={s.headerTitle}>Chat</Text>
                </View>

                <ScrollView
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[GREEN]}
                            tintColor={GREEN}
                        />
                    }
                >
                    <Text style={s.sectionTitle}>Pilihan fitur</Text>

                    <View style={s.featureRow}>
                        <TouchableOpacity
                            style={s.featureItem}
                            activeOpacity={0.75}
                            onPress={openWhatsApp}
                        >
                            <View
                                style={[
                                    s.featureIcon,
                                    { backgroundColor: ORANGE },
                                ]}
                            >
                                <Ionicons
                                    name="logo-whatsapp"
                                    size={26}
                                    color="#fff"
                                />
                            </View>
                            <Text style={s.featureLabel}>
                                Bantuan
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={s.chatHeaderRow}>
                        <Text style={s.sectionTitle}>
                            Chat kamu
                        </Text>
                        {rooms.length > MAX_RECENT && (
                            <Pressable
                                hitSlop={8}
                                onPress={() =>
                                    router.push(
                                        ALL_CHATS_ROUTE as any
                                    )
                                }
                            >
                                <Text style={s.seeAll}>
                                    Lihat semua
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    {renderChats()}
                </ScrollView>

                <TouchableOpacity
                    style={s.floatingButton}
                    activeOpacity={0.85}
                    onPress={openNewChat}
                >
                    <MaterialCommunityIcons
                        name="message-plus"
                        size={30}
                        color="#fff"
                    />
                </TouchableOpacity>
            </View>

            {/* Modal Pilih Order */}
            <Modal
                visible={pickerVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setPickerVisible(false)}
            >
                <View style={s.modalOverlay}>
                    <Pressable
                        style={{ flex: 1 }}
                        onPress={() => setPickerVisible(false)}
                    />
                    <View style={s.modalSheet}>
                        <Text style={s.modalTitle}>
                            Chat dengan driver
                        </Text>
                        <Text style={s.modalSub}>
                            Pilih order yang ingin kamu chat
                        </Text>

                        {ordersLoading ? (
                            <SkeletonChatRows count={3} />
                        ) : orders.length === 0 ? (
                            <Text style={s.modalEmpty}>
                                Belum ada order dengan driver.
                                Chat bisa dimulai setelah
                                pesananmu diterima driver.
                            </Text>
                        ) : (
                            <ScrollView
                                style={{ maxHeight: 360 }}
                            >
                                {orders.map((o) => (
                                    <Pressable
                                        key={o.id}
                                        style={s.orderRow}
                                        onPress={() =>
                                            startChatFromOrder(o)
                                        }
                                    >
                                        <Avatar
                                            uri={
                                                o.driver
                                                    ?.avatar_url ??
                                                null
                                            }
                                            name={
                                                o.driver
                                                    ?.full_name ??
                                                'Driver'
                                            }
                                            size={44}
                                            backgroundColor={GREEN}
                                        />
                                        <View
                                            style={{ flex: 1 }}
                                        >
                                            <Text
                                                style={s.orderName}
                                                numberOfLines={
                                                    1
                                                }
                                            >
                                                {o.driver
                                                    ?.full_name ??
                                                    'Driver'}
                                            </Text>
                                            <Text
                                                style={s.orderDesc}
                                                numberOfLines={
                                                    1
                                                }
                                            >
                                                {o.order_code} •{' '}
                                                {o.dropoff_name ??
                                                    o.dropoff_address ??
                                                    '-'}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name="chevron-forward"
                                            size={18}
                                            color={GRAY}
                                        />
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Loading Modal */}
            <LoadingModal visible={opening} />

            {/* AppAlert */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={
                    alertState.buttons ?? [{ text: 'OK' }]
                }
                onClose={hideAlert}
            />
        </SafeAreaView>
    );
}

// ============================================================
// STYLES
// ============================================================
const sk = StyleSheet.create({
    base: {
        backgroundColor: SKELETON,
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
    safeArea: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, backgroundColor: '#fff' },

    header: {
        height: 64,
        justifyContent: 'center',
        paddingHorizontal: 25,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    headerTitle: {
        fontSize: 25,
        fontWeight: '700',
        color: TEXT,
    },

    scrollContent: {
        paddingHorizontal: 25,
        paddingTop: 24,
        paddingBottom: 140,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: TEXT,
    },

    featureRow: {
        flexDirection: 'row',
        marginTop: 22,
        gap: 28,
    },
    featureItem: { alignItems: 'center', width: 76 },
    featureIcon: {
        width: 54,
        height: 54,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureLabel: {
        marginTop: 9,
        fontSize: 16,
        color: '#555',
    },

    chatHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 48,
        marginBottom: 8,
    },
    seeAll: {
        fontSize: 14,
        fontWeight: '700',
        color: GREEN,
    },

    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginHorizontal: -25,
        paddingHorizontal: 25,
        paddingVertical: 14,
    },
    chatInfo: { flex: 1, minWidth: 0 },
    chatTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chatName: {
        flex: 1,
        marginRight: 8,
        fontSize: 16,
        fontWeight: '700',
        color: TEXT,
    },
    chatDate: { fontSize: 14, color: GRAY },
    chatPreview: {
        fontSize: 14,
        color: GRAY,
        marginTop: 4,
    },

    emptyWrap: {
        alignItems: 'center',
        paddingTop: 48,
        gap: 14,
    },
    emptyIcon: {
        width: 54,
        height: 54,
        borderRadius: 36,
        backgroundColor: '#F1F2F4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: GRAY,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    retryBtn: {
        marginTop: 4,
        paddingHorizontal: 24,
        paddingVertical: 11,
        borderRadius: 30,
        backgroundColor: GREEN,
    },
    retryBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },

    floatingButton: {
        position: 'absolute',
        right: 24,
        bottom: 174,
        width: 54,
        height: 54,
        borderRadius: 34,
        backgroundColor: GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 32,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: TEXT,
    },
    modalSub: {
        fontSize: 13,
        color: GRAY,
        marginTop: 4,
        marginBottom: 12,
    },
    modalEmpty: {
        fontSize: 14,
        color: GRAY,
        lineHeight: 20,
        paddingVertical: 24,
        textAlign: 'center',
    },
    orderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: BORDER,
    },
    orderName: {
        fontSize: 15,
        fontWeight: '800',
        color: TEXT,
    },
    orderDesc: {
        fontSize: 12,
        color: GRAY,
        marginTop: 2,
    },
});