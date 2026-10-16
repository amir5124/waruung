// components/HotRecommendations.tsx
// Section "Rekomendasi Hangat" di beranda: menu makanan dari resto terdekat (data dari backend).
import { ShimmerBox, ShimmerGroup } from '@/components/Shimmer';
import { api, type NearbyMerchant } from '@/lib/api';
import { loadSavedLocation } from '@/lib/savedLocation';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const BLUE = '#2F86EB';
const SEARCH_RADIUS = 15000;
const MENU_FETCH_LIMIT = 6;
const PER_MERCHANT = 3;
const MAX_ITEMS = 12;

type Reco = {
    key: string;
    name: string;
    price: number;
    image_url: string | null;
    merchant: NearbyMerchant;
    dist: number;
};

const fmtRp = (n: number) => `Rp ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const fmtCount = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)}rb+` : `${n}`);

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

/** Pakai alamat tersimpan (sama dengan halaman WarFood); kalau belum ada, pakai GPS. */
async function resolveCoords(): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const saved = await loadSavedLocation();
        if (saved) return { latitude: saved.latitude, longitude: saved.longitude };
    } catch { }
    try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return null;
        const last = await Location.getLastKnownPositionAsync();
        if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
        return null;
    }
}

type Props = {
    /** Naikkan angka ini (mis. saat pull-to-refresh) untuk memuat ulang. */
    refreshKey?: number;
};

export default function HotRecommendations({ refreshKey = 0 }: Props) {
    const { width } = useWindowDimensions();
    const cardW = Math.min(Math.round(width * 0.68), 320);
    const imgH = Math.round(cardW * 0.56);

    const [items, setItems] = useState<Reco[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [liked, setLiked] = useState<Record<string, boolean>>({});
    const reqId = useRef(0);

    const load = useCallback(async () => {
        const my = ++reqId.current;
        setLoading(true);
        setError(false);
        try {
            const c = await resolveCoords();
            if (my !== reqId.current) return;
            if (!c) {
                setItems([]);
                return;
            }

            const list = await api.merchants.nearby(c.latitude, c.longitude, SEARCH_RADIUS);
            if (my !== reqId.current) return;

            const near = list
                .map((m) => ({
                    m,
                    dist:
                        m.route_distance_m ??
                        m.distance_m ??
                        (m.latitude != null && m.longitude != null
                            ? haversine(c.latitude, c.longitude, m.latitude, m.longitude)
                            : Infinity),
                }))
                .filter((x) => x.dist <= SEARCH_RADIUS && x.m.is_open !== false)
                .sort((a, b) => a.dist - b.dist)
                .slice(0, MENU_FETCH_LIMIT);

            const settled = await Promise.allSettled(near.map((x) => api.merchants.menu(x.m.user_id)));
            if (my !== reqId.current) return;

            const out: Reco[] = [];
            settled.forEach((r, i) => {
                if (r.status !== 'fulfilled') return;
                const { m, dist } = near[i];
                r.value.items
                    .filter((it) => it.is_available && (it.stock == null || it.stock > 0))
                    // utamakan yang punya foto
                    .sort((a, b) => Number(!!b.image_url) - Number(!!a.image_url))
                    .slice(0, PER_MERCHANT)
                    .forEach((it) =>
                        out.push({
                            key: `${m.user_id}-${it.id}`,
                            name: it.name,
                            price: it.price,
                            image_url: it.image_url,
                            merchant: m,
                            dist,
                        }),
                    );
            });

            // selang-seling antar resto supaya beragam, bukan satu resto berderet
            const byMerchant = new Map<string, Reco[]>();
            out.forEach((o) => {
                const arr = byMerchant.get(o.merchant.user_id) ?? [];
                arr.push(o);
                byMerchant.set(o.merchant.user_id, arr);
            });
            const queues = Array.from(byMerchant.values());
            const mixed: Reco[] = [];
            for (let k = 0; mixed.length < MAX_ITEMS && queues.some((q) => q[k]); k++) {
                queues.forEach((q) => q[k] && mixed.length < MAX_ITEMS && mixed.push(q[k]));
            }
            setItems(mixed);
        } catch {
            if (my === reqId.current) setError(true);
        } finally {
            if (my === reqId.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load, refreshKey]);

    const openResto = (m: NearbyMerchant) =>
        router.push({ pathname: '/resto/[id]', params: { id: m.user_id } } as any);

    const goAll = () => router.push('/resto-terdekat' as any);

    return (
        <View>
            {/* Header section */}
            <View style={s.sectionHeader}>
                <View>
                    <Text style={s.sectionTitle}>Rekomendasi Hangat</Text>
                    <View style={s.sectionUnderline} />
                </View>
                <Pressable style={s.seeAllButton} onPress={goAll}>
                    <Text style={s.seeAll}>See All</Text>
                    <Ionicons name="chevron-forward" size={16} color={BLUE} />
                </Pressable>
            </View>

            {loading ? (
                <ShimmerGroup style={s.list}>
                    <View style={{ flexDirection: 'row', gap: 14 }}>
                        {[0, 1].map((i) => (
                            <View key={i} style={[s.card, { width: cardW }]}>
                                <ShimmerBox style={{ width: '100%', height: imgH, borderRadius: 0 }} />
                                <View style={s.cardBody}>
                                    <ShimmerBox style={{ width: '65%', height: 20 }} />
                                    <ShimmerBox style={{ width: '85%', height: 14, marginTop: 10 }} />
                                    <ShimmerBox style={{ width: '50%', height: 14, marginTop: 10 }} />
                                </View>
                            </View>
                        ))}
                    </View>
                </ShimmerGroup>
            ) : error ? (
                <Pressable style={s.stateBox} onPress={load}>
                    <Ionicons name="refresh" size={20} color={BLUE} />
                    <Text style={s.stateText}>Gagal memuat rekomendasi. Ketuk untuk coba lagi.</Text>
                </Pressable>
            ) : items.length === 0 ? (
                <View style={s.stateBox}>
                    <Ionicons name="restaurant-outline" size={22} color="#8A8F98" />
                    <Text style={s.stateText}>Belum ada menu tersedia di sekitarmu.</Text>
                </View>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.list}
                    decelerationRate="fast"
                    snapToInterval={cardW + 14}
                >
                    {items.map((it) => {
                        const hasRating = (it.merchant.rating_avg ?? 0) > 0;
                        const isLiked = !!liked[it.key];
                        return (
                            <Pressable
                                key={it.key}
                                style={[s.card, { width: cardW }]}
                                onPress={() => openResto(it.merchant)}
                            >
                                <View>
                                    {it.image_url ? (
                                        <Image source={{ uri: it.image_url }} style={{ width: '100%', height: imgH }} />
                                    ) : (
                                        <View style={[s.imgEmpty, { height: imgH }]}>
                                            <Ionicons name="fast-food-outline" size={40} color="#B0B5BD" />
                                        </View>
                                    )}

                                    {/* Badge diskon (masih statis) */}
                                    <View style={s.discount}>
                                        <Text style={s.discountText}>Terbaru</Text>
                                    </View>

                                    <Pressable
                                        style={s.heart}
                                        hitSlop={8}
                                        onPress={() => setLiked((p) => ({ ...p, [it.key]: !p[it.key] }))}
                                    >
                                        <Ionicons
                                            name={isLiked ? 'heart' : 'heart-outline'}
                                            size={24}
                                            color={isLiked ? '#E53935' : '#1B1B1B'}
                                        />
                                    </Pressable>
                                </View>

                                <View style={s.cardBody}>
                                    <Text style={s.title} numberOfLines={1}>{it.name}</Text>

                                    <View style={s.row}>
                                        <Ionicons name="location-outline" size={16} color="#8A8F98" />
                                        <Text style={s.address} numberOfLines={1}>
                                            {it.merchant.store_name}
                                            {it.dist !== Infinity ? `  •  ${fmtDist(it.dist)}` : ''}
                                        </Text>
                                    </View>

                                    <View style={[s.row, { justifyContent: 'space-between' }]}>
                                        <View style={s.row}>
                                            <Ionicons name="star" size={16} color="#F5A623" />
                                            <Text style={s.rating}>
                                                {hasRating ? it.merchant.rating_avg!.toFixed(1) : 'Baru'}
                                            </Text>
                                            {hasRating && it.merchant.rating_count ? (
                                                <Text style={s.reviewCount}>({fmtCount(it.merchant.rating_count)})</Text>
                                            ) : null}
                                        </View>
                                        <Text style={s.price}>{fmtRp(it.price)}</Text>
                                    </View>
                                </View>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 15,
        marginBottom: 14,
    },
    sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1B1B1B' },
    sectionUnderline: { width: 40, height: 4, borderRadius: 2, backgroundColor: BLUE, marginTop: 4 },
    seeAllButton: {
        flexDirection: 'row', alignItems: 'center', gap: 2,
        backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#CFE2FA',
        paddingVertical: 8, paddingHorizontal: 14,
    },
    seeAll: { fontSize: 14, fontWeight: '600', color: BLUE },

    list: { paddingLeft: 16, paddingRight: 16, gap: 14 },
    card: {
        backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
        shadowColor: '#2F86EB', shadowOpacity: 0.1, shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 }, elevation: 3,
    },
    imgEmpty: { width: '100%', backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
    discount: {
        position: 'absolute', top: 12, left: 12,
        backgroundColor: '#E53935', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
    },
    discountText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    heart: {
        position: 'absolute', top: 12, right: 12, width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    },

    cardBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 6 },
    title: { fontSize: 20, fontWeight: '800', color: '#1B1B1B' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    address: { flex: 1, fontSize: 14, color: '#6B7280' },
    rating: { fontSize: 15, fontWeight: '800', color: '#1B1B1B' },
    reviewCount: { fontSize: 14, color: '#6B7280' },
    price: { fontSize: 15, fontWeight: '800', color: '#1AA260' },

    stateBox: {
        marginHorizontal: 16, padding: 18, borderRadius: 16, backgroundColor: '#fff',
        flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    stateText: { flex: 1, fontSize: 14, color: '#5C6470' },
});