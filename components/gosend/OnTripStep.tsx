import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { getRoute } from '@/services/google-maps';
import type { DriverInfo, PackageInfo, PlaceLoc } from '@/types/gosend';
import type { RouteInfo } from '@/types/ojek';
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
import { CircleButton, MAP_PROVIDER } from '../ojek/parts';

type Props = {
    origin: PlaceLoc;
    destination: PlaceLoc;
    driver: DriverInfo;
    securityCode?: string | null;
    receiveCode: boolean;
    packageInfo?: PackageInfo;
    price?: number;
    optionName?: string;
    onBack: () => void;
    onArrived?: () => void;
    onChat?: () => void;
    onCall?: () => void;
    tripDurationMs?: number;
};

/**
 * Mapping gambar marker per tipe kendaraan.
 * Konsisten dengan DriverFoundStep — semua fallback ke `kurir`.
 */
const MARKER_IMG: Record<string, any> = {
    kurir: require('@/assets/images/kurir-map.png'),
    motor: require('@/assets/images/kurir-map.png'),
    mobil: require('@/assets/images/mobil-map.png'),
    motor_food: require('@/assets/images/kurir-map.png'),
};
const DEFAULT_MARKER = MARKER_IMG.kurir;

const MARKER_DEST = require('@/assets/images/marker-destination.png');

function getMarkerImage(vehicleType?: string | null) {
    if (!vehicleType) return DEFAULT_MARKER;
    return MARKER_IMG[vehicleType.toLowerCase()] ?? DEFAULT_MARKER;
}

// Simulasi: tick 100 ms
const TICK_MS = 100;
const MARKER_ANIM_MS = 150;

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

function haversine(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
): number {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

function remainingDistance(
    polyline: { latitude: number; longitude: number }[],
    fromIdx: number
): number {
    let total = 0;
    for (let i = fromIdx; i < polyline.length - 1; i++) {
        total += haversine(polyline[i], polyline[i + 1]);
    }
    return total;
}

function animateMarker(
    region: AnimatedRegion,
    to: { latitude: number; longitude: number },
    duration: number
) {
    const config: any = {
        latitude: to.latitude,
        longitude: to.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration,
        useNativeDriver: false,
    };
    region.timing(config).start();
}

const sizeLabel = (size?: string | null) =>
    !size
        ? ''
        : size === 'kecil'
            ? 'Kecil'
            : size.charAt(0).toUpperCase() + size.slice(1);

export default function OnTripStep({
    origin,
    destination,
    driver,
    securityCode,
    receiveCode,
    packageInfo,
    price,
    optionName,
    onBack,
    onArrived,
    onChat,
    onCall,
    tripDurationMs = 60000,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const SHEET_H = (receiveCode ? 380 : 320) + insets.bottom;

    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [idx, setIdx] = useState(0);
    const [trackView, setTrackView] = useState(true);

    const arrivedRef = useRef(false);
    const onArrivedRef = useRef(onArrived);
    onArrivedRef.current = onArrived;

    // ---- Ambil rute origin -> destination ----
    useEffect(() => {
        let alive = true;
        getRoute(origin.coords, destination.coords).then((r) => {
            if (!alive) return;
            setRoute(r);
            setIdx(0);
        });
        return () => {
            alive = false;
        };
    }, [origin.coords, destination.coords]);

    const polyline = useMemo(
        () =>
            route?.polyline?.length
                ? route.polyline
                : [origin.coords, destination.coords],
        [route, origin.coords, destination.coords]
    );
    const last = polyline.length - 1;

    // ---- AnimatedRegion untuk marker ----
    const driverCoord = useRef(
        new AnimatedRegion({
            latitude: origin.coords.latitude,
            longitude: origin.coords.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
        })
    ).current;

    useEffect(() => {
        if (polyline.length === 0) return;
        const p0 = polyline[0];
        driverCoord.setValue({
            latitude: p0.latitude,
            longitude: p0.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
        });
    }, [polyline, driverCoord]);

    // ---- Simulasi pergerakan: tick 100 ms ----
    useEffect(() => {
        if (last < 1) return;
        const totalTicks = Math.max(1, Math.round(tripDurationMs / TICK_MS));
        const stepSize = Math.max(0.5, last / totalTicks);
        const id = setInterval(() => {
            setIdx((i) => {
                const next = i + stepSize;
                return next >= last ? last : next;
            });
        }, TICK_MS);
        return () => clearInterval(id);
    }, [last, tripDurationMs]);

    // ---- Animasikan marker tiap idx berubah ----
    useEffect(() => {
        if (polyline.length === 0) return;
        const pos = polyline[Math.min(Math.floor(idx), last)];
        if (!pos) return;
        animateMarker(driverCoord, pos, MARKER_ANIM_MS);
    }, [idx, polyline, last, driverCoord]);

    useEffect(() => {
        const t = setTimeout(() => setTrackView(false), 500);
        return () => clearTimeout(t);
    }, []);

    const fit = () => {
        mapRef.current?.fitToCoordinates(polyline, {
            edgePadding: {
                top: insets.top + 120,
                bottom: SHEET_H + 60,
                left: 60,
                right: 60,
            },
            animated: true,
        });
    };
    useEffect(() => {
        if (route) fit();
    }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

    const arrived = last >= 1 && idx >= last;

    useEffect(() => {
        if (arrived && !arrivedRef.current) {
            arrivedRef.current = true;
            onArrivedRef.current?.();
        }
    }, [arrived]);

    const progress = last > 0 ? idx / last : 1;

    const remainingMeters = useMemo(() => {
        if (last < 1) return 0;
        return remainingDistance(polyline, Math.min(Math.floor(idx), last));
    }, [polyline, idx, last]);

    const remainingKm = (remainingMeters / 1000).toFixed(1);
    const totalDistKm = route ? (route.distanceMeters / 1000).toFixed(1) : null;

    const totalSec = route?.durationSec ?? Math.round(tripDurationMs / 1000);
    const remainSec = Math.round(totalSec * (1 - progress));
    const minutes = Math.max(1, Math.ceil(remainSec / 60));

    const call = () =>
        onCall ? onCall() : Linking.openURL(`tel:${driver.phone}`);

    const markerImg = getMarkerImage(driver.vehicleType);

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
                    latitude: origin.coords.latitude,
                    longitude: origin.coords.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                }}
            >
                <Polyline
                    coordinates={polyline.slice(0, Math.floor(idx) + 1)}
                    strokeColor={colors.border}
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                />
                <Polyline
                    coordinates={polyline.slice(Math.floor(idx))}
                    strokeColor="#ffffff"
                    strokeWidth={9}
                    lineCap="round"
                    lineJoin="round"
                />
                <Polyline
                    coordinates={polyline.slice(Math.floor(idx))}
                    strokeColor={colors.primary}
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                />

                <Marker
                    coordinate={destination.coords}
                    image={MARKER_DEST}
                    anchor={{ x: 0.5, y: 1 }}
                    title={destination.name}
                    description="Tujuan"
                    zIndex={1}
                />

                <MarkerAnimated
                    coordinate={driverCoord}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={trackView}
                    zIndex={2}
                >
                    <View style={s.driverMarker}>
                        <Image
                            source={markerImg}
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
                    <View style={s.destDot}>
                        <View style={s.destDotInner} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.routeLabel}>Menuju</Text>
                        <Text style={s.routeText} numberOfLines={1}>
                            {destination.name}
                        </Text>
                    </View>
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
                                    ? 'Paket sampai di tujuan'
                                    : 'Paketmu dalam perjalanan'}
                            </Text>
                            <Text style={s.statusSub}>
                                {arrived
                                    ? 'Menyerahkan paket ke penerima'
                                    : totalDistKm
                                        ? `${remainingKm} km lagi dari total ${totalDistKm} km`
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

                    <View style={s.progressTrack}>
                        <View
                            style={[
                                s.progressFill,
                                { width: `${Math.round(progress * 100)}%` },
                            ]}
                        />
                    </View>

                    <View style={s.driverRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.driverName} numberOfLines={1}>
                                {driver.name}
                            </Text>
                            <Text style={s.driverPlate} numberOfLines={1}>
                                {driver.vehiclePlate}
                            </Text>
                        </View>
                        <Pressable onPress={onChat} style={s.iconBtn}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={20}
                                color={colors.textMuted}
                            />
                        </Pressable>
                        <Pressable
                            onPress={call}
                            style={[s.iconBtn, s.iconBtnPrimary]}
                        >
                            <Ionicons name="call" size={20} color="#fff" />
                        </Pressable>
                    </View>

                    {packageInfo && packageInfo.type && (
                        <View style={s.infoRow}>
                            <Ionicons
                                name="cube-outline"
                                size={16}
                                color={colors.textMuted}
                            />
                            <Text style={s.infoText} numberOfLines={1}>
                                {[packageInfo.type, sizeLabel(packageInfo.size)]
                                    .filter(Boolean)
                                    .join(' • ')}
                            </Text>
                        </View>
                    )}

                    {typeof price === 'number' && (
                        <View style={s.fareRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.fareLabel}>
                                    {optionName ?? 'WarSend'}
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
                                {formatRupiah(price)}
                            </Text>
                        </View>
                    )}

                    {receiveCode && (
                        <View style={s.codeRow}>
                            <View style={s.codeIcon}>
                                <Ionicons
                                    name="shield-checkmark"
                                    size={18}
                                    color={colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.codeTitle}>
                                    Kode keamanan
                                </Text>
                                <Text style={s.codeSub}>
                                    Cocokkan dengan driver sebelum serah
                                    terima paket
                                </Text>
                            </View>
                            <Text style={s.codeValue}>
                                {securityCode || '—'}
                            </Text>
                        </View>
                    )}
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
        paddingVertical: 10,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    routeLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textMuted,
    },
    routeText: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginTop: 1,
    },
    destDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#f26b21',
        alignItems: 'center',
        justifyContent: 'center',
    },
    destDotInner: {
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
    handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
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
        marginBottom: 12,
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
    progressTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E6E8EB',
        overflow: 'hidden',
        marginBottom: 16,
    },
    progressFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
    driverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#F5F6F8',
        marginBottom: 12,
    },
    driverName: { fontSize: 15, fontWeight: '800', color: colors.text },
    driverPlate: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBtnPrimary: { backgroundColor: colors.primary, borderWidth: 0 },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 4,
        marginBottom: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: colors.text,
        fontWeight: '600',
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
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: 14,
    },
    codeIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    codeTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    codeSub: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
        lineHeight: 15,
    },
    codeValue: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.primary,
        letterSpacing: 2,
    },
});