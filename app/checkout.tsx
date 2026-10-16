// app/checkout.tsx
// Konfirmasi pesanan makanan — tampilan mengikuti desain "Konfirmasi Pesanan",
// "Pilih Pembayaran" dan "Pilih Bank". Logika bisnis (estimasi ongkir, validasi,
// payload order) dipertahankan dari versi sebelumnya.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Image,
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadingModal from '@/components/LoadingModal';
import { ShimmerBox, ShimmerGroup } from '@/components/Shimmer';
import { colors } from '@/constants/ojek-theme';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { BANKS, extractPayment, setPaymentSeed } from '@/lib/paymentInfo';
import { loadSavedLocation } from '@/lib/savedLocation';
import { useAppAlert } from '@/lib/useAppAlert';

// ============================================================
// CONSTANTS
// ============================================================
const PRIMARY = colors.primary; // '#40a3ea'
const SECONDARY = colors.secondary; // '#e68515'
const PRIMARY_SOFT = '#E8F4FD';
const PRIMARY_DARK = '#1F6FAE'; // teks di atas tint (kontras cukup)
const INK = '#172019';
const MUTED = '#5F6B64';
const LINE = '#EDF0EE';
const DANGER = '#C62828';

// warna metode pembayaran (sama dengan OrderStep)
const GREEN = '#16A34A';
const CYAN = '#12a8d8';
const ORANGE = '#f26b21';
const PURPLE = '#8B5CF6';

const SERVICE_FEE = 1000;
const FALLBACK_DELIVERY_FEE = 8000;
const ROAD_FACTOR = 1.3;
const AVG_SPEED_KMH = 25;
const FEE_ROUND_TO = 500;
const DEFAULT_PREP_MIN = 10;
const PICKUP_MIN = 5;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(x));
}

type PaymentMethod = 'cash' | 'wallet' | 'qris' | 'bank_transfer';
type IconName = keyof typeof Ionicons.glyphMap;

const fmtRp = (n: number) =>
    `Rp${Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

// ============================================================
// LOGGER
// ============================================================
const TAG = '[Checkout]';
const log = (...a: any[]) => console.log(TAG, ...a);
const logWarn = (...a: any[]) => console.warn(TAG, ...a);
const logErr = (...a: any[]) => console.error(TAG, ...a);

// ============================================================
// PAYMENT HELPERS
// ============================================================
function getPaymentLabel(m: PaymentMethod, bankLabel?: string) {
    switch (m) {
        case 'cash':
            return 'Tunai';
        case 'wallet':
            return 'Saldo Waruung';
        case 'qris':
            return 'QRIS';
        case 'bank_transfer':
            return bankLabel ? `VA ${bankLabel}` : 'Transfer Bank (VA)';
    }
}

function getPaymentIcon(m: PaymentMethod): IconName {
    switch (m) {
        case 'cash':
            return 'cash-outline';
        case 'wallet':
            return 'wallet';
        case 'qris':
            return 'qr-code-outline';
        case 'bank_transfer':
            return 'card-outline';
    }
}

function getPaymentColor(m: PaymentMethod) {
    switch (m) {
        case 'cash':
            return GREEN;
        case 'wallet':
            return CYAN;
        case 'qris':
            return ORANGE;
        case 'bank_transfer':
            return PURPLE;
    }
}

function getPaymentHint(m: PaymentMethod) {
    switch (m) {
        case 'cash':
            return 'Bayar langsung ke driver';
        case 'wallet':
            return '';
        case 'qris':
            return 'Kode QRIS muncul setelah pesan';
        case 'bank_transfer':
            return 'Nomor VA muncul setelah pesan';
    }
}

// ============================================================
// VALIDATOR
// ============================================================
function validatePayload(p: any) {
    const missing: string[] = [];
    const invalid: Record<string, string> = {};

    const requiredStrings = [
        'type',
        'pickup_name',
        'pickup_address',
        'dropoff_name',
        'dropoff_address',
        'merchant_id',
    ];
    for (const k of requiredStrings) {
        if (!p[k] || typeof p[k] !== 'string' || !p[k].trim()) {
            missing.push(k);
        }
    }

    const requiredNumbers = [
        'pickup_lat',
        'pickup_lng',
        'dropoff_lat',
        'dropoff_lng',
        'distance_km',
        'subtotal',
        'delivery_fee',
        'service_fee',
        'total',
    ];
    for (const k of requiredNumbers) {
        const v = p[k];
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            invalid[k] = `not a number (got ${v})`;
        } else if (
            k !== 'pickup_lat' &&
            k !== 'pickup_lng' &&
            k !== 'dropoff_lat' &&
            k !== 'dropoff_lng' &&
            v <= 0
        ) {
            invalid[k] = `must be > 0 (got ${v})`;
        }
    }

    if (!Array.isArray(p.items) || p.items.length === 0) {
        missing.push('items[]');
    } else {
        p.items.forEach((it: any, i: number) => {
            if (typeof it.menu_item_id !== 'number') {
                invalid[`items[${i}].menu_item_id`] = 'must be number';
            }
            if (typeof it.qty !== 'number' || it.qty <= 0) {
                invalid[`items[${i}].qty`] = 'must be > 0';
            }
            if (typeof it.price !== 'number' || it.price <= 0) {
                invalid[`items[${i}].price`] = 'must be > 0';
            }
        });
    }

    return {
        ok: missing.length === 0 && Object.keys(invalid).length === 0,
        missing,
        invalid,
    };
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function Checkout() {
    const insets = useSafeAreaInsets();
    const cart = useCart();
    const items: any[] = cart.items as any[];
    const params = useLocalSearchParams<{
        merchantId?: string;
        addressPicked?: string;
    }>();

    // ---- Payment ----
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [draftMethod, setDraftMethod] = useState<PaymentMethod>('cash');
    const [bankCode, setBankCode] = useState<string | null>(null);
    const [selectedBankLabel, setSelectedBankLabel] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [customerBalance, setCustomerBalance] = useState(0);
    const { showAlert, alertNode } = useAppAlert();
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const orderPlaced = useRef(false);

    // ---- Catatan & keyboard ----
    const [notes, setNotes] = useState('');
    const [kbOpen, setKbOpen] = useState(false);

    // ---- Merchant ----
    const [merchant, setMerchant] = useState<{
        user_id: string;
        store_name: string;
        address: string | null;
        latitude: number | null;
        longitude: number | null;
    } | null>(null);

    // ---- User address ----
    const [userAddress, setUserAddress] = useState<{
        name: string;
        address: string;
        latitude: number;
        longitude: number;
    } | null>(null);

    // ---- Estimate ----
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [etaMin, setEtaMin] = useState(0);
    const [distanceKm, setDistanceKm] = useState(0);
    const [loadingEstimate, setLoadingEstimate] = useState(true);

    // ---- Tariff ----
    const [foodTariffCode, setFoodTariffCode] = useState<string>('food');
    const tariffRef = useRef<any>(null);

    const subtotal = cart.totalPrice();
    const itemCount = items.reduce((a, it) => a + Number(it.qty ?? 0), 0);
    const total = subtotal + deliveryFee + SERVICE_FEE;
    const isSaldoEnough = customerBalance >= total;
    const isOnlinePayment = paymentMethod === 'qris' || paymentMethod === 'bank_transfer';

    // sembunyikan footer saat keyboard terbuka (catatan sedang diisi)
    useEffect(() => {
        const a = Keyboard.addListener('keyboardDidShow', () => setKbOpen(true));
        const b = Keyboard.addListener('keyboardDidHide', () => setKbOpen(false));
        return () => {
            a.remove();
            b.remove();
        };
    }, []);

    // ============================================================
    // HELPER: load alamat dari storage
    // ============================================================
    const loadUserAddress = useCallback(async () => {
        log('Loading saved location…');
        const saved: any = await loadSavedLocation();
        log('saved:', saved);

        if (saved) {
            setUserAddress({
                name: saved.name ?? saved.label ?? 'Lokasi Saya',
                address: saved.address ?? saved.label ?? '',
                latitude: saved.latitude,
                longitude: saved.longitude,
            });
            return saved;
        }
        setUserAddress(null);
        return null;
    }, []);

    // ============================================================
    // HELPER: hitung estimasi ongkir
    // ============================================================
    const estimateDelivery = useCallback(
        async (m: any, addr: any) => {
            if (!m?.latitude || !m?.longitude || !addr?.latitude || !addr?.longitude) {
                logWarn('estimate: data kurang, pakai fallback');
                setDeliveryFee(FALLBACK_DELIVERY_FEE);
                setDistanceKm(1);
                setEtaMin(15);
                return;
            }

            // Estimasi dihitung di aplikasi (tidak butuh endpoint backend khusus):
            // jarak garis lurus × faktor jalan, ongkir dari tarif food, ETA = siap + jemput + jalan.
            try {
                const straightKm =
                    haversineKm(Number(m.latitude), Number(m.longitude), Number(addr.latitude), Number(addr.longitude));
                const roadKm = Math.max(0.1, straightKm * ROAD_FACTOR);
                const tf: any = tariffRef.current;

                let fee = FALLBACK_DELIVERY_FEE;
                if (tf && Number(tf.min_fare) > 0) {
                    const baseKm = Number(tf.base_km ?? 0);
                    const perKm = Number(tf.per_km ?? 0);
                    const extraKm = Math.max(0, Math.ceil(roadKm - baseKm));
                    fee = Math.ceil((Number(tf.min_fare) + extraKm * perKm) / FEE_ROUND_TO) * FEE_ROUND_TO;
                }
                const travelMin = (roadKm / AVG_SPEED_KMH) * 60;
                const eta = Math.max(5, Math.round(Number(m.prep_time_min ?? DEFAULT_PREP_MIN) + PICKUP_MIN + travelMin));

                log('estimate lokal:', { straightKm, roadKm, fee, eta });
                setDeliveryFee(fee);
                setEtaMin(eta);
                setDistanceKm(Math.round(roadKm * 10) / 10);
            } catch (e) {
                logWarn('estimate gagal, fallback:', e);
                setDeliveryFee(FALLBACK_DELIVERY_FEE);
                setDistanceKm(1);
                setEtaMin(15);
            }
        },
        []
    );

    // ============================================================
    // BOOTSTRAP (sekali)
    // ============================================================
    const bootstrap = useCallback(async () => {
        log('========== BOOTSTRAP START ==========');
        try {
            const merchantId = params.merchantId ?? cart.merchantId;
            log('merchantId:', merchantId);
            if (!merchantId) {
                showAlert('Error', 'Resto tidak ditemukan.');
                return;
            }

            // 1) Merchant
            const m = await api.merchants.detail(merchantId);
            const merchantData = {
                user_id: m.user_id,
                store_name: m.store_name,
                address: m.address ?? null,
                latitude: m.latitude,
                longitude: m.longitude,
            };
            setMerchant(merchantData);

            // 2) Alamat user
            const saved = await loadUserAddress();

            // 3) Saldo wallet
            try {
                const wallet = await api.wallet.get();
                setCustomerBalance(Number(wallet.balance ?? 0));
            } catch (e) {
                logWarn('wallet gagal:', e);
            }

            // 4) Tariff food
            try {
                const tariffs = await api.tariffs.list();
                const foodTariff = tariffs.find((t) => t.service_type === 'food');
                if (foodTariff) {
                    setFoodTariffCode(foodTariff.code);
                    tariffRef.current = foodTariff;
                }
                else logWarn('tidak ada tariff food, pakai default');
            } catch (e) {
                logWarn('tariffs gagal:', e);
            }

            // 5) Estimasi ongkir
            await estimateDelivery(merchantData, saved);

            log('========== BOOTSTRAP OK ==========');
        } catch (e) {
            logErr('BOOTSTRAP FAILED:', e);
            showAlert('Gagal memuat data', 'Coba lagi ya.');
        } finally {
            setLoadingEstimate(false);
        }
    }, [params.merchantId, cart.merchantId, loadUserAddress, estimateDelivery]);

    useEffect(() => {
        bootstrap();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================================================
    // RE-LOAD saat balik dari pick-address
    // ============================================================
    useEffect(() => {
        if (!params.addressPicked) return;
        if (!merchant) return;

        log('addressPicked flag detected, reloading…');
        (async () => {
            setLoadingEstimate(true);
            const saved = await loadUserAddress();
            await estimateDelivery(merchant, saved);
            setLoadingEstimate(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.addressPicked]);

    // ============================================================
    // NAVIGATE TO PICK ADDRESS
    // ============================================================
    const goToPickAddress = () => {
        router.push({
            pathname: '/pick-address',
            params: { returnTo: '/checkout' },
        } as any);
    };

    // ============================================================
    // PAYMENT SHEET
    // ============================================================
    const openPaymentSheet = () => {
        setDraftMethod(paymentMethod);
        setShowPaymentModal(true);
    };

    const openBankSheet = () => {
        // tutup sheet pembayaran dulu, baru buka sheet bank (aman di iOS)
        setShowPaymentModal(false);
        setTimeout(() => setShowBankModal(true), 250);
    };

    const pickDraft = (m: PaymentMethod) => {
        if (m === 'wallet' && !isSaldoEnough) {
            showAlert('Saldo tidak cukup', `Saldo kamu ${fmtRp(customerBalance)}, butuh ${fmtRp(total)}`);
            return;
        }
        setDraftMethod(m);
        if (m === 'bank_transfer') openBankSheet();
    };

    const confirmPayment = () => {
        if (draftMethod === 'bank_transfer' && !bankCode) {
            openBankSheet();
            return;
        }
        setPaymentMethod(draftMethod);
        if (draftMethod !== 'bank_transfer') {
            setBankCode(null);
            setSelectedBankLabel('');
        }
        setShowPaymentModal(false);
    };

    const pickBank = (b: (typeof BANKS)[number]) => {
        setBankCode(b.code);
        setSelectedBankLabel(b.label);
        setPaymentMethod('bank_transfer');
        setDraftMethod('bank_transfer');
        setShowBankModal(false);
    };

    // ============================================================
    // SUBMIT ORDER
    // ============================================================
    const handleOrder = async () => {
        if (submittingRef.current) return;

        log('========== HANDLE ORDER ==========');

        // ---- Validasi ----
        if (!merchant) {
            showAlert('Error', 'Data resto belum siap.');
            return;
        }
        if (!userAddress) {
            showAlert('Alamat belum dipilih', 'Ketuk bagian "Diantar ke" untuk memilih alamat.');
            return;
        }
        if (items.length === 0) {
            showAlert('Keranjang kosong', 'Tambahkan menu dulu.');
            return;
        }
        if (merchant.latitude == null || merchant.longitude == null) {
            showAlert('Lokasi resto tidak tersedia', 'Resto ini belum punya koordinat.');
            return;
        }
        if (paymentMethod === 'wallet' && !isSaldoEnough) {
            showAlert('Saldo tidak cukup', `Butuh ${fmtRp(total)}`);
            return;
        }
        if (paymentMethod === 'bank_transfer' && !bankCode) {
            showAlert('Bank belum dipilih', 'Pilih bank dulu untuk VA.');
            setShowBankModal(true);
            return;
        }

        // ---- Sanitasi angka ----
        const safeDistanceKm = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 1;
        const safeDurationMin = Number.isFinite(etaMin) && etaMin > 0 ? etaMin : 15;
        const safeDeliveryFee =
            Number.isFinite(deliveryFee) && deliveryFee > 0 ? deliveryFee : FALLBACK_DELIVERY_FEE;
        const safeSubtotal = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0;
        const safeTotal = safeSubtotal + safeDeliveryFee + SERVICE_FEE;

        // ---- Payload ----
        const payload = {
            type: 'food' as const,

            // Pickup = resto
            pickup_name: merchant.store_name || 'Resto',
            pickup_address: merchant.address || merchant.store_name || 'Alamat resto',
            pickup_lat: Number(merchant.latitude),
            pickup_lng: Number(merchant.longitude),

            // Dropoff = user
            dropoff_name: userAddress.name || 'Lokasi Saya',
            dropoff_address: userAddress.address || 'Alamat tidak tersedia',
            dropoff_lat: Number(userAddress.latitude),
            dropoff_lng: Number(userAddress.longitude),

            // Jarak & durasi
            distance_km: safeDistanceKm,
            duration_min: safeDurationMin,

            // Food
            merchant_id: merchant.user_id,
            items: items.map((it) => ({
                menu_item_id: Number(it.id),
                name: it.name,
                qty: Number(it.qty),
                price: Number(it.price),
                note: it.note ?? '',
            })),
            subtotal: safeSubtotal,
            delivery_fee: safeDeliveryFee,
            service_fee: SERVICE_FEE,
            total: safeTotal,

            // Payment
            payment_method: paymentMethod,
            bank_code: paymentMethod === 'bank_transfer' && bankCode ? bankCode : undefined,

            // Tariff
            tariff_code: foodTariffCode,
            option_name: 'Food Delivery',

            notes: notes.trim(),
        };

        // ---- Log & validasi ----
        log('PAYLOAD:', JSON.stringify(payload, null, 2));
        const v = validatePayload(payload);
        log('VALIDATION:', v);
        if (!v.ok) {
            logErr('PAYLOAD INVALID');
            const lines: string[] = [];
            if (v.missing.length) lines.push(`Kosong: ${v.missing.join(', ')}`);
            if (Object.keys(v.invalid).length) {
                lines.push(
                    `Invalid:\n${Object.entries(v.invalid)
                        .map(([k, val]) => `• ${k}: ${val}`)
                        .join('\n')}`
                );
            }
            showAlert('Payload tidak valid', lines.join('\n\n'));
            return;
        }

        // ---- Kirim ----
        submittingRef.current = true;
        setSubmitting(true);
        try {
            log('Sending order…');
            const order: any = await api.orders.create(payload);
            log('✅ Order created:', order.id, order.order_code);

            const online = paymentMethod === 'qris' || paymentMethod === 'bank_transfer';
            if (online) {
                // simpan info QRIS / VA dari respons supaya halaman bayar langsung menampilkannya
                const info = extractPayment(order);
                setPaymentSeed(order.id, { ...info, bank: info.bank ?? bankCode });
            }

            orderPlaced.current = true;
            cart.clear();
            router.replace({
                pathname: online ? '/pembayaran' : '/mencari-driver',
                params: { orderId: String(order.id) },
            } as any);
        } catch (e: any) {
            logErr('❌ Create order failed:', e?.message);
            showAlert('Gagal buat pesanan', e?.message ?? 'Coba lagi sebentar.');
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
            log('========== HANDLE ORDER END ==========\n');
        }
    };

    // ============================================================
    // KERANJANG KOSONG
    // ============================================================
    if (items.length === 0 && !submitting && !orderPlaced.current) {
        return (
            <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
                <Ionicons name="basket-outline" size={54} color="#B0B5BD" />
                <Text style={s.emptyTitle}>Keranjang masih kosong</Text>
                <Pressable style={s.emptyBtn} onPress={() => router.back()}>
                    <Text style={s.emptyBtnText}>Pilih menu</Text>
                </Pressable>
                {alertNode}
            </View>
        );
    }

    const payHint = getPaymentHint(paymentMethod);

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <View style={s.screen}>
            {/* ===== HEADER ===== */}
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable
                    accessibilityLabel="Kembali"
                    onPress={() => router.back()}
                    hitSlop={10}
                    style={s.hBack}
                >
                    <Ionicons name="arrow-back" size={24} color={INK} />
                </Pressable>
                <Text style={s.hTitle}>Konfirmasi Pesanan</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 210 }}
            >
                {/* ===== DIANTAR KE ===== */}
                <View style={s.card}>
                    <Text style={s.cardLabel}>Diantar ke</Text>
                    <Pressable style={s.addrRow} onPress={goToPickAddress}>
                        <View style={s.addrIcon}>
                            <Ionicons name="location" size={18} color="#fff" />
                        </View>

                        <View style={{ flex: 1 }}>
                            {userAddress ? (
                                <>
                                    <Text style={s.addrMain} numberOfLines={2}>
                                        {userAddress.name}
                                    </Text>
                                    {!!userAddress.address && userAddress.address !== userAddress.name && (
                                        <Text style={s.addrDetail} numberOfLines={2}>
                                            {userAddress.address}
                                        </Text>
                                    )}
                                </>
                            ) : (
                                <Text style={s.addrMain}>Pilih alamat pengantaran</Text>
                            )}

                            {loadingEstimate ? (
                                <ShimmerGroup style={{ marginTop: 6 }}>
                                    <ShimmerBox style={{ width: 150, height: 12 }} />
                                </ShimmerGroup>
                            ) : etaMin > 0 ? (
                                <View style={s.etaRow}>
                                    <Ionicons name="time-outline" size={13} color={PRIMARY_DARK} />
                                    <Text style={s.etaText}>
                                        Tiba sekitar {etaMin}-{etaMin + 10} menit
                                        {distanceKm > 0 ? ` • ${distanceKm.toFixed(1).replace('.', ',')} km` : ''}
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        <View style={s.changeBtn}>
                            <Text style={s.changeBtnText}>{userAddress ? 'Ubah' : 'Pilih'}</Text>
                        </View>
                    </Pressable>
                </View>

                {/* ===== PESANAN ===== */}
                <View style={s.card}>
                    <View style={s.restoRow}>
                        <Ionicons name="restaurant" size={18} color={PRIMARY} />
                        <Text style={s.restoName} numberOfLines={1}>
                            {merchant?.store_name ?? items[0]?.merchantName ?? 'Resto'}
                        </Text>
                        <Pressable onPress={() => router.back()} hitSlop={8}>
                            <Text style={s.addMore}>+ Tambah</Text>
                        </Pressable>
                    </View>

                    {items.map((it) => (
                        <View key={it.id} style={s.line}>
                            {it.image_url ? (
                                <Image source={{ uri: it.image_url }} style={s.lineImg} />
                            ) : (
                                <View style={[s.lineImg, s.lineImgEmpty]}>
                                    <Ionicons name="fast-food-outline" size={20} color="#B0B5BD" />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={s.lineName} numberOfLines={2}>
                                    {it.name}
                                </Text>
                                <Text style={s.linePrice}>{fmtRp(Number(it.price) * Number(it.qty))}</Text>
                            </View>
                            <View style={s.stepper}>
                                <Pressable
                                    accessibilityLabel={it.qty <= 1 ? 'Hapus item' : 'Kurangi'}
                                    hitSlop={8}
                                    style={s.stepBtn}
                                    onPress={() => cart.dec(it.id)}
                                >
                                    <Ionicons
                                        name={it.qty <= 1 ? 'trash-outline' : 'remove'}
                                        size={17}
                                        color={it.qty <= 1 ? DANGER : PRIMARY}
                                    />
                                </Pressable>
                                <Text style={s.qty}>{it.qty}</Text>
                                <Pressable
                                    accessibilityLabel="Tambah"
                                    hitSlop={8}
                                    style={s.stepBtn}
                                    onPress={() => cart.inc(it.id)}
                                >
                                    <Ionicons name="add" size={17} color={PRIMARY} />
                                </Pressable>
                            </View>
                        </View>
                    ))}

                    <View style={s.noteBox}>
                        <Ionicons name="create-outline" size={18} color="#7B8680" />
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Catatan untuk resto / driver (opsional)"
                            placeholderTextColor="#9AA0A8"
                            style={s.noteInput}
                            maxLength={200}
                            multiline
                        />
                    </View>
                </View>

                {/* ===== RINCIAN PEMBAYARAN ===== */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>Rincian pembayaran</Text>
                    <Row label={`Subtotal (${itemCount} item)`} value={fmtRp(subtotal)} />
                    <Row
                        label="Ongkos kirim"
                        value={fmtRp(deliveryFee)}
                        loading={loadingEstimate}
                    />
                    <Row label="Biaya layanan" value={fmtRp(SERVICE_FEE)} />
                    <View style={s.divider} />
                    <Row label="Total" value={fmtRp(total)} bold loading={loadingEstimate} />
                </View>
            </ScrollView>

            {/* ===== FOOTER ===== */}
            {!kbOpen && (
                <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
                    <Pressable style={s.payLine} onPress={openPaymentSheet}>
                        <View style={[s.payIcon, { backgroundColor: getPaymentColor(paymentMethod) }]}>
                            <Ionicons name={getPaymentIcon(paymentMethod)} size={14} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.payText}>{getPaymentLabel(paymentMethod, selectedBankLabel)}</Text>
                            {paymentMethod === 'wallet' ? (
                                <Text
                                    style={[
                                        s.paySub,
                                        { color: isSaldoEnough ? PRIMARY_DARK : DANGER, fontWeight: '700' },
                                    ]}
                                >
                                    Saldo: {fmtRp(customerBalance)}
                                </Text>
                            ) : !!payHint ? (
                                <Text style={s.paySub}>{payHint}</Text>
                            ) : null}
                        </View>
                        <Text style={s.payChange}>Ganti</Text>
                        <Ionicons name="chevron-forward" size={16} color={INK} />
                    </Pressable>

                    <Pressable
                        style={[s.cta, (submitting || loadingEstimate) && { opacity: 0.6 }]}
                        onPress={handleOrder}
                        disabled={submitting || loadingEstimate}
                    >
                        <Text style={s.ctaText}>
                            {submitting
                                ? isOnlinePayment
                                    ? 'Menyiapkan pembayaran…'
                                    : 'Membuat pesanan…'
                                : 'Pesan sekarang'}
                        </Text>
                        {!submitting && <Text style={s.ctaPrice}>{fmtRp(total)}</Text>}
                    </Pressable>
                </View>
            )}

            {/* ===== MODAL: PILIH METODE ===== */}
            <Modal
                visible={showPaymentModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPaymentModal(false)}
                statusBarTranslucent
            >
                <View style={s.overlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setShowPaymentModal(false)}
                    />
                    <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
                        <View style={s.handle} />
                        <Text style={s.sheetTitle}>Pilih Metode Pembayaran</Text>

                        <PaymentOption
                            icon="cash-outline"
                            color={GREEN}
                            title="Tunai"
                            subtitle="Bayar langsung ke driver"
                            selected={draftMethod === 'cash'}
                            onPress={() => pickDraft('cash')}
                        />
                        <PaymentOption
                            icon="wallet"
                            color={CYAN}
                            title="Saldo Waruung"
                            subtitle={`Saldo: ${fmtRp(customerBalance)}`}
                            selected={draftMethod === 'wallet'}
                            disabled={!isSaldoEnough}
                            onPress={() => pickDraft('wallet')}
                        />
                        <PaymentOption
                            icon="qr-code-outline"
                            color={ORANGE}
                            title="QRIS"
                            subtitle="Scan dengan e-wallet atau m-banking"
                            selected={draftMethod === 'qris'}
                            onPress={() => pickDraft('qris')}
                        />
                        <PaymentOption
                            icon="card-outline"
                            color={PURPLE}
                            title="Transfer Bank (VA)"
                            subtitle={bankCode ? `VA ${selectedBankLabel}` : 'BRI, BNI, Mandiri, BCA, dll'}
                            selected={draftMethod === 'bank_transfer'}
                            onPress={() => pickDraft('bank_transfer')}
                        />

                        <Pressable style={s.sheetCta} onPress={confirmPayment}>
                            <Text style={s.sheetCtaText}>
                                {draftMethod === 'bank_transfer' && !bankCode
                                    ? 'Pilih bank'
                                    : `Gunakan ${getPaymentLabel(draftMethod, selectedBankLabel)}`}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* ===== MODAL: PILIH BANK ===== */}
            <Modal
                visible={showBankModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowBankModal(false)}
                statusBarTranslucent
            >
                <View style={s.overlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setShowBankModal(false)}
                    />
                    <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
                        <View style={s.handle} />
                        <Text style={s.sheetTitle}>Pilih Bank</Text>
                        <Text style={s.sheetSub}>Nomor Virtual Account akan dibuat untuk bank yang kamu pilih.</Text>
                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            {BANKS.map((b, i) => (
                                <Pressable
                                    key={b.code}
                                    onPress={() => pickBank(b)}
                                    style={[
                                        s.bankRow,
                                        i < BANKS.length - 1 && s.bankRowBorder,
                                        bankCode === b.code && s.bankRowActive,
                                    ]}
                                >
                                    <View style={[s.bankBadge, { backgroundColor: b.color }]}>
                                        <Text style={s.bankBadgeText}>{b.short}</Text>
                                    </View>
                                    <Text style={s.bankLabel}>{b.label}</Text>
                                    {bankCode === b.code && (
                                        <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ===== APP ALERT & LOADING ===== */}
            {alertNode}
            <LoadingModal visible={submitting} />
        </View>
    );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================
function Row({
    label,
    value,
    bold,
    loading,
}: {
    label: string;
    value: string;
    bold?: boolean;
    loading?: boolean;
}) {
    return (
        <View style={s.row}>
            <Text style={[s.rowLabel, bold && s.rowBold]}>{label}</Text>
            {loading ? (
                <ShimmerGroup>
                    <ShimmerBox style={{ width: 72, height: bold ? 18 : 14 }} />
                </ShimmerGroup>
            ) : (
                <Text style={[s.rowValue, bold && s.rowBold]}>{value}</Text>
            )}
        </View>
    );
}

function PaymentOption({
    icon,
    color,
    title,
    subtitle,
    selected,
    disabled,
    onPress,
}: {
    icon: IconName;
    color: string;
    title: string;
    subtitle?: string;
    selected: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={[
                s.payOpt,
                selected && { borderColor: PRIMARY, backgroundColor: PRIMARY_SOFT },
                disabled && { opacity: 0.5 },
            ]}
        >
            <View style={[s.payOptIcon, { backgroundColor: color }]}>
                <Ionicons name={icon} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.payOptTitle}>{title}</Text>
                {!!subtitle && <Text style={s.payOptSub}>{subtitle}</Text>}
            </View>
            <View style={[s.radio, selected && { borderColor: PRIMARY }]}>
                {selected && <View style={s.radioInner} />}
            </View>
        </Pressable>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F4F6F5' },
    center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },

    // Header
    header: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    hBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    hTitle: { fontSize: 18, fontWeight: '800', color: INK },

    // Cards
    card: { backgroundColor: '#fff', marginTop: 8, padding: 16 },
    cardLabel: { fontSize: 13, fontWeight: '700', color: MUTED },
    cardTitle: { fontSize: 15, fontWeight: '800', color: INK, marginBottom: 8 },

    // Alamat
    addrRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    addrIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: SECONDARY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addrMain: { fontSize: 15, fontWeight: '800', color: INK, lineHeight: 20 },
    addrDetail: { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 17 },
    etaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    etaText: { fontSize: 12, fontWeight: '700', color: PRIMARY_DARK },
    changeBtn: {
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 17,
        borderWidth: 1.5,
        borderColor: PRIMARY,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    changeBtnText: { fontSize: 13, fontWeight: '800', color: PRIMARY_DARK },

    // Pesanan
    restoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    restoName: { flex: 1, fontSize: 15, fontWeight: '800', color: INK },
    addMore: { fontSize: 13, fontWeight: '800', color: PRIMARY_DARK },
    line: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: LINE,
    },
    lineImg: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EEF0F3' },
    lineImgEmpty: { alignItems: 'center', justifyContent: 'center' },
    lineName: { fontSize: 14, fontWeight: '700', color: INK },
    linePrice: { fontSize: 13, color: MUTED, marginTop: 3 },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 34,
        borderWidth: 1.5,
        borderColor: PRIMARY,
        borderRadius: 17,
        paddingHorizontal: 2,
    },
    stepBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    qty: { minWidth: 22, textAlign: 'center', fontWeight: '800', fontSize: 14, color: INK },
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 4,
        backgroundColor: '#F4F6F5',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    noteInput: { flex: 1, fontSize: 13, color: INK, padding: 0, minHeight: 18 },

    // Rincian
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    rowLabel: { fontSize: 14, color: MUTED },
    rowValue: { fontSize: 14, fontWeight: '700', color: INK },
    rowBold: { fontSize: 16, fontWeight: '800', color: INK },
    divider: { height: 1, backgroundColor: LINE, marginVertical: 6 },

    // Footer
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: LINE,
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 12,
    },
    payLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    payIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    payText: { fontSize: 15, fontWeight: '800', color: INK },
    paySub: { fontSize: 12, color: MUTED, marginTop: 1 },
    payChange: { fontSize: 13, fontWeight: '800', color: PRIMARY_DARK },
    cta: {
        height: 56,
        borderRadius: 28,
        backgroundColor: PRIMARY,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    ctaPrice: { color: '#fff', fontWeight: '800', fontSize: 16 },

    // Kosong
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#3A3F47' },
    emptyBtn: { backgroundColor: PRIMARY, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 24 },
    emptyBtnText: { color: '#fff', fontWeight: '800' },

    // Sheet
    overlay: { flex: 1, backgroundColor: 'rgba(17,24,20,0.55)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADFDC', marginBottom: 14 },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: INK, marginBottom: 14 },
    sheetSub: { fontSize: 13, color: MUTED, marginTop: -8, marginBottom: 10, lineHeight: 18 },
    sheetCta: {
        height: 54,
        borderRadius: 27,
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    sheetCtaText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    payOpt: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E1E6E3',
        backgroundColor: '#fff',
        marginBottom: 10,
    },
    payOptIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    payOptTitle: { fontSize: 15, fontWeight: '800', color: INK },
    payOptSub: { fontSize: 12, color: MUTED, marginTop: 2 },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#CBD2CE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: PRIMARY },

    // Bank
    bankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
    bankRowBorder: { borderBottomWidth: 1, borderBottomColor: LINE },
    bankRowActive: { backgroundColor: PRIMARY_SOFT, borderRadius: 12, paddingHorizontal: 12 },
    bankBadge: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    bankBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    bankLabel: { flex: 1, marginLeft: 14, fontSize: 15, fontWeight: '700', color: INK },
});