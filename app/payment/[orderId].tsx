// app/payment/[orderId].tsx
import LoadingModal from '@/components/LoadingModal';
import { useOrder } from '@/contexts/OrderContext';
import { api } from '@/lib/api';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================
// HELPERS
// ============================================================
function formatRp(n: number) {
    return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

function formatCountdown(msLeft: number): string {
    if (msLeft <= 0) return '00:00';
    const totalSec = Math.floor(msLeft / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}

// ============================================================
// SCREEN
// ============================================================
export default function PaymentScreen() {
    const insets = useSafeAreaInsets();
    const { orderId } = useLocalSearchParams<{ orderId: string }>();

    // ✅ Context — untuk boot OjekFlow setelah paid
    const {
        setActiveOrder,
        setBootingOrderId,
        setBootedOrderId,
        setPendingPaymentOrderId,
        setBootingFromPayment,
    } = useOrder();

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(true);
    const [copied, setCopied] = useState(false);
    const [now, setNow] = useState(Date.now());

    // ------------------------------------------------------------
    // Fetch order detail
    // ------------------------------------------------------------
    useEffect(() => {
        if (!orderId) return;

        const load = async () => {
            try {
                const o = await api.getOrder(Number(orderId));
                setOrder(o);
            } catch (err: any) {
                console.error(
                    '[PAYMENT] Gagal load order:',
                    err.message
                );
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [orderId]);

    // ------------------------------------------------------------
    // Countdown ticker (update tiap detik)
    // ------------------------------------------------------------
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // ------------------------------------------------------------
    // Hitung sisa waktu
    // ------------------------------------------------------------
    const msLeft = useMemo(() => {
        if (!order?.payment_expired_at) return 0;
        const exp = new Date(order.payment_expired_at).getTime();
        return exp - now;
    }, [order?.payment_expired_at, now]);

    const countdownText = useMemo(() => formatCountdown(msLeft), [msLeft]);
    const isExpired = msLeft <= 0 && order?.payment_status === 'pending';
    const isPaid = order?.payment_status === 'paid';

    // ------------------------------------------------------------
    // Polling status pembayaran
    // ------------------------------------------------------------
    useEffect(() => {
        if (!orderId || !polling) return;

        const id = setInterval(async () => {
            try {
                const o = await api.getOrder(Number(orderId));
                setOrder(o);

                if (o.payment_status === 'paid') {
                    setPolling(false);

                    console.log(
                        '[PAYMENT] Paid! → set activeOrder & redirect'
                    );

                    // ═══════════════════════════════════════════════
                    // ✅ Set context supaya OjekFlow boot dari sini
                    // ═══════════════════════════════════════════════
                    setActiveOrder(
                        Number(orderId),
                        '/services/ojek-motor'
                    );

                    // Reset boot guard biar boot fresh
                    setBootingOrderId(null);
                    setBootedOrderId(null);

                    // Flag: boot karena payment (bukan notif)
                    setBootingFromPayment(true);

                    // Clear pending payment — sudah selesai
                    setPendingPaymentOrderId(null);

                    // Redirect ke tabs → OjekFlow boot dari activeOrder
                    setTimeout(() => {
                        router.replace('/(tabs)' as any);
                    }, 1500);
                }
            } catch (err) {
                console.warn('[PAYMENT] Poll error:', err);
            }
        }, 3000);

        return () => clearInterval(id);
    }, [
        orderId,
        polling,
        setActiveOrder,
        setBootingOrderId,
        setBootedOrderId,
        setPendingPaymentOrderId,
        setBootingFromPayment,
    ]);

    // ------------------------------------------------------------
    // Copy to clipboard
    // ------------------------------------------------------------
    const copyToClipboard = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ------------------------------------------------------------
    // Loading state
    // ------------------------------------------------------------
    if (loading || !order) {
        return <LoadingModal visible={true} />;
    }

    const isVa = order.payment_method === 'bank_transfer';
    const totalFare = Number(order.total_fare ?? 0);

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                contentContainerStyle={{
                    padding: 20,
                    paddingBottom: 120,
                }}
            >
                {/* Header */}
                <Text style={s.title}>
                    {isPaid
                        ? '✅ Pembayaran Berhasil'
                        : isExpired
                            ? '⏰ Waktu Habis'
                            : 'Selesaikan Pembayaran'}
                </Text>
                <Text style={s.subtitle}>
                    {isPaid
                        ? 'Kami sedang mencarikan driver untukmu...'
                        : isExpired
                            ? 'Waktu pembayaran habis. Silakan buat pesanan baru.'
                            : 'Bayar sebelum waktu pembayaran habis'}
                </Text>

                {/* ═══════════════════════════════════════════════════
                    COUNTDOWN (kalau belum bayar & belum expired)
                ═══════════════════════════════════════════════════ */}
                {!isPaid && !isExpired && (
                    <View style={s.countdownBox}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.countdownLabel}>
                                Selesaikan pembayaran dalam
                            </Text>
                        </View>
                        <Text style={s.countdownValue}>
                            {countdownText}
                        </Text>
                    </View>
                )}

                {/* Expired warning */}
                {isExpired && (
                    <View style={s.expiredBox}>
                        <Text style={s.expiredText}>
                            Waktu pembayaran habis. Pesanan akan dibatalkan
                            otomatis.
                        </Text>
                    </View>
                )}

                {/* ═══════════════════════════════════════════════════
                    INFO ORDER
                ═══════════════════════════════════════════════════ */}
                <View style={s.card}>
                    <Text style={s.cardLabel}>Order</Text>
                    <Text style={s.cardValue}>#{order.order_code}</Text>
                    <View style={s.divider} />
                    <Text style={s.cardLabel}>Total bayar</Text>
                    <Text style={s.totalValue}>{formatRp(totalFare)}</Text>
                </View>

                {/* ═══════════════════════════════════════════════════
                    VA (Virtual Account)
                ═══════════════════════════════════════════════════ */}
                {!isPaid && !isExpired && isVa && order.payment_url && (
                    <View style={s.card}>
                        <Text style={s.cardLabel}>Virtual Account</Text>
                        <Text style={s.vaText} selectable>
                            {order.payment_url}
                        </Text>
                        <Pressable
                            onPress={() =>
                                copyToClipboard(
                                    order.payment_url,
                                    'Nomor VA'
                                )
                            }
                            style={s.copyBtn}
                        >
                            <Text style={s.copyBtnText}>
                                {copied ? '✓ Disalin' : 'Salin Nomor VA'}
                            </Text>
                        </Pressable>
                        <View style={s.divider} />
                        <Text style={s.hintText}>
                            Transfer tepat sesuai nominal{' '}
                            <Text style={s.hintStrong}>
                                {formatRp(totalFare)}
                            </Text>{' '}
                            agar otomatis terdeteksi.
                        </Text>
                    </View>
                )}

                {/* ═══════════════════════════════════════════════════
                    QRIS
                ═══════════════════════════════════════════════════ */}
                {!isPaid && !isExpired && !isVa && order.payment_url && (
                    <View style={s.card}>
                        <Text style={s.cardLabel}>Scan QRIS</Text>
                        <Image
                            source={{ uri: order.payment_url }}
                            style={s.qrImage}
                            resizeMode="contain"
                        />
                        <View style={s.divider} />
                        <Text style={s.hintText}>
                            Scan dengan e-wallet atau m-banking. Nominal{' '}
                            <Text style={s.hintStrong}>
                                {formatRp(totalFare)}
                            </Text>
                            .
                        </Text>
                    </View>
                )}

                {/* ═══════════════════════════════════════════════════
                    INFO FOOTNOTE
                ═══════════════════════════════════════════════════ */}
                <Text style={s.footNote}>
                    {isPaid
                        ? 'Pembayaran kamu sudah kami terima. Driver akan segera dihubungi.'
                        : isExpired
                            ? 'Pesanan tidak dapat dilanjutkan. Silakan buat pesanan baru.'
                            : 'Pembayaran akan terdeteksi otomatis. Kalau sudah bayar, tunggu 1-2 menit.'}
                </Text>
            </ScrollView>

            {/* ═══════════════════════════════════════════════════
                BOTTOM BAR
            ═══════════════════════════════════════════════════ */}
            <View
                style={[
                    s.bottom,
                    { paddingBottom: insets.bottom + 12 },
                ]}
            >
                {isPaid ? (
                    <TouchableOpacity
                        style={s.btn}
                        onPress={() => router.replace('/(tabs)' as any)}
                    >
                        <Text style={s.btnText}>Lihat Pesanan</Text>
                    </TouchableOpacity>
                ) : isExpired ? (
                    <TouchableOpacity
                        style={s.btn}
                        onPress={() => router.replace('/(tabs)' as any)}
                    >
                        <Text style={s.btnText}>Buat Pesanan Baru</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={s.btnGhost}
                        onPress={() => router.back()}
                    >
                        <Text style={s.btnGhostText}>
                            Kembali ke Beranda
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F6F7F9' },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginTop: 20,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 12,
    },

    // Countdown
    countdownBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7E6',
        borderWidth: 1,
        borderColor: '#FFE0A3',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
    },
    countdownLabel: {
        fontSize: 13,
        color: '#8a6d3b',
        fontWeight: '700',
    },
    countdownValue: {
        fontSize: 26,
        fontWeight: '900',
        color: '#e68515',
        letterSpacing: 1,
        marginLeft: 10,
    },

    // Expired warning
    expiredBox: {
        backgroundColor: '#FDEAEA',
        borderWidth: 1,
        borderColor: '#F5B7B7',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
    },
    expiredText: {
        fontSize: 13,
        color: '#7f2f2f',
        textAlign: 'center',
        fontWeight: '700',
        lineHeight: 19,
    },

    // Cards
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    cardLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F2F4',
        marginVertical: 12,
    },
    totalValue: {
        fontSize: 28,
        fontWeight: '900',
        color: '#40a3ea',
    },

    // VA
    vaText: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 2,
        color: '#111827',
        textAlign: 'center',
        marginVertical: 16,
    },
    copyBtn: {
        backgroundColor: '#EAF5FD',
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
    },
    copyBtnText: {
        color: '#2b8ed6',
        fontWeight: '800',
        fontSize: 14,
    },

    // QR
    qrImage: {
        width: '100%',
        height: 280,
        marginTop: 12,
    },

    // Hint
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 18,
    },
    hintStrong: {
        fontWeight: '800',
        color: '#111827',
    },
    footNote: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 18,
        paddingHorizontal: 12,
    },

    // Bottom bar
    bottom: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#ECECEC',
    },
    btn: {
        backgroundColor: '#40a3ea',
        paddingVertical: 16,
        borderRadius: 999,
        alignItems: 'center',
    },
    btnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
    },
    btnGhost: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    btnGhostText: {
        color: '#40a3ea',
        fontWeight: '700',
        fontSize: 14,
    },
});