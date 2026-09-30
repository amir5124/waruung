import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { getRoute } from '@/services/google-maps';
import type {
    ContactInfo,
    DriverInfo,
    GoSendCourierOption,
    PackageInfo,
    PlaceLoc,
} from '@/types/gosend';
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
    useWindowDimensions,
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

/** Data order WarSend (sama dengan payload yang dikirim saat booking) */
export type GoSendOrder = {
    origin: PlaceLoc;
    destination: PlaceLoc;
    option: GoSendCourierOption;
    packageInfo: PackageInfo;
    sender: ContactInfo | null;
    receiver: ContactInfo | null;
};

/**
 * Status driver dari backend.
 * - 'searching'  : backend belum menemukan driver (marker disembunyikan)
 * - 'pending'    : driver sudah ditugaskan tapi belum accept -> marker diam
 * - 'accepted'   : driver sudah accept, menuju pickup -> marker bergerak
 * - 'arrived'    : driver sudah sampai di titik jemput
 */
export type DriverStatus = 'searching' | 'pending' | 'accepted' | 'arrived';

type Props = {
    order: GoSendOrder;
    /**
     * Data driver dari API.
     * - `driver.coords` di-update parent secara live (polling / realtime).
     */
    driver: DriverInfo;
    /** Status driver dari backend. Kalau tidak dikirim, default 'accepted'. */
    status?: DriverStatus;
    /** Kode keamanan dari backend. Hanya ditampilkan kalau order.packageInfo.receiveCode = true */
    securityCode?: string | null;
    onBack: () => void;
    onCall: () => void;
    onChat: () => void;
    /** Kalau diisi, tombol "Batalkan pesanan" ditampilkan */
    onCancel?: () => void;
    /** Dipanggil sekali saat status backend berubah jadi 'arrived' */
    onArrived?: () => void;
};

const ORANGE = '#f26b21';

/**
 * Mapping gambar marker per tipe kendaraan.
 * Semua fallback tetap ke `kurir` supaya tidak crash.
 */
const MARKER_IMG: Record<string, any> = {
    kurir: require('../../assets/images/kurir-map.png'),
    motor: require('../../assets/images/motor-map.png'),
    mobil: require('../../assets/images/mobil-map.png'),
    motor_food: require('../../assets/images/kurir-map.png'),
};

const DEFAULT_MARKER = MARKER_IMG.kurir;

const REFETCH_ROUTE_METERS = 100; // ambil rute ulang kalau driver bergeser > 100 m
const MARKER_ANIM_MS = 1000; // durasi animasi marker antar update lokasi

type LatLng = { latitude: number; longitude: number };

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
        <View style={[s.routeDot, { backgroundColor: colors.secondary }]}>
            <Ionicons name="arrow-down" size={14} color="#fff" />
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

const sizeLabel = (size?: string | null) =>
    !size
        ? ''
        : size === 'kecil'
            ? 'Kecil'
            : size.charAt(0).toUpperCase() + size.slice(1);

/** Ambil gambar marker sesuai tipe kendaraan driver, fallback ke kurir */
function getMarkerImage(vehicleType?: string | null) {
    if (!vehicleType) return DEFAULT_MARKER;
    return MARKER_IMG[vehicleType.toLowerCase()] ?? DEFAULT_MARKER;
}

export default function DriverFoundStep({
    order,
    driver,
    status = 'accepted',
    securityCode,
    onBack,
    onCall,
    onChat,
    onCancel,
    onArrived,
}: Props) {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const mapRef = useRef<MapView>(null);

    const { origin, destination, option, packageInfo, sender, receiver } = order;
    const showCode = !!packageInfo.receiveCode;

    // marker bergerak hanya kalau driver sudah accept
    const isTracking = status === 'accepted' || status === 'arrived';
    const isWaiting = status === 'searching' || status === 'pending';

    const SHEET_H =
        Math.round(Math.min(windowHeight * 0.6, 540)) + insets.bottom;

    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [trackView, setTrackView] = useState(true);
    const arrivedFiredRef = useRef(false);
    const onArrivedRef = useRef(onArrived);
    onArrivedRef.current = onArrived;

    // ---- Rute driver -> titik jemput, refresh kalau driver bergeser jauh ----
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
        )
            return;

        lastFetchRef.current = driver.coords;
        const id = ++reqRef.current;
        getRoute(driver.coords, origin.coords)
            .then((r) => {
                if (mountedRef.current && id === reqRef.current) setRoute(r);
            })
            .catch((err) =>
                console.warn('[DriverFound] Gagal ambil rute:', err?.message)
            );
    }, [
        driver.coords.latitude,
        driver.coords.longitude,
        origin.coords.latitude,
        origin.coords.longitude,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    const polyline = useMemo(
        () =>
            route?.polyline?.length
                ? route.polyline
                : [driver.coords, origin.coords],
        [route, driver.coords, origin.coords]
    );

    // ---- Marker driver bergerak halus antar update lokasi ----
    const driverCoord = useRef(
        new AnimatedRegion({
            latitude: driver.coords.latitude,
            longitude: driver.coords.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
        })
    ).current;

    useEffect(() => {
        // Saat status masih pending/searching, jangan animasi — posisikan langsung.
        if (!isTracking) {
            driverCoord.setValue({
                latitude: driver.coords.latitude,
                longitude: driver.coords.longitude,
                latitudeDelta: 0,
                longitudeDelta: 0,
            });
            return;
        }

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
        isTracking,
    ]);

    // marker berisi Image -> tracksViewChanges sebentar supaya gambar ter-render, lalu dimatikan
    useEffect(() => {
        setTrackView(true);
        const t = setTimeout(() => setTrackView(false), 1200);
        return () => clearTimeout(t);
    }, [driver.vehicleType]);

    // ---- Fit peta: sekali saat rute pertama tiba ----
    const fittedRef = useRef(false);
    const fit = () => {
        mapRef.current?.fitToCoordinates(polyline, {
            edgePadding: {
                top: insets.top + 150,
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

    // ---- Status sampai ----
    // ⚠️ FIX: "arrived" ditentukan backend (status === 'arrived').
    // JANGAN pakai jarak — karena saat driver accept, coords-nya bisa sudah
    // dekat dengan pickup (driver memang di sekitar sana) sehingga UI salah
    // anggap "sudah sampai" padahal backend masih 'accepted'.
    const distToPickup = distanceMeters(driver.coords, origin.coords);
    const arrived = status === 'arrived';

    // Trigger onArrived sekali saja saat backend bilang arrived
    useEffect(() => {
        if (arrived && !arrivedFiredRef.current) {
            arrivedFiredRef.current = true;
            onArrivedRef.current?.();
        }
    }, [arrived]);

    // ETA:
    // - kalau tracking: pakai durationSec dari rute
    // - kalau menunggu: pakai driver.etaMinutes (dari backend)
    const remainSec = isTracking
        ? route?.durationSec ?? (driver.etaMinutes ?? 5) * 60
        : (driver.etaMinutes ?? 5) * 60;
    const minutes = Math.max(1, Math.ceil(remainSec / 60));

    const call = () => {
        Linking.openURL(`tel:${driver.phone}`);
        onCall();
    };

    // ---- Teks status dinamis ----
    const statusTitle = arrived
        ? 'Drivermu sudah sampai'
        : status === 'searching'
            ? 'Mencari driver…'
            : status === 'pending'
                ? 'Menunggu driver menerima pesanan…'
                : 'Driver menuju lokasi jemputmu';

    const statusSub = arrived
        ? 'Segera temui drivermu di titik jemput'
        : status === 'searching'
            ? 'Kami sedang mencarikan driver terdekat'
            : status === 'pending'
                ? 'Pesananmu sudah dikirim ke driver'
                : 'Pantau posisinya di peta';

    // ---- Marker image dinamis ----
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
                    latitude: driver.coords.latitude,
                    longitude: driver.coords.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                }}
            >
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

                <Marker
                    coordinate={origin.coords}
                    anchor={{ x: 0.5, y: 1 }}
                    title={origin.name}
                    description="Titik jemput"
                    zIndex={1}
                >
                    <View style={s.pickupMarker}>
                        <Ionicons name="location" size={16} color="#fff" />
                    </View>
                </Marker>

                {/* Marker driver hanya muncul kalau sudah ada driver dari backend */}
                {status !== 'searching' && (
                    <MarkerAnimated
                        coordinate={driverCoord as any}
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
                )}
            </MapView>

            {/* kartu titik jemput + tujuan */}
            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[s.routeCard, { top: insets.top + 12 }]}
            >
                <View style={s.routeRow}>
                    <RouteDot type="origin" />
                    <Text style={s.routeText} numberOfLines={1}>
                        {origin.name}
                    </Text>
                </View>
                <View style={s.routeDivider} />
                <View style={s.routeRow}>
                    <RouteDot type="destination" />
                    <Text style={s.routeText} numberOfLines={1}>
                        {destination.name}
                    </Text>
                </View>
            </Animated.View>

            <View style={[s.floatBack, { bottom: SHEET_H + 12 }]}>
                <CircleButton icon="arrow-back" onPress={onBack} />
            </View>

            {/* bottom sheet */}
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
                    {/* status + ETA */}
                    <View style={s.statusRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.statusTitle}>{statusTitle}</Text>
                            <Text style={s.statusSub}>{statusSub}</Text>
                        </View>
                        <View style={s.etaBox}>
                            <Text style={s.etaNum}>
                                {arrived ? '0' : minutes}
                            </Text>
                            <Text style={s.etaUnit}>mnt</Text>
                        </View>
                    </View>

                    {/* data driver — tampil hanya kalau driver sudah ada */}
                    {!isWaiting || status === 'pending' ? (
                        <View style={s.driverCard}>
                            <View style={s.driverTop}>
                                <Avatar
                                    name={driver.name}
                                    uri={driver.photoUrl}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={s.driverName}
                                        numberOfLines={1}
                                    >
                                        {driver.name}
                                    </Text>
                                    <View style={s.ratingRow}>
                                        <Ionicons
                                            name="star"
                                            size={14}
                                            color="#f5a623"
                                        />
                                        <Text style={s.ratingText}>
                                            {(driver.rating ?? 0).toFixed(1)}
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
                                        {driver.vehicleModel}
                                    </Text>
                                </View>
                                <View style={s.plate}>
                                    <Text style={s.plateText}>
                                        {driver.vehiclePlate}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        // skeleton loading saat masih searching
                        <View style={s.skeletonCard}>
                            <Text style={s.skeletonText}>
                                Sedang mencarikan driver untukmu…
                            </Text>
                        </View>
                    )}

                    {/* chat + telepon */}
                    <View style={s.actionRow}>
                        <Pressable
                            onPress={onChat}
                            style={[s.chatPill, isWaiting && s.disabled]}
                            disabled={isWaiting && status === 'searching'}
                        >
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={20}
                                color={colors.textMuted}
                            />
                            <Text style={s.chatText}>
                                Kirim pesan ke driver
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={call}
                            style={[
                                s.callBtn,
                                isWaiting &&
                                status === 'searching' &&
                                s.disabled,
                            ]}
                            disabled={isWaiting && status === 'searching'}
                        >
                            <Ionicons name="call" size={22} color="#fff" />
                        </Pressable>
                    </View>

                    {/* detail paket (dari order) */}
                    <View style={s.infoCard}>
                        <View style={s.infoRow}>
                            <Ionicons
                                name="cube-outline"
                                size={18}
                                color={colors.textMuted}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={s.infoTitle}>
                                    {[
                                        packageInfo.type,
                                        sizeLabel(packageInfo.size),
                                    ]
                                        .filter(Boolean)
                                        .join(' • ')}
                                </Text>
                                {!!packageInfo.weight && (
                                    <Text style={s.infoSub}>
                                        {packageInfo.weight}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {(sender || receiver) && (
                            <View style={s.infoDivider} />
                        )}

                        {sender && (
                            <View style={s.infoRow}>
                                <RouteDot type="origin" />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.infoTitle} numberOfLines={1}>
                                        Pengirim: {sender.name}
                                    </Text>
                                    <Text style={s.infoSub}>+62 {sender.phone}</Text>
                                    {!!sender.landmark && (
                                        <Text style={s.infoSub}>📍 {sender.landmark}</Text>
                                    )}
                                </View>
                            </View>
                        )}
                        {receiver && (
                            <View style={[s.infoRow, sender && { marginTop: 10 }]}>
                                <RouteDot type="destination" />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.infoTitle} numberOfLines={1}>
                                        Penerima: {receiver.name}
                                    </Text>
                                    <Text style={s.infoSub}>+62 {receiver.phone}</Text>
                                    {!!receiver.landmark && (
                                        <Text style={s.infoSub}>📍 {receiver.landmark}</Text>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>

                    {/* ongkir */}
                    <View style={s.fareRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.fareLabel}>{option.name}</Text>
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
                            {formatRupiah(option.price)}
                        </Text>
                    </View>

                    {/* kode keamanan: hanya kalau "Kode terima paket" diaktifkan */}
                    {showCode && (
                        <View style={[s.fareRow, { borderTopWidth: 0 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.fareLabel}>
                                    Kode keamanan
                                </Text>
                                <View style={s.payRow}>
                                    <Ionicons
                                        name="shield-checkmark"
                                        size={13}
                                        color={colors.primary}
                                    />
                                    <Text style={s.payText}>
                                        Cocokkan dengan driver sebelum serah
                                        terima
                                    </Text>
                                </View>
                            </View>
                            <Text style={s.codeText}>
                                {securityCode || '—'}
                            </Text>
                        </View>
                    )}

                    {onCancel && (
                        <Pressable onPress={onCancel} style={s.cancelBtn}>
                            <Text style={s.cancelText}>
                                Batalkan pesanan
                            </Text>
                        </Pressable>
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
        borderColor: colors.primary,
    },
    pickupMarker: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: ORANGE,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
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
    vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    vehicleName: { fontSize: 14, fontWeight: '700', color: colors.text },
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

    skeletonCard: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#F5F6F8',
        marginBottom: 12,
        alignItems: 'center',
    },
    skeletonText: {
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: '600',
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
    disabled: { opacity: 0.45 },

    infoCard: {
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    infoTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    infoSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    infoDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginVertical: 12,
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
    payRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 3,
    },
    payText: { flexShrink: 1, fontSize: 12, color: colors.textMuted },
    farePrice: { fontSize: 17, fontWeight: '800', color: colors.text },
    codeText: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
        letterSpacing: 2,
    },

    cancelBtn: { alignItems: 'center', paddingVertical: 14 },
    cancelText: { fontSize: 15, fontWeight: '700', color: '#ee6c6c' },
});