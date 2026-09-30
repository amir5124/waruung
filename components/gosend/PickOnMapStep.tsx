import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import { reverseGeocode } from '@/services/google-maps';
import type { Coords, PlaceLoc } from '@/types/gosend';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER, PinDot } from '../ojek/parts';

type Props = {
    initialCoords: Coords;
    onBack: () => void;
    onConfirm: (place: PlaceLoc) => void;
};

const PIN_HEIGHT = 58;

// ⬇️ Konstanta animasi zoom
const INITIAL_ZOOM_MULTIPLIER = 5; // mulai 5x lebih zoom-out
const ZOOM_DURATION_MS = 900;      // durasi animasi zoom
const ZOOM_START_DELAY_MS = 300;   // delay sebelum mulai zoom

export default function PickOnMapStep({
    initialCoords,
    onBack,
    onConfirm,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [picked, setPicked] = useState<PlaceLoc>({
        name: '',
        address: '',
        coords: initialCoords,
    });
    const [resolving, setResolving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const moved = useRef(false);
    const reqId = useRef(0);
    const lift = useSharedValue(0);

    const resolve = async (c: Coords) => {
        const id = ++reqId.current;
        setResolving(true);
        try {
            const r = await reverseGeocode(c);
            if (id !== reqId.current) return; // ada request yang lebih baru
            setPicked({ coords: c, name: r.name, address: r.address });
        } catch {
            if (id !== reqId.current) return;
            setPicked({
                coords: c,
                name: 'Lokasi dipilih',
                address: `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`,
            });
        } finally {
            if (id === reqId.current) setResolving(false);
        }
    };

    // ============================================================
    // Animasi: zoom-out saat buka → animasi zoom-in ke lokasi user
    // ============================================================
    useEffect(() => {
        // 1. Resolve alamat awal (langsung, biar label cepat terisi)
        resolve(initialCoords);

        // 2. Setelah delay, animasi zoom-in ke lokasi user
        const timer = setTimeout(() => {
            mapRef.current?.animateToRegion(
                { ...initialCoords, ...MAP_DELTA },
                ZOOM_DURATION_MS
            );
        }, ZOOM_START_DELAY_MS);

        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onRegionComplete = (r: Region) => {
        lift.value = withSpring(0, { damping: 14 });
        if (!moved.current) return; // abaikan event bawaan saat peta pertama kali muncul
        resolve({ latitude: r.latitude, longitude: r.longitude });
    };

    const pinStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -PIN_HEIGHT / 2 + lift.value }],
    }));

    const handleConfirm = () => {
        setConfirming(true);
        onConfirm(picked);
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={{ flex: 1 }}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    // ⬇️ Mulai dengan zoom-out (5x lebih jauh dari MAP_DELTA)
                    initialRegion={{
                        ...initialCoords,
                        latitudeDelta:
                            MAP_DELTA.latitudeDelta * INITIAL_ZOOM_MULTIPLIER,
                        longitudeDelta:
                            MAP_DELTA.longitudeDelta *
                            INITIAL_ZOOM_MULTIPLIER,
                    }}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    onPanDrag={() => {
                        moved.current = true;
                        lift.value = withSpring(-14, { damping: 14 });
                    }}
                    onRegionChangeComplete={onRegionComplete}
                />

                {/* pin tetap di tengah peta */}
                <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, s.pinWrap]}
                >
                    <Animated.View style={[{ alignItems: 'center' }, pinStyle]}>
                        <View style={s.bubble}>
                            <PinDot type="destination" size={30} />
                            <Text style={s.bubbleText}>Lokasi paket</Text>
                        </View>
                        <View
                            style={[
                                s.stem,
                                { backgroundColor: colors.secondary },
                            ]}
                        />
                    </Animated.View>
                    <View style={s.shadowDot} />
                </View>

                <View
                    style={{
                        position: 'absolute',
                        top: insets.top + 12,
                        left: 16,
                    }}
                >
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>
            </View>

            <Animated.View entering={FadeInUp.duration(300)} style={s.panel}>
                <View style={[s.body, { paddingBottom: insets.bottom + 16 }]}>
                    <Text style={s.title}>Set lokasi paket</Text>

                    <View
                        style={[
                            s.place,
                            { backgroundColor: colors.secondarySoft },
                        ]}
                    >
                        <PinDot type="destination" size={34} />
                        <View style={{ flex: 1 }}>
                            <Text style={s.placeName} numberOfLines={1}>
                                {resolving
                                    ? 'Mencari alamat…'
                                    : picked.name || '—'}
                            </Text>
                            <Text style={s.placeAddr} numberOfLines={2}>
                                {resolving ? ' ' : picked.address}
                            </Text>
                        </View>
                        {resolving && (
                            <ActivityIndicator
                                size="small"
                                color={colors.secondary}
                            />
                        )}
                    </View>

                    <Pressable
                        disabled={resolving || confirming}
                        onPress={handleConfirm}
                        style={[
                            s.confirm,
                            {
                                backgroundColor: colors.secondary,
                                opacity:
                                    resolving || confirming ? 0.6 : 1,
                            },
                        ]}
                    >
                        {confirming ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={s.confirmText}>
                                Pilih lokasi ini
                            </Text>
                        )}
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
    title: { fontSize: 20, fontWeight: '800', color: colors.text },
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
});