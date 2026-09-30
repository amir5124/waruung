import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import { useNearbyDrivers } from '@/hooks/use-nearby-drivers';
import type { UserLocationState } from '@/hooks/use-user-location';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from './parts';

const VEHICLE_IMG = {
    motor: require('../../assets/images/motor-map.png'),
    mobil: require('@/assets/images/mobil-map.png'),
    motor_food: require('../../assets/images/motor-map.png'),
};

const MESSAGES: Record<string, { text: string; action?: string }> = {
    denied: {
        text: 'Izinkan akses lokasi supaya kami bisa menentukan titik jemputmu.',
        action: 'Izinkan lokasi',
    },
    blocked: {
        text: 'Akses lokasi dimatikan. Aktifkan lewat pengaturan aplikasi.',
        action: 'Buka pengaturan',
    },
    'services-off': {
        text: 'GPS di HP kamu mati. Nyalakan dulu, lalu coba lagi.',
        action: 'Aktifkan GPS',
    },
    error: { text: 'Belum bisa mendapatkan lokasimu.', action: 'Coba lagi' },
};

const DEFAULT_REGION = {
    latitude: -6.2088,
    longitude: 106.8456,
    ...MAP_DELTA,
};

export function LocationPreview({ location }: { location: UserLocationState }) {
    const { status, coords, refresh, openSettings } = location;
    const [enabling, setEnabling] = useState(false);
    const mapRef = useRef<MapView>(null);
    const autoZoomed = useRef(false);

    // Ambil driver online di sekitar (radius 3 km)
    const { drivers } = useNearbyDrivers(coords, {
        radius: 3000,
        limit: 20,
        pollMs: 5000,
    });

    // Log driver untuk debug
    useEffect(() => {
        console.log('========================================');
        console.log('[LocationPreview] drivers count:', drivers.length);
        drivers.forEach((d, i) => {
            console.log(`[LocationPreview] Driver #${i + 1}:`, {
                id: d.id,
                name: d.name,
                vehicle_type: d.vehicle_type,
                coords: d.coords,
                distance_m: d.distance_m,
            });
        });
        console.log('========================================');
    }, [drivers]);

    // Animasi zoom-in saat coords pertama kali tersedia
    useEffect(() => {
        if (!coords || autoZoomed.current) return;
        autoZoomed.current = true;

        const timer = setTimeout(() => {
            mapRef.current?.animateToRegion({ ...coords, ...MAP_DELTA }, 900);
        }, 300);

        return () => clearTimeout(timer);
    }, [coords]);

    const handleEnableGps = async () => {
        if (Platform.OS === 'android') {
            setEnabling(true);
            try {
                await Location.enableNetworkProviderAsync();
                await refresh();
            } catch (error) {
                console.log('Gagal enable GPS otomatis:', error);
                openSettings();
            } finally {
                setEnabling(false);
            }
        } else {
            openSettings();
        }
    };

    const handleActionPress = () => {
        if (status === 'blocked') openSettings();
        else if (status === 'services-off') handleEnableGps();
        else refresh();
    };

    if (coords) {
        const validDrivers = drivers.filter((d) => d.coords);

        return (
            <View style={s.box} pointerEvents="none">
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    initialRegion={{
                        ...coords,
                        latitudeDelta: MAP_DELTA.latitudeDelta * 5,
                        longitudeDelta: MAP_DELTA.longitudeDelta * 5,
                    }}
                    showsUserLocation={false}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    showsCompass={false}
                >
                    {validDrivers.slice(0, 10).map((d) => {
                        console.log(
                            '[LocationPreview] RENDER marker:',
                            d.name,
                            d.coords
                        );
                        return (
                            <Marker
                                key={d.id}
                                coordinate={d.coords!}
                                anchor={{ x: 0.5, y: 0.5 }}
                                tracksViewChanges={true}
                                zIndex={5}
                            >
                                <View style={s.driverMarker} collapsable={false}>
                                    <Image
                                        source={
                                            VEHICLE_IMG[d.vehicle_type] ??
                                            VEHICLE_IMG.motor
                                        }
                                        style={{ width: 28, height: 28 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </Marker>
                        );
                    })}
                </MapView>
            </View>
        );
    }

    if (status === 'loading') {
        return (
            <View style={s.box} pointerEvents="none">
                <MapView
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    region={DEFAULT_REGION}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    showsCompass={false}
                />
                <View style={s.loadingOverlay}>
                    <View style={s.loadingBox}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                </View>
            </View>
        );
    }

    const m = MESSAGES[status] ?? MESSAGES.error;
    return (
        <View style={[s.box, s.center, { paddingHorizontal: 16 }]}>
            <Ionicons name="location-outline" size={28} color={colors.secondary} />
            <Text style={s.hint}>{m.text}</Text>
            <Pressable
                onPress={handleActionPress}
                disabled={enabling}
                style={[s.action, enabling && { opacity: 0.6 }]}
            >
                {enabling ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={s.actionText}>{m.action}</Text>
                )}
            </Pressable>
        </View>
    );
}

const s = StyleSheet.create({
    box: {
        height: 120,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.field,
    },
    center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
    hint: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
    action: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.primary,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingBox: {
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    driverMarker: {
        width: 40,
        height: 40,

        alignItems: 'center',
        justifyContent: 'center',

    },
});