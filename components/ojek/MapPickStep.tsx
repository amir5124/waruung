import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import { reverseGeocode } from '@/services/google-maps';
import type { Coords, PlaceLoc } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Region } from 'react-native-maps';
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER, PinDot } from './parts';

type Props = {
    /** 'pickup' = set titik jemput (halaman 5), 'destination' = pilih tujuan lewat peta */
    mode: 'pickup' | 'destination';
    initial: PlaceLoc;
    /** posisi GPS asli, untuk lingkaran akurasi + tombol recenter */
    userLocation?: { coords: Coords; accuracy: number | null } | null;
    onBack: () => void;
    onEdit: () => void;
    onConfirm: (p: PlaceLoc) => void;
};

const WEAK_GPS_METERS = 50;
const PIN_HEIGHT = 58;

export default function MapPickStep({ mode, initial, userLocation, onBack, onEdit, onConfirm }: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [picked, setPicked] = useState<PlaceLoc>(initial);
    const [resolving, setResolving] = useState(false);
    const moved = useRef(false);
    const reqId = useRef(0);
    const lift = useSharedValue(0);
    const isPickup = mode === 'pickup';

    const resolve = async (c: Coords) => {
        const id = ++reqId.current;
        setResolving(true);
        const r = await reverseGeocode(c);
        if (id !== reqId.current) return; // ada request yang lebih baru
        setPicked({ coords: c, name: r.name, address: r.address });
        setResolving(false);
    };

    // alamat awal belum ada (mis. GPS baru masuk / origin kosong) -> resolve sekali
    useEffect(() => {
        if (!initial.address) resolve(initial.coords);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onRegionComplete = (r: Region) => {
        lift.value = withSpring(0, { damping: 14 });
        if (!moved.current) return; // abaikan event bawaan saat peta pertama kali muncul
        resolve({ latitude: r.latitude, longitude: r.longitude });
    };

    const pinStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -PIN_HEIGHT / 2 + lift.value }],
    }));

    const weakGps =
        isPickup && userLocation?.accuracy != null && userLocation.accuracy > WEAK_GPS_METERS;

    const accent = isPickup ? colors.primary : colors.secondary;

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={{ flex: 1 }}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    initialRegion={{ ...initial.coords, ...MAP_DELTA }}
                    showsUserLocation
                    showsMyLocationButton={false}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    onPanDrag={() => {
                        moved.current = true;
                        lift.value = withSpring(-14, { damping: 14 });
                    }}
                    onRegionChangeComplete={onRegionComplete}
                >
                    {isPickup && userLocation?.accuracy != null && (
                        <Circle
                            center={userLocation.coords}
                            radius={userLocation.accuracy}
                            strokeColor="rgba(64,163,234,0.5)"
                            fillColor="rgba(64,163,234,0.15)"
                        />
                    )}
                </MapView>

                {/* pin tetap di tengah peta */}
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.pinWrap]}>
                    <Animated.View style={[{ alignItems: 'center' }, pinStyle]}>
                        <View style={s.bubble}>
                            <PinDot type={isPickup ? 'origin' : 'destination'} size={30} />
                            <Text style={s.bubbleText}>{isPickup ? 'Titik jemput' : 'Tujuan'}</Text>
                        </View>
                        <View style={[s.stem, { backgroundColor: accent }]} />
                    </Animated.View>
                    <View style={s.shadowDot} />
                </View>

                <View style={{ position: 'absolute', top: insets.top + 12, left: 16 }}>
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>
                {userLocation && (
                    <View style={{ position: 'absolute', right: 16, bottom: 16 }}>
                        <CircleButton
                            icon="locate"
                            onPress={() => {
                                moved.current = true; // supaya alamat ikut ter-update
                                mapRef.current?.animateToRegion({ ...userLocation.coords, ...MAP_DELTA }, 400);
                            }}
                        />
                    </View>
                )}
            </View>

            <Animated.View entering={FadeInUp.duration(300)} style={s.panel}>
                {weakGps && (
                    <View style={s.warn}>
                        <Ionicons name="alert-circle" size={30} color={colors.secondary} />
                        <Text style={s.warnText}>Sinyal GPS-mu lemah. Pastikan titik jemput yang kamu pilih udah sesuai.</Text>
                    </View>
                )}
                <View style={[s.body, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={s.titleRow}>
                        <Text style={s.title}>{isPickup ? 'Set lokasi jemput' : 'Set lokasi tujuan'}</Text>
                        {isPickup && (
                            <Pressable onPress={onEdit} style={s.editBtn}>
                                <Text style={s.editText}>Edit</Text>
                            </Pressable>
                        )}
                    </View>

                    <View style={[s.place, { backgroundColor: isPickup ? colors.primarySoft : colors.secondarySoft }]}>
                        <PinDot type={isPickup ? 'origin' : 'destination'} size={34} />
                        <View style={{ flex: 1 }}>
                            <Text style={s.placeName} numberOfLines={1}>{resolving ? 'Mencari alamat…' : picked.name || '—'}</Text>
                            <Text style={s.placeAddr} numberOfLines={2}>{resolving ? ' ' : picked.address}</Text>
                        </View>
                        {resolving && <ActivityIndicator size="small" color={accent} />}
                    </View>

                    <Pressable
                        disabled={resolving}
                        onPress={() => onConfirm(picked)}
                        style={[s.confirm, { backgroundColor: accent, opacity: resolving ? 0.6 : 1 }]}
                    >
                        <Text style={s.confirmText}>{isPickup ? 'Konfirmasi titik jemput' : 'Konfirmasi lokasi tujuan'}</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    pinWrap: { alignItems: 'center', justifyContent: 'center' },
    bubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 6,
        paddingRight: 16,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    bubbleText: { fontWeight: '700', fontSize: 15, color: colors.text },
    stem: { width: 3, height: PIN_HEIGHT - 44, borderRadius: 2 },
    shadowDot: { position: 'absolute', width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.25)' },
    panel: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, overflow: 'hidden' },
    warn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.secondarySoft,
        paddingHorizontal: 20,
        paddingVertical: 14,
        paddingBottom: 38,
        marginBottom: -24,
    },
    warnText: { flex: 1, fontWeight: '600', color: colors.text, lineHeight: 20 },
    body: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: '800', color: colors.text },
    editBtn: { paddingHorizontal: 18, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.primary, justifyContent: 'center' },
    editText: { color: colors.primary, fontWeight: '800' },
    place: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
    placeName: { fontSize: 17, fontWeight: '800', color: colors.text },
    placeAddr: { color: colors.textMuted, marginTop: 2, lineHeight: 20 },
    confirm: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
    confirmText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});