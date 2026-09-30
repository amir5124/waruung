import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { getRoute } from '@/services/google-maps';
import type { OrderPayload, RouteInfo, ServiceType } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MapView, {
    AnimatedRegion,
    Marker,
    MarkerAnimated,
    Polyline,
} from 'react-native-maps';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER } from './parts';

export type Driver = {
    id: string;
    name: string;
    photo?: string;
    rating: number;
    trips: number;
    plate: string;
    vehicle: string;
    color: string;
    phone: string;
    coords: { latitude: number; longitude: number };
    vehicleType?: ServiceType;
};

type Props = {
    payload: OrderPayload;
    driver: Driver;
    onBack: () => void;
    onCancel: () => void;
    onArrived?: () => void;
    onChat?: () => void;
    onCall?: () => void;
};

const ORANGE = '#f26b21';

const VEHICLE_IMG: Record<string, any> = {
    motor: require('@/assets/images/motor-map.png'),
    mobil: require('@/assets/images/mobil-map.png'),
};
const MARKER_ORIGIN = require('@/assets/images/marker-origin.png');

// Durasi animasi pindah posisi marker (ms)
const MARKER_ANIM_MS = 800;
// Jarak minimum (meter) supaya route di-refresh ulang
const REFETCH_ROUTE_METERS = 100;

type LatLng = { latitude: number; longitude: number };

const rupiahDots = (n: number) =>
    String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function distanceMeters(a: LatLng, b: LatLng): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
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

function Avatar({ name, uri }: { name: string; uri?: string }) {
    const [failed, setFailed] = useState(false);
    const initials = name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('');
    if (uri && !failed) {
        return (
            <Image
                source={{ uri }}
                style={s.avatar}
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarText}>{initials}</Text>
        </View>
    );
}

export default function DriverFoundStep({
    payload,
    driver,
    onBack,
    onCancel,
    onArrived,
    onChat,
    onCall,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const SHEET_H = 430 + insets.bottom;

    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [trackView, setTrackView] = useState(true);
    const fittedRef = useRef(false);

    const onArrivedRef = useRef(onArrived);
    onArrivedRef.current = onArrived;
    const arrivedFiredRef = useRef(false);

    // ---- Rute driver -> titik jemput, refresh kalau driver bergeser > 100m ----
    const lastFetchRef = useRef<LatLng | null>(null);
    const reqRef = useRef(0);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const prev = lastFetchRef.current;
        if (
            prev &&
            distanceMeters(prev, driver.coords) < REFETCH_ROUTE_METERS
        ) {
            return;
        }

        lastFetchRef.current = driver.coords;
        const id = ++reqRef.current;

        getRoute(driver.coords, payload.origin.coords)
            .then((r) => {
                if (mountedRef.current && id === reqRef.current) {
                    setRoute(r);
                }
            })
            .catch((err) =>
                console.warn('[DriverFound] Gagal ambil rute:', err?.message)
            );
    }, [
        driver.coords.latitude,
        driver.coords.longitude,
        payload.origin.coords.latitude,
        payload.origin.coords.longitude,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    const polyline = useMemo(
        () =>
            route?.polyline?.length
                ? route.polyline
                : [driver.coords, payload.origin.coords],
        [route, driver.coords, payload.origin.coords]
    );

    // ---- AnimatedRegion untuk marker driver (smooth) ----
    const driverCoord = useRef(
        new AnimatedRegion({
            latitude: driver.coords.latitude,
            longitude: driver.coords.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
        })
    ).current;

    // ---- Update posisi marker tiap driver.coords berubah (dari polling parent) ----
    useEffect(() => {
        driverCoord
            .timing({
                latitude: driver.coords.latitude,
                longitude: driver.coords.longitude,
                latitudeDelta: 0,
                longitudeDelta: 0,
                duration: MARKER_ANIM_MS,
                useNativeDriver: false,
            } as any)
            .start();
    }, [
        driver.coords.latitude,
        driver.coords.longitude,
        driverCoord,
    ]);

    // ---- Matikan trackView setelah 500 ms (biar marker ringan) ----
    useEffect(() => {
        const t = setTimeout(() => setTrackView(false), 500);
        return () => clearTimeout(t);
    }, [driver.vehicleType]);

    // ---- Fit peta: sekali saat rute pertama tiba ----
    const fit = () => {
        mapRef.current?.fitToCoordinates(polyline, {
            edgePadding: {
                top: insets.top + 140,
                bottom: SHEET_H + 60,
                left: 60,
                right: 60,
            },
            animated: true,
        });
    };
    useEffect(() => {
        if (route && !fittedRef.current) {
            fittedRef.current = true;
            fit();
        }
    }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Status "sampai" ----
    // ⚠️ Karena Ojek tidak punya status backend 'arrived', kita pakai jarak.
    // Kalau nanti backend Ojek punya status 'arrived', ubah ke `driverStatus === 'arrived'`.
    const distToPickup = distanceMeters(driver.coords, payload.origin.coords);
    const arrived = distToPickup <= 50; // 50m

    useEffect(() => {
        if (arrived && !arrivedFiredRef.current) {
            arrivedFiredRef.current = true;
            onArrivedRef.current?.();
        }
    }, [arrived]);

    // ---- ETA dari route ----
    const remainSec = route?.durationSec ?? 300;
    const minutes = Math.max(1, Math.ceil(remainSec / 60));

    const call = () =>
        onCall ? onCall() : Linking.openURL(`tel:${driver.phone}`);

    const vehicleIcon =
        VEHICLE_IMG[driver.vehicleType ?? payload.service] ??
        VEHICLE_IMG.motor;

    return (
        <View style={{ flex: 1 }}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                onMapReady={fit}
                initialRegion={{
                    latitude: driver.coords.latitude,
                    longitude: driver.coords.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                }}
            >
                {/* Polyline aktif (driver -> pickup) */}
                <Polyline
                    coordinates={polyline}
                    strokeColor="#ffffff"
                    strokeWidth={9}
                    lineCap="round"
                    lineJoin="round"
                />
                <Polyline
                    coordinates={polyline}
                    strokeColor={colors.primary}
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                />

                {/* Marker titik jemput */}
                <Marker
                    coordinate={payload.origin.coords}
                    image={MARKER_ORIGIN}
                    anchor={{ x: 0.5, y: 1 }}
                    title={payload.origin.name}
                    description="Titik jemput"
                    zIndex={1}
                />

                {/* Marker driver — DINAMIS dari driver.coords */}
                <MarkerAnimated
                    coordinate={driverCoord}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={trackView}
                    zIndex={2}
                >
                    <View style={s.driverMarker}>
                        <Image
                            source={vehicleIcon}
                            style={{ width: 34, height: 34 }}
                            resizeMode="contain"
                        />
                    </View>
                </MarkerAnimated>
            </MapView>

            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[s.routeCard, { top: insets.top + 12 }]}
            >
                <View style={s.routeRow}>
                    <RouteDot type="origin" />
                    <Text style={s.routeText} numberOfLines={1}>
                        {payload.origin.name}
                    </Text>
                </View>
                <View style={s.routeDivider} />
                <View style={s.routeRow}>
                    <RouteDot type="destination" />
                    <Text style={s.routeText} numberOfLines={1}>
                        {payload.destination.name}
                    </Text>
                </View>
            </Animated.View>

            <View style={[s.floatBack, { bottom: SHEET_H + 12 }]}>
                <CircleButton icon="arrow-back" onPress={onBack} />
            </View>

            <Animated.View
                entering={FadeInUp.duration(350)}
                style={[
                    s.sheet,
                    { height: SHEET_H, paddingBottom: insets.bottom + 12 },
                ]}
            >
                <View style={s.handleArea}>
                    <View style={s.handle} />
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 4 }}
                >
                    <View style={s.statusRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.statusTitle}>
                                {arrived
                                    ? 'Drivermu sudah sampai'
                                    : 'Driver menuju lokasi jemputmu'}
                            </Text>
                            <Text style={s.statusSub}>
                                {arrived
                                    ? 'Segera temui drivermu di titik jemput'
                                    : 'Pantau posisinya di peta'}
                            </Text>
                        </View>
                        <View style={s.etaBox}>
                            <Text style={s.etaNum}>
                                {arrived ? '0' : minutes}
                            </Text>
                            <Text style={s.etaUnit}>mnt</Text>
                        </View>
                    </View>

                    <View style={s.driverCard}>
                        <View style={s.driverTop}>
                            <Avatar name={driver.name} uri={driver.photo} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.driverName} numberOfLines={1}>
                                    {driver.name}
                                </Text>
                                <View style={s.ratingRow}>
                                    <Ionicons
                                        name="star"
                                        size={14}
                                        color="#f5a623"
                                    />
                                    <Text style={s.ratingText}>
                                        {driver.rating.toFixed(1)}
                                    </Text>
                                    <View style={s.dot} />
                                    <Text
                                        style={s.tripsText}
                                        numberOfLines={1}
                                    >
                                        {rupiahDots(driver.trips)} perjalanan
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={s.driverDivider} />

                        <View style={s.vehicleRow}>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={s.vehicleName}
                                    numberOfLines={1}
                                >
                                    {driver.vehicle}
                                </Text>
                                <Text
                                    style={s.vehicleColor}
                                    numberOfLines={1}
                                >
                                    {driver.color}
                                </Text>
                            </View>
                            <View style={s.plate}>
                                <Text style={s.plateText}>
                                    {driver.plate}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={s.actionRow}>
                        <Pressable onPress={onChat} style={s.chatPill}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={20}
                                color={colors.textMuted}
                            />
                            <Text style={s.chatText}>
                                Kirim pesan ke driver
                            </Text>
                        </Pressable>
                        <Pressable onPress={call} style={s.callBtn}>
                            <Ionicons name="call" size={22} color="#fff" />
                        </Pressable>
                    </View>

                    <View style={s.fareRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.fareLabel}>
                                {payload.optionName}
                            </Text>
                            <View style={s.payRow}>
                                <Ionicons
                                    name="wallet"
                                    size={13}
                                    color={colors.primary}
                                />
                                <Text style={s.payText}>Tunai</Text>
                            </View>
                        </View>
                        <Text style={s.farePrice}>
                            {formatRupiah(payload.price)}
                        </Text>
                    </View>

                    <Pressable onPress={onCancel} style={s.cancelBtn}>
                        <Text style={s.cancelText}>Batalkan pesanan</Text>
                    </Pressable>
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    driverMarker: {
        width: 46,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
    },

    routeCard: {
        position: 'absolute',
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        height: 36,
    },
    routeText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    routeDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 36,
    },
    routeDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    routeDotInner: {
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: '#fff',
    },

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
    handleArea: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#c9ccd1',
    },

    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
    },
    statusTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
    statusSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    etaBox: {
        minWidth: 60,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
    },
    etaNum: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.primary,
        lineHeight: 26,
    },
    etaUnit: { fontSize: 12, fontWeight: '700', color: colors.primary },

    driverCard: {
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#F5F6F8',
        marginBottom: 12,
    },
    driverTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    driverDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#d9dce1',
        marginVertical: 12,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#dfe3e8',
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    driverName: { fontSize: 16, fontWeight: '800', color: colors.text },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    ratingText: { fontSize: 13, fontWeight: '700', color: colors.text },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: '#c4c8cf',
        marginHorizontal: 2,
    },
    tripsText: { flexShrink: 1, fontSize: 12, color: colors.textMuted },
    vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    vehicleName: { fontSize: 14, fontWeight: '700', color: colors.text },
    vehicleColor: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    plate: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.text,
        backgroundColor: '#fff',
    },
    plateText: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: 0.5,
    },

    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    chatPill: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    chatText: { fontSize: 14, color: colors.textMuted },
    callBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    fareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    fareLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    payRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
    payText: { fontSize: 13, color: colors.textMuted },
    farePrice: { fontSize: 17, fontWeight: '800', color: colors.text },

    cancelBtn: { alignItems: 'center', paddingVertical: 14 },
    cancelText: { fontSize: 15, fontWeight: '700', color: '#ee6c6c' },
});