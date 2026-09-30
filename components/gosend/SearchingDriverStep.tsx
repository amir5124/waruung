import { colors } from '@/constants/ojek-theme';
import type { PlaceLoc } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
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
import { MAP_PROVIDER } from '../ojek/parts';

type Props = {
    origin: PlaceLoc;
    onBack: () => void;
    onCancelConfirmed: () => void;
    onDriverFound: () => void;
    searchDelayMs?: number;
};

const RING_SIZE = 260;
const DOT_SIZE = 26;

// ⬇️ Konstanta animasi zoom
const INITIAL_ZOOM_MULTIPLIER = 6; // mulai 6x lebih zoom-out
const TARGET_DELTA = 0.004;         // delta akhir (zoom-in ke titik jemput)
const ZOOM_DURATION_MS = 1200;      // durasi animasi zoom-in
const ZOOM_START_DELAY_MS = 350;    // delay sebelum mulai zoom-in

/**
 * Ring radar. Digambar sebagai View biasa DI ATAS peta (bukan children <Marker>),
 * karena di Android children Marker di-rasterisasi jadi bitmap sehingga animasinya tidak bergerak.
 */
function Ring({ delay }: { delay: number }) {
    const p = useSharedValue(0);

    useEffect(() => {
        p.value = withDelay(
            delay,
            withRepeat(
                withTiming(1, {
                    duration: 2600,
                    easing: Easing.out(Easing.quad),
                }),
                -1,
                false
            )
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

export default function SearchingDriverStep({
    origin,
    onBack,
    onCancelConfirmed,
    onDriverFound,
    searchDelayMs = 5000,
}: Props) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const mapRef = React.useRef<MapView>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const SHEET_H = 200 + insets.bottom;
    const TOP_INSET = insets.top + 12;
    const centerY = TOP_INSET + (height - TOP_INSET - SHEET_H) / 2;

    const { latitude, longitude } = origin.coords;

    // ⬇️ Fungsi zoom-in ke titik jemput
    const zoomToPickup = () => {
        mapRef.current?.animateToRegion(
            {
                latitude,
                longitude,
                latitudeDelta: TARGET_DELTA,
                longitudeDelta: TARGET_DELTA,
            },
            ZOOM_DURATION_MS
        );
    };

    // ⬇️ Trigger zoom-in setelah delay (biar user lihat zoom-out dulu)
    useEffect(() => {
        const t = setTimeout(() => {
            zoomToPickup();
        }, ZOOM_START_DELAY_MS);
        return () => clearTimeout(t);
    }, [latitude, longitude]); // eslint-disable-line react-hooks/exhaustive-deps

    const foundRef = React.useRef(onDriverFound);
    foundRef.current = onDriverFound;

    useEffect(() => {
        const t = setTimeout(() => foundRef.current(), searchDelayMs);
        return () => clearTimeout(t);
    }, [searchDelayMs]);

    return (
        <View style={{ flex: 1 }}>
            {/* Peta: mulai sangat zoom-out, lalu animasi zoom-in ke titik jemput */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                mapPadding={{
                    top: TOP_INSET,
                    bottom: SHEET_H,
                    left: 0,
                    right: 0,
                }}
                initialRegion={{
                    latitude,
                    longitude,
                    // ⬇️ Mulai dengan delta besar (zoom-out)
                    latitudeDelta: TARGET_DELTA * INITIAL_ZOOM_MULTIPLIER,
                    longitudeDelta: TARGET_DELTA * INITIAL_ZOOM_MULTIPLIER,
                }}
            />

            {/* Ring radar + titik jemput (di atas peta, di tengah area terlihat) */}
            <RadarOverlay top={centerY - RING_SIZE / 2} />

            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[s.backWrap, { top: insets.top + 12 }]}
            >
                <Pressable onPress={onBack} style={s.circleBtn}>
                    <Ionicons
                        name="arrow-back"
                        size={20}
                        color={colors.text}
                    />
                </Pressable>
            </Animated.View>

            <Animated.View
                entering={FadeInUp.delay(150).duration(350)}
                style={[
                    s.sheet,
                    { paddingBottom: insets.bottom + 20 },
                ]}
            >
                <Text style={s.searchingText}>
                    Mencari driver buatmu, ditunggu ya...
                </Text>
                <Pressable
                    style={s.cancelBtn}
                    onPress={() => setShowCancelModal(true)}
                >
                    <Text style={s.cancelText}>
                        Batalkan pengiriman
                    </Text>
                </Pressable>
            </Animated.View>

            <Modal
                visible={showCancelModal}
                transparent
                animationType="fade"
            >
                <Pressable
                    style={s.modalBackdrop}
                    onPress={() => setShowCancelModal(false)}
                />
                <View
                    style={[
                        s.confirmSheet,
                        { paddingBottom: insets.bottom + 20 },
                    ]}
                >
                    <View style={s.confirmHeader}>
                        <Pressable
                            onPress={() => setShowCancelModal(false)}
                            style={s.circleBtn}
                        >
                            <Ionicons
                                name="arrow-back"
                                size={18}
                                color={colors.text}
                            />
                        </Pressable>
                        <View style={{ flex: 1 }} />
                        <Pressable
                            onPress={() => setShowCancelModal(false)}
                            style={s.circleBtn}
                        >
                            <Ionicons
                                name="close"
                                size={18}
                                color={colors.text}
                            />
                        </Pressable>
                    </View>
                    <Text style={s.confirmText}>
                        Kalo cancel sekarang, kamu mungkin harus nunggu
                        lebih lama lagi. Beneran mau cancel?
                    </Text>
                    <View style={s.confirmRow}>
                        <Pressable
                            style={s.stayBtn}
                            onPress={() => setShowCancelModal(false)}
                        >
                            <Text style={s.stayText}>Tunggu, deh</Text>
                        </Pressable>
                        <Pressable
                            style={s.confirmCancelBtn}
                            onPress={() => {
                                setShowCancelModal(false);
                                onCancelConfirmed();
                            }}
                        >
                            <Text style={s.confirmCancelText}>
                                Iya, cancel
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

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
    backWrap: { position: 'absolute', left: 16 },
    circleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 28,
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    searchingText: {
        fontSize: 17,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    cancelBtn: {
        backgroundColor: '#FDE9E9',
        borderRadius: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    cancelText: {
        color: '#E24C4C',
        fontWeight: '800',
        fontSize: 14,
    },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
    confirmSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    confirmHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmText: {
        fontSize: 17,
        fontWeight: '800',
        color: colors.text,
        lineHeight: 24,
        marginBottom: 20,
    },
    confirmRow: { flexDirection: 'row', gap: 12 },
    stayBtn: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stayText: {
        color: colors.primary,
        fontWeight: '800',
        fontSize: 15,
    },
    confirmCancelBtn: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmCancelText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },
});