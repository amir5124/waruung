import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import { useNearbyDrivers } from '@/hooks/use-nearby-drivers';
import { reverseGeocode } from '@/services/google-maps';
import { findMainRoadSuggestion, type RoadSuggestion } from '@/services/main-road';
import type { Coords, PlaceLoc } from '@/types/ojek';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MapView, { Circle, Marker, Polyline, Region } from 'react-native-maps';
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER, PinDot } from './parts';

type Props = {
    mode: 'pickup' | 'destination';
    initial: PlaceLoc;
    userLocation?: { coords: Coords; accuracy: number | null } | null;
    onBack: () => void;
    onEdit: () => void;
    onConfirm: (p: PlaceLoc) => void;
};

const WEAK_GPS_METERS = 50;
const PIN_HEIGHT = 58;

const VEHICLE_IMG = {
    motor: require('@/assets/images/motor-map.png'),
    mobil: require('@/assets/images/mobil-map.png'),
    motor_food: require('@/assets/images/motor-map.png'),
};

// garis putus-putus "berjalan"
const DASH = 10;
const GAP = 8;
const PERIOD = DASH + GAP;
const EPS = 0.01;

function dashPatternAt(offset: number): number[] {
    const s = ((offset % PERIOD) + PERIOD) % PERIOD;
    if (s < 0.5) return [DASH, GAP];
    if (s < DASH) return [DASH - s, GAP, s, EPS];
    const r = PERIOD - s;
    return [EPS, r, DASH, GAP - r];
}

function MarchingLine({ coords, color }: { coords: Coords[]; color: string }) {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setPhase((p) => (p + 3) % PERIOD), 60);
        return () => clearInterval(t);
    }, []);

    return (
        <Polyline
            coordinates={coords}
            strokeColor={color}
            strokeWidth={4}
            lineCap="butt"
            lineDashPattern={dashPatternAt(PERIOD - phase)}
            zIndex={10}
        />
    );
}

export default function MapPickStep({
    mode,
    initial,
    userLocation,
    onBack,
    onEdit,
    onConfirm,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [picked, setPicked] = useState<PlaceLoc>(initial);
    const [resolving, setResolving] = useState(false);
    const [suggestion, setSuggestion] = useState<
        (RoadSuggestion & { from: Coords }) | null
    >(null);
    const [trackView, setTrackView] = useState(true);
    const moved = useRef(false);
    const reqId = useRef(0);
    const roadAbort = useRef<AbortController | null>(null);
    const lift = useSharedValue(0);
    const isPickup = mode === 'pickup';
    const autoZoomed = useRef(false);

    // ---- Ambil driver di sekitar ----
    const { drivers } = useNearbyDrivers(picked.coords, {
        radius: 5000,
        limit: 30,
        pollMs: 5000,
    });

    // ---- Matikan trackView setelah 800 ms ----
    useEffect(() => {
        const t = setTimeout(() => setTrackView(false), 800);
        return () => clearTimeout(t);
    }, []);

    const searchRoad = (c: Coords, id: number) => {
        if (!isPickup) return;
        roadAbort.current?.abort();
        const ctrl = new AbortController();
        roadAbort.current = ctrl;
        findMainRoadSuggestion(c, ctrl.signal).then((sug) => {
            const ok = id === reqId.current;
            if (__DEV__) console.log('[main-road] hasil', !!sug, 'dipakai', ok);
            if (ok) setSuggestion(sug ? { ...sug, from: c } : null);
        });
    };

    const resolve = async (c: Coords) => {
        const id = ++reqId.current;
        setResolving(true);
        setSuggestion(null);
        searchRoad(c, id);

        try {
            const r = await reverseGeocode(c);
            if (id !== reqId.current) return;
            setPicked({ coords: c, name: r.name, address: r.address });
        } catch {
            if (id !== reqId.current) return;
        }
        setResolving(false);
    };

    const goToSuggestion = () => {
        if (!suggestion) return;
        moved.current = true;
        mapRef.current?.animateToRegion(
            { ...suggestion.coords, ...MAP_DELTA },
            500
        );
    };

    // Alamat awal belum ada -> resolve sekali
    useEffect(() => {
        if (!initial.address) resolve(initial.coords);
        else searchRoad(initial.coords, reqId.current);
        return () => roadAbort.current?.abort();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto zoom ke lokasi user (mode pickup)
    useEffect(() => {
        if (!isPickup || !userLocation || autoZoomed.current) return;
        autoZoomed.current = true;

        const timer = setTimeout(() => {
            moved.current = true;
            mapRef.current?.animateToRegion(
                { ...userLocation.coords, ...MAP_DELTA },
                800
            );
        }, 400);

        return () => clearTimeout(timer);
    }, [userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

    // Mode destination: mulai zoom out, lalu zoom-in ke tujuan
    useEffect(() => {
        if (isPickup) return;
        const timer = setTimeout(() => {
            moved.current = true;
            mapRef.current?.animateToRegion(
                { ...initial.coords, ...MAP_DELTA },
                800
            );
        }, 400);
        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onRegionComplete = (r: Region) => {
        lift.value = withSpring(0, { damping: 14 });
        if (!moved.current) return;
        resolve({ latitude: r.latitude, longitude: r.longitude });
    };

    const pinStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -PIN_HEIGHT / 2 + lift.value }],
    }));

    const weakGps =
        isPickup &&
        userLocation?.accuracy != null &&
        userLocation.accuracy > WEAK_GPS_METERS;

    const accent = isPickup ? colors.primary : colors.secondary;

    const lineCoords = (() => {
        if (!suggestion) return null;
        const a = {
            latitude: Number(suggestion.from?.latitude),
            longitude: Number(suggestion.from?.longitude),
        };
        const b = {
            latitude: Number(suggestion.coords?.latitude),
            longitude: Number(suggestion.coords?.longitude),
        };
        const ok = [a.latitude, a.longitude, b.latitude, b.longitude].every(
            Number.isFinite
        );
        return ok ? [a, b] : null;
    })();
    const lineKey = lineCoords
        ? `${lineCoords[0].latitude.toFixed(6)},${lineCoords[0].longitude.toFixed(6)}-${lineCoords[1].latitude.toFixed(6)},${lineCoords[1].longitude.toFixed(6)}`
        : 'none';

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={{ flex: 1 }}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    initialRegion={
                        isPickup
                            ? {
                                ...initial.coords,
                                latitudeDelta: MAP_DELTA.latitudeDelta * 5,
                                longitudeDelta: MAP_DELTA.longitudeDelta * 5,
                            }
                            : {
                                ...initial.coords,
                                latitudeDelta: MAP_DELTA.latitudeDelta * 8,
                                longitudeDelta: MAP_DELTA.longitudeDelta * 8,
                            }
                    }
                    showsUserLocation
                    showsMyLocationButton={false}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    onPanDrag={() => {
                        moved.current = true;
                        setSuggestion(null);
                        lift.value = withSpring(-14, { damping: 14 });
                    }}
                    onRegionChangeComplete={onRegionComplete}
                >
                    {/* Lingkaran akurasi GPS */}
                    {isPickup && userLocation?.accuracy != null && (
                        <Circle
                            center={userLocation.coords}
                            radius={userLocation.accuracy}
                            strokeColor="rgba(64,163,234,0.5)"
                            fillColor="rgba(64,163,234,0.15)"
                        />
                    )}

                    {/* Driver markers */}
                    {drivers
                        .filter((d) => d.coords)
                        .map((d) => (
                            <Marker
                                key={d.id}
                                coordinate={d.coords!}
                                anchor={{ x: 0.5, y: 0.5 }}
                                tracksViewChanges={trackView}
                                zIndex={5}
                            >
                                <View style={s.carMarker}>
                                    <Image
                                        source={
                                            VEHICLE_IMG[d.vehicle_type] ??
                                            VEHICLE_IMG.motor
                                        }
                                        style={{ width: 32, height: 32 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </Marker>
                        ))}

                    {/* Saran jalan + garis putus-putus */}
                    {isPickup && suggestion && lineCoords && (
                        <>
                            <MarchingLine
                                key={lineKey}
                                coords={lineCoords}
                                color={colors.primary}
                            />
                            <Marker
                                key={`m-${lineKey}`}
                                coordinate={lineCoords[1]}
                                anchor={{ x: 0.5, y: 0.5 }}
                                onPress={goToSuggestion}
                                zIndex={11}
                            >
                                <View style={s.sugDot} />
                            </Marker>
                        </>
                    )}
                </MapView>

                {/* Pin tengah */}
                <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, s.pinWrap]}
                >
                    <Animated.View style={[{ alignItems: 'center' }, pinStyle]}>
                        <View style={s.bubble}>
                            <PinDot
                                type={isPickup ? 'origin' : 'destination'}
                                size={30}
                            />
                            <Text style={s.bubbleText}>
                                {isPickup ? 'Titik jemput' : 'Tujuan'}
                            </Text>
                        </View>
                        <View style={[s.stem, { backgroundColor: accent }]} />
                    </Animated.View>
                    <View style={s.shadowDot} />
                </View>

                {/* Tombol back */}
                <View
                    style={{
                        position: 'absolute',
                        top: insets.top + 12,
                        left: 16,
                    }}
                >
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>

                {/* Tombol locate */}
                {userLocation && (
                    <View
                        style={{
                            position: 'absolute',
                            right: 16,
                            bottom: 46,
                        }}
                    >
                        <CircleButton
                            icon="locate"
                            onPress={() => {
                                moved.current = true;
                                mapRef.current?.animateToRegion(
                                    { ...userLocation.coords, ...MAP_DELTA },
                                    400
                                );
                            }}
                        />
                    </View>
                )}
            </View>

            {/* Panel bawah */}
            <Animated.View entering={FadeInUp.duration(300)} style={s.panel}>
                <View
                    style={[s.body, { paddingBottom: insets.bottom + 16 }]}
                >
                    <View style={s.titleRow}>
                        <Text style={s.title}>
                            {isPickup ? 'Set lokasi jemput' : 'Set lokasi tujuan'}
                        </Text>
                        {isPickup && (
                            <Pressable onPress={onEdit} style={s.editBtn}>
                                <Text style={s.editText}>Edit</Text>
                            </Pressable>
                        )}
                    </View>

                    {isPickup && suggestion && !resolving && (
                        <Pressable onPress={goToSuggestion} style={s.suggest}>
                            <Text style={s.suggestText} numberOfLines={2}>
                                Lebih mudah dijemput di {suggestion.name} (
                                {suggestion.distance} m dari sini)
                            </Text>
                            <Text style={s.suggestAction}>Pindah</Text>
                        </Pressable>
                    )}

                    <View
                        style={[
                            s.place,
                            {
                                backgroundColor: isPickup
                                    ? colors.primarySoft
                                    : colors.secondarySoft,
                            },
                        ]}
                    >
                        <PinDot
                            type={isPickup ? 'origin' : 'destination'}
                            size={34}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={s.placeName} numberOfLines={1}>
                                {resolving ? 'Mencari alamat…' : picked.name || '—'}
                            </Text>
                            <Text style={s.placeAddr} numberOfLines={2}>
                                {resolving ? ' ' : picked.address}
                            </Text>
                        </View>
                        {resolving && (
                            <ActivityIndicator size="small" color={accent} />
                        )}
                    </View>

                    <Pressable
                        disabled={resolving}
                        onPress={() => onConfirm(picked)}
                        style={[
                            s.confirm,
                            {
                                backgroundColor: accent,
                                opacity: resolving ? 0.6 : 1,
                            },
                        ]}
                    >
                        <Text style={s.confirmText}>
                            {isPickup
                                ? 'Konfirmasi titik jemput'
                                : 'Konfirmasi lokasi tujuan'}
                        </Text>
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
    shadowDot: {
        position: 'absolute',
        width: 10,
        height: 4,
        borderRadius: 5,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    panel: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -24,
        overflow: 'hidden',
    },
    body: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        gap: 16,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: { fontSize: 20, fontWeight: '800', color: colors.text },
    editBtn: {
        paddingHorizontal: 18,
        height: 38,
        borderRadius: 19,
        borderWidth: 1.5,
        borderColor: colors.primary,
        justifyContent: 'center',
    },
    editText: { color: colors.primary, fontWeight: '800' },
    place: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
    },
    placeName: { fontSize: 17, fontWeight: '800', color: colors.text },
    placeAddr: { color: colors.textMuted, marginTop: 2, lineHeight: 20 },
    confirm: {
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    sugDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 4,
        borderColor: colors.primary,
    },
    suggest: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: colors.secondarySoft,
    },
    suggestText: {
        flex: 1,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 20,
    },
    suggestAction: { color: colors.primary, fontWeight: '800' },

    carMarker: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: colors.primary,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
});