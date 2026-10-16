// app/resto-terdekat.tsx
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
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GREEN = '#1AA260';
const RED = '#D71920';

type Merchant = NearbyMerchant;

const RADIUS_OPTIONS = [1000, 3000, 5000, 10000, 15000, 25000];

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

// Estimasi sederhana: ~3 menit per km + 15 menit persiapan
function etaRange(m: number) {
    const base = 15 + Math.round((m / 1000) * 3);
    return `${base}-${base + 10} min`;
}

const fmtCount = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)}rb+` : `${n}`);

export default function RestoTerdekatScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [items, setItems] = useState<Merchant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // filter
    const [radius, setRadius] = useState(15000);
    const [onlyTopRated, setOnlyTopRated] = useState(false);
    const [showRadiusPicker, setShowRadiusPicker] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (!perm.granted) {
                setError('Izin lokasi diperlukan untuk menampilkan resto terdekat.');
                return;
            }
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                setError('GPS belum aktif. Nyalakan layanan lokasi lalu coba lagi.');
                return;
            }

            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const { latitude, longitude } = pos.coords;
            setCoords({ latitude, longitude });

            const list = await api.merchants.nearby(latitude, longitude, radius);
            setItems(list);
        } catch (e: any) {
            setError(e?.message ?? 'Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    }, [radius]);

    useEffect(() => {
        load();
    }, [load]);

    // Hitung jarak (pakai distance_m dari backend, fallback haversine), filter & urutkan
    const data = useMemo(() => {
        if (!coords) return [];
        return items
            .map((m) => {
                const dist =
                    m.distance_m ??
                    (m.latitude != null && m.longitude != null
                        ? haversine(coords.latitude, coords.longitude, m.latitude, m.longitude)
                        : Infinity);
                return { ...m, _dist: dist };
            })
            .filter((m) => m._dist <= radius)
            .filter((m) => (onlyTopRated ? (m.rating_avg ?? 0) >= 4.5 : true))
            .sort((a, b) => a._dist - b._dist);
    }, [items, coords, radius, onlyTopRated]);

    const renderItem = ({ item }: { item: Merchant & { _dist: number } }) => {
        const hasRating = (item.rating_avg ?? 0) > 0;
        return (
            <Pressable
                style={s.card}
                onPress={() => router.push({ pathname: '/resto/[id]', params: { id: item.user_id } } as any)}
            >
                <View style={s.cardRow}>
                    {item.logo_url ? (
                        <MerchantImage uri={item.logo_url} style={s.thumb} iconSize={28} />
                    ) : (
                        <View style={[s.thumb, s.thumbEmpty]}>
                            <Ionicons name="restaurant" size={28} color="#B0B5BD" />
                        </View>
                    )}

                    <View style={{ flex: 1 }}>
                        <Text style={s.name} numberOfLines={1}>{item.store_name}</Text>

                        <View style={s.metaRow}>
                            {hasRating ? (
                                <>
                                    <Ionicons name="star" size={14} color="#F5A623" />
                                    <Text style={s.rating}>{item.rating_avg!.toFixed(1)}</Text>
                                    <Text style={s.meta}>
                                        ({item.rating_count ? `${fmtCount(item.rating_count)} ratings` : `${item.total_orders ?? 0} pesanan`})
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="sparkles" size={14} color="#F5A623" />
                                    <Text style={s.newText}>Baru</Text>
                                </>
                            )}
                            {item.category_label ? (
                                <Text style={s.meta} numberOfLines={1}>  |  {item.category_label}</Text>
                            ) : null}
                        </View>

                        <Text style={s.meta} numberOfLines={1}>
                            {fmtDistance(item.route_distance_m ?? item._dist)}  |  {item.eta_min != null ? `${item.eta_min}-${item.eta_min + 10} min` : etaRange(item._dist)}
                            {!item.is_open ? '  |  Tutup' : ''}
                        </Text>

                        {item.address ? (
                            <Text style={s.address} numberOfLines={1}>{item.address}</Text>
                        ) : null}
                    </View>
                </View>

                {/* Chip info */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                    {item.delivery_fee != null ? (
                        <View style={s.tag}>
                            <Ionicons name="bicycle" size={13} color={RED} />
                            <Text style={s.tagText}>
                                Ongkir Rp {Math.round(item.delivery_fee).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                            </Text>
                        </View>
                    ) : null}
                    <View style={s.tag}>
                        <Ionicons name="location" size={13} color={RED} />
                        <Text style={s.tagText}>{fmtDistance(item.route_distance_m ?? item._dist)} dari kamu</Text>
                    </View>
                    <View style={[s.tag, { backgroundColor: item.is_open ? '#E7F6EE' : '#F1F2F4' }]}>
                        <Ionicons
                            name={item.is_open ? 'checkmark-circle' : 'close-circle'}
                            size={13}
                            color={item.is_open ? GREEN : '#8A8F98'}
                        />
                        <Text style={s.tagText}>{item.is_open ? 'Buka' : 'Tutup'}</Text>
                    </View>
                </ScrollView>

                {/* Ulasan toko (jika ada) */}
                {item.latest_review ? (
                    <View style={s.reviewBox}>
                        <View style={s.reviewAvatar}>
                            <Ionicons name="person" size={12} color="#8A8F98" />
                        </View>
                        <Text style={s.reviewText} numberOfLines={1}>“{item.latest_review}</Text>
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color="#C5CAD1" />
                    </View>
                ) : null}
            </Pressable>
        );
    };

    return (
        <View style={s.screen}>
            {/* Header */}
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={26} color="#1B1B1B" />
                </Pressable>
                <Text style={s.title}>Terdekat</Text>
                <Text style={s.subtitle}>Resto yummy di deket sini.</Text>

                {/* Filter chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 14 }}
                    contentContainerStyle={{ gap: 8, paddingRight: 16 }}
                >
                    <Pressable
                        style={[s.filterChip, showRadiusPicker && s.filterChipActive]}
                        onPress={() => setShowRadiusPicker((v) => !v)}
                    >
                        <Ionicons name="options-outline" size={20} color="#1B1B1B" />
                    </Pressable>
                    <Pressable
                        style={[s.filterChip, s.filterChipActive]}
                        onPress={() => setShowRadiusPicker((v) => !v)}
                    >
                        <Text style={s.filterText}>Radius {fmtDistance(radius)}</Text>
                    </Pressable>
                    <Pressable
                        style={[s.filterChip, onlyTopRated && s.filterChipActive]}
                        onPress={() => setOnlyTopRated((v) => !v)}
                    >
                        <Ionicons name="star" size={14} color="#F5A623" />
                        <Text style={s.filterText}>Rating 4.5+</Text>
                    </Pressable>
                </ScrollView>

                {showRadiusPicker && (
                    <View style={s.radiusRow}>
                        {RADIUS_OPTIONS.map((r) => (
                            <Pressable
                                key={r}
                                style={[s.radiusChip, radius === r && s.radiusChipActive]}
                                onPress={() => {
                                    setRadius(r);
                                    setShowRadiusPicker(false);
                                }}
                            >
                                <Text style={[s.radiusText, radius === r && { color: '#fff' }]}>
                                    {fmtDistance(r)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </View>

            {/* Content */}
            {loading ? (
                <RestoListSkeleton variant="full" bottomInset={insets.bottom} />
            ) : error ? (
                <View style={s.center}>
                    <Ionicons name="location-outline" size={44} color="#B0B5BD" />
                    <Text style={s.centerText}>{error}</Text>
                    <Pressable style={s.retryBtn} onPress={load}>
                        <Text style={s.retryText}>Coba Lagi</Text>
                    </Pressable>
                    <Pressable onPress={() => Linking.openSettings()}>
                        <Text style={s.linkText}>Buka Pengaturan</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(m) => m.user_id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
                    showsVerticalScrollIndicator={false}
                    refreshing={loading}
                    onRefresh={load}
                    ListEmptyComponent={
                        <View style={s.center}>
                            <Ionicons name="storefront-outline" size={44} color="#B0B5BD" />
                            <Text style={s.centerText}>
                                Belum ada resto dalam radius {fmtDistance(radius)}.{'\n'}Coba perbesar radius.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F4F5F7' },
    header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14 },
    backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: 6 },
    title: { fontSize: 24, fontWeight: '800', color: '#1B1B1B' },
    subtitle: { fontSize: 15, color: '#3A3F47', marginTop: 2 },

    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: '#E1E4E8', borderRadius: 22,
        paddingHorizontal: 16, height: 44, backgroundColor: '#F8F9FA',
    },
    filterChipActive: { borderColor: GREEN, backgroundColor: '#E7F6EE' },
    filterText: { fontSize: 15, fontWeight: '700', color: '#1B1B1B' },
    radiusRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    radiusChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
        borderWidth: 1, borderColor: '#E1E4E8', backgroundColor: '#fff',
    },
    radiusChipActive: { backgroundColor: GREEN, borderColor: GREEN },
    radiusText: { fontSize: 13, fontWeight: '700', color: '#1B1B1B' },

    card: { backgroundColor: '#fff', borderRadius: 20, padding: 14 },
    cardRow: { flexDirection: 'row', gap: 14 },
    thumb: { width: 86, height: 86, borderRadius: 16, backgroundColor: '#EEE' },
    thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 17, fontWeight: '800', color: '#1B1B1B' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    rating: { fontSize: 14, fontWeight: '800', color: '#1B1B1B' },
    newText: { fontSize: 14, fontWeight: '800', color: '#1B1B1B' },
    meta: { fontSize: 13, color: '#5C6470', marginTop: 3 },
    address: { fontSize: 12, color: '#8A8F98', marginTop: 3 },

    tag: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        borderWidth: 1, borderColor: '#E1E4E8', borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 7, marginRight: 8, backgroundColor: '#fff',
    },
    tagText: { fontSize: 13, fontWeight: '700', color: '#1B1B1B' },

    reviewBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
        backgroundColor: '#EEF4FA', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
    },
    reviewAvatar: {
        width: 22, height: 22, borderRadius: 11, backgroundColor: '#D9DEE4',
        alignItems: 'center', justifyContent: 'center',
    },
    reviewText: { flex: 1, fontSize: 13, color: '#3A3F47' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    centerText: { fontSize: 14, color: '#5C6470', textAlign: 'center', lineHeight: 20 },
    retryBtn: { backgroundColor: RED, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
    retryText: { color: '#fff', fontWeight: '800' },
    linkText: { color: GREEN, fontWeight: '700', marginTop: 4 },
});