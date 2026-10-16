import { mapStyle } from '@/constants/ojek-map-style';
import { colors } from '@/constants/ojek-theme';
import { api, NearbyDriver } from '@/lib/api';
import type { PlaceLoc } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import MapView, { AnimatedRegion, MarkerAnimated } from 'react-native-maps';
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

type LatLng = { latitude: number; longitude: number };

const RING_SIZE = 260;
const DOT_SIZE = 26;

// Animasi zoom
const INITIAL_ZOOM_MULTIPLIER = 4;
const TARGET_DELTA = 0.012; // ±1,3 km: cukup lebar agar driver sekitar terlihat
const ZOOM_DURATION_MS = 1200;
const ZOOM_START_DELAY_MS = 350;

// Driver sekitar
const NEARBY_RADIUS_M = 3000;
const NEARBY_LIMIT = 15;
const POLL_MS = 3000;
const MARKER_ANIM_MS = 2800; // sedikit lebih pendek dari POLL_MS
const HEADING_MIN_METERS = 5;
// 0 jika gambar menghadap ke atas (utara). Ubah (90/180/-90) bila perlu.
const ICON_HEADING_OFFSET = 0;

const DRIVER_ICON = require('@/assets/images/motor-map.png');

// ============================================================
// Helpers
// ============================================================
const toRad = (d: number) => (d * Math.PI) / 180;

function distanceMeters(a: LatLng, b: LatLng): number {
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

function bearing(a: LatLng, b: LatLng): number {
    const y =
        Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
    const x =
        Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
        Math.sin(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.cos(toRad(b.longitude - a.longitude));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ============================================================
// Hook: polling driver di sekitar titik jemput
// ============================================================
function useNearbyDrivers(center: LatLng) {
    const [drivers, setDrivers] = useState<NearbyDriver[]>([]);

    useEffect(() => {
        let alive = true;
        let inFlight = false;

        const tick = async () => {
            if (inFlight) return;
            inFlight = true;
            try {
                const list = await api.drivers.nearby(
                    center.latitude,
                    center.longitude,
                    NEARBY_RADIUS_M,
                    NEARBY_LIMIT
                );
                if (!alive) return;
                // hanya driver motor yang punya koordinat valid
                setDrivers(
                    list.filter(
                        (d) =>
                            !!d.coords &&
                            Number.isFinite(d.coords.latitude) &&
                            Number.isFinite(d.coords.longitude)
                    )
                );
            } catch (err: any) {
                console.warn('[Searching] nearby gagal:', err?.message);
            } finally {
                inFlight = false;
            }
        };

        tick();
        const id = setInterval(tick, POLL_MS);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [center.latitude, center.longitude]);

    return drivers;
}

// ============================================================
// Marker satu driver: bergerak halus + berputar sesuai arah
// ============================================================
function NearbyDriverMarker({ driver }: { driver: NearbyDriver }) {
    const coords = driver.coords as LatLng;

    const region = useRef(
        new AnimatedRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
        })
    ).current;

    const [heading, setHeading] = useState(0);
    const [trackView, setTrackView] = useState(true);
    const prevRef = useRef<LatLng>(coords);

    useEffect(() => {
        // arah ikon dari pergerakan terakhir (abaikan jitter kecil)
        if (distanceMeters(prevRef.current, coords) > HEADING_MIN_METERS) {
            setHeading(bearing(prevRef.current, coords));
            prevRef.current = coords;
        }

        const config: any = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
            duration: MARKER_ANIM_MS,
            useNativeDriver: false,
        };
        region.timing(config).start();
    }, [coords.latitude, coords.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <MarkerAnimated
            coordinate={region}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={(heading + ICON_HEADING_OFFSET) % 360}
            tracksViewChanges={trackView}
            zIndex={2}
        >
            <View style={m.driverMarker}>
                <Image
                    source={DRIVER_ICON}
                    style={{ width: 34, height: 34 }}
                    resizeMode="contain"
                    // matikan tracksViewChanges setelah gambar siap (hindari ikon hilang di Android)
                    onLoad={() => setTimeout(() => setTrackView(false), 150)}
                />
            </View>
        </MarkerAnimated>
    );
}

// ============================================================
// Radar
// ============================================================
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

// ============================================================
// Screen
// ============================================================
export default function SearchingDriverStep({
    origin,
    onBack,
    onCancelConfirmed,
    onDriverFound,
    searchDelayMs = 5000,
}: Props) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const mapRef = useRef<MapView>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const SHEET_H = 200 + insets.bottom;
    const TOP_INSET = insets.top + 12;
    const centerY = TOP_INSET + (height - TOP_INSET - SHEET_H) / 2;

    const { latitude, longitude } = origin.coords;

    // Driver sekitar (realtime)
    const nearby = useNearbyDrivers({ latitude, longitude });

    // Zoom-in ke titik jemput
    useEffect(() => {
        const t = setTimeout(() => {
            mapRef.current?.animateToRegion(
                {
                    latitude,
                    longitude,
                    latitudeDelta: TARGET_DELTA,
                    longitudeDelta: TARGET_DELTA,
                },
                ZOOM_DURATION_MS
            );
        }, ZOOM_START_DELAY_MS);
        return () => clearTimeout(t);
    }, [latitude, longitude]);

    const foundRef = useRef(onDriverFound);
    foundRef.current = onDriverFound;

    useEffect(() => {
        const t = setTimeout(() => foundRef.current(), searchDelayMs);
        return () => clearTimeout(t);
    }, [searchDelayMs]);

    return (
        <View style={{ flex: 1 }}>
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
                mapPadding={{
                    top: TOP_INSET,
                    bottom: SHEET_H,
                    left: 0,
                    right: 0,
                }}
                initialRegion={{
                    latitude,
                    longitude,
                    latitudeDelta: TARGET_DELTA * INITIAL_ZOOM_MULTIPLIER,
                    longitudeDelta: TARGET_DELTA * INITIAL_ZOOM_MULTIPLIER,
                }}
            >
                {/* key = id driver, supaya tiap ikon mempertahankan animasinya */}
                {nearby.map((d) => (
                    <NearbyDriverMarker key={d.id} driver={d} />
                ))}
            </MapView>

            {/* Ring radar + titik jemput */}
            <RadarOverlay top={centerY - RING_SIZE / 2} />

            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[s.backWrap, { top: insets.top + 12 }]}
            >
                <Pressable onPress={onBack} style={s.circleBtn}>
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                </Pressable>
            </Animated.View>

            <Animated.View
                entering={FadeInUp.delay(150).duration(350)}
                style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}
            >
                <Text style={s.searchingText}>
                    Mencari driver buatmu, ditunggu ya...
                </Text>
                {nearby.length > 0 && (
                    <Text style={s.nearbyText}>
                        {nearby.length} driver di sekitarmu
                    </Text>
                )}
                <Pressable
                    style={s.cancelBtn}
                    onPress={() => setShowCancelModal(true)}
                >
                    <Text style={s.cancelText}>Batalkan pengiriman</Text>
                </Pressable>
            </Animated.View>

            <Modal visible={showCancelModal} transparent animationType="fade">
                <Pressable
                    style={s.modalBackdrop}
                    onPress={() => setShowCancelModal(false)}
                />
                <View
                    style={[s.confirmSheet, { paddingBottom: insets.bottom + 20 }]}
                >
                    <View style={s.confirmHeader}>
                        <Pressable
                            onPress={() => setShowCancelModal(false)}
                            style={s.circleBtn}
                        >
                            <Ionicons name="arrow-back" size={18} color={colors.text} />
                        </Pressable>
                        <View style={{ flex: 1 }} />
                        <Pressable
                            onPress={() => setShowCancelModal(false)}
                            style={s.circleBtn}
                        >
                            <Ionicons name="close" size={18} color={colors.text} />
                        </Pressable>
                    </View>
                    <Text style={s.confirmText}>
                        Kalo cancel sekarang, kamu mungkin harus nunggu lebih
                        lama lagi. Beneran mau cancel?
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
                            <Text style={s.confirmCancelText}>Iya, cancel</Text>
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
    driverMarker: {
        width: 46,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
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
        marginBottom: 6,
    },
    nearbyText: {
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: 16,
    },
    cancelBtn: {
        backgroundColor: '#FDE9E9',
        borderRadius: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        marginTop: 8,
    },
    cancelText: { color: '#E24C4C', fontWeight: '800', fontSize: 14 },

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
    confirmHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
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
    stayText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
    confirmCancelBtn: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmCancelText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});