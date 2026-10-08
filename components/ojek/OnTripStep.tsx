import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { getRoute } from '@/services/google-maps';
import type { OrderPayload, RouteInfo } from '@/types/ojek';
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
import type { Driver } from './DriverFoundStep';
import { CircleButton, MAP_PROVIDER } from './parts';

type Props = {
    payload: OrderPayload;
    driver: Driver; // driver.coords diperbarui realtime oleh OjekFlow (polling)
    onBack: () => void;
    onChat?: () => void;
    onCall?: () => void;
};

type LatLng = { latitude: number; longitude: number };

const VEHICLE_IMG = {
    motor: require('../../assets/images/motor-map.png'),
    mobil: require('../../assets/images/mobil-map.png'),
};
const MARKER_DEST = require('@/assets/images/marker-destination.png');

// Sedikit lebih pendek dari POLL_INTERVAL (3000 ms) di OjekFlow,
// supaya marker selalu sudah sampai sebelum titik berikutnya datang.
const MARKER_ANIM_MS = 2800;
// Driver dianggap keluar jalur jika > 150 m dari polyline
const OFF_ROUTE_METERS = 150;
// Jeda minimum antar pengambilan ulang rute
const REROUTE_MIN_INTERVAL_MS = 15000;
// Dianggap sampai tujuan jika sisa jarak <= 30 m
const ARRIVE_METERS = 30;

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

/** Index titik polyline yang paling dekat dengan posisi driver */
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

/** Animasikan marker dengan aman (bypass typing react-native-maps) */
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

export default function OnTripStep({
    payload,
    driver,
    onBack,
    onChat,
    onCall,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const SHEET_H = 300 + insets.bottom;

    const driverPos: LatLng = driver.coords;

    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [trackView, setTrackView] = useState(true);

    const fittedRef = useRef(false);
    const mountedRef = useRef(true);
    const reqRef = useRef(0);
    const lastRerouteRef = useRef(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // ---- Ambil rute ----
    const fetchRoute = (from: LatLng) => {
        const id = ++reqRef.current;
        getRoute(from, payload.destination.coords)
            .then((r) => {
                if (mountedRef.current && id === reqRef.current) setRoute(r);
            })
            .catch((err) =>
                console.warn('[OnTrip] Gagal ambil rute:', err?.message)
            );
    };

    // Rute awal: titik jemput -> tujuan
    useEffect(() => {
        fetchRoute(payload.origin.coords);
    }, [
        payload.origin.coords.latitude,
        payload.origin.coords.longitude,
        payload.destination.coords.latitude,
        payload.destination.coords.longitude,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    const polyline = useMemo<LatLng[]>(
        () =>
            route?.polyline?.length
                ? route.polyline
                : [payload.origin.coords, payload.destination.coords],
        [route, payload.origin.coords, payload.destination.coords]
    );
    const last = polyline.length - 1;

    // ---- Posisi driver pada polyline (REALTIME, bukan simulasi) ----
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

    // ---- AnimatedRegion untuk marker driver ----
    const driverCoord = useRef(
        new AnimatedRegion({
            latitude: driver.coords.latitude,
            longitude: driver.coords.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
        })
    ).current;

    // Geser marker setiap koordinat driver dari server berubah
    useEffect(() => {
        animateMarker(driverCoord, driverPos, MARKER_ANIM_MS);
    }, [driverPos.latitude, driverPos.longitude, driverCoord]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Matikan trackView setelah 500 ms ----
    useEffect(() => {
        const t = setTimeout(() => setTrackView(false), 500);
        return () => clearTimeout(t);
    }, []);

    // ---- Fit peta: sekali saat rute pertama tiba ----
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
        }
    }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---------- Sisa jarak, progress, ETA (dari posisi driver) ----------
    const remainingMeters = useMemo(() => {
        if (last < 0) return 0;
        return haversine(driverPos, polyline[idx]) + remainingDistance(polyline, idx);
    }, [polyline, idx, last, driverPos.latitude, driverPos.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

    const totalMeters = Math.max(
        route?.distanceMeters ?? remainingDistance(polyline, 0),
        remainingMeters,
        1
    );
    const progress = Math.min(1, Math.max(0, 1 - remainingMeters / totalMeters));

    const remainingKm = (remainingMeters / 1000).toFixed(1);
    const totalDistKm = (totalMeters / 1000).toFixed(1);

    const baseSec = route?.durationSec ?? payload.durationSec ?? 0;
    const remainSec = Math.round(baseSec * (remainingMeters / totalMeters));
    const minutes = Math.max(1, Math.ceil(remainSec / 60));

    const arrived = remainingMeters <= ARRIVE_METERS;

    const call = () => (onCall ? onCall() : Linking.openURL(`tel:${driver.phone}`));

    const vehicleIcon =
        VEHICLE_IMG[driver.vehicleType ?? payload.service] ?? VEHICLE_IMG.motor;

    // Jalur yang sudah dilewati & yang belum (berpusat di posisi driver)
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
                {/* Jalur yang sudah dilewati (abu-abu) */}
                {passed.length > 1 && (
                    <Polyline
                        coordinates={passed}
                        strokeColor={colors.border}
                        strokeWidth={5}
                        lineCap="round"
                        lineJoin="round"
                    />
                )}

                {/* Jalur yang belum dilewati (putih + biru) */}
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

                {/* Marker tujuan */}
                <Marker
                    coordinate={payload.destination.coords}
                    image={MARKER_DEST}
                    anchor={{ x: 0.5, y: 1 }}
                    title={payload.destination.name}
                    description="Tujuan"
                    zIndex={1}
                />

                {/* Marker driver — mengikuti driver.coords (realtime) */}
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
                    <View style={s.destDot}>
                        <View style={s.destDotInner} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.routeLabel}>Menuju</Text>
                        <Text style={s.routeText} numberOfLines={1}>
                            {payload.destination.name}
                        </Text>
                    </View>
                </View>
            </Animated.View>

            <View style={[s.floatBack, { bottom: SHEET_H + 12 }]}>
                <CircleButton icon="arrow-back" onPress={onBack} />
            </View>

            <Animated.View
                entering={FadeInUp.duration(350)}
                style={[s.sheet, { height: SHEET_H, paddingBottom: insets.bottom + 12 }]}
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
                                {arrived ? 'Sampai di tujuan' : 'Dalam perjalanan ke tujuan'}
                            </Text>
                            <Text style={s.statusSub}>
                                {arrived
                                    ? 'Perjalanan hampir selesai'
                                    : `${remainingKm} km lagi dari total ${totalDistKm} km`}
                            </Text>
                        </View>
                        <View style={s.etaBox}>
                            <Text style={s.etaNum}>{arrived ? '0' : minutes}</Text>
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
                                {driver.plate}
                            </Text>
                        </View>
                        <Pressable onPress={onChat} style={s.iconBtn}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={20}
                                color={colors.textMuted}
                            />
                        </Pressable>
                        <Pressable onPress={call} style={[s.iconBtn, s.iconBtnPrimary]}>
                            <Ionicons name="call" size={20} color="#fff" />
                        </Pressable>
                    </View>

                    <View style={s.fareRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.fareLabel}>{payload.optionName}</Text>
                            <View style={s.payRow}>
                                <Ionicons name="wallet" size={13} color={colors.primary} />
                                <Text style={s.payText}>Tunai</Text>
                            </View>
                        </View>
                        <Text style={s.farePrice}>{formatRupiah(payload.price)}</Text>
                    </View>
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
    routeText: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 1 },
    destDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#f26b21',
        alignItems: 'center',
        justifyContent: 'center',
    },
    destDotInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },

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
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#c9ccd1' },

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
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
    etaNum: { fontSize: 22, fontWeight: '800', color: colors.primary, lineHeight: 26 },
    etaUnit: { fontSize: 12, fontWeight: '700', color: colors.primary },

    progressTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E6E8EB',
        overflow: 'hidden',
        marginBottom: 16,
    },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },

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

    fareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    fareLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    payRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
    payText: { fontSize: 13, color: colors.textMuted },
    farePrice: { fontSize: 17, fontWeight: '800', color: colors.text },
});