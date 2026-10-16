// components/food/CompletedStep.tsx
// Tahap "Pesanan tiba!" — header + rating driver + tip opsional + ringkasan (sesuai desain).
// Data dari API: order.driver, order.merchant, order.order_items, order.total_fare, order.payment_method.
import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import type { OrderResponse } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = (colors as any).primary ?? '#40a3ea';
const PRIMARY_SOFT = '#E8F4FD';
const PRIMARY_DARK = '#1F6FAE';
const YELLOW = '#F5A623';
const TEXT = '#172019';
const MUTED = '#5F6B64';
const BORDER = '#E3E8E5';

const RATING_LABEL = ['', 'Buruk', 'Kurang', 'Cukup', 'Bagus', 'Luar biasa'];
const TAGS = ['Ramah', 'Cepat', 'Makanan masih hangat', 'Rapi'];
const TIPS = [2000, 5000, 10000];

export type RatePayload = {
    rating: number;
    tags: string[];
    tip: number; // 0 jika tidak memberi tip
};

type Props = {
    order: OrderResponse;
    /** Dipanggil saat "Kirim penilaian" ditekan, membawa rating, tag, dan tip */
    onRate: (payload: RatePayload) => void | Promise<void>;
    /** Dipanggil saat "Lewati" atau tombol tutup ditekan */
    onDone: () => void;
};

const payLabel = (pm?: string | null) =>
    pm === 'cash' ? 'Tunai' : pm === 'wallet' ? 'Saldo' : pm === 'qris' ? 'QRIS' : 'Transfer Bank';

export default function CompletedStep({ order, onRate, onDone }: Props) {
    const insets = useSafeAreaInsets();
    const o: any = order;
    const driver: any = order.driver;

    const [rating, setRating] = useState(5);
    const [tags, setTags] = useState<string[]>([]);
    const [tip, setTip] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const driverName: string = driver?.full_name ?? 'Driver';
    const storeName: string = o.merchant?.store_name ?? o.pickup_name ?? 'Resto';
    const itemCount = useMemo(() => {
        const items: any[] = o.order_items ?? o.items ?? [];
        return items.reduce((n, it) => n + (Number(it?.qty ?? it?.quantity) || 1), 0);
    }, [o.order_items, o.items]);

    const toggleTag = (t: string) =>
        setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

    const submit = async () => {
        if (submitting) return;
        try {
            const r = onRate({ rating, tags, tip });
            if (r && typeof (r as any).then === 'function') {
                setSubmitting(true);
                await r;
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={s.root}>
            <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
            >
                {/* ===== Header ===== */}
                <View style={[s.hero, { paddingTop: insets.top + 16 }]}>
                    <View style={s.circleBig} />
                    <View style={s.circleSmall} />

                    <Pressable
                        onPress={onDone}
                        hitSlop={10}
                        style={[s.closeBtn, { top: insets.top + 14 }]}
                        accessibilityLabel="Tutup"
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </Pressable>

                    <Animated.View entering={FadeIn.duration(400)} style={s.checkCircle}>
                        <Ionicons name="checkmark" size={46} color={PRIMARY_DARK} />
                    </Animated.View>
                    <Animated.View entering={FadeInUp.delay(150).duration(300)} style={{ alignItems: 'center' }}>
                        <Text style={s.heroTitle}>Pesanan tiba!</Text>
                        <Text style={s.heroSub}>Selamat menikmati makananmu</Text>
                    </Animated.View>
                </View>

                {/* ===== Kartu rating ===== */}
                <Animated.View entering={FadeInUp.delay(250).duration(300)} style={[s.card, s.ratingCard]}>
                    <View style={s.driverRow}>
                        {driver?.avatar_url ? (
                            <Image source={{ uri: driver.avatar_url }} style={s.avatar} />
                        ) : (
                            <View style={[s.avatar, { backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={s.avatarLetter}>{driverName.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.askText}>Bagaimana pelayanan driver?</Text>
                            <Text style={s.driverName} numberOfLines={1}>
                                {driverName}
                            </Text>
                        </View>
                    </View>

                    <View style={s.starsRow}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} bintang`}>
                                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={42} color={YELLOW} />
                            </Pressable>
                        ))}
                    </View>
                    <Text style={s.ratingLabel}>{RATING_LABEL[rating]}</Text>

                    <View style={s.tagWrap}>
                        {TAGS.map((t) => {
                            const on = tags.includes(t);
                            return (
                                <Pressable key={t} onPress={() => toggleTag(t)} style={[s.chip, on && s.chipOn]}>
                                    <Text style={[s.chipText, on && s.chipTextOn]}>{t}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* ===== Tip ===== */}
                <Animated.View entering={FadeInUp.delay(330).duration(300)} style={s.card}>
                    <Text style={s.cardTitle}>
                        Beri tip untuk driver <Text style={s.optional}>(opsional)</Text>
                    </Text>
                    <View style={s.tipRow}>
                        {TIPS.map((v) => {
                            const on = tip === v;
                            return (
                                <Pressable key={v} onPress={() => setTip(on ? 0 : v)} style={[s.tipBtn, on && s.chipOn]}>
                                    <Text style={[s.tipText, on && s.chipTextOn]}>{formatRupiah(v)}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* ===== Ringkasan ===== */}
                <Animated.View entering={FadeInUp.delay(410).duration(300)} style={s.card}>
                    <View style={s.sumHead}>
                        <Ionicons name="restaurant-outline" size={20} color={PRIMARY} />
                        <Text style={s.sumName} numberOfLines={1}>
                            {storeName} · {itemCount} item
                        </Text>
                        <View style={s.payChip}>
                            <Text style={s.payChipText}>{payLabel(o.payment_method)}</Text>
                        </View>
                    </View>
                    <View style={s.totalRow}>
                        <Text style={s.totalLabel}>Total dibayar</Text>
                        <Text style={s.totalValue}>{formatRupiah(order.total_fare)}</Text>
                    </View>
                </Animated.View>
            </ScrollView>

            {/* ===== Footer ===== */}
            <View style={[s.footer, { paddingBottom: insets.bottom }]}>
                <Pressable style={[s.sendBtn, submitting && { opacity: 0.7 }]} onPress={submit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.sendText}>Kirim penilaian</Text>}
                </Pressable>
                <Pressable onPress={onDone} hitSlop={8} style={s.skipBtn}>
                    <Text style={s.skipText}>Lewati</Text>
                </Pressable>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F3F5F4' },

    // Header
    hero: {
        backgroundColor: PRIMARY_DARK,
        alignItems: 'center',
        paddingBottom: 70,
        overflow: 'hidden',
    },
    circleBig: {
        position: 'absolute',
        top: -70,
        right: -110,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
    circleSmall: {
        position: 'absolute',
        bottom: -70,
        left: -90,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
    closeBtn: { position: 'absolute', left: 20, zIndex: 2 },
    checkCircle: {
        marginTop: 28,
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTitle: { marginTop: 18, fontSize: 28, fontWeight: '800', color: '#fff' },
    heroSub: { marginTop: 4, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.92)' },

    // Kartu
    card: {
        backgroundColor: '#fff',
        borderRadius: 22,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 18,
    },
    ratingCard: {
        marginTop: -44,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
    },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarLetter: { color: '#fff', fontSize: 20, fontWeight: '800' },
    askText: { fontSize: 13, color: MUTED, fontWeight: '600' },
    driverName: { fontSize: 18, fontWeight: '800', color: TEXT, marginTop: 1 },

    starsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 6 },
    ratingLabel: { textAlign: 'center', marginTop: 12, fontSize: 16, fontWeight: '800', color: TEXT },

    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: BORDER,
        backgroundColor: '#fff',
    },
    chipOn: { borderColor: PRIMARY_DARK, backgroundColor: PRIMARY_SOFT },
    chipText: { fontSize: 14, fontWeight: '700', color: TEXT },
    chipTextOn: { color: PRIMARY_DARK },

    cardTitle: { fontSize: 15, fontWeight: '800', color: TEXT },
    optional: { fontWeight: '600', color: MUTED },
    tipRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    tipBtn: {
        flex: 1,
        height: 46,
        borderRadius: 23,
        borderWidth: 1.5,
        borderColor: BORDER,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tipText: { fontSize: 14, fontWeight: '800', color: TEXT },

    sumHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sumName: { flex: 1, fontSize: 15, fontWeight: '800', color: TEXT },
    payChip: { backgroundColor: PRIMARY_SOFT, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
    payChipText: { fontSize: 12, fontWeight: '800', color: PRIMARY_DARK },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    totalLabel: { fontSize: 15, fontWeight: '800', color: TEXT },
    totalValue: { fontSize: 15, fontWeight: '800', color: TEXT },

    // Footer
    footer: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: BORDER,
    },
    sendBtn: {
        height: 54,
        borderRadius: 27,
        backgroundColor: PRIMARY_DARK,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    skipBtn: { alignItems: 'center', paddingVertical: 12 },
    skipText: { fontSize: 14, fontWeight: '700', color: MUTED },
});