import { mapStyle } from '@/constants/ojek-map-style';
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

type LatLng = { latitude: number; longitude: number };

type Props = {
    origin: PlaceLoc;
    destination: PlaceLoc;
    /** driver.coords harus diperbarui realtime oleh parent (polling) */
    driver: DriverInfo & { coords?: LatLng | null };
    /** status order dari backend (opsional): 'in_progress' | 'completed' */
    status?: string;
    securityCode?: string | null;
    receiveCode: boolean;
    packageInfo?: PackageInfo;
    price?: number;
    optionName?: string;
    onBack: () => void;
    /** dipanggil sekali saat status order menjadi 'completed' */
    onArrived?: () => void;
    onChat?: () => void;
    onCall?: () => void;
};

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

// Sedikit lebih pendek dari interval polling (3000 ms) di parent
const MARKER_ANIM_MS = 2800;
// Driver dianggap keluar jalur jika > 150 m dari polyline
const OFF_ROUTE_METERS = 150;
// Jeda minimum antar pengambilan ulang rute
const REROUTE_MIN_INTERVAL_MS = 15000;
// Dianggap dekat tujuan jika sisa jarak <= 30 m
const NEAR_METERS = 30;
// Abaikan gerak kecil (jitter GPS) untuk arah ikon
const HEADING_MIN_METERS = 5;
// 0 jika gambar menghadap ke atas (utara). Ubah (90/180/-90) bila perlu.
const ICON_HEADING_OFFSET = 0;
// Kamera mengikuti driver
const FOLLOW_ZOOM = 16;
const FOLLOW_START_DELAY_MS = 2500;

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

function haversine(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

function remainingDistance(polyline: LatLng[], fromIdx: number): number {
    let total = 0;
    for (let i = fromIdx; i < polyline.length - 1; i++) {
        total += haversine(polyline[i], polyline[i + 1]);
    }
    return total;
}

function nearestIndex(polyline: LatLng[], pos: LatLng): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < polyline.length; i++) {
        const d = haversine(pos, polyline[i]);
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
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

function animateMarker(region: AnimatedRegion, to: LatLng, duration: number) {
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
    status,
    securityCode,
    receiveCode,
    packageInfo,
    price,
    optionName,
    onBack,
    onArrived,
    onChat,
    onCall,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const SHEET_H = (receiveCode ? 380 : 320) + insets.bottom;

    // Posisi driver realtime (fallback ke titik jemput bila belum ada)
    const driverPos: LatLng = driver.coords ?? origin.coords;

    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [trackView, setTrackView] = useState(true);

    const fittedRef = useRef(false);
    const mountedRef = useRef(true);
    const reqRef = useRef(0);
    const lastRerouteRef = useRef(0);
    // Jarak total awal, supaya progress tidak reset saat rute diambil ulang
    const baseTotalRef = useRef(0);

    const [following, setFollowing] = useState(true);
    const [followReady, setFollowReady] = useState(false);

    const onArrivedRef = useRef(onArrived);
    onArrivedRef.current = onArrived;
    const arrivedFiredRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // ---- Ambil rute ----
    const fetchRoute = (from: LatLng) => {
        const id = ++reqRef.current;
        getRoute(from, destination.coords)
            .then((r) => {
                if (mountedRef.current && id === reqRef.current) {
                    if (!baseTotalRef.current && r?.distanceMeters) {
                        baseTotalRef.current = r.distanceMeters;
                    }
                    setRoute(r);
                }
            })
            .catch((err) =>
                console.warn('[GoSend OnTrip] Gagal ambil rute:', err?.message)
            );
    };

    // Rute awal: titik jemput -> tujuan
    useEffect(() => {
        fetchRoute(origin.coords);
    }, [
        origin.coords.latitude,
        origin.coords.longitude,
        destination.coords.latitude,
        destination.coords.longitude,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    const polyline = useMemo<LatLng[]>(
        () =>
            route?.polyline?.length
                ? route.polyline
                : [origin.coords, destination.coords],
        [route, origin.coords, destination.coords]
    );
    const last = polyline.length - 1;

    // ---- Posisi driver pada polyline (REALTIME) ----
    const idx = useMemo(
        () => nearestIndex(polyline, driverPos),
        [polyline, driverPos.latitude, driverPos.longitude] // eslint-disable-line react-hooks/exhaustive-deps
    );

    // ---- Rute ulang kalau driver keluar jalur ----
    useEffect(() => {
        if (!route) return;
        const offRoute = haversine(driverPos, polyline[idx]);
        const now = Date.now();
        if (
            offRoute > OFF_ROUTE_METERS &&
            now - lastRerouteRef.current > REROUTE_MIN_INTERVAL_MS
        ) {
            lastRerouteRef.current = now;
            fetchRoute(driverPos);
        }
    }, [driverPos.latitude, driverPos.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Marker driver: bergerak halus ----
    const driverCoord = useRef(
        new AnimatedRegion({
            latitude: driverPos.latitude,
            longitude: driverPos.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
        })
    ).current;

    useEffect(() => {
        animateMarker(driverCoord, driverPos, MARKER_ANIM_MS);
    }, [driverPos.latitude, driverPos.longitude, driverCoord]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Arah ikon dari pergerakan terakhir ----
    const [heading, setHeading] = useState(0);
    const prevPosRef = useRef<LatLng>(driverPos);
    useEffect(() => {
        if (haversine(prevPosRef.current, driverPos) > HEADING_MIN_METERS) {
            setHeading(bearing(prevPosRef.current, driverPos));
            prevPosRef.current = driverPos;
        }
    }, [driverPos.latitude, driverPos.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Fit peta sekali saat rute pertama tiba ----
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
        if (route && !fittedRef.current) {
            fittedRef.current = true;
            fit();
            const t = setTimeout(() => setFollowReady(true), FOLLOW_START_DELAY_MS);
            return () => clearTimeout(t);
        }
    }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Kamera mengikuti driver ----
    useEffect(() => {
        if (!following || !followReady) return;
        mapRef.current?.animateCamera(
            { center: driverPos, zoom: FOLLOW_ZOOM },
            { duration: MARKER_ANIM_MS }
        );
    }, [following, followReady, driverPos.latitude, driverPos.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Sisa jarak, progress, ETA ----
    const remainingMeters = useMemo(() => {
        if (last < 0) return 0;
        return haversine(driverPos, polyline[idx]) + remainingDistance(polyline, idx);
    }, [polyline, idx, last, driverPos.latitude, driverPos.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

    const totalMeters = Math.max(
        baseTotalRef.current ||
        route?.distanceMeters ||
        remainingDistance(polyline, 0),
        remainingMeters,
        1
    );
    const progress = Math.min(1, Math.max(0, 1 - remainingMeters / totalMeters));

    const remainingKm = (remainingMeters / 1000).toFixed(1);
    const totalDistKm = (totalMeters / 1000).toFixed(1);

    const baseSec = route?.durationSec ?? 0;
    const routeMeters = route?.distanceMeters ?? totalMeters;
    const remainSec = Math.round(
        baseSec * Math.min(1, remainingMeters / Math.max(routeMeters, 1))
    );
    const minutes = Math.max(1, Math.ceil(remainSec / 60));

    // Dekat tujuan (berdasarkan jarak), selesai (berdasarkan status backend)
    const nearDestination = remainingMeters <= NEAR_METERS;
    const completed = status === 'completed';

    useEffect(() => {
        if (completed && !arrivedFiredRef.current) {
            arrivedFiredRef.current = true;
            onArrivedRef.current?.();
        }
    }, [completed]);

    const call = () =>
        onCall ? onCall() : Linking.openURL(`tel:${driver.phone}`);

    const markerImg = getMarkerImage(driver.vehicleType);

    // Jalur yang sudah dilewati & yang belum
    const passed = useMemo(
        () => [...polyline.slice(0, idx + 1), driverPos],
        [polyline, idx, driverPos.latitude, driverPos.longitude] // eslint-disable-line react-hooks/exhaustive-deps
    );
    const ahead = useMemo(
        () => [driverPos, ...polyline.slice(idx + 1)],
        [polyline, idx, driverPos.latitude, driverPos.longitude] // eslint-disable-line react-hooks/exhaustive-deps
    );

    return (
        <View style={{ flex: 1 }}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                customMapStyle={mapStyle}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                onMapReady={fit}
                // geser manual → berhenti mengikuti driver
                onPanDrag={() => setFollowing(false)}
                initialRegion={{
                    latitude: driverPos.latitude,
                    longitude: driverPos.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                }}
            >
                {/* Jalur yang sudah dilewati */}
                {passed.length > 1 && (
                    <Polyline
                        coordinates={passed}
                        strokeColor={colors.border}
                        strokeWidth={5}
                        lineCap="round"
                        lineJoin="round"
                    />
                )}

                {/* Jalur yang belum dilewati */}
                {ahead.length > 1 && (
                    <>
                        <Polyline
                            coordinates={ahead}
                            strokeColor="#ffffff"
                            strokeWidth={9}
                            lineCap="round"
                            lineJoin="round"
                        />
                        <Polyline
                            coordinates={ahead}
                            strokeColor={colors.primary}
                            strokeWidth={5}
                            lineCap="round"
                            lineJoin="round"
                        />
                    </>
                )}

                <Marker
                    coordinate={destination.coords}
                    image={MARKER_DEST}
                    anchor={{ x: 0.5, y: 1 }}
                    title={destination.name}
                    description="Tujuan"
                    zIndex={1}
                />

                {/* Marker driver: realtime, berputar sesuai arah */}
                <MarkerAnimated
                    coordinate={driverCoord}
                    anchor={{ x: 0.5, y: 0.5 }}
                    flat
                    rotation={(heading + ICON_HEADING_OFFSET) % 360}
                    tracksViewChanges={trackView}
                    zIndex={2}
                >
                    <View style={s.driverMarker}>
                        <Image
                            source={markerImg}
                            style={{ width: 34, height: 34 }}
                            resizeMode="contain"
                            onLoad={() => setTimeout(() => setTrackView(false), 150)}
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

            {/* Tombol pusatkan ke driver, muncul saat peta digeser manual */}
            {!following && (
                <View style={[s.floatRecenter, { bottom: SHEET_H + 12 }]}>
                    <CircleButton
                        icon="locate"
                        onPress={() => {
                            setFollowing(true);
                            mapRef.current?.animateCamera(
                                { center: driverPos, zoom: FOLLOW_ZOOM },
                                { duration: 600 }
                            );
                        }}
                    />
                </View>
            )}

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
                                {completed
                                    ? 'Paket sudah diterima'
                                    : nearDestination
                                        ? 'Driver sudah di tujuan'
                                        : 'Paketmu dalam perjalanan'}
                            </Text>
                            <Text style={s.statusSub}>
                                {completed
                                    ? 'Pengiriman selesai'
                                    : nearDestination
                                        ? 'Menyerahkan paket ke penerima'
                                        : `${remainingKm} km lagi dari total ${totalDistKm} km`}
                            </Text>
                        </View>
                        <View style={s.etaBox}>
                            <Text style={s.etaNum}>
                                {completed || nearDestination ? '0' : minutes}
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
                            <Text style={s.farePrice}>{formatRupiah(price)}</Text>
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
                                <Text style={s.codeTitle}>Kode keamanan</Text>
                                <Text style={s.codeSub}>
                                    Cocokkan dengan driver sebelum serah terima
                                    paket
                                </Text>
                            </View>
                            <Text style={s.codeValue}>{securityCode || '—'}</Text>
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
    routeLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
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
    floatRecenter: { position: 'absolute', right: 16 },
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
    driverPlate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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