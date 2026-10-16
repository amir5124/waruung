// components/warfood/SearchingDriverStep.tsx
// Tahap "Mencari driver" — peta bergaya mapStyle + radar + bottom sheet (sesuai desain 05-Cari-Driver).
import { mapStyle } from '@/constants/ojek-map-style';
import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import type { OrderResponse } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, {
    cancelAnimation,
    Easing,
    FadeIn,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_PROVIDER } from '../ojek/parts';

// ============================================================
// CONSTANTS
// ============================================================
const PRIMARY = (colors as any).primary ?? '#40a3ea';
const SECONDARY = (colors as any).secondary ?? '#e68515';
const PRIMARY_SOFT = '#E8F4FD';
const PRIMARY_DARK = '#1F6FAE';
const DANGER = '#C62828';
const TEXT = '#172019';
const MUTED = '#5F6B64';
const TRACK = '#E3E8E5';

const RING_SIZE = 260;
const DOT_SIZE = 28;
const SHEET_BASE_H = 420;
const TOP_BAR_H = 44;

const START_ZOOM = 12;
const END_ZOOM = 16.5;
const ZOOM_DELAY = 400;
const ZOOM_DURATION = 2000;

const MARKER_PICKUP = require('@/assets/images/marker-origin.png');
const MARKER_DROP = require('@/assets/images/marker-destination.png');

const STAGES = ['Cari driver', 'Ke resto', 'Beli pesanan', 'Diantar', 'Tiba'];

type Props = {
    order: OrderResponse;
    onBack: () => void;
    onCancel: () => void;
};

// ============================================================
// RADAR
// ============================================================
function Ring({ delay }: { delay: number }) {
    const p = useSharedValue(0);
    useEffect(() => {
        p.value = withDelay(
            delay,
            withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false),
        );
        return () => cancelAnimation(p);
    }, []); // eslint-disable-line

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: 0.12 + p.value * 0.88 }],
        opacity: (1 - p.value) * 0.4,
    }));
    return <Animated.View style={[m.ring, style]} />;
}

function RadarOverlay({ top }: { top: number }) {
    return (
        <View pointerEvents="none" style={[m.overlay, { top }]}>
            <Ring delay={0} />
            <Ring delay={870} />
            <Ring delay={1740} />
            <View style={m.dot}>
                <Ionicons name="restaurant" size={14} color="#fff" />
            </View>
        </View>
    );
}

// ============================================================
// PROGRESS TAK TENTU
// ============================================================
function IndeterminateBar() {
    const [trackW, setTrackW] = useState(0);
    const p = useSharedValue(0);
    const BAR_W = 110;

    useEffect(() => {
        p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, false);
        return () => cancelAnimation(p);
    }, []); // eslint-disable-line

    const style = useAnimatedStyle(() => ({
        width: BAR_W,
        transform: [{ translateX: -BAR_W + p.value * (trackW + BAR_W) }],
    }));

    return (
        <View style={s.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
            <Animated.View style={[s.bar, style]} />
        </View>
    );
}

// ============================================================
// TAHAPAN
// ============================================================
function Stepper({ active }: { active: number }) {
    return (
        <View style={s.stepper}>
            {STAGES.map((label, i) => {
                const done = i < active;
                const cur = i === active;
                return (
                    <View key={label} style={s.stepCol}>
                        <View style={s.stepLineRow}>
                            <View style={[s.line, i === 0 && { opacity: 0 }, (done || cur) && i > 0 && { backgroundColor: PRIMARY }]} />
                            <View
                                style={[
                                    s.stepDot,
                                    (done || cur) && { backgroundColor: PRIMARY, borderColor: PRIMARY },
                                ]}
                            >
                                {done && <Ionicons name="checkmark" size={11} color="#fff" />}
                            </View>
                            <View style={[s.line, i === STAGES.length - 1 && { opacity: 0 }, done && { backgroundColor: PRIMARY }]} />
                        </View>
                        <Text style={[s.stepLabel, cur && { fontWeight: '800', color: TEXT }]} numberOfLines={1}>
                            {label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

// ============================================================
// HELPERS
// ============================================================
const payLabel = (pm?: string | null) =>
    pm === 'cash' ? 'Tunai' : pm === 'wallet' ? 'Saldo' : pm === 'qris' ? 'QRIS' : 'Transfer Bank';

function getItems(order: any): any[] {
    const list = order?.order_items ?? order?.items;
    return Array.isArray(list) ? list : [];
}

function itemsSummary(order: any): string {
    return getItems(order)
        .map((it) => {
            const name = it?.name ?? it?.item_name ?? it?.menu_name ?? it?.product_name ?? 'Item';
            const qty = it?.qty ?? it?.quantity ?? 1;
            return `${qty}x ${name}${it?.variant ? ` (${it.variant})` : ''}`;
        })
        .join(' · ');
}
// ============================================================
// MAIN
// ============================================================
export default function SearchingDriverStep({ order, onBack, onCancel }: Props) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const mapRef = useRef<MapView>(null);

    const SHEET_H = SHEET_BASE_H + insets.bottom;
    const TOP_INSET = insets.top + 12 + TOP_BAR_H + 12;
    const centerY = TOP_INSET + (height - TOP_INSET - SHEET_H) / 2;

    const pickup = {
        latitude: order.pickup_coords?.latitude ?? 0,
        longitude: order.pickup_coords?.longitude ?? 0,
    };
    const dropoff = {
        latitude: order.dropoff_coords?.latitude ?? 0,
        longitude: order.dropoff_coords?.longitude ?? 0,
    };

    const zoomedRef = useRef(false);
    const zoomToPickup = () => {
        if (zoomedRef.current) return;
        zoomedRef.current = true;
        setTimeout(() => {
            mapRef.current?.animateCamera({ center: pickup, zoom: END_ZOOM }, { duration: ZOOM_DURATION });
        }, ZOOM_DELAY);
    };

    const [showRadar, setShowRadar] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setShowRadar(true), ZOOM_DELAY + ZOOM_DURATION - 300);
        return () => clearTimeout(t);
    }, []);

    const storeName = (order as any).merchant?.store_name ?? (order as any).pickup_name ?? 'Resto';
    const summary = itemsSummary(order);
    // sebelumnya: const itemCount = (order as any).items?.length ?? 0;
    const itemCount = getItems(order).reduce((n, it) => n + (Number(it?.qty ?? it?.quantity) || 1), 0);

    return (
        <View style={{ flex: 1, backgroundColor: '#E8EEE9' }}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                customMapStyle={mapStyle}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                mapPadding={{ top: TOP_INSET, bottom: SHEET_H, left: 0, right: 0 }}
                onMapReady={zoomToPickup}
                initialCamera={{ center: pickup, zoom: START_ZOOM, heading: 0, pitch: 0 }}
            >
                <Marker coordinate={pickup} image={MARKER_PICKUP} anchor={{ x: 0.5, y: 1 }} />
                <Marker coordinate={dropoff} image={MARKER_DROP} anchor={{ x: 0.5, y: 1 }} opacity={0.6} />
            </MapView>

            {showRadar && (
                <Animated.View entering={FadeIn.duration(400)} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <RadarOverlay top={centerY - RING_SIZE / 2} />
                </Animated.View>
            )}

            {/* Top bar: tutup + kode pesanan */}
            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[s.topBar, { top: insets.top + 12 }]}
                pointerEvents="box-none"
            >
                <Pressable onPress={onBack} style={s.closeBtn} hitSlop={8} accessibilityLabel="Tutup">
                    <Ionicons name="close" size={22} color={TEXT} />
                </Pressable>
                <View style={s.codePill}>
                    <Text style={s.codeText}>{order.order_code}</Text>
                </View>
            </Animated.View>

            {/* Bottom sheet */}
            <Animated.View
                entering={FadeInUp.delay(150).duration(350)}
                style={[s.sheet, { height: SHEET_H, paddingBottom: insets.bottom + 16 }]}
            >
                <View style={s.handle} />

                <View style={{ alignItems: 'center' }}>
                    <Text style={s.title}>Mencari driver untukmu…</Text>
                    <Text style={s.subtitle}>
                        Pesananmu sudah diteruskan ke {storeName}.{'\n'}Biasanya driver ditemukan dalam 1-2 menit.
                    </Text>
                </View>

                <IndeterminateBar />
                <Stepper active={0} />

                {/* Ringkasan */}
                <View style={s.summaryCard}>
                    <View style={s.summaryHead}>
                        <Text style={s.summaryName} numberOfLines={1}>
                            {storeName}
                        </Text>
                        <View style={s.chip}>
                            <Text style={s.chipText}>{payLabel((order as any).payment_method)}</Text>
                        </View>
                    </View>
                    <Text style={s.summaryItems} numberOfLines={2}>
                        {summary || `${itemCount} item`}
                    </Text>
                    <View style={s.totalRow}>
                        <Text style={s.totalLabel}>Total</Text>
                        <Text style={s.totalValue}>{formatRupiah(order.total_fare)}</Text>
                    </View>
                </View>

                <Pressable style={s.cancelBtn} onPress={onCancel}>
                    <Text style={s.cancelText}>Batalkan pesanan</Text>
                </Pressable>
            </Animated.View>
        </View>
    );
}

// ============================================================
// STYLE
// ============================================================
const m = StyleSheet.create({
    overlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: RING_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        backgroundColor: PRIMARY,
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: SECONDARY,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        elevation: 4,
    },
});

const s = StyleSheet.create({
    topBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        height: TOP_BAR_H,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    closeBtn: {
        width: TOP_BAR_H,
        height: TOP_BAR_H,
        borderRadius: TOP_BAR_H / 2,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    codePill: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    codeText: { fontSize: 12, fontWeight: '800', color: TEXT },

    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#DADFDC',
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 20, fontWeight: '800', color: TEXT },
    subtitle: { fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 19, textAlign: 'center' },

    track: {
        height: 5,
        borderRadius: 3,
        backgroundColor: PRIMARY_SOFT,
        overflow: 'hidden',
        marginTop: 18,
    },
    bar: { height: 5, borderRadius: 3, backgroundColor: PRIMARY },

    stepper: { flexDirection: 'row', marginTop: 20 },
    stepCol: { flex: 1, alignItems: 'center' },
    stepLineRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
    line: { flex: 1, height: 3, backgroundColor: TRACK },
    stepDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#CBD2CE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepLabel: { fontSize: 11, fontWeight: '600', color: '#7B8680', marginTop: 6 },

    summaryCard: { marginTop: 20, backgroundColor: '#F4F6F5', borderRadius: 16, padding: 14 },
    summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryName: { flex: 1, fontSize: 14, fontWeight: '800', color: TEXT },
    chip: { backgroundColor: PRIMARY_SOFT, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
    chipText: { fontSize: 11, fontWeight: '800', color: PRIMARY_DARK },
    summaryItems: { fontSize: 13, color: '#4A554F', marginTop: 6, lineHeight: 19 },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: TRACK,
    },
    totalLabel: { fontSize: 14, fontWeight: '800', color: TEXT },
    totalValue: { fontSize: 14, fontWeight: '800', color: TEXT },

    cancelBtn: {
        marginTop: 14,
        height: 48,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#F2C4C6',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: { color: DANGER, fontWeight: '800', fontSize: 14 },
});