import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import type { OrderPayload } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView from 'react-native-maps';
import Animated, {
    cancelAnimation,
    Easing,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER } from './parts';

type Props = {
    payload: OrderPayload;
    onBack: () => void;
    onApplyPriority?: () => void;
    /** dipanggil saat driver (dummy) ditemukan */
    onDriverFound?: () => void;
    /** lama pencarian dummy, default 5 detik */
    searchDelayMs?: number;
    
};

const ORANGE = '#f26b21';
const PRIORITY_FEE = 2000;

const VEHICLE_IMG = {
    motor: require('@/assets/images/motor.png'),
    mobil: require('@/assets/images/mobil.png'),
};

const RING_SIZE = 260; // diameter ring terbesar
const DOT_SIZE = 26;
const ROUTE_CARD_H = 90; // perkiraan tinggi kartu asal-tujuan

/**
 * Ring radar. Digambar sebagai View biasa DI ATAS peta (bukan children <Marker>),
 * karena di Android children Marker di-rasterisasi jadi bitmap sehingga animasinya tidak bergerak.
 */
function Ring({ delay }: { delay: number }) {
    const p = useSharedValue(0);

    useEffect(() => {
        p.value = withDelay(
            delay,
            withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false)
        );
        return () => cancelAnimation(p);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: 0.12 + p.value * 0.88 }],
        opacity: (1 - p.value) * 0.45,
    }));

    return <Animated.View style={[m.ring, style]} />;
}

/** Titik jemput + 3 ring berdenyut, ditaruh persis di tengah area peta yang terlihat */
function RadarOverlay({ top }: { top: number }) {
    return (
        <View pointerEvents="none" style={[m.overlay, { top }]}>
            <Ring delay={0} />
            <Ring delay={870} />
            <Ring delay={1740} />
            <View style={m.dot}>
                <Ionicons name="arrow-up" size={15} color="#fff" />
            </View>
        </View>
    );
}

/** "Lagi cari driver buatmu secepatnya" + titik-titik yang jalan */
function SearchingTitle() {
    const [n, setN] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setN((v) => (v + 1) % 4), 450);
        return () => clearInterval(id);
    }, []);
    return (
        <Text style={s.statusTitle}>
            Lagi cari driver buatmu secepatnya{'.'.repeat(n)}
        </Text>
    );
}

/** progress bar tak berujung (indeterminate) */
function IndeterminateBar() {
    const [trackW, setTrackW] = useState(0);
    const p = useSharedValue(0);
    const BAR_W = 90;

    useEffect(() => {
        p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, false);
        return () => cancelAnimation(p);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

function RouteDot({ type }: { type: 'origin' | 'destination' }) {
    if (type === 'origin') {
        return (
            <View style={[s.routeDot, { backgroundColor: colors.primary }]}>
                <Ionicons name="arrow-up" size={14} color="#fff" />
            </View>
        );
    }
    return (
        <View style={[s.routeDot, { backgroundColor: ORANGE }]}>
            <View style={s.routeDotInner} />
        </View>
    );
}

export default function SearchingDriverStep({
    payload,
    onBack,
    onApplyPriority,
    onDriverFound,
    searchDelayMs = 5000,
}: Props) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const mapRef = useRef<MapView>(null);

    // simpan callback di ref supaya timer tidak ter-reset saat parent re-render
    const foundRef = useRef(onDriverFound);
    foundRef.current = onDriverFound;

    // SIMULASI: setelah beberapa detik, anggap driver ditemukan.
    // Ganti dengan respons backend (websocket / polling) saat sudah ada API pemesanan.
    useEffect(() => {
        const t = setTimeout(() => foundRef.current?.(), searchDelayMs);
        return () => clearTimeout(t);
    }, [searchDelayMs]);

    const SHEET_H = 340 + insets.bottom;
    const TOP_INSET = insets.top + 12 + ROUTE_CARD_H + 12;
    // titik tengah area peta yang tidak tertutup kartu atas & bottom sheet
    const centerY = TOP_INSET + (height - TOP_INSET - SHEET_H) / 2;

    const { latitude, longitude } = payload.origin.coords;

    const zoomToPickup = () => {
        mapRef.current?.animateToRegion(
            { latitude, longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 },
            800
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Peta: mulai agak jauh lalu zoom halus ke titik jemput */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                mapPadding={{ top: TOP_INSET, bottom: SHEET_H, left: 0, right: 0 }}
                onMapReady={zoomToPickup}
                initialRegion={{ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
            />

            {/* Ring radar + titik jemput (di atas peta, di tengah area terlihat) */}
            <RadarOverlay top={centerY - RING_SIZE / 2} />

            {/* Kartu asal-tujuan + tombol Edit */}
            <Animated.View entering={FadeInUp.duration(300)} style={[s.routeCard, { top: insets.top + 12 }]}>
                <View style={{ flex: 1 }}>
                    <View style={s.routeRow}>
                        <RouteDot type="origin" />
                        <Text style={s.routeText} numberOfLines={1}>{payload.origin.name}</Text>
                    </View>
                    <View style={s.routeDivider} />
                    <View style={s.routeRow}>
                        <RouteDot type="destination" />
                        <Text style={s.routeText} numberOfLines={1}>{payload.destination.name}</Text>
                    </View>
                </View>
                <Pressable onPress={onBack} style={s.editBtn}>
                    <Text style={s.editText}>Edit</Text>
                </Pressable>
            </Animated.View>

            {/* Tombol kembali, mengambang tepat di atas bottom sheet */}
            <View style={[s.floatBack, { bottom: SHEET_H + 12 }]}>
                <CircleButton icon="arrow-back" onPress={onBack} />
            </View>

            {/* Bottom sheet: status pencarian driver + booking prioritas */}
            <Animated.View
                entering={FadeInUp.delay(150).duration(350)}
                style={[s.sheet, { height: SHEET_H, paddingBottom: insets.bottom + 16 }]}
            >
                <View style={s.handleArea}>
                    <View style={s.handle} />
                </View>

                <View style={s.statusCard}>
                    <Image source={VEHICLE_IMG[payload.service]} style={{ width: 44, height: 44 }} resizeMode="contain" />
                    <View style={{ flex: 1 }}>
                        <SearchingTitle />
                        <Text style={s.statusSub}>Ditunggu ya, yang booking lagi rame 🙏</Text>
                    </View>
                </View>

                <IndeterminateBar />

                <View style={s.priorityCard}>
                    <View style={s.priorityRow}>
                        <View style={s.priorityIcon}>
                            <Ionicons name="flash" size={14} color="#fff" />
                        </View>
                        <Text style={s.priorityTitle}>Booking Prioritas</Text>
                        <Text style={s.priorityPrice}>{formatRupiah(PRIORITY_FEE)}</Text>
                        <View style={s.checkbox} />
                    </View>
                    <View style={s.priorityDivider} />
                    <Text style={s.priorityDesc}>
                        Lebih cepat dapat driver, sekalian nambah penghasilan mereka.
                    </Text>
                    <Pressable style={s.priorityButton} onPress={onApplyPriority}>
                        <Text style={s.priorityButtonText}>Pakai Booking Prioritas</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    );
}

// ---- style radar ----
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
        backgroundColor: colors.primary,
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        elevation: 4,
    },
});

const s = StyleSheet.create({
    routeCard: {
        position: 'absolute',
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingLeft: 14,
        paddingRight: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 36 },
    routeText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
    routeDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 36 },
    routeDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    routeDotInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
    editBtn: {
        height: 40,
        paddingHorizontal: 18,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    editText: { color: colors.primary, fontWeight: '800', fontSize: 15 },

    floatBack: { position: 'absolute', left: 16 },

    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingHorizontal: 16,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
    },
    handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#c9ccd1' },

    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#F5F6F8',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
    },
    statusTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    statusSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

    track: {
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E6E8EB',
        overflow: 'hidden',
        marginBottom: 14,
    },
    bar: { height: 4, borderRadius: 2, backgroundColor: colors.primary },

    priorityCard: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 14,
    },
    priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    priorityIcon: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    priorityTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
    priorityPrice: { fontSize: 14, color: colors.textMuted, marginRight: 8 },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    priorityDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginVertical: 12,
    },
    priorityDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 14 },
    priorityButton: {
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EDEEF0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    priorityButtonText: { fontSize: 15, fontWeight: '700', color: '#9CA0A6' },
});