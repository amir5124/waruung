// app/ongkir-murah.tsx
// Ongkir dihitung dari jarak, jadi resto yang paling dekat = ongkir paling murah.
import MerchantImage from '@/components/MerchantImage';
import { RestoListSkeleton } from '@/components/Shimmer';
import { api, type NearbyMerchant } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GREEN = '#1AA260';
const RED = '#D71920';
const MAX_RADIUS = 3000; // hanya resto dalam 3 km (ongkir hemat)

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

const fmtDistance = (m: number) =>
    m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

export default function OngkirMurahScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [items, setItems] = useState<NearbyMerchant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (!perm.granted) {
                setError('Izin lokasi diperlukan untuk menampilkan resto ongkir hemat.');
                return;
            }
            if (!(await Location.hasServicesEnabledAsync())) {
                setError('GPS belum aktif. Nyalakan layanan lokasi lalu coba lagi.');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const { latitude, longitude } = pos.coords;
            setCoords({ latitude, longitude });

            const list = await api.merchants.nearby(latitude, longitude, MAX_RADIUS);
            setItems(list);
        } catch (e: any) {
            setError(e?.message ?? 'Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const data = useMemo(() => {
        if (!coords) return [];
        return items
            .map((m) => ({
                ...m,
                _dist:
                    m.distance_m ??
                    (m.latitude != null && m.longitude != null
                        ? haversine(coords.latitude, coords.longitude, m.latitude, m.longitude)
                        : Infinity),
            }))
            .filter((m) => m._dist <= MAX_RADIUS && m.is_open)
            .sort((a, b) => a._dist - b._dist);
    }, [items, coords]);

    return (
        <View style={s.screen}>
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
                    <Ionicons name="arrow-back" size={26} color="#1B1B1B" />
                </Pressable>
                <Text style={s.title}>Ongkir MURAAAH</Text>
                <Text style={s.subtitle}>Resto terdekat = ongkir paling hemat.</Text>
            </View>

            {loading ? (
                <RestoListSkeleton variant="compact" bottomInset={insets.bottom} />
            ) : error ? (
                <View style={s.center}>
                    <Ionicons name="location-outline" size={44} color="#B0B5BD" />
                    <Text style={s.centerText}>{error}</Text>
                    <Pressable style={s.retryBtn} onPress={load}>
                        <Text style={s.retryText}>Coba Lagi</Text>
                    </Pressable>
                    <Pressable onPress={() => Linking.openSettings()}>
                        <Text style={s.link}>Buka Pengaturan</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(m) => m.user_id}
                    contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
                    showsVerticalScrollIndicator={false}
                    refreshing={loading}
                    onRefresh={load}
                    ListEmptyComponent={
                        <View style={s.center}>
                            <Ionicons name="storefront-outline" size={44} color="#B0B5BD" />
                            <Text style={s.centerText}>
                                Belum ada resto buka dalam {fmtDistance(MAX_RADIUS)} dari lokasimu.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            style={s.card}
                            onPress={() =>
                                router.push({ pathname: '/resto/[id]', params: { id: item.user_id } } as any)
                            }
                        >
                            {item.logo_url ? (
                                <MerchantImage uri={item.logo_url} style={s.thumb} iconSize={24} />
                            ) : (
                                <View style={[s.thumb, s.thumbEmpty]}>
                                    <Ionicons name="restaurant" size={24} color="#B0B5BD" />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={s.name} numberOfLines={1}>{item.store_name}</Text>
                                <View style={s.row}>
                                    {(item.rating_avg ?? 0) > 0 && (
                                        <>
                                            <Ionicons name="star" size={13} color="#F5A623" />
                                            <Text style={s.rating}>{item.rating_avg!.toFixed(1)}</Text>
                                            <Text style={s.meta}>  |  </Text>
                                        </>
                                    )}
                                    <Text style={s.meta}>{fmtDistance(item.route_distance_m ?? item._dist)} dari kamu</Text>
                                </View>
                                <View style={s.badge}>
                                    <Ionicons name="bicycle" size={13} color={RED} />
                                    <Text style={s.badgeText}>{item.delivery_fee != null ? `Ongkir Rp ${Math.round(item.delivery_fee).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : 'Ongkir hemat'}</Text>
                                </View>
                            </View>
                        </Pressable>
                    )}
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F4F5F7' },
    header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14 },
    back: { width: 36, height: 36, justifyContent: 'center', marginBottom: 6 },
    title: { fontSize: 24, fontWeight: '800', color: '#1B1B1B' },
    subtitle: { fontSize: 15, color: '#3A3F47', marginTop: 2 },

    card: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 12 },
    thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#EEE' },
    thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 16, fontWeight: '800', color: '#1B1B1B' },
    row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    rating: { fontSize: 13, fontWeight: '800', color: '#1B1B1B', marginLeft: 3 },
    meta: { fontSize: 13, color: '#5C6470' },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
        borderWidth: 1, borderColor: '#E1E4E8', borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 4, marginTop: 8,
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: '#1B1B1B' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    centerText: { fontSize: 14, color: '#5C6470', textAlign: 'center', lineHeight: 20 },
    retryBtn: { backgroundColor: RED, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
    retryText: { color: '#fff', fontWeight: '800' },
    link: { color: GREEN, fontWeight: '700' },
});