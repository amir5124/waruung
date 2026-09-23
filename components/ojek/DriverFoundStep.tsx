import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { getRoute } from '@/services/google-maps';
import type { OrderPayload, RouteInfo, ServiceType } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER } from './parts';

export type Driver = {
    id: string;
    name: string;
    /** URL foto driver. Kalau kosong / gagal dimuat -> tampil inisial nama */
    photo?: string;
    rating: number;
    trips: number;
    plate: string;
    vehicle: string;
    color: string;
    phone: string;
    coords: { latitude: number; longitude: number };
};

/** DATA DUMMY untuk simulasi. Ganti dengan respons backend saat driver benar-benar ditemukan. */
export function makeDummyDriver(service: ServiceType, near: { latitude: number; longitude: number }): Driver {
    const coords = { latitude: near.latitude + 0.009, longitude: near.longitude - 0.006 };
    if (service === 'motor') {
        return {
            id: 'drv-001',
            name: 'Budi Santoso',
            photo: 'https://i.pravatar.cc/200?img=12',
            rating: 4.9,
            trips: 1284,
            plate: 'B 3421 KXR',
            vehicle: 'Honda Vario 125',
            color: 'Hitam',
            phone: '081234567890',
            coords,
        };
    }
    return {
        id: 'drv-002',
        name: 'Agus Prasetyo',
        photo: 'https://i.pravatar.cc/200?img=33',
        rating: 4.8,
        trips: 962,
        plate: 'B 1188 TZP',
        vehicle: 'Toyota Avanza',
        color: 'Putih',
        phone: '081298765432',
        coords,
    };
}

type Props = {
    payload: OrderPayload;
    driver: Driver;
    onBack: () => void;
    onCancel: () => void;
    /** dipanggil sekali saat status berubah jadi "sudah sampai" di titik jemput */
    onArrived?: () => void;
    /** buka layar chat (belum ada -> tombol tetap tampil) */
    onChat?: () => void;
    /** default: buka dialer dengan nomor driver */
    onCall?: () => void;
};

const ORANGE = '#f26b21';
const CORAL = '#ee6c6c';

const VEHICLE_IMG = {
    motor: require('@/assets/images/motor.png'),
    mobil: require('@/assets/images/mobil.png'),
};
const MARKER_ORIGIN = require('@/assets/images/marker-origin.png');

const rupiahDots = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

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
        return <Image source={{ uri }} style={s.avatar} onError={() => setFailed(true)} />;
    }
    return (
        <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarText}>{initials}</Text>
        </View>
    );
}

export default function DriverFoundStep({ payload, driver, onBack, onCancel, onArrived, onChat, onCall }: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const SHEET_H = 430 + insets.bottom;

    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [idx, setIdx] = useState(0);
    const [trackView, setTrackView] = useState(true);
    const arrivedFiredRef = useRef(false);
    const onArrivedRef = useRef(onArrived);
    onArrivedRef.current = onArrived;

    // rute driver -> titik jemput
    useEffect(() => {
        let alive = true;
        getRoute(driver.coords, payload.origin.coords).then((r) => {
            if (!alive) return;
            setRoute(r);
            setIdx(0);
        });
        return () => {
            alive = false;
        };
    }, [driver.coords, payload.origin.coords]);

    const polyline = useMemo(
        () => (route?.polyline?.length ? route.polyline : [driver.coords, payload.origin.coords]),
        [route, driver.coords, payload.origin.coords]
    );
    const last = polyline.length - 1;

    // SIMULASI: driver bergerak di sepanjang rute (~45 detik). Hapus bagian ini saat pakai lokasi driver asli.
    useEffect(() => {
        if (last < 1) return;
        const step = Math.max(1, Math.ceil(last / 45));
        const id = setInterval(() => setIdx((i) => Math.min(i + step, last)), 1000);
        return () => clearInterval(id);
    }, [last]);

    // marker berisi View -> perlu tracksViewChanges sebentar supaya gambar ikut ter-render, lalu dimatikan
    useEffect(() => {
        const t = setTimeout(() => setTrackView(false), 1200);
        return () => clearTimeout(t);
    }, []);

    const fit = () => {
        mapRef.current?.fitToCoordinates(polyline, {
            edgePadding: { top: insets.top + 140, bottom: SHEET_H + 60, left: 60, right: 60 },
            animated: true,
        });
    };
    useEffect(() => {
        fit();
    }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

    const driverPos = polyline[Math.min(idx, last)];
    const arrived = last >= 1 && idx >= last;

    useEffect(() => {
        if (arrived && !arrivedFiredRef.current) {
            arrivedFiredRef.current = true;
            onArrivedRef.current?.();
        }
    }, [arrived]);
    const totalSec = route?.durationSec ?? 300;
    const remainSec = Math.round(totalSec * (1 - (last > 0 ? idx / last : 1)));
    const minutes = Math.max(1, Math.ceil(remainSec / 60));

    const call = () => (onCall ? onCall() : Linking.openURL(`tel:${driver.phone}`));

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
                    latitude: payload.origin.coords.latitude,
                    longitude: payload.origin.coords.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                }}
            >
                <Polyline coordinates={polyline.slice(idx)} strokeColor="#ffffff" strokeWidth={9} lineCap="round" lineJoin="round" />
                <Polyline coordinates={polyline.slice(idx)} strokeColor={colors.primary} strokeWidth={5} lineCap="round" lineJoin="round" />

                <Marker
                    coordinate={payload.origin.coords}
                    image={MARKER_ORIGIN}
                    anchor={{ x: 0.5, y: 1 }}
                    title={payload.origin.name}
                    description="Titik jemput"
                    zIndex={1}
                />
                <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={trackView} zIndex={2}>
                    <View style={s.driverMarker}>
                        <Image source={VEHICLE_IMG[payload.service]} style={{ width: 34, height: 34 }} resizeMode="contain" />
                    </View>
                </Marker>
            </MapView>

            {/* kartu asal-tujuan */}
            <Animated.View entering={FadeInUp.duration(300)} style={[s.routeCard, { top: insets.top + 12 }]}>
                <View style={s.routeRow}>
                    <RouteDot type="origin" />
                    <Text style={s.routeText} numberOfLines={1}>{payload.origin.name}</Text>
                </View>
                <View style={s.routeDivider} />
                <View style={s.routeRow}>
                    <RouteDot type="destination" />
                    <Text style={s.routeText} numberOfLines={1}>{payload.destination.name}</Text>
                </View>
            </Animated.View>

            <View style={[s.floatBack, { bottom: SHEET_H + 12 }]}>
                <CircleButton icon="arrow-back" onPress={onBack} />
            </View>

            {/* bottom sheet */}
            <Animated.View
                entering={FadeInUp.duration(350)}
                style={[s.sheet, { height: SHEET_H, paddingBottom: insets.bottom + 12 }]}
            >
                <View style={s.handleArea}>
                    <View style={s.handle} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
                    {/* status + ETA */}
                    <View style={s.statusRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.statusTitle}>
                                {arrived ? 'Drivermu sudah sampai' : 'Driver menuju lokasi jemputmu'}
                            </Text>
                            <Text style={s.statusSub}>
                                {arrived ? 'Segera temui drivermu di titik jemput' : 'Pantau posisinya di peta'}
                            </Text>
                        </View>
                        <View style={s.etaBox}>
                            <Text style={s.etaNum}>{arrived ? '0' : minutes}</Text>
                            <Text style={s.etaUnit}>mnt</Text>
                        </View>
                    </View>

                    {/* data driver */}
                    <View style={s.driverCard}>
                        <View style={s.driverTop}>
                            <Avatar name={driver.name} uri={driver.photo} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.driverName} numberOfLines={1}>{driver.name}</Text>
                                <View style={s.ratingRow}>
                                    <Ionicons name="star" size={14} color="#f5a623" />
                                    <Text style={s.ratingText}>{driver.rating.toFixed(1)}</Text>
                                    <View style={s.dot} />
                                    <Text style={s.tripsText} numberOfLines={1}>{rupiahDots(driver.trips)} perjalanan</Text>
                                </View>
                            </View>
                        </View>

                        <View style={s.driverDivider} />

                        <View style={s.vehicleRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.vehicleName} numberOfLines={1}>{driver.vehicle}</Text>
                                <Text style={s.vehicleColor} numberOfLines={1}>{driver.color}</Text>
                            </View>
                            <View style={s.plate}>
                                <Text style={s.plateText}>{driver.plate}</Text>
                            </View>
                        </View>
                    </View>

                    {/* chat + telepon */}
                    <View style={s.actionRow}>
                        <Pressable onPress={onChat} style={s.chatPill}>
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.textMuted} />
                            <Text style={s.chatText}>Kirim pesan ke driver</Text>
                        </Pressable>
                        <Pressable onPress={call} style={s.callBtn}>
                            <Ionicons name="call" size={22} color="#fff" />
                        </Pressable>
                    </View>

                    {/* ringkasan tarif */}
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
        borderRadius: 23,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.primary,
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
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 36 },
    routeText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
    routeDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 36 },
    routeDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    routeDotInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },

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

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
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
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#dfe3e8' },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    driverName: { fontSize: 16, fontWeight: '800', color: colors.text },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    ratingText: { fontSize: 13, fontWeight: '700', color: colors.text },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#c4c8cf', marginHorizontal: 2 },
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
    plateText: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },

    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
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
    cancelText: { fontSize: 15, fontWeight: '700', color: CORAL },
});