// app/pembayaran.tsx
// Halaman "Selesaikan Pembayaran" untuk QRIS dan Virtual Account.
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadingModal from '@/components/LoadingModal';
import { colors } from '@/constants/ojek-theme';
import { api } from '@/lib/api';
import {
    bankMeta,
    extractPayment,
    getPaymentSeed,
    hasPaymentInfo,
    isPaid,
    mergePayment,
    parseDate,
} from '@/lib/paymentInfo';
import { useAppAlert } from '@/lib/useAppAlert';

const PRIMARY = (colors as any).primary ?? '#40a3ea';
const SECONDARY = (colors as any).secondary ?? '#e68515';
const PRIMARY_SOFT = '#E8F4FD';
const PRIMARY_DARK = '#1F6FAE';
const DANGER = '#D93025';
const TEXT = '#1B2430';
const MUTED = '#6B7684';
const BORDER = '#E6EAF0';

const rupiah = (n: number) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
const groupVa = (v: string) => v.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

const VA_STEPS = [
    'Buka aplikasi mobile banking atau ATM bank Anda',
    'Pilih menu Transfer › Virtual Account',
    'Masukkan nomor Virtual Account di atas',
    'Pastikan nominal sesuai, lalu konfirmasi pembayaran',
];

export default function PembayaranScreen() {
    const insets = useSafeAreaInsets();
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    const id = Number(orderId);

    const { showAlert, alertNode } = useAppAlert();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    const [checking, setChecking] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [copied, setCopied] = useState(false);
    const [qrFailed, setQrFailed] = useState(false);
    const done = useRef(false);

    const goNext = useCallback(() => {
        if (done.current) return;
        done.current = true;
        router.replace({ pathname: '/mencari-driver', params: { orderId: String(id) } } as any);
    }, [id]);

    const fetchOrder = useCallback(
        async (manual = false) => {
            if (!id || done.current) return;
            if (manual) setChecking(true);
            try {
                const o: any = await (api.orders as any).get(id);
                setOrder(o);
                const st = String(o?.status ?? '').toLowerCase();
                if (st === 'cancelled' || st === 'canceled' || st === 'dibatalkan') {
                    if (!done.current) {
                        done.current = true;
                        showAlert('Pesanan dibatalkan', 'Pesanan ini sudah dibatalkan.', [
                            { text: 'OK', onPress: () => router.replace('/(tabs)' as any) },
                        ]);
                    }
                    return;
                }
                if (isPaid(o) || (st && st !== 'pending')) goNext();
                else if (manual) showAlert('Belum terbayar', 'Pembayaran belum kami terima. Coba lagi sebentar.');
            } catch {
                if (manual) showAlert('Gagal', 'Tidak dapat mengecek status pembayaran.');
            } finally {
                setLoading(false);
                if (manual) setChecking(false);
            }
        },
        [id, goNext, showAlert],
    );

    // polling status tiap 3 detik
    useEffect(() => {
        fetchOrder();
        const t = setInterval(() => fetchOrder(), 3000);
        return () => clearInterval(t);
    }, [fetchOrder]);

    // tick countdown
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const info = useMemo(
        () => mergePayment(order ? extractPayment(order) : null, getPaymentSeed(id)),
        [order, id],
    );

    const method: 'qris' | 'bank_transfer' = useMemo(() => {
        const m = String(order?.payment_method ?? '').toLowerCase();
        if (m === 'qris') return 'qris';
        if (m === 'bank_transfer') return 'bank_transfer';
        return info.va && !info.qris ? 'bank_transfer' : 'qris';
    }, [order, info]);

    const deadline = useMemo(() => {
        const MAX = 24 * 3600 * 1000;
        let t = parseDate(info.expired);
        if (t && t - Date.now() > MAX) t = null;
        if (!t) {
            const c = parseDate(order?.created_at);
            t = (c ?? Date.now()) + 15 * 60 * 1000;
        }
        return t;
    }, [info.expired, order?.created_at]);

    const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
    const expired = !!order && remaining <= 0;
    const urgent = remaining > 0 && remaining < 120;
    const total = Number(order?.total_fare ?? order?.total ?? 0);
    const bank = bankMeta(info.bank);
    const code = order?.order_code ?? order?.code ?? (id ? `#${id}` : '');

    const copy = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text.replace(/\s+/g, ''));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { }
    };

    const cancelOrder = () => {
        showAlert('Batalkan pesanan?', 'Pesanan dan pembayaran ini akan dibatalkan.', [
            { text: 'Tidak', style: 'cancel' },
            {
                text: 'Ya, batalkan',
                style: 'destructive',
                onPress: async () => {
                    setCancelling(true);
                    try {
                        await (api.orders as any).updateStatus(id, 'cancelled', 'Dibatalkan oleh pelanggan');
                    } catch { }
                    done.current = true;
                    setCancelling(false);
                    router.replace('/(tabs)' as any);
                },
            },
        ]);
    };

    const close = () => {
        showAlert('Tinggalkan halaman?', 'Pesanan tetap menunggu pembayaran. Anda bisa kembali ke beranda.', [
            { text: 'Tetap di sini', style: 'cancel' },
            { text: 'Ke beranda', onPress: () => router.replace('/(tabs)' as any) },
        ]);
    };

    const ready = hasPaymentInfo(info);

    return (
        <View style={[s.root, { paddingTop: insets.top }]}>
            <View style={s.header}>
                <Pressable onPress={close} hitSlop={10} style={s.iconBtn}>
                    <Ionicons name="close" size={22} color={TEXT} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={s.title}>Selesaikan Pembayaran</Text>
                    {!!code && <Text style={s.sub}>Pesanan {code}</Text>}
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}>
                {/* Timer */}
                <View style={[s.timer, urgent && { backgroundColor: '#FDECEA' }, expired && { backgroundColor: '#F1F3F6' }]}>
                    <Ionicons
                        name="time-outline"
                        size={22}
                        color={expired ? MUTED : urgent ? DANGER : SECONDARY}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={s.timerLabel}>{expired ? 'Waktu pembayaran habis' : 'Bayar sebelum'}</Text>
                    </View>
                    {!expired && (
                        <Text style={[s.timerValue, urgent && { color: DANGER }]}>{fmtTime(remaining)}</Text>
                    )}
                </View>

                {/* Nominal + QR / VA */}
                <View style={s.card}>
                    <Text style={s.cardLabel}>Total pembayaran</Text>
                    <Text style={s.amount}>{loading && !order ? '—' : rupiah(total)}</Text>

                    {method === 'qris' ? (
                        <>
                            <View style={s.qrBox}>
                                {info.qris && !qrFailed ? (
                                    <Image
                                        source={{ uri: info.qris }}
                                        style={s.qr}
                                        resizeMode="contain"
                                        onError={() => setQrFailed(true)}
                                    />
                                ) : (
                                    <View style={s.qrPlaceholder}>
                                        {qrFailed ? (
                                            <Text style={s.mutedCenter}>Gagal memuat QR. Tekan "Cek status" atau coba lagi.</Text>
                                        ) : (
                                            <>
                                                <ActivityIndicator color={PRIMARY} />
                                                <Text style={s.mutedCenter}>Menyiapkan kode QRIS…</Text>
                                            </>
                                        )}
                                    </View>
                                )}
                            </View>
                            <Text style={s.caption}>
                                Scan dengan aplikasi e-wallet atau mobile banking apa pun yang mendukung QRIS
                            </Text>
                        </>
                    ) : (
                        <>
                            <View style={s.vaBox}>
                                <View style={s.vaTop}>
                                    <View style={[s.bankBadge, { backgroundColor: bank?.color ?? PRIMARY }]}>
                                        <Text style={s.bankBadgeText}>{bank?.short ?? 'VA'}</Text>
                                    </View>
                                    <Text style={s.vaBank}>Virtual Account {bank?.label ?? info.bank ?? ''}</Text>
                                </View>
                                {info.va ? (
                                    <>
                                        <Text selectable style={s.vaNumber}>{groupVa(info.va)}</Text>
                                        <Pressable onPress={() => copy(info.va!)} style={s.copyBtn}>
                                            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={PRIMARY_DARK} />
                                            <Text style={s.copyText}>{copied ? 'Tersalin' : 'Salin nomor'}</Text>
                                        </Pressable>
                                    </>
                                ) : (
                                    <View style={{ alignItems: 'center', paddingVertical: 14, gap: 8 }}>
                                        <ActivityIndicator color={PRIMARY} />
                                        <Text style={s.mutedCenter}>Menyiapkan nomor Virtual Account…</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={s.caption}>Transfer tepat sesuai nominal di atas agar terverifikasi otomatis</Text>
                        </>
                    )}
                </View>

                {/* Cara bayar VA */}
                {method === 'bank_transfer' && (
                    <View style={s.card}>
                        <Text style={s.cardTitle}>Cara pembayaran</Text>
                        {VA_STEPS.map((t, i) => (
                            <View key={i} style={s.step}>
                                <View style={s.stepNo}>
                                    <Text style={s.stepNoText}>{i + 1}</Text>
                                </View>
                                <Text style={s.stepText}>{t}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Status */}
                <View style={s.waitCard}>
                    {expired ? (
                        <>
                            <Ionicons name="alert-circle-outline" size={20} color={MUTED} />
                            <Text style={[s.waitText, { color: MUTED }]}>
                                Batas waktu terlewati. Buat pesanan baru dari beranda.
                            </Text>
                        </>
                    ) : (
                        <>
                            <ActivityIndicator size="small" color={PRIMARY} />
                            <Text style={s.waitText}>
                                {ready ? 'Menunggu pembayaran…' : 'Menyiapkan pembayaran…'}
                            </Text>
                            <Pressable onPress={() => fetchOrder(true)} disabled={checking} hitSlop={8}>
                                <Text style={s.link}>{checking ? 'Mengecek…' : 'Cek status'}</Text>
                            </Pressable>
                        </>
                    )}
                </View>
            </ScrollView>

            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                {expired ? (
                    <Pressable style={s.primaryBtn} onPress={() => router.replace('/(tabs)' as any)}>
                        <Text style={s.primaryBtnText}>Kembali</Text>
                    </Pressable>
                ) : (
                    <Pressable style={s.cancelBtn} onPress={cancelOrder} disabled={cancelling}>
                        <Text style={s.cancelText}>Batalkan pesanan</Text>
                    </Pressable>
                )}
            </View>

            {alertNode}
            <LoadingModal visible={cancelling || checking} />
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F6F8FB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F3F6',
    },
    title: { fontSize: 17, fontWeight: '700', color: TEXT },
    sub: { fontSize: 12, color: MUTED, marginTop: 1 },

    timer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FDF1E3',
        borderRadius: 14,
        padding: 14,
    },
    timerLabel: { fontSize: 14, fontWeight: '600', color: TEXT },
    timerValue: { fontSize: 20, fontWeight: '800', color: SECONDARY, fontVariant: ['tabular-nums'] },

    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
    },
    cardLabel: { fontSize: 13, color: MUTED, textAlign: 'center' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 10 },
    amount: { fontSize: 30, fontWeight: '800', color: TEXT, textAlign: 'center', marginTop: 4, marginBottom: 14 },

    qrBox: {
        alignSelf: 'center',
        width: 248,
        height: 248,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: BORDER,
        padding: 10,
        backgroundColor: '#fff',
    },
    qr: { width: '100%', height: '100%' },
    qrPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10 },
    caption: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 12, lineHeight: 18 },
    mutedCenter: { fontSize: 13, color: MUTED, textAlign: 'center' },

    vaBox: { backgroundColor: PRIMARY_SOFT, borderRadius: 14, padding: 14, alignItems: 'center', gap: 10 },
    vaTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bankBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    bankBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    vaBank: { fontSize: 14, fontWeight: '600', color: TEXT },
    vaNumber: { fontSize: 26, fontWeight: '800', color: PRIMARY_DARK, letterSpacing: 1, fontVariant: ['tabular-nums'] },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#fff',
    },
    copyText: { fontSize: 13, fontWeight: '700', color: PRIMARY_DARK },

    step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
    stepNo: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: PRIMARY_SOFT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNoText: { fontSize: 12, fontWeight: '700', color: PRIMARY_DARK },
    stepText: { flex: 1, fontSize: 13, color: TEXT, lineHeight: 19 },

    waitCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER,
    },
    waitText: { flex: 1, fontSize: 14, color: TEXT },
    link: { fontSize: 13, fontWeight: '700', color: PRIMARY_DARK },

    footer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: BORDER,
    },
    cancelBtn: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: DANGER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: { color: DANGER, fontWeight: '700', fontSize: 15 },
    primaryBtn: {
        height: 48,
        borderRadius: 12,
        backgroundColor: PRIMARY_DARK,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});