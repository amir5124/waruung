import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import type { UserLocationState } from '@/hooks/use-user-location';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { MAP_PROVIDER } from './parts';

const MESSAGES: Record<string, { text: string; action?: string }> = {
    denied: { text: 'Izinkan akses lokasi supaya kami bisa menentukan titik jemputmu.', action: 'Izinkan lokasi' },
    blocked: { text: 'Akses lokasi dimatikan. Aktifkan lewat pengaturan aplikasi.', action: 'Buka pengaturan' },
    'services-off': { text: 'GPS di HP kamu mati. Nyalakan dulu, lalu coba lagi.', action: 'Aktifkan GPS' },
    error: { text: 'Belum bisa mendapatkan lokasimu.', action: 'Coba lagi' },
};

// Region default sementara, selagi lokasi asli belum didapat
const DEFAULT_REGION = {
    latitude: -6.2088,
    longitude: 106.8456,
    ...MAP_DELTA,
};

export function LocationPreview({ location }: { location: UserLocationState }) {
    const { status, coords, refresh, openSettings } = location;
    const [enabling, setEnabling] = useState(false);

    /**
     * Coba nyalakan GPS langsung lewat dialog sistem (Android).
     * Kalau berhasil, langsung refresh lokasi.
     * Di iOS, tidak ada API untuk trigger GPS dari dalam app, jadi arahkan ke Settings.
     */
    const handleEnableGps = async () => {
        if (Platform.OS === 'android') {
            setEnabling(true);
            try {
                // Memunculkan dialog sistem native "Aktifkan GPS?"
                await Location.enableNetworkProviderAsync();
                // Kalau user menyetujui, GPS otomatis nyala -> langsung coba ambil lokasi lagi
                await refresh();
            } catch (error) {
                // User menolak dialog, atau device tidak support -> fallback ke pengaturan manual
                console.log('Gagal enable GPS otomatis:', error);
                openSettings();
            } finally {
                setEnabling(false);
            }
        } else {
            // iOS: Apple tidak izinkan trigger GPS langsung, harus lewat Settings
            openSettings();
        }
    };

    const handleActionPress = () => {
        if (status === 'blocked') {
            openSettings();
        } else if (status === 'services-off') {
            handleEnableGps();
        } else {
            refresh();
        }
    };

    if (coords) {
        return (
            <View style={s.box} pointerEvents="none">
                <MapView
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    region={{ ...coords, ...MAP_DELTA }}
                    showsUserLocation
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    showsCompass={false}
                />
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
    box: { height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.field },
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
});