// HomeStep.tsx
import AppAlert from '@/components/AppAlert';
import MerchantImage from '@/components/MerchantImage';
import { api, type NearbyMerchant } from '@/lib/api';
import { loadSavedLocation, saveLocation, type SavedLocation } from '@/lib/savedLocation';
import type { FoodCategory } from '@/types/warfood';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddressSearchModal, { type PickedAddress } from './AddressSearchModal';
import CategoryGrid from './CategoryGrid';
import HomeSkeleton, {
    CategorySkeleton,
    ProductRowSkeleton,
    PromoRowSkeleton,
    RestoSectionSkeleton,
} from './HomeSkeleton';

const RED = '#D71920';
const GREEN = '#1AA260';
const SEARCH_RADIUS = 15000; // resto dalam 15 km
const MENU_FETCH_LIMIT = 6; // ambil menu dari 6 resto terdekat

const QUICK_ICONS = {
    nearby: require('@/assets/images/restaurant.png'),
    cheapDelivery: require('@/assets/images/coupon.png'),
    promo: require('@/assets/images/promo.png'),
};

// ---------- Types ----------
type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

type MerchantWithDist = NearbyMerchant & { _dist: number };

type Product = {
    id: number;
    name: string;
    price: number;
    image_url: string | null;
    merchant: MerchantWithDist;
};

type Props = {
    locationLabel?: string; // fallback label awal
    onClose: () => void;
    onPressSearch: () => void;
    onPressNearby: () => void;
    onPressCheapDelivery: () => void;
    onPressPromo: () => void;
    /** Dipanggil saat resto / produk diklik. Dikirim data resto asli dari backend. */
    onPressResto: (merchant: NearbyMerchant) => void;
    onPressSeeAll: () => void;
    onLocationResolved?: (info: { label: string; latitude: number; longitude: number }) => void;
};

// ---------- Helpers ----------
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

const fmtRp = (n: number) => `Rp ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

function etaRange(m: number) {
    const base = 15 + Math.round((m / 1000) * 3);
    return `${base}-${base + 10} min`;
}

// ============================================================
// Pakai hasil hitungan backend kalau ada; kalau tidak, estimasi dari garis lurus
const distOf = (m: MerchantWithDist) => m.route_distance_m ?? m._dist;
const etaText = (m: MerchantWithDist) =>
    m.eta_min != null ? `${m.eta_min}-${m.eta_min + 10} min` : etaRange(m._dist);
const feeLine = (m: MerchantWithDist) =>
    m.delivery_fee != null
        ? `Ongkir ${fmtRp(m.delivery_fee)} • ${fmtDistance(distOf(m))}`
        : `${fmtDistance(distOf(m))} dari kamu`;

export default function HomeStep({
    locationLabel, onClose, onPressSearch, onPressNearby,
    onPressCheapDelivery, onPressPromo, onPressResto, onPressSeeAll,
    onLocationResolved,
}: Props) {
    const insets = useSafeAreaInsets();

    // ---------- Lokasi (disimpan di storage) ----------
    const [loc, setLoc] = useState<SavedLocation | null>(null);
    const [locReady, setLocReady] = useState(false); // storage sudah dibaca
    const [gpsLoading, setGpsLoading] = useState(false);
    const [addressModal, setAddressModal] = useState(false);
    const gpsFetching = useRef(false);

    // ---------- Data dari backend ----------
    const [merchants, setMerchants] = useState<MerchantWithDist[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<FoodCategory[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [dataError, setDataError] = useState<string | null>(null);
    const reqId = useRef(0);

    // ---------- AppAlert ----------
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons?: AlertButton[];
    }>({ visible: false, title: '', message: '', buttons: undefined });

    const showAlert = (title: string, message: string, buttons?: AlertButton[]) =>
        setAlertState({ visible: true, title, message, buttons });
    const hideAlert = () => setAlertState((a) => ({ ...a, visible: false }));

    // ---------- Terapkan lokasi + simpan ----------
    const applyLocation = useCallback(
        async (next: Omit<SavedLocation, 'updatedAt'>) => {
            const saved = await saveLocation(next);
            setLoc(saved);
            onLocationResolved?.({
                label: saved.label ?? 'Lokasi saat ini',
                latitude: saved.latitude,
                longitude: saved.longitude,
            });
        },
        [onLocationResolved]
    );


    // ---------- Ambil GPS (hanya saat dibutuhkan) ----------
    const fetchGps = useCallback(async (): Promise<boolean> => {
        if (gpsFetching.current) return false;
        gpsFetching.current = true;
        setGpsLoading(true);
        try {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (!perm.granted) {
                showAlert(
                    'Izin lokasi diperlukan',
                    'Aktifkan izin lokasi di pengaturan, atau cari alamat secara manual.',
                    [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() },
                    ]
                );
                return false;
            }
            if (!(await Location.hasServicesEnabledAsync())) {
                showAlert('GPS belum aktif', 'Nyalakan GPS / layanan lokasi di perangkatmu, lalu coba lagi.');
                return false;
            }

            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const { latitude, longitude } = pos.coords;

            let text = 'Lokasi saat ini';
            try {
                const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (addr) {
                    const street = [addr.street, addr.streetNumber].filter(Boolean).join(' ');
                    const parts = [street || addr.name, addr.district || addr.subregion, addr.city].filter(Boolean);
                    if (parts.length) text = parts.join(', ');
                }
            } catch {
                // reverse geocode gagal -> teks default
            }

            await applyLocation({ label: text, latitude, longitude, source: 'gps' });
            return true;
        } catch (err: any) {
            console.warn('[HOME] Gagal ambil lokasi:', err?.message);
            showAlert('Gagal mengambil lokasi', err?.message ?? 'Coba lagi beberapa saat.', [
                { text: 'Tutup', style: 'cancel' },
                { text: 'Coba Lagi', onPress: () => fetchGps() },
            ]);
            return false;
        } finally {
            gpsFetching.current = false;
            setGpsLoading(false);
        }
    }, [applyLocation]);

    // ---------- Saat pertama dibuka: baca storage dulu ----------
    // Sudah ada alamat tersimpan -> pakai, TIDAK ambil GPS lagi.
    // Belum ada -> ambil GPS sekali, lalu simpan.
    useEffect(() => {
        let alive = true;
        (async () => {
            const saved = await loadSavedLocation();
            if (!alive) return;
            if (saved) {
                setLoc(saved);
                onLocationResolved?.({
                    label: saved.label ?? 'Lokasi tersimpan',
                    latitude: saved.latitude,
                    longitude: saved.longitude,
                });
                setLocReady(true);
            } else {
                setLocReady(true);
                await fetchGps();
            }
        })();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // ---------- Ambil resto, menu, dan kategori dari backend ----------
    const lat = loc?.latitude;
    const lng = loc?.longitude;

    const loadNearby = useCallback(async () => {
        if (lat == null || lng == null) return;
        const my = ++reqId.current;
        setDataLoading(true);
        setDataError(null);
        // kosongkan data lama supaya shimmer tampil untuk alamat baru
        setMerchants([]);
        setProducts([]);
        setCategories([]);
        try {
            const list = await api.merchants.nearby(lat, lng, SEARCH_RADIUS);
            // DEBUG: hapus setelah masalah selesai
            console.log('[HOME] lokasi:', lat, lng, '| resto dari backend:', list.length);
            console.log('[HOME] contoh resto:', JSON.stringify(list[0] ?? null));
            if (my !== reqId.current) return;

            const withDist: MerchantWithDist[] = list
                .map((m) => ({
                    ...m,
                    _dist:
                        m.distance_m ??
                        (m.latitude != null && m.longitude != null
                            ? haversine(lat, lng, m.latitude, m.longitude)
                            : Infinity),
                }))
                .filter((m) => m._dist <= SEARCH_RADIUS)
                .sort((a, b) => a._dist - b._dist);

            setMerchants(withDist);

            // Menu dari beberapa resto terdekat yang sedang buka (paralel)
            const targets = withDist.filter((m) => m.is_open !== false).slice(0, MENU_FETCH_LIMIT);
            // DEBUG: hapus setelah masalah selesai
            console.log('[HOME] lolos radius:', withDist.length, '| buka (diambil menunya):', targets.length);
            const settled = await Promise.allSettled(
                targets.map((m) => api.merchants.menu(m.user_id))
            );
            if (my !== reqId.current) return;

            const prods: Product[] = [];
            // kategori dikumpulkan dari kategori menu resto-resto terdekat
            const catMap = new Map<string, { label: string; imageUrl: string; count: number }>();

            settled.forEach((r, idx) => {
                if (r.status !== 'fulfilled') return;
                const merchant = targets[idx];
                const { categories: cats, items } = r.value;
                const available = items.filter((it) => it.is_available && (it.stock == null || it.stock > 0));

                available.slice(0, 4).forEach((it) =>
                    prods.push({
                        id: it.id,
                        name: it.name,
                        price: it.price,
                        image_url: it.image_url,
                        merchant,
                    })
                );

                cats.forEach((c) => {
                    const inCat = available.filter((it) => it.category_id === c.id);
                    if (inCat.length === 0) return;
                    const key = c.name.trim().toLowerCase();
                    const img =
                        inCat.find((it) => it.image_url)?.image_url ?? merchant.logo_url ?? '';
                    const prev = catMap.get(key);
                    if (prev) {
                        prev.count += inCat.length;
                        if (!prev.imageUrl && img) prev.imageUrl = img;
                    } else {
                        catMap.set(key, { label: c.name.trim(), imageUrl: img, count: inCat.length });
                    }
                });
            });

            setProducts(prods);
            setCategories(
                Array.from(catMap.entries())
                    .filter(([, v]) => !!v.imageUrl)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 8)
                    .map(([key, v]) => ({ key, label: v.label, imageUrl: v.imageUrl }) as FoodCategory)
            );
        } catch (e: any) {
            if (my !== reqId.current) return;
            setDataError(e?.message ?? 'Gagal memuat resto');
        } finally {
            if (my === reqId.current) setDataLoading(false);
        }
    }, [lat, lng]);

    useEffect(() => {
        loadNearby();
    }, [loadNearby]);

    // ---------- Pilih alamat dari modal ----------
    const handlePickAddress = async (addr: PickedAddress) => {
        await applyLocation({ ...addr, source: 'search' });
        setAddressModal(false);
    };

    const handleUseCurrent = async () => {
        const ok = await fetchGps();
        if (ok) setAddressModal(false);
    };

    // ---------- Turunan data ----------
    const featured = products[0] ?? null;
    const nearestOpen = useMemo(() => merchants.filter((m) => m.is_open !== false), [merchants]);
    const labelText = loc?.label ?? locationLabel ?? 'Pilih alamat';

    // Shimmer layar penuh selama mencari lokasi
    const isLocating = !locReady || (gpsLoading && !loc);
    // Shimmer per bagian selama memuat resto/menu
    const showSectionSkeleton = dataLoading && merchants.length === 0;
    const noLocation = locReady && !loc && !gpsLoading;

    // ============================================================
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            {isLocating ? (
                <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false}>
                    <HomeSkeleton paddingTop={insets.top} />
                </ScrollView>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    {/* ---- Header merah ---- */}
                    <View style={[s.header, { paddingTop: insets.top }]}>
                        <View style={s.headerTop}>
                            <Pressable style={s.circleBtn} onPress={onClose}>
                                <Ionicons name="close" size={22} color="#1B1B1B" />
                            </Pressable>

                            {/* Pill alamat: ketuk -> modal cari alamat */}
                            <Pressable style={s.locationPill} onPress={() => setAddressModal(true)}>
                                <Ionicons name="location" size={14} color="#fff" />
                                <Text style={s.locationText} numberOfLines={1}>{labelText}</Text>
                                <Ionicons name="chevron-down" size={14} color="#fff" />
                            </Pressable>

                            <Pressable style={s.circleBtn} onPress={onPressPromo}>
                                <Ionicons name="heart-half-outline" size={20} color="#1B1B1B" />
                            </Pressable>
                            <Pressable style={s.circleBtn}>
                                <Ionicons name="receipt-outline" size={20} color="#1B1B1B" />
                            </Pressable>
                        </View>

                        {/* Banner: produk dari resto terdekat */}
                        <View style={s.bannerRow}>
                            {featured ? (
                                <>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.bannerBrand} numberOfLines={1}>
                                            {featured.merchant.store_name} · {fmtDistance(distOf(featured.merchant))}
                                        </Text>
                                        <Text style={s.bannerTitle} numberOfLines={2}>{featured.name}</Text>
                                        <Text style={s.bannerPrice}>{fmtRp(featured.price)}</Text>
                                        <Pressable style={s.bannerCta} onPress={() => onPressResto(featured.merchant)}>
                                            <Text style={s.bannerCtaText}>Pesan sekarang</Text>
                                            <Ionicons name="chevron-forward" size={14} color={RED} />
                                        </Pressable>
                                    </View>
                                    {featured.image_url ? (
                                        <Image source={{ uri: featured.image_url }} style={s.bannerImage} />
                                    ) : null}
                                </>
                            ) : (
                                <View style={{ flex: 1, minHeight: 110, justifyContent: 'center' }}>
                                    <Text style={s.bannerTitle}>
                                        {noLocation
                                            ? 'Pilih alamat dulu yuk!'
                                            : dataLoading
                                                ? 'Mencari menu enak di dekatmu...'
                                                : 'Lagi mau makan apa hari ini?'}
                                    </Text>
                                    {dataLoading && (
                                        <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
                                    )}
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ---- Search bar ---- */}
                    <View style={s.searchWrap}>
                        <Pressable style={s.searchBar} onPress={onPressSearch}>
                            <Ionicons name="search" size={18} color="#8A8F98" />
                            <Text style={s.searchPlaceholder}>Lagi mau mamam apa?</Text>
                            <Ionicons name="restaurant" size={18} color={RED} />
                        </Pressable>
                    </View>

                    {/* ---- 3 menu ikon ---- */}
                    <View style={s.quickMenuRow}>
                        <Pressable style={s.quickMenu} onPress={onPressNearby}>
                            <Image source={QUICK_ICONS.nearby} style={s.quickMenuIcon} />
                            <Text style={s.quickMenuLabel}>Resto{'\n'}Terdekat</Text>
                        </Pressable>
                        <Pressable style={s.quickMenu} onPress={onPressCheapDelivery}>
                            <View>
                                <Image source={QUICK_ICONS.cheapDelivery} style={s.quickMenuIcon} />
                                <View style={s.quickMenuBadge}>
                                    <Text style={s.quickMenuBadgeText}>-50%</Text>
                                </View>
                            </View>
                            <Text style={s.quickMenuLabel}>Ongkir{'\n'}MURAAAH</Text>
                        </Pressable>
                        <Pressable style={s.quickMenu} onPress={onPressPromo}>
                            <Image source={QUICK_ICONS.promo} style={s.quickMenuIcon} />
                            <Text style={s.quickMenuLabel}>Serba{'\n'}Promo</Text>
                        </Pressable>
                    </View>

                    {/* ===== Belum ada alamat (izin ditolak / GPS mati) ===== */}
                    {noLocation ? (
                        <View style={[s.section, s.stateBox]}>
                            <Ionicons name="location-outline" size={40} color="#B0B5BD" />
                            <Text style={s.stateText}>
                                Kami butuh alamatmu untuk menampilkan resto dan menu di sekitarmu.
                            </Text>
                            <Pressable style={s.retryBtn} onPress={() => setAddressModal(true)}>
                                <Text style={s.retryText}>Pilih Alamat</Text>
                            </Pressable>
                        </View>
                    ) : showSectionSkeleton ? (
                        /* ===== Shimmer selama resto & menu dimuat ===== */
                        <>
                            <PromoRowSkeleton />
                            <CategorySkeleton />
                            <ProductRowSkeleton />
                            <RestoSectionSkeleton />
                        </>
                    ) : (
                        <>
                            {/* ---- Group order + resto terdekat ---- */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.promoScroll}>
                                <View style={s.promoBanner}>
                                    <View style={s.promoBadge}>
                                        <Text style={s.promoBadgeText}>Jajan barengan</Text>
                                    </View>
                                    <Text style={s.promoTitle}>MURAAAH pakai{'\n'}GROUP ORDER</Text>
                                    <Pressable style={s.promoCta}>
                                        <Text style={s.promoCtaText}>Cek sekarang</Text>
                                    </Pressable>
                                </View>

                                {nearestOpen.slice(0, 5).map((m) => (
                                    <Pressable key={m.user_id} style={s.dealCard} onPress={() => onPressResto(m)}>
                                        {m.logo_url ? (
                                            <MerchantImage uri={m.logo_url} style={s.dealImage} iconSize={30} />
                                        ) : (
                                            <View style={[s.dealImage, s.imgEmpty]}>
                                                <Ionicons name="restaurant" size={30} color="#B0B5BD" />
                                            </View>
                                        )}
                                        {(m.total_orders ?? 0) === 0 && (
                                            <View style={s.dealNewBadge}><Text style={s.dealNewBadgeText}>Baru</Text></View>
                                        )}
                                        <View style={s.dealBody}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                {(m.rating_avg ?? 0) > 0 && (
                                                    <>
                                                        <Ionicons name="star" size={11} color="#F5A623" />
                                                        <Text style={s.dealMeta}>{m.rating_avg!.toFixed(1)} • </Text>
                                                    </>
                                                )}
                                                <Text style={s.dealMeta}>{etaText(m)}</Text>
                                            </View>
                                            <Text style={s.dealTitle} numberOfLines={2}>{m.store_name}</Text>
                                            <Text style={s.dealOngkir}>{feeLine(m)}</Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </ScrollView>

                            {/* ---- Kategori dari menu resto terdekat ---- */}
                            {categories.length > 0 && (
                                <View style={s.section}>
                                    <View style={s.sectionHeader}>
                                        <Text style={s.sectionTitle}>Kuliner sesuai seleramu</Text>
                                        <Pressable onPress={onPressSeeAll}>
                                            <Text style={s.seeAll}>Lihat Semua</Text>
                                        </Pressable>
                                    </View>
                                    <CategoryGrid categories={categories} />
                                </View>
                            )}

                            {/* ---- Menu dari resto terdekat ---- */}
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Menu enak dari resto terdekat</Text>
                                <Text style={s.sectionSub}>Dipilih dari resto buka di sekitarmu</Text>

                                {dataError ? (
                                    <View style={s.stateBox}>
                                        <Text style={s.stateText}>{dataError}</Text>
                                        <Pressable style={s.retryBtn} onPress={loadNearby}>
                                            <Text style={s.retryText}>Coba Lagi</Text>
                                        </Pressable>
                                    </View>
                                ) : products.length === 0 ? (
                                    <View style={s.stateBox}>
                                        <Ionicons name="fast-food-outline" size={36} color="#B0B5BD" />
                                        <Text style={s.stateText}>Belum ada menu tersedia di sekitar alamat ini.</Text>
                                    </View>
                                ) : (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={{ marginTop: 12 }}
                                        contentContainerStyle={{ gap: 12, paddingRight: 16 }}
                                    >
                                        {products.map((p) => (
                                            <Pressable
                                                key={`${p.merchant.user_id}-${p.id}`}
                                                style={s.productCard}
                                                onPress={() => onPressResto(p.merchant)}
                                            >
                                                {p.image_url ? (
                                                    <Image source={{ uri: p.image_url }} style={s.productImage} />
                                                ) : (
                                                    <View style={[s.productImage, s.imgEmpty]}>
                                                        <Ionicons name="fast-food" size={30} color="#B0B5BD" />
                                                    </View>
                                                )}
                                                <View style={{ padding: 10 }}>
                                                    <Text style={s.productName} numberOfLines={2}>{p.name}</Text>
                                                    <Text style={s.productPrice}>{fmtRp(p.price)}</Text>
                                                    <Text style={s.productStore} numberOfLines={1}>
                                                        {p.merchant.store_name} • {fmtDistance(distOf(p.merchant))}
                                                    </Text>
                                                </View>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>

                            {/* ---- Resto di sekitarmu ---- */}
                            <View style={s.section}>
                                <View style={s.sectionHeader}>
                                    <Text style={s.sectionTitle}>Resto di sekitarmu</Text>
                                    <Pressable onPress={onPressNearby}>
                                        <Text style={s.seeAll}>Lihat Semua</Text>
                                    </Pressable>
                                </View>

                                {merchants.length === 0 ? (
                                    <View style={s.stateBox}>
                                        <Ionicons name="storefront-outline" size={36} color="#B0B5BD" />
                                        <Text style={s.stateText}>
                                            Belum ada resto dalam radius {fmtDistance(SEARCH_RADIUS)} dari alamat ini.
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={{ marginTop: 12, gap: 12 }}>
                                        {merchants.slice(0, 8).map((m) => (
                                            <Pressable key={m.user_id} style={s.restoCard} onPress={() => onPressResto(m)}>
                                                {m.logo_url ? (
                                                    <MerchantImage uri={m.logo_url} style={s.restoThumb} />
                                                ) : (
                                                    <View style={[s.restoThumb, s.imgEmpty]}>
                                                        <Ionicons name="restaurant" size={24} color="#B0B5BD" />
                                                    </View>
                                                )}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.restoName} numberOfLines={1}>{m.store_name}</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                                        {(m.rating_avg ?? 0) > 0 ? (
                                                            <>
                                                                <Ionicons name="star" size={12} color="#F5A623" />
                                                                <Text style={s.restoRating}>{m.rating_avg!.toFixed(1)}</Text>
                                                            </>
                                                        ) : (
                                                            <Text style={s.restoNew}>Baru</Text>
                                                        )}
                                                        <Text style={s.restoMeta}>
                                                            {'  |  '}{fmtDistance(distOf(m))}{'  |  '}{etaText(m)}
                                                        </Text>
                                                    </View>
                                                    {m.delivery_fee != null ? (
                                                        <Text style={s.restoFee}>Ongkir {fmtRp(m.delivery_fee)}</Text>
                                                    ) : null}
                                                    {m.latest_review ? (
                                                        <Text style={s.restoReview} numberOfLines={1}>“{m.latest_review}</Text>
                                                    ) : null}
                                                    {!m.is_open && <Text style={s.restoClosed}>Tutup</Text>}
                                                </View>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </>
                    )}
                </ScrollView>
            )}

            {/* ===== MODAL CARI ALAMAT ===== */}
            <AddressSearchModal
                visible={addressModal}
                currentLabel={loc?.label ?? undefined}
                userCoords={loc ? { latitude: loc.latitude, longitude: loc.longitude } : null}
                onClose={() => setAddressModal(false)}
                onSelect={handlePickAddress}
                onUseCurrent={handleUseCurrent}
            />

            {/* ===== APP ALERT ===== */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={hideAlert}
            />
        </View>
    );
}

const s = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingBottom: 24, backgroundColor: RED },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    locationPill: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10,
    },
    locationText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
    bannerRow: { flexDirection: 'row', alignItems: 'center' },
    bannerBrand: { color: '#fff', fontWeight: '700', fontSize: 12, marginBottom: 4 },
    bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 6 },
    bannerPrice: { color: '#fff', fontWeight: '800', fontSize: 24 },
    bannerCta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', alignSelf: 'flex-start', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
    bannerCtaText: { color: RED, fontWeight: '700', fontSize: 12 },
    bannerImage: { width: 130, height: 110, borderRadius: 16, resizeMode: 'cover' },

    searchWrap: { paddingHorizontal: 16, marginTop: -20 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 25, paddingHorizontal: 16, height: 52,
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
    },
    searchPlaceholder: { flex: 1, fontSize: 14, color: '#8A8F98' },

    quickMenuRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 20, gap: 12 },
    quickMenu: {
        flex: 1, alignItems: 'center', gap: 8,
        backgroundColor: '#fff', borderRadius: 16, paddingVertical: 10,
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    },
    quickMenuIcon: { width: 44, height: 44, resizeMode: 'contain' },
    quickMenuLabel: { fontSize: 12, fontWeight: '700', color: '#1B1B1B', textAlign: 'center' },
    quickMenuBadge: {
        position: 'absolute', top: -6, right: -10,
        backgroundColor: RED, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
    },
    quickMenuBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

    promoScroll: { marginTop: 20 },
    promoBanner: {
        width: 220, backgroundColor: RED, borderRadius: 16, padding: 16, marginLeft: 16,
        justifyContent: 'space-between',
    },
    promoBadge: { backgroundColor: '#B6F09C', alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10 },
    promoBadgeText: { fontSize: 11, fontWeight: '800', color: '#1B1B1B' },
    promoTitle: { color: '#fff', fontWeight: '800', fontSize: 18, lineHeight: 24, marginBottom: 12 },
    promoCta: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 8, alignItems: 'center' },
    promoCtaText: { color: '#1B1B1B', fontWeight: '700', fontSize: 13 },

    dealCard: { width: 190, backgroundColor: '#fff', borderRadius: 16, marginLeft: 12, marginRight: 4, marginVertical: 4, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6 },
    dealImage: { width: '100%', height: 110, backgroundColor: '#EEE' },
    dealNewBadge: { position: 'absolute', top: 100, left: 10, backgroundColor: GREEN, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    dealNewBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    dealBody: { padding: 10 },
    dealMeta: { fontSize: 11, color: '#5C6470' },
    dealTitle: { fontSize: 13, fontWeight: '800', color: '#1B1B1B', marginTop: 4, lineHeight: 17 },
    dealOngkir: { fontSize: 11, color: '#5C6470', marginTop: 4 },
    imgEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F2F4' },

    section: { paddingHorizontal: 16, marginTop: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1B1B1B' },
    sectionSub: { fontSize: 13, color: '#5C6470', marginTop: 2 },
    seeAll: { fontSize: 13, fontWeight: '700', color: GREEN },

    stateBox: { alignItems: 'center', gap: 10, paddingVertical: 28 },
    stateText: { fontSize: 13, color: '#5C6470', textAlign: 'center', lineHeight: 19 },
    retryBtn: { backgroundColor: RED, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 18 },
    retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },

    productCard: { width: 160, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, marginVertical: 4 },
    productImage: { width: '100%', height: 110, backgroundColor: '#EEE' },
    productName: { fontSize: 13, fontWeight: '800', color: '#1B1B1B', lineHeight: 17 },
    productPrice: { fontSize: 13, fontWeight: '800', color: RED, marginTop: 4 },
    productStore: { fontSize: 11, color: '#5C6470', marginTop: 4 },

    restoCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#EEF0F2' },
    restoThumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#EEE' },
    restoName: { fontSize: 15, fontWeight: '800', color: '#1B1B1B' },
    restoRating: { fontSize: 12, fontWeight: '800', color: '#1B1B1B' },
    restoNew: { fontSize: 12, fontWeight: '800', color: GREEN },
    restoMeta: { fontSize: 12, color: '#5C6470' },
    restoReview: { fontSize: 12, color: '#5C6470', marginTop: 6, fontStyle: 'italic' },
    restoFee: { fontSize: 12, fontWeight: '700', color: '#1B1B1B', marginTop: 4 },
    restoClosed: { fontSize: 11, fontWeight: '800', color: '#8A8F98', marginTop: 4 },
});