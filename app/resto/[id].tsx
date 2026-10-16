// app/resto/[id].tsx
// Detail resto — tampilan mengikuti desain "Detail Resto" (warna dari ojek-theme).
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MerchantImage from '@/components/MerchantImage';
import { ShimmerBox, ShimmerGroup } from '@/components/Shimmer';
import { colors } from '@/constants/ojek-theme';
import {
    api,
    type MerchantMenuResponse,
    type NearbyMerchant,
} from '@/lib/api';
import { useCart } from '@/lib/cart';
import { loadSavedLocation } from '@/lib/savedLocation';
import { Image } from 'react-native';

// ============================================================
// CONSTANTS
// ============================================================
const PRIMARY = colors.primary;     // '#40a3ea'
const SECONDARY = colors.secondary; // '#e68515'
const PRIMARY_SOFT = '#E8F4FD';     // tint tipis dari primary
const PRIMARY_DARK = '#1F6FAE';     // teks di atas tint (kontras cukup)
const INK = '#172019';
const MUTED = '#5F6B64';
const LINE = '#EDF0EE';

const COVER_H = Math.round(Dimensions.get('window').width * 0.55);

const fmtRp = (n: number) =>
    `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const fmtDist = (m: number) =>
    m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;

// ============================================================
// HELPERS — lokasi & jarak
// (sebaiknya dipindah ke lib/geo.ts karena dipakai juga di beranda)
// ============================================================
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

/** Alamat tersimpan dulu (sama dengan beranda); kalau belum ada, pakai GPS. */
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

// ============================================================
// HELPERS — open_hours
// ============================================================
const DAY_ORDER = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'] as const;

const DAY_LABEL: Record<string, string> = {
    senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis',
    jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu',
};

function normalizeOpenHours(
    raw: string | Record<string, string> | null | undefined
): Array<{ day: string; hours: string }> {
    if (!raw) return [];
    if (typeof raw === 'string') return [{ day: '', hours: raw }];
    return DAY_ORDER.filter((d) => raw[d] != null).map((d) => ({
        day: DAY_LABEL[d] ?? d,
        hours: String(raw[d]),
    }));
}

function getTodayHours(
    raw: string | Record<string, string> | null | undefined
): string | null {
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    const map: Record<number, string> = {
        0: 'minggu', 1: 'senin', 2: 'selasa', 3: 'rabu', 4: 'kamis', 5: 'jumat', 6: 'sabtu',
    };
    return raw[map[new Date().getDay()]] ?? null;
}

// ------------------------------------------------------------
// Cek apakah SEKARANG berada dalam jam operasional.
// Mengenali: "08:00 - 21:00", "08.00-21.00", "08:00 s/d 21:00",
// "09:00-12:00, 14:00-21:00", "24 jam", "Tutup"/"Libur".
// return: true = dalam jam buka, false = di luar jam / libur,
//         null = format tidak dikenali (ikut flag server).
// ------------------------------------------------------------
const RANGE_RE = /(\d{1,2})[:.](\d{2})\s*(?:-|–|—|s\/d|sd|sampai|to)\s*(\d{1,2})[:.](\d{2})/gi;

function parseRanges(str: string): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (const m of String(str).matchAll(RANGE_RE)) {
        out.push([Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]);
    }
    return out;
}

function isWithinHours(
    raw: string | Record<string, string> | null | undefined,
    now: Date = new Date()
): boolean | null {
    if (!raw) return null;

    const nowMin = now.getHours() * 60 + now.getMinutes();
    const keys = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

    const todayStr = typeof raw === 'string' ? raw : raw[keys[now.getDay()]];
    const yesterdayStr = typeof raw === 'string' ? null : raw[keys[(now.getDay() + 6) % 7]];

    // hari tidak terdaftar pada objek jam = tutup
    if (todayStr == null) return typeof raw === 'string' ? null : false;

    // jam buka semalam yang melewati tengah malam (mis. 18:00-02:00)
    if (yesterdayStr) {
        for (const [st, en] of parseRanges(yesterdayStr)) {
            if (en < st && nowMin < en) return true;
        }
    }

    const t = String(todayStr);
    if (/24\s*jam/i.test(t)) return true;

    const ranges = parseRanges(t);
    if (ranges.length === 0) {
        return /tutup|libur|closed/i.test(t) ? false : null;
    }

    for (const [st, en] of ranges) {
        if (st === en) return true;                 // 00:00-00:00 = 24 jam
        if (en > st) {
            if (nowMin >= st && nowMin < en) return true;
        } else {
            if (nowMin >= st) return true;          // lewat tengah malam
        }
    }
    return false;
}

// Bisa dipesan = flag server buka DAN tidak di luar jam operasional
function isOrderable(m: any, now: Date = new Date()): boolean {
    if (m?.is_open === false) return false;
    return isWithinHours(m?.open_hours, now) !== false;
}

// ============================================================
// KERANJANG — jumlah per item & kurangi.
// Disesuaikan dengan hook useCart milikmu; kalau nama fungsinya beda,
// cukup ubah dua helper ini.
// ============================================================
function qtyOf(cart: any, id: number): number {
    if (typeof cart.qtyOf === 'function') return cart.qtyOf(id) ?? 0;
    if (typeof cart.getQty === 'function') return cart.getQty(id) ?? 0;
    const list = cart.items ?? cart.lines ?? [];
    const found = Array.isArray(list)
        ? list.find((l: any) => (l.id ?? l.menu_item_id) === id)
        : null;
    return found?.qty ?? 0;
}

function decrease(cart: any, id: number) {
    const fn = cart.decrement ?? cart.dec ?? cart.remove ?? cart.decrease;
    if (typeof fn === 'function') fn.call(cart, id);
}

const canDecrease = (cart: any) =>
    ['decrement', 'dec', 'remove', 'decrease'].some((k) => typeof cart[k] === 'function');

// ============================================================
// TYPES
// ============================================================
type MenuItem = MerchantMenuResponse['items'][number];

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function RestoDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const cart = useCart();
    const cartAny = cart as any;

    const [merchant, setMerchant] = useState<NearbyMerchant | null>(null);
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCat, setActiveCat] = useState<string>('Semua');
    const [showAllHours, setShowAllHours] = useState(false);
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

    // ---- Tick tiap menit: status buka/tutup ikut berubah otomatis ----
    const [, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick((n) => n + 1), 60_000);
        return () => clearInterval(t);
    }, []);

    // ---- Lokasi pengguna (untuk hitung jarak & ETA) ----
    useEffect(() => {
        let alive = true;
        resolveCoords().then((c) => {
            if (alive) setCoords(c);
        });
        return () => {
            alive = false;
        };
    }, []);

    // ---- Load merchant + menu ----
    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [m, menuRes] = await Promise.all([
                api.merchants.detail(id as string),
                api.merchants.foodMenu(id as string),
            ]);
            setMerchant(m);
            setMenu(
                menuRes.items.filter(
                    (it) => it.is_available && (it.stock == null || it.stock > 0)
                )
            );
        } catch (e) {
            console.warn('[RestoDetail] load gagal', e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    // ---- Kategori unik ----
    const categories = useMemo(() => {
        const set = new Set<string>();
        menu.forEach((m: any) => {
            if (m.category_name) set.add(m.category_name);
        });
        return ['Semua', ...Array.from(set)];
    }, [menu]);

    // ---- Filter menu ----
    const filtered = useMemo(
        () =>
            activeCat === 'Semua'
                ? menu
                : menu.filter((m: any) => m.category_name === activeCat),
        [menu, activeCat]
    );

    // ---- Jarak: hasil backend dulu, kalau tidak ada hitung dari lat/lng ----
    const distM = useMemo(() => {
        if (!merchant) return null;
        const m = merchant as any;
        if (m.route_distance_m != null) return Number(m.route_distance_m);
        if (m.distance_m != null) return Number(m.distance_m);
        if (coords && m.latitude != null && m.longitude != null) {
            return haversine(
                coords.latitude,
                coords.longitude,
                Number(m.latitude),
                Number(m.longitude)
            );
        }
        return null;
    }, [merchant, coords]);

    // ---- ETA: dari backend kalau ada, kalau tidak estimasi (sama dengan beranda) ----
    const etaMin = useMemo(() => {
        if (merchant?.eta_min != null) return Number(merchant.eta_min);
        if (distM == null) return null;
        return 15 + Math.round((distM / 1000) * 3);
    }, [merchant, distM]);

    const cartCount = cart.totalQty();
    const cartTotal = cart.totalPrice();

    // ---- Tambah item (diblokir kalau toko tutup / di luar jam) ----
    const add = (it: MenuItem) => {
        if (!merchant || !isOrderable(merchant)) return;
        cart.add({
            id: it.id,
            name: it.name,
            price: it.price,
            image_url: it.image_url,
            merchantId: merchant.user_id,
            merchantName: merchant.store_name,
        });
    };

    // ---- Skeleton ----
    if (loading || !merchant) {
        return <RestoDetailSkeleton />;
    }

    const flagOpen = merchant.is_open !== false;
    const outsideHours =
        flagOpen && isWithinHours((merchant as any).open_hours) === false;
    const isOpen = flagOpen && !outsideHours;

    const todayHours = getTodayHours((merchant as any).open_hours);
    const hoursList = normalizeOpenHours((merchant as any).open_hours);
    const hasHoursObject =
        (merchant as any).open_hours != null &&
        typeof (merchant as any).open_hours === 'object';
    const hasRating = (merchant.rating_avg ?? 0) > 0;
    const coverUrl = (merchant as any).cover_url ?? merchant.logo_url ?? null;
    const showStepper = canDecrease(cartAny);

    return (
        <View style={{ flex: 1, backgroundColor: '#F4F6F5' }}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: cartCount > 0 ? 130 : 40 }}
            >
                {/* ===== FOTO COVER ===== */}
                <View>
                    <MerchantImage
                        uri={coverUrl}
                        fit="cover"
                        iconSize={56}
                        style={{ width: '100%', height: COVER_H + 24 }}
                    />
                    <View style={s.coverShade} pointerEvents="none" />

                    <Pressable
                        accessibilityLabel="Kembali"
                        style={[s.backBtn, { top: insets.top + 8 }]}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={22} color={INK} />
                    </Pressable>
                </View>

                {/* ===== INFO RESTO ===== */}
                <View style={s.infoCard}>
                    <View style={s.titleRow}>
                        <MerchantImage
                            uri={merchant.logo_url}
                            fit="cover"
                            iconSize={26}
                            style={s.logo}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={s.storeName} numberOfLines={2}>
                                {merchant.store_name}
                            </Text>
                            <View style={s.statusRow}>
                                <View
                                    style={[
                                        s.statusChip,
                                        { backgroundColor: isOpen ? PRIMARY_SOFT : '#F1F2F4' },
                                    ]}
                                >
                                    <View
                                        style={[
                                            s.statusDot,
                                            { backgroundColor: isOpen ? PRIMARY : '#8A8F98' },
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            s.statusText,
                                            { color: isOpen ? PRIMARY_DARK : MUTED },
                                        ]}
                                    >
                                        {isOpen ? 'Buka' : 'Tutup'}
                                    </Text>
                                </View>
                                {!!todayHours && (
                                    <Text style={s.todayHours} numberOfLines={1}>
                                        {todayHours}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* stats */}
                    <View style={s.statsRow}>
                        <View style={s.stat}>
                            <Ionicons name="star" size={16} color={SECONDARY} />
                            <Text style={s.statVal}>
                                {hasRating ? merchant.rating_avg!.toFixed(1) : 'Baru'}
                            </Text>
                            {!!merchant.rating_count && (
                                <Text style={s.statSub}>({merchant.rating_count})</Text>
                            )}
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.stat}>
                            <Ionicons name="location" size={16} color={PRIMARY} />
                            <Text style={s.statVal}>
                                {distM != null ? fmtDist(distM) : '-'}
                            </Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.stat}>
                            <Ionicons name="time-outline" size={16} color={MUTED} />
                            <Text style={s.statVal}>
                                {etaMin != null ? `${etaMin}-${etaMin + 10} mnt` : '-'}
                            </Text>
                        </View>
                    </View>

                    {/* ongkir */}
                    {merchant.delivery_fee != null && (
                        <View style={s.feeChip}>
                            <Ionicons name="bicycle" size={15} color={SECONDARY} />
                            <Text style={s.feeText}>Ongkir {fmtRp(merchant.delivery_fee)}</Text>
                        </View>
                    )}

                    {/* alamat */}
                    <View style={s.addrRow}>
                        <Ionicons name="location-outline" size={16} color="#7B8680" style={{ marginTop: 2 }} />
                        <Text style={s.addr}>
                            {merchant.address ?? 'Alamat tidak tersedia'}
                        </Text>
                    </View>

                    {!!merchant.description && (
                        <Text style={s.desc}>{merchant.description}</Text>
                    )}

                    {/* jam operasional lengkap */}
                    {hasHoursObject && hoursList.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                            <Pressable
                                style={s.hoursToggleRow}
                                onPress={() => setShowAllHours((v) => !v)}
                                hitSlop={8}
                            >
                                <Ionicons name="calendar-outline" size={16} color="#7B8680" />
                                <Text style={s.hoursToggle}>
                                    {showAllHours ? 'Sembunyikan jam buka' : 'Lihat jam buka'}
                                </Text>
                                <Ionicons
                                    name={showAllHours ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color={PRIMARY}
                                />
                            </Pressable>

                            {showAllHours && (
                                <View style={s.hoursDetail}>
                                    {hoursList.map((h, i) => (
                                        <View key={i} style={s.hoursRow}>
                                            <Text style={s.hoursDay}>{h.day || '—'}</Text>
                                            <Text style={s.hoursVal}>{h.hours}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {!isOpen && (
                        <View style={s.closedBanner}>
                            <Ionicons name="moon-outline" size={18} color="#8A5A00" />
                            <Text style={s.closedText}>
                                {outsideHours
                                    ? `Di luar jam operasional${todayHours ? ` (${todayHours})` : ''}. Kamu masih bisa melihat menunya.`
                                    : 'Resto sedang tutup. Kamu masih bisa melihat menunya.'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ===== TAB KATEGORI ===== */}
                {categories.length > 1 && (
                    <View style={s.catWrap}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.catList}
                        >
                            {categories.map((c) => {
                                const active = c === activeCat;
                                return (
                                    <Pressable
                                        key={c}
                                        onPress={() => setActiveCat(c)}
                                        style={[s.cat, active && s.catActive]}
                                    >
                                        <Text style={[s.catText, active && s.catTextActive]}>
                                            {c}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ===== LIST MENU ===== */}
                <View style={s.menuCard}>
                    <Text style={s.menuHeading}>
                        {activeCat === 'Semua' ? 'Menu' : activeCat}
                    </Text>

                    {filtered.length === 0 ? (
                        <View style={s.emptyMenu}>
                            <Ionicons name="fast-food-outline" size={40} color="#B0B5BD" />
                            <Text style={s.emptyText}>Belum ada menu di kategori ini.</Text>
                        </View>
                    ) : (
                        filtered.map((it, idx) => {
                            const qty = qtyOf(cartAny, it.id);
                            return (
                                <View key={it.id}>
                                    {idx > 0 && <View style={s.sep} />}
                                    <View style={s.menuRow}>
                                        <View style={{ flex: 1, paddingRight: 12 }}>
                                            <Text style={s.menuName} numberOfLines={2}>
                                                {it.name}
                                            </Text>
                                            {!!it.description && (
                                                <Text style={s.menuDesc} numberOfLines={2}>
                                                    {it.description}
                                                </Text>
                                            )}
                                            <View style={s.priceRow}>
                                                <Text style={s.menuPrice}>{fmtRp(it.price)}</Text>
                                                {it.stock != null && it.stock <= 5 && (
                                                    <Text style={s.stockLow}>Sisa {it.stock}</Text>
                                                )}
                                            </View>
                                        </View>

                                        <View style={{ alignItems: 'center' }}>
                                            {it.image_url ? (
                                                <Image source={{ uri: it.image_url }} style={s.menuImg} />
                                            ) : (
                                                <View style={[s.menuImg, s.menuImgEmpty]}>
                                                    <Ionicons name="fast-food-outline" size={28} color="#B0B5BD" />
                                                </View>
                                            )}

                                            <View style={s.qtyWrap}>
                                                {qty > 0 && showStepper ? (
                                                    <View style={s.stepper}>
                                                        <Pressable
                                                            hitSlop={6}
                                                            style={s.stepBtn}
                                                            onPress={() => decrease(cartAny, it.id)}
                                                        >
                                                            <Ionicons name="remove" size={18} color={PRIMARY} />
                                                        </Pressable>
                                                        <Text style={s.qtyText}>{qty}</Text>
                                                        <Pressable
                                                            hitSlop={6}
                                                            style={[s.stepBtn, !isOpen && { opacity: 0.4 }]}
                                                            disabled={!isOpen}
                                                            onPress={() => add(it)}
                                                        >
                                                            <Ionicons name="add" size={18} color={PRIMARY} />
                                                        </Pressable>
                                                    </View>
                                                ) : (
                                                    <Pressable
                                                        disabled={!isOpen}
                                                        onPress={() => add(it)}
                                                        style={[s.addBtn, !isOpen && { opacity: 0.4 }]}
                                                    >
                                                        <Text style={s.addBtnText}>
                                                            {qty > 0 ? `Tambah (${qty})` : 'Tambah'}
                                                        </Text>
                                                    </Pressable>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* ===== FLOATING CART BAR ===== */}
            {cartCount > 0 && (
                <View style={[s.cartBarWrap, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
                    <Pressable
                        style={[s.cartBar, !isOpen && { opacity: 0.5 }]}
                        disabled={!isOpen}
                        onPress={() =>
                            router.push({
                                pathname: '/checkout',
                                params: { merchantId: merchant.user_id },
                            } as any)
                        }
                    >
                        <View style={s.cartBadge}>
                            <Text style={s.cartBadgeText}>{cartCount}</Text>
                        </View>
                        <Text style={s.cartText}>
                            {isOpen ? 'Lihat Keranjang' : 'Resto Tutup'}
                        </Text>
                        <Text style={s.cartPrice}>{fmtRp(cartTotal)}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#fff" />
                    </Pressable>
                </View>
            )}
        </View>
    );
}

// ============================================================
// SKELETON
// ============================================================
function RestoDetailSkeleton() {
    return (
        <ShimmerGroup style={{ flex: 1, backgroundColor: '#F4F6F5' }}>
            <ShimmerBox style={{ width: '100%', height: COVER_H + 24, borderRadius: 0 }} />
            <View style={[s.infoCard, { gap: 12 }]}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <ShimmerBox style={{ width: 56, height: 56, borderRadius: 16 }} />
                    <View style={{ flex: 1, gap: 8 }}>
                        <ShimmerBox style={{ width: '70%', height: 20 }} />
                        <ShimmerBox style={{ width: 60, height: 20, borderRadius: 10 }} />
                    </View>
                </View>
                <ShimmerBox style={{ width: '100%', height: 38 }} />
                <ShimmerBox style={{ width: '85%', height: 14 }} />
                <ShimmerBox style={{ width: '65%', height: 14 }} />
            </View>
            <View style={{ padding: 16, gap: 18, backgroundColor: '#fff', marginTop: 8 }}>
                {[0, 1, 2].map((i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1, gap: 8 }}>
                            <ShimmerBox style={{ width: '60%', height: 16 }} />
                            <ShimmerBox style={{ width: '85%', height: 12 }} />
                            <ShimmerBox style={{ width: 80, height: 14 }} />
                        </View>
                        <ShimmerBox style={{ width: 92, height: 92, borderRadius: 14 }} />
                    </View>
                ))}
            </View>
        </ShimmerGroup>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    // ---- Cover ----
    coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.08)' },
    backBtn: {
        position: 'absolute',
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },

    // ---- Info resto ----
    infoCard: {
        backgroundColor: '#fff',
        marginTop: -24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logo: { width: 56, height: 56, borderRadius: 16 },
    storeName: { fontSize: 21, fontWeight: '800', color: INK, lineHeight: 26 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: '700' },
    todayHours: { flexShrink: 1, fontSize: 12, color: MUTED, fontWeight: '600' },

    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: LINE,
    },
    stat: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    statVal: { fontSize: 14, fontWeight: '800', color: INK },
    statSub: { fontSize: 12, color: MUTED },
    statDivider: { width: 1, height: 22, backgroundColor: LINE },

    feeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#F6D9B0',
        backgroundColor: '#FFF6EA',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    feeText: { fontSize: 13, fontWeight: '700', color: INK },

    addrRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    addr: { flex: 1, fontSize: 13, color: '#4A554F', lineHeight: 19 },
    desc: { marginTop: 8, fontSize: 13, color: '#4A554F', lineHeight: 19 },

    // ---- Jam operasional ----
    hoursToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hoursToggle: { flex: 1, fontSize: 13, fontWeight: '700', color: PRIMARY_DARK },
    hoursDetail: {
        marginTop: 8,
        padding: 12,
        backgroundColor: '#F4F6F5',
        borderRadius: 12,
        gap: 6,
    },
    hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
    hoursDay: { fontSize: 12, color: MUTED, fontWeight: '600', minWidth: 70 },
    hoursVal: { fontSize: 12, color: INK, fontWeight: '700' },

    closedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        backgroundColor: '#FFF4D6',
        borderRadius: 12,
        padding: 10,
    },
    closedText: { flex: 1, fontSize: 12, color: '#8A5A00', fontWeight: '600' },

    // ---- Kategori ----
    catWrap: { backgroundColor: '#fff', marginTop: 8 },
    catList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    cat: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E1E6E3',
        backgroundColor: '#fff',
    },
    catActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    catText: { fontSize: 13, fontWeight: '700', color: INK },
    catTextActive: { color: '#fff' },

    // ---- Menu ----
    menuCard: { backgroundColor: '#fff', marginTop: 8, paddingBottom: 6 },
    menuHeading: {
        fontSize: 16,
        fontWeight: '800',
        color: PRIMARY_DARK,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 4,
    },
    sep: { height: 1, backgroundColor: LINE, marginHorizontal: 16 },
    menuRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14 },
    menuName: { fontSize: 15, fontWeight: '800', color: INK },
    menuDesc: { fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 17 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    menuPrice: { fontSize: 15, fontWeight: '800', color: INK },
    stockLow: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9A5400',
        backgroundColor: '#FFF1DC',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    menuImg: { width: 92, height: 92, borderRadius: 14, backgroundColor: '#EEF0F3' },
    menuImgEmpty: { alignItems: 'center', justifyContent: 'center' },

    qtyWrap: { marginTop: -16 },
    addBtn: {
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: PRIMARY,
        borderRadius: 18,
        paddingHorizontal: 18,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addBtnText: { color: PRIMARY_DARK, fontWeight: '800', fontSize: 13 },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: PRIMARY,
        borderRadius: 18,
        height: 34,
        paddingHorizontal: 2,
    },
    stepBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    qtyText: { minWidth: 22, textAlign: 'center', fontWeight: '800', color: INK },

    emptyMenu: { paddingVertical: 40, alignItems: 'center', gap: 10 },
    emptyText: { fontSize: 14, color: MUTED },

    // ---- Floating cart bar ----
    cartBarWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: LINE,
    },
    cartBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: PRIMARY,
        height: 54,
        borderRadius: 27,
        paddingHorizontal: 14,
    },
    cartBadge: {
        minWidth: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    cartBadgeText: { fontWeight: '800', color: PRIMARY_DARK, fontSize: 14 },
    cartText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 16 },
    cartPrice: { color: '#fff', fontWeight: '800', fontSize: 16 },
});