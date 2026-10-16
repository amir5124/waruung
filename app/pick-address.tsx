// app/pick-address.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type SavedAddress } from '@/lib/api';
import {
    loadSavedLocation,
    saveLocation,
    type SavedLocation,
} from '@/lib/savedLocation';
import { reverseGeocode } from '@/services/google-maps';

const BLUE = '#2F86EB';
const GREEN = '#16A34A';

type PickedAddress = {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
};

export default function PickAddressScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ returnTo?: string }>();

    const [current, setCurrent] = useState<PickedAddress | null>(null);
    const [saved, setSaved] = useState<SavedAddress[]>([]);
    const [lastUsed, setLastUsed] = useState<SavedLocation | null>(null);
    const [loadingGps, setLoadingGps] = useState(true);
    const [loadingSaved, setLoadingSaved] = useState(true);

    // ============================================================
    // LOAD GPS CURRENT LOCATION
    // ============================================================
    const loadGps = useCallback(async () => {
        setLoadingGps(true);
        try {
            const perm =
                await Location.requestForegroundPermissionsAsync();
            if (!perm.granted) {
                setCurrent(null);
                return;
            }

            const last =
                await Location.getLastKnownPositionAsync();
            const pos = last
                ? last
                : await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

            const coords = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
            };

            // Reverse geocode
            const geo = await reverseGeocode(coords);

            setCurrent({
                name: geo?.name ?? 'Lokasi Saya',
                address: geo?.address ?? 'Alamat tidak diketahui',
                latitude: coords.latitude,
                longitude: coords.longitude,
            });
        } catch (e) {
            console.warn('[PickAddress] gps gagal:', e);
            setCurrent(null);
        } finally {
            setLoadingGps(false);
        }
    }, []);

    // ============================================================
    // LOAD SAVED ADDRESSES + LAST USED
    // ============================================================
    const loadSaved = useCallback(async () => {
        setLoadingSaved(true);
        try {
            const [list, last] = await Promise.all([
                api.savedAddresses.list().catch(() => []),
                loadSavedLocation(),
            ]);
            setSaved(list ?? []);
            setLastUsed(last);
        } catch (e) {
            console.warn('[PickAddress] saved gagal:', e);
        } finally {
            setLoadingSaved(false);
        }
    }, []);

    useEffect(() => {
        loadGps();
        loadSaved();
    }, [loadGps, loadSaved]);

    // ============================================================
    // PILIH ALAMAT
    // ============================================================
    const pick = async (addr: PickedAddress) => {
        // Simpan ke storage biar dipakai checkout
        await saveLocation({
            latitude: addr.latitude,
            longitude: addr.longitude,
            name: addr.name,
            address: addr.address,
            label: null,
        });

        // Balik ke checkout dengan flag refresh
        if (params.returnTo) {
            router.replace({
                pathname: params.returnTo as any,
                params: { addressPicked: Date.now().toString() },
            } as any);
        } else {
            router.back();
        }
    };

    // ============================================================
    // BUKA PETA UNTUK PILIH TITIK MANUAL
    // ============================================================
    const openMapPicker = () => {
        const seed = current ?? lastUsed ?? {
            latitude: -6.2,
            longitude: 106.63,
        };
        router.push({
            pathname: '/pick-map',
            params: {
                lat: String(seed.latitude),
                lng: String(seed.longitude),
                returnTo: params.returnTo ?? '/checkout',
            },
        } as any);
    };

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <View style={{ flex: 1, backgroundColor: '#F6F8FB' }}>
            {/* Header */}
            <View
                style={[
                    s.header,
                    { paddingTop: insets.top + 12 },
                ]}
            >
                <Pressable
                    onPress={() => router.back()}
                    style={s.backBtn}
                >
                    <Ionicons
                        name="arrow-back"
                        size={22}
                        color="#1B1B1B"
                    />
                </Pressable>
                <Text style={s.headerTitle}>Pilih Alamat</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: 40,
                }}
            >
                {/* ===== GPS SEKARANG ===== */}
                <Text style={s.sectionTitle}>Lokasi Saat Ini</Text>

                <Pressable
                    style={s.card}
                    onPress={() => current && pick(current)}
                    disabled={!current}
                >
                    <View style={[s.iconWrap, { backgroundColor: BLUE }]}>
                        {loadingGps ? (
                            <ActivityIndicator
                                color="#fff"
                                size="small"
                            />
                        ) : (
                            <Ionicons
                                name="navigate"
                                size={20}
                                color="#fff"
                            />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>
                            {loadingGps
                                ? 'Mencari lokasi…'
                                : current?.name ?? 'GPS tidak aktif'}
                        </Text>
                        <Text
                            style={s.cardSub}
                            numberOfLines={2}
                        >
                            {current?.address ??
                                'Aktifkan GPS untuk melanjutkan'}
                        </Text>
                    </View>
                    {current && (
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color="#B0B5BD"
                        />
                    )}
                </Pressable>

                {/* ===== PILIH DARI PETA ===== */}
                <Text style={[s.sectionTitle, { marginTop: 20 }]}>
                    Pilih Manual
                </Text>

                <Pressable style={s.card} onPress={openMapPicker}>
                    <View
                        style={[
                            s.iconWrap,
                            { backgroundColor: '#8B5CF6' },
                        ]}
                    >
                        <Ionicons
                            name="map"
                            size={20}
                            color="#fff"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>
                            Pilih dari Peta
                        </Text>
                        <Text style={s.cardSub}>
                            Tandai titik lokasi di peta
                        </Text>
                    </View>
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#B0B5BD"
                    />
                </Pressable>

                {/* ===== ALAMAT TERSIMPAN ===== */}
                {saved.length > 0 && (
                    <>
                        <Text
                            style={[
                                s.sectionTitle,
                                { marginTop: 20 },
                            ]}
                        >
                            Alamat Tersimpan
                        </Text>

                        {saved.map((addr) => {
                            const coords =
                                parseLocationToCoords(addr.location);
                            if (!coords) return null;

                            const icon =
                                addr.kind === 'home'
                                    ? 'home'
                                    : addr.kind === 'office'
                                        ? 'business'
                                        : 'location';
                            const color =
                                addr.kind === 'home'
                                    ? GREEN
                                    : addr.kind === 'office'
                                        ? '#8B5CF6'
                                        : '#F5A623';

                            return (
                                <Pressable
                                    key={addr.id}
                                    style={s.card}
                                    onPress={() =>
                                        pick({
                                            name:
                                                addr.label ??
                                                addr.name,
                                            address: addr.address,
                                            latitude:
                                                coords.latitude,
                                            longitude:
                                                coords.longitude,
                                        })
                                    }
                                >
                                    <View
                                        style={[
                                            s.iconWrap,
                                            { backgroundColor: color },
                                        ]}
                                    >
                                        <Ionicons
                                            name={icon as any}
                                            size={20}
                                            color="#fff"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.cardTitle}>
                                            {addr.label ?? addr.name}
                                        </Text>
                                        <Text
                                            style={s.cardSub}
                                            numberOfLines={2}
                                        >
                                            {addr.address}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={20}
                                        color="#B0B5BD"
                                    />
                                </Pressable>
                            );
                        })}
                    </>
                )}

                {!loadingSaved && saved.length === 0 && (
                    <View style={s.emptyBox}>
                        <Ionicons
                            name="bookmark-outline"
                            size={32}
                            color="#B0B5BD"
                        />
                        <Text style={s.emptyText}>
                            Belum ada alamat tersimpan
                        </Text>
                        <Text style={s.emptyHint}>
                            Buka profil → Alamat untuk menyimpan
                            alamat favorit
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

// Helper: parse lokasi dari backend (bisa GeoJSON / string / object)
function parseLocationToCoords(
    loc: any
): { latitude: number; longitude: number } | null {
    if (!loc) return null;

    if (
        typeof loc.latitude === 'number' &&
        typeof loc.longitude === 'number'
    ) {
        return { latitude: loc.latitude, longitude: loc.longitude };
    }
    if (
        Array.isArray(loc.coordinates) &&
        loc.coordinates.length >= 2
    ) {
        const [lng, lat] = loc.coordinates;
        if (typeof lat === 'number' && typeof lng === 'number') {
            return { latitude: lat, longitude: lng };
        }
    }
    if (typeof loc === 'string') {
        const m = loc.match(
            /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i
        );
        if (m) {
            return {
                latitude: Number(m[2]),
                longitude: Number(m[1]),
            };
        }
    }
    return null;
}

const s = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#EEF0F3',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#1B1B1B',
    },

    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1B1B1B',
    },
    cardSub: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },

    emptyBox: {
        alignItems: 'center',
        padding: 24,
        gap: 6,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
    },
    emptyHint: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
    },
});