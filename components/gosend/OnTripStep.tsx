import { colors } from '@/constants/ojek-theme';
import { getRoute } from '@/services/google-maps';
import type { DriverInfo, PlaceLoc } from '@/types/gosend';
import type { RouteInfo } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER } from '../ojek/parts';

type Props = {
    origin: PlaceLoc;
    destination: PlaceLoc;
    driver: DriverInfo;
    securityCode: string;
    onBack: () => void;
    /** dipanggil sekali saat driver (dummy) sampai di tujuan */
    onArrived?: () => void;
    onChat?: () => void;
    onCall?: () => void;
    /** lama simulasi perjalanan, default 60 detik */
    tripDurationMs?: number;
};

const MOTOR_IMG = require('@/assets/images/motor.png');
const MARKER_DEST = require('@/assets/images/marker-destination.png');

function DestDot() {
    return (
        <View style={s.destDot}>
            <View style={s.destDotInner} />
        </View>
    );
}

export default function OnTripStep({
    origin,
    destination,
    driver,
    securityCode,
    onBack,
    onArrived,
    onChat,
    onCall,
    tripDurationMs = 60000,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const SHEET_H = 320 + insets.bottom;

    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [idx, setIdx] = useState(0);
    const [trackView, setTrackView] = useState(true);
    const arrivedFiredRef = useRef(false);
    const onArrivedRef = useRef(onArrived);
    onArrivedRef.current = onArrived;

    // rute nyata titik jemput -> tujuan
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
        () => (route?.polyline?.length ? route.polyline : [origin.coords, destination.coords]),
        [route, origin.coords, destination.coords]
    );
    const last = polyline.length - 1;

    // SIMULASI: motor bergerak sepanjang rute menuju tujuan. Ganti dengan lokasi driver asli (mis. lewat socket) saat backend siap.
    useEffect(() => {
        if (last < 1) return;
        const tickMs = 1000;
        const steps = Math.max(1, Math.round(tripDurationMs / tickMs));
        const stepSize = Math.max(1, Math.ceil(last / steps));
        const id = setInterval(() => {
            setIdx((i) => Math.min(i + stepSize, last));
        }, tickMs);
        return () => clearInterval(id);
    }, [last, tripDurationMs]);

    useEffect(() => {
        const t = setTimeout(() => setTrackView(false), 1200);
        return () => clearTimeout(t);
    }, []);

    const fit = () => {
        mapRef.current?.fitToCoordinates(polyline.slice(idx), {
            edgePadding: { top: insets.top + 120, bottom: SHEET_H + 60, left: 60, right: 60 },
            animated: true,
        });
    };
    useEffect(() => {
        fit();
    }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

    const driverPos = polyline[Math.min(idx, last)];
    const arrived = last >= 1 && idx >= last;

    // efek terpisah: jangan panggil onArrived di dalam updater setIdx (memicu setState komponen
    // lain di tengah kalkulasi state ini -> "Cannot update a component while rendering..." )
    useEffect(() => {
        if (arrived && !arrivedFiredRef.current) {
            arrivedFiredRef.current = true;
            onArrivedRef.current?.();
        }
    }, [arrived]);

    const progress = last > 0 ? idx / last : 1;
    const totalSec = route?.durationSec ?? Math.round(tripDurationMs / 1000);
    const remainSec = Math.round(totalSec * (1 - progress));
    const minutes = Math.max(1, Math.ceil(remainSec / 60));
    const totalDistKm = route ? (route.distanceMeters / 1000).toFixed(1) : null;

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
                    latitude: origin.coords.latitude,
                    longitude: origin.coords.longitude,
                    latitudeDelta: 0.03,
                    longitudeDelta: 0.03,
                }}
            >
                {/* jalur yang sudah dilewati: abu-abu pudar */}
                <Polyline coordinates={polyline.slice(0, idx + 1)} strokeColor={colors.border} strokeWidth={5} lineCap="round" lineJoin="round" />
                {/* jalur yang belum dilewati: warna aktif */}
                <Polyline coordinates={polyline.slice(idx)} strokeColor="#ffffff" strokeWidth={9} lineCap="round" lineJoin="round" />
                <Polyline coordinates={polyline.slice(idx)} strokeColor={colors.primary} strokeWidth={5} lineCap="round" lineJoin="round" />

                <Marker
                    coordinate={destination.coords}
                    image={MARKER_DEST}
                    anchor={{ x: 0.5, y: 1 }}
                    title={destination.name}
                    description="Tujuan"
                    zIndex={1}
                />
                <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={trackView} zIndex={2}>
                    <View style={s.driverMarker}>
                        <Image source={MOTOR_IMG} style={{ width: 34, height: 34 }} resizeMode="contain" />
                    </View>
                </Marker>
            </MapView>

            {/* kartu tujuan (bukan titik jemput lagi) */}
            <Animated.View entering={FadeInUp.duration(300)} style={[s.routeCard, { top: insets.top + 12 }]}>
                <View style={s.routeRow}>
                    <DestDot />
                    <View style={{ flex: 1 }}>
                        <Text style={s.routeLabel}>Menuju</Text>
                        <Text style={s.routeText} numberOfLines={1}>{destination.name}</Text>
                    </View>
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
                                {arrived ? 'Paket sampai di tujuan' : 'Paketmu dalam perjalanan'}
                            </Text>
                            <Text style={s.statusSub}>
                                {arrived
                                    ? 'Menyerahkan paket ke penerima'
                                    : totalDistKm
                                        ? `Sisa ${totalDistKm} km lagi`
                                        : 'Pantau posisinya di peta'}
                            </Text>
                        </View>
                        <View style={s.etaBox}>
                            <Text style={s.etaNum}>{arrived ? '0' : minutes}</Text>
                            <Text style={s.etaUnit}>mnt</Text>
                        </View>
                    </View>

                    {/* progress bar perjalanan */}
                    <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>

                    {/* ringkasan driver, versi ringkas (sudah pernah ditampilkan di layar sebelumnya) */}
                    <View style={s.driverRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.driverName} numberOfLines={1}>{driver.name}</Text>
                            <Text style={s.driverPlate} numberOfLines={1}>{driver.vehiclePlate}</Text>
                        </View>
                        <Pressable onPress={onChat} style={s.iconBtn}>
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.textMuted} />
                        </Pressable>
                        <Pressable onPress={call} style={[s.iconBtn, s.iconBtnPrimary]}>
                            <Ionicons name="call" size={20} color="#fff" />
                        </Pressable>
                    </View>

                    {/* kode keamanan, tetap diingatkan sampai serah terima */}
                    <View style={s.codeRow}>
                        <View style={s.codeIcon}>
                            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.codeTitle}>Kode keamanan</Text>
                            <Text style={s.codeSub}>Cocokkan dengan driver sebelum serah terima paket</Text>
                        </View>
                        <Text style={s.codeValue}>{securityCode}</Text>
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
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: '#f26b21',
        alignItems: 'center', justifyContent: 'center',
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

    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
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
    codeSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
    codeValue: { fontSize: 22, fontWeight: '800', color: colors.primary, letterSpacing: 2 },
});