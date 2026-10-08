// app/topup.tsx
// Alur ala Gojek/Grab: Nominal → Metode Pembayaran → Instruksi Bayar → Berhasil
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { router, Stack } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    BackHandler,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import AppAlert, { AlertButton } from '../components/AppAlert';
import LoadingModal from '../components/LoadingModal';
import { api } from '../lib/api';

// ============================================================
// THEME
// ============================================================
const COLORS = {
    primary: '#40a3ea',
    primaryDark: '#2b8ed6',
    primarySoft: '#EAF5FD',
    primaryBorder: '#BFE0F8',
    secondary: '#e68515',
    secondarySoft: '#FFF7E6',
    secondaryBorder: '#FFE0A3',
    text: '#111827',
    textMuted: '#6B7280',
    textLight: '#9CA3AF',
    border: '#ECECEC',
    divider: '#F1F2F4',
    bg: '#F6F7F9',
    card: '#FFFFFF',
    danger: '#e24c4c',
    dangerSoft: '#FDEAEA',
    success: '#16A34A',
    successSoft: '#E8F7EE',
};

// ============================================================
// FEE ADMIN (harus sinkron dengan backend)
// ============================================================
const FEE_VA_DEFAULT = 2500;
const FEE_VA_BCA = 4000;
const FEE_QRIS_PERCENT = 0.008; // 0.8%

function calcAdminFee(method: 'va' | 'qris', bankCode: string | null, amount: number): number {
    if (method === 'qris') return Math.round(amount * FEE_QRIS_PERCENT);
    if (bankCode === '014') return FEE_VA_BCA; // BCA
    return FEE_VA_DEFAULT;
}

// ============================================================
// DATA
// ============================================================
const MIN_TOPUP = 10000; // minimum net yang masuk saldo

const PRESETS: { value: number; icon: string }[] = [
    { value: 20000, icon: '🪙' },
    { value: 50000, icon: '💵' },
    { value: 100000, icon: '💸' },
    { value: 200000, icon: '💰' },
    { value: 300000, icon: '🧧' },
    { value: 500000, icon: '🎁' },
];

type Bank = { code: string; label: string; short: string; color: string; dark?: boolean };

const BANK_GROUPS: { title: string; banks: Bank[] }[] = [
    {
        title: 'Bank BUMN',
        banks: [
            { code: '002', label: 'BRI', short: 'BRI', color: '#00529C' },
            { code: '009', label: 'BNI', short: 'BNI', color: '#F15A23' },
            { code: '008', label: 'Mandiri', short: 'MDR', color: '#003D79' },
            { code: '200', label: 'BTN', short: 'BTN', color: '#F9A11B' },
        ],
    },
    {
        title: 'Bank Swasta',
        banks: [
            { code: '014', label: 'BCA', short: 'BCA', color: '#0060AF' },
            { code: '022', label: 'CIMB Niaga', short: 'CIMB', color: '#EC1C24' },
            { code: '013', label: 'Permata', short: 'PMT', color: '#6CB33F' },
            { code: '011', label: 'Danamon', short: 'DNM', color: '#F26522' },
            { code: '016', label: 'Maybank', short: 'MBK', color: '#FFC20E', dark: true },
            { code: '019', label: 'PaninBank', short: 'PNN', color: '#0067B1' },
            { code: '426', label: 'Bank Mega', short: 'MGA', color: '#1C4EA0' },
            { code: '028', label: 'OCBC NISP', short: 'OCBC', color: '#E60012' },
            { code: '153', label: 'Bank Sinarmas', short: 'SMS', color: '#D71920' },
        ],
    },
    {
        title: 'Bank Syariah',
        banks: [
            { code: '422', label: 'BSI', short: 'BSI', color: '#00A19B' },
            { code: '147', label: 'Muamalat', short: 'MMT', color: '#C51F2D' },
        ],
    },
    {
        title: 'Bank Digital',
        banks: [{ code: '213', label: 'BTPN', short: 'BTPN', color: '#FF6600' }],
    },
];

const ALL_BANKS: Bank[] = BANK_GROUPS.flatMap((g) => g.banks);

type Method = 'va' | 'qris';
type Step = 'amount' | 'method' | 'pay' | 'success';

type HowSection = { title: string; steps: React.ReactNode[] };

// ============================================================
// HELPERS
// ============================================================
const formatRp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

function parseExpiredToMs(expired: string): number {
    const y = Number(expired.slice(0, 4));
    const mo = Number(expired.slice(4, 6)) - 1;
    const d = Number(expired.slice(6, 8));
    const h = Number(expired.slice(8, 10));
    const mi = Number(expired.slice(10, 12));
    const s = Number(expired.slice(12, 14));
    return Date.UTC(y, mo, d, h, mi, s) - 7 * 60 * 60 * 1000;
}

function formatExpiredLabel(expired: string): string {
    const dd = expired.slice(6, 8);
    const mm = expired.slice(4, 6);
    const yyyy = expired.slice(0, 4);
    const hh = expired.slice(8, 10);
    const mi = expired.slice(10, 12);
    return `${dd}/${mm}/${yyyy}, ${hh}:${mi} WIB`;
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

function toImageUri(raw: string): string {
    if (/^(https?:|data:|file:)/i.test(raw)) return raw;
    return `data:image/png;base64,${raw}`;
}

const B = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ fontWeight: '700', color: COLORS.text }}>{children}</Text>
);

function buildHowQris(totalText: string): HowSection[] {
    return [
        {
            title: 'Bayar lewat e-wallet',
            steps: [
                <>Buka aplikasi e-wallet (GoPay, OVO, DANA, ShopeePay, LinkAja, dll).</>,
                <>Pilih menu <B>Scan</B> atau <B>Bayar</B>.</>,
                <>Scan QR di layar ini. Kalau scan dari galeri, simpan dulu lewat tombol <B>Simpan QR</B>.</>,
                <>Pastikan nominal <B>{totalText}</B> sudah sesuai.</>,
                <>Konfirmasi dan masukkan PIN, lalu tunggu notifikasi berhasil.</>,
            ],
        },
        {
            title: 'Bayar lewat m-banking',
            steps: [
                <>Buka aplikasi m-banking yang mendukung QRIS.</>,
                <>Pilih menu <B>QRIS</B> atau <B>Scan QR</B>.</>,
                <>Scan QR di layar ini atau pilih gambar QR dari galeri.</>,
                <>Periksa nominal <B>{totalText}</B>, lalu konfirmasi pembayaran.</>,
            ],
        },
    ];
}

function buildHowVa(bankName: string, va: string, totalText: string): HowSection[] {
    return [
        {
            title: `m-Banking ${bankName}`,
            steps: [
                <>Salin nomor Virtual Account <B>{va}</B>.</>,
                <>Buka aplikasi m-banking {bankName} dan login.</>,
                <>Pilih menu <B>Transfer</B> lalu <B>Virtual Account</B> (atau <B>Bayar</B> lalu <B>VA</B>).</>,
                <>Tempel nomor VA, lalu pastikan nama dan nominal <B>{totalText}</B> sesuai.</>,
                <>Konfirmasi dengan PIN/OTP, lalu simpan bukti transfer.</>,
            ],
        },
        {
            title: `ATM ${bankName}`,
            steps: [
                <>Masukkan kartu ATM dan PIN.</>,
                <>Pilih <B>Transaksi Lainnya</B> lalu <B>Transfer</B> dan <B>Virtual Account</B>.</>,
                <>Masukkan nomor VA <B>{va}</B>.</>,
                <>Periksa nominal <B>{totalText}</B>, lalu konfirmasi dan simpan struk.</>,
            ],
        },
    ];
}

// ============================================================
// KOMPONEN KECIL
// ============================================================
function BankBadge({ bank, size = 40 }: { bank: Bank; size?: number }) {
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2.8,
                backgroundColor: bank.color,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Text
                style={{
                    color: bank.dark ? '#1F2937' : '#fff',
                    fontWeight: '800',
                    fontSize: bank.short.length > 3 ? size * 0.26 : size * 0.3,
                }}
            >
                {bank.short}
            </Text>
        </View>
    );
}

function RadioDot({ selected }: { selected: boolean }) {
    return (
        <View style={[s.radioOuter, selected && { borderColor: COLORS.primary }]}>
            {selected && <View style={s.radioInner} />}
        </View>
    );
}

function OptionRow({
    left,
    title,
    subtitle,
    selected,
    onPress,
    last,
}: {
    left: React.ReactNode;
    title: string;
    subtitle?: string;
    selected: boolean;
    onPress: () => void;
    last?: boolean;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[s.optionRow, !last && s.optionRowBorder, selected && s.optionRowActive]}
        >
            {left}
            <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.optionTitle}>{title}</Text>
                {!!subtitle && <Text style={s.optionSubtitle}>{subtitle}</Text>}
            </View>
            <RadioDot selected={selected} />
        </TouchableOpacity>
    );
}

function StepBar({ current }: { current: 1 | 2 | 3 }) {
    return (
        <View style={s.stepBar}>
            {[1, 2, 3].map((i) => (
                <View
                    key={i}
                    style={[s.stepBarSeg, i <= current && { backgroundColor: COLORS.primary }]}
                />
            ))}
        </View>
    );
}

function Header({
    title,
    onBack,
    current,
}: {
    title: string;
    onBack: () => void;
    current?: 1 | 2 | 3;
}) {
    return (
        <View style={s.headerWrap}>
            <View style={s.header}>
                <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={10}>
                    <Text style={s.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={s.headerTitle}>{title}</Text>
                <View style={{ width: 36 }} />
            </View>
            {current && <StepBar current={current} />}
        </View>
    );
}

function BottomBar({ children }: { children: React.ReactNode }) {
    const insets = useSafeAreaInsets();
    return (
        <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
            {children}
        </View>
    );
}

function Accordion({
    section,
    open,
    onToggle,
}: {
    section: HowSection;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <View style={s.accItem}>
            <TouchableOpacity style={s.accHeader} onPress={onToggle} activeOpacity={0.7}>
                <Text style={s.accTitle}>{section.title}</Text>
                <Text style={[s.accChevron, open && { transform: [{ rotate: '180deg' }] }]}>
                    ⌄
                </Text>
            </TouchableOpacity>
            {open && (
                <View style={s.accBody}>
                    {section.steps.map((st, i) => (
                        <View key={i} style={s.accStepRow}>
                            <View style={s.accNum}>
                                <Text style={s.accNumText}>{i + 1}</Text>
                            </View>
                            <Text style={s.accStepText}>{st}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

// ============================================================
// SCREEN
// ============================================================
export default function TopupScreen() {
    const insets = useSafeAreaInsets();

    const [step, setStep] = useState<Step>('amount');
    const [method, setMethod] = useState<Method>('qris');
    const [bankCode, setBankCode] = useState<string>('002');
    const [amount, setAmount] = useState<string>('50000');
    const [customMode, setCustomMode] = useState(false);
    const [bankQuery, setBankQuery] = useState('');

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [topup, setTopup] = useState<{
        partner_reff: string;
        virtual_account?: string;
        imageqris?: string;
        expired?: string;
    } | null>(null);

    const [openHow, setOpenHow] = useState<number | null>(0);
    const [toast, setToast] = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const qrRef = useRef<View>(null);

    const amt = Number(amount) || 0;
    const selectedBank = ALL_BANKS.find((b) => b.code === bankCode);

    // ✅ Hitung fee admin & total yang harus dibayar
    const adminFee = useMemo(
        () => calcAdminFee(method, bankCode, amt),
        [method, bankCode, amt]
    );
    const totalPay = amt + adminFee;

    // ------------------------------------------------------------
    // ALERT (AppAlert)
    // ------------------------------------------------------------
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons?: AlertButton[];
    }>({ visible: false, title: '', message: '' });

    const showAlert = (title: string, message: string, buttons?: AlertButton[]) => {
        setAlertState({ visible: true, title, message, buttons });
    };
    const closeAlert = () => setAlertState((prev) => ({ ...prev, visible: false }));

    // ------------------------------------------------------------
    // TOAST
    // ------------------------------------------------------------
    const showToast = (msg: string) => {
        setToast(msg);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2200);
    };

    useEffect(() => {
        return () => {
            if (toastTimer.current) clearTimeout(toastTimer.current);
        };
    }, []);

    // ------------------------------------------------------------
    // COUNTDOWN
    // ------------------------------------------------------------
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!topup?.expired) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [topup?.expired]);

    const msLeft = useMemo(() => {
        if (!topup?.expired) return 0;
        return parseExpiredToMs(topup.expired) - now;
    }, [topup?.expired, now]);

    const countdownText = useMemo(() => formatCountdown(msLeft), [msLeft]);
    const isExpired = !!topup?.expired && msLeft <= 0;

    // ------------------------------------------------------------
    // ✅ AUTO-POLLING STATUS TOPUP
    // ------------------------------------------------------------
    useEffect(() => {
        // Hanya polling kalau di step 'pay' dan ada partner_reff
        if (step !== 'pay' || !topup?.partner_reff) return;
        if (isExpired) return;

        let stopped = false;
        let attempts = 0;
        const MAX_ATTEMPTS = 100; // 100 x 3s = 5 menit
        const INTERVAL_MS = 3000;

        const poll = async () => {
            if (stopped || attempts >= MAX_ATTEMPTS) return;
            attempts++;

            try {
                const res: any = await api.wallet.topupExecute(topup.partner_reff);
                console.log('[POLL]', attempts, JSON.stringify(res));

                const candidates = [
                    res?.status,
                    res?.data?.status,
                    res?.data?.data?.status_trx,
                    res?.data?.data?.status_paid,
                    res?.data?.status_trx,
                    res?.data?.status_paid,
                ]
                    .filter(Boolean)
                    .map((v) => String(v).toUpperCase());

                const OK = ['SUCCESS', 'SETTLE', 'SETTLED', 'PAID'];
                if (candidates.some((v) => OK.includes(v))) {
                    stopped = true;
                    setStep('success');
                }
            } catch (e) {
                console.log('[POLL ERROR]', e);
            }
        };

        const intervalId = setInterval(poll, INTERVAL_MS);

        return () => {
            stopped = true;
            clearInterval(intervalId);
        };
    }, [step, topup?.partner_reff, isExpired]);

    // ------------------------------------------------------------
    // NAVIGASI
    // ------------------------------------------------------------
    const goBack = () => {
        if (step === 'method') {
            setStep('amount');
        } else if (step === 'pay') {
            setTopup(null);
            setStep('method');
        } else {
            router.back();
        }
    };

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step === 'method' || step === 'pay') {
                goBack();
                return true;
            }
            return false;
        });
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    // ------------------------------------------------------------
    // ACTIONS
    // ------------------------------------------------------------
    const goToMethod = () => {
        if (!amt || amt < MIN_TOPUP) {
            showAlert('Nominal belum sesuai', `Minimal top up ${formatRp(MIN_TOPUP)}.`);
            return;
        }
        setStep('method');
    };

    const handleCreate = async () => {
        if (!amt || amt < MIN_TOPUP) {
            showAlert('Nominal belum sesuai', `Minimal top up ${formatRp(MIN_TOPUP)}.`);
            return;
        }
        if (method === 'va' && !bankCode) {
            showAlert('Bank belum dipilih', 'Pilih bank untuk Virtual Account dulu.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.wallet.topupInquiry({
                amount: amt,
                method,
                bank_code: method === 'va' ? bankCode : undefined,
            });
            setTopup(res);
            setNow(Date.now());
            setOpenHow(0);
            setStep('pay');
        } catch (err: any) {
            showAlert('Gagal membuat pembayaran', err?.message ?? 'Terjadi kesalahan. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const copyText = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        showToast(`${label} disalin`);
    };

    const handleSaveQris = async () => {
        if (!topup?.imageqris || !qrRef.current) return;
        setSaving(true);
        let tmpUri: string | null = null;
        try {
            const perm = await MediaLibrary.requestPermissionsAsync(true);
            if (!perm.granted) {
                showAlert(
                    'Izin ditolak',
                    'Izinkan akses galeri di pengaturan untuk menyimpan QRIS.'
                );
                return;
            }

            let fileUri: string;
            try {
                fileUri = await captureRef(qrRef, {
                    format: 'png',
                    quality: 1,
                    result: 'tmpfile',
                });
            } catch {
                const raw = topup.imageqris;
                if (!/^https?:/i.test(raw)) throw new Error('Gagal membuat gambar QR');
                const dest = `${FileSystem.cacheDirectory}qris_${topup.partner_reff}.png`;
                const dl = await FileSystem.downloadAsync(raw, dest);
                fileUri = dl.uri;
            }
            tmpUri = fileUri;

            await MediaLibrary.saveToLibraryAsync(fileUri);
            showToast('QRIS tersimpan di galeri');
        } catch (err: any) {
            showAlert(
                'Gagal menyimpan QRIS',
                err?.message ?? 'Tidak bisa menyimpan QRIS ke galeri.'
            );
        } finally {
            if (tmpUri && Platform.OS !== 'web') {
                FileSystem.deleteAsync(tmpUri, { idempotent: true }).catch(() => { });
            }
            setSaving(false);
        }
    };

    const resetAll = () => {
        setTopup(null);
        setCustomMode(false);
        setAmount('50000');
        setStep('amount');
    };

    // ============================================================
    // RENDER: 1. PILIH NOMINAL
    // ============================================================
    const renderAmount = () => (
        <>
            <Header title="Top Up Saldo" onBack={goBack} current={1} />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={s.sectionTitle}>Pilih nominal</Text>
                <View style={s.grid}>
                    {PRESETS.map((p) => {
                        const active = !customMode && amount === String(p.value);
                        return (
                            <TouchableOpacity
                                key={p.value}
                                activeOpacity={0.8}
                                style={[s.amountCard, active && s.amountCardActive]}
                                onPress={() => {
                                    setCustomMode(false);
                                    setAmount(String(p.value));
                                }}
                            >
                                {active && (
                                    <View style={s.checkBadge}>
                                        <Text style={s.checkBadgeText}>✓</Text>
                                    </View>
                                )}
                                <Text style={s.amountIcon}>{p.icon}</Text>
                                <Text style={s.amountText}>{formatRp(p.value)}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[s.customBtn, customMode && s.customBtnActive]}
                    onPress={() => {
                        setCustomMode(true);
                        if (PRESETS.some((p) => String(p.value) === amount)) setAmount('');
                    }}
                >
                    <View
                        style={[
                            s.plusDot,
                            customMode && { backgroundColor: COLORS.primary },
                        ]}
                    >
                        <Text style={s.plusText}>+</Text>
                    </View>
                    <Text style={s.customText}>Atau, ketik sendiri nominalnya</Text>
                </TouchableOpacity>

                {customMode && (
                    <>
                        <View style={s.inputWrap}>
                            <Text style={s.inputPrefix}>Rp</Text>
                            <TextInput
                                style={s.input}
                                keyboardType="numeric"
                                value={amount ? Number(amount).toLocaleString('id-ID') : ''}
                                onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                                placeholder="0"
                                placeholderTextColor={COLORS.textLight}
                                autoFocus
                            />
                        </View>
                        <Text
                            style={[
                                s.hint,
                                !!amount && amt < MIN_TOPUP && { color: COLORS.danger },
                            ]}
                        >
                            Minimal top up {formatRp(MIN_TOPUP)}
                        </Text>
                    </>
                )}

                {/* ✅ Info fee admin */}
                <View style={s.feeInfoBox}>
                    <Text style={s.feeInfoTitle}>ℹ️ Info Biaya Admin</Text>
                    <Text style={s.feeInfoText}>
                        • VA: Rp{FEE_VA_DEFAULT.toLocaleString('id-ID')}
                    </Text>
                    <Text style={s.feeInfoText}>
                        • VA BCA: Rp{FEE_VA_BCA.toLocaleString('id-ID')}
                    </Text>
                    <Text style={s.feeInfoText}>
                        • QRIS: {FEE_QRIS_PERCENT * 100}% dari nominal
                    </Text>
                </View>
            </ScrollView>

            <BottomBar>
                <TouchableOpacity
                    style={[s.btn, (!amt || amt < MIN_TOPUP) && { opacity: 0.5 }]}
                    onPress={goToMethod}
                    disabled={!amt || amt < MIN_TOPUP}
                >
                    <Text style={s.btnText}>Lanjut</Text>
                </TouchableOpacity>
            </BottomBar>
        </>
    );

    // ============================================================
    // RENDER: 2. PILIH METODE PEMBAYARAN
    // ============================================================
    const renderMethod = () => {
        const q = bankQuery.trim().toLowerCase();
        const groups = BANK_GROUPS.map((g) => ({
            ...g,
            banks: g.banks.filter((b) => !q || b.label.toLowerCase().includes(q)),
        })).filter((g) => g.banks.length > 0);

        const selectedLabel =
            method === 'qris'
                ? 'QRIS'
                : selectedBank
                    ? `VA ${selectedBank.label}`
                    : 'Virtual Account';

        return (
            <>
                <Header title="Metode Pembayaran" onBack={goBack} current={2} />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ✅ Ringkasan dengan fee */}
                    <View style={s.summaryCard}>
                        <View style={{ flex: 1 }}>
                            <View style={s.summaryRowItem}>
                                <Text style={s.summaryLabel}>Nominal top up</Text>
                                <Text style={s.summaryValueSm}>{formatRp(amt)}</Text>
                            </View>
                            <View style={s.summaryRowItem}>
                                <Text style={s.summaryLabel}>Biaya admin</Text>
                                <Text style={s.summaryValueSm}>{formatRp(adminFee)}</Text>
                            </View>
                            <View style={s.summaryDivider} />
                            <View style={s.summaryRowItem}>
                                <Text style={s.summaryLabelBold}>Total bayar</Text>
                                <Text style={s.summaryValueBold}>{formatRp(totalPay)}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => setStep('amount')}
                            hitSlop={10}
                            style={{ paddingLeft: 12 }}
                        >
                            <Text style={s.linkText}>Ubah</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={s.groupTitle}>Bayar instan</Text>
                    <View style={s.group}>
                        <OptionRow
                            left={
                                <View style={s.qrisIcon}>
                                    <Text style={s.qrisIconText}>QR</Text>
                                </View>
                            }
                            title="QRIS"
                            subtitle={`Fee ${FEE_QRIS_PERCENT * 100}% • GoPay, OVO, DANA, dll`}
                            selected={method === 'qris'}
                            onPress={() => setMethod('qris')}
                            last
                        />
                    </View>

                    <Text style={s.groupTitle}>Virtual Account</Text>
                    <View style={s.searchWrap}>
                        <Text style={s.searchIcon}>⌕</Text>
                        <TextInput
                            style={s.searchInput}
                            placeholder="Cari bank"
                            placeholderTextColor={COLORS.textLight}
                            value={bankQuery}
                            onChangeText={setBankQuery}
                            autoCorrect={false}
                        />
                        {!!bankQuery && (
                            <TouchableOpacity onPress={() => setBankQuery('')} hitSlop={10}>
                                <Text style={s.searchClear}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {groups.length === 0 && (
                        <View style={s.emptyBox}>
                            <Text style={s.emptyText}>Bank tidak ditemukan</Text>
                        </View>
                    )}

                    {groups.map((g) => (
                        <View key={g.title} style={{ marginBottom: 12 }}>
                            <Text style={s.subGroupTitle}>{g.title}</Text>
                            <View style={s.group}>
                                {g.banks.map((b, i) => {
                                    const fee = b.code === '014' ? FEE_VA_BCA : FEE_VA_DEFAULT;
                                    return (
                                        <OptionRow
                                            key={b.code}
                                            left={<BankBadge bank={b} />}
                                            title={b.label}
                                            subtitle={`VA • Fee ${formatRp(fee)}`}
                                            selected={method === 'va' && bankCode === b.code}
                                            onPress={() => {
                                                setMethod('va');
                                                setBankCode(b.code);
                                            }}
                                            last={i === g.banks.length - 1}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                </ScrollView>

                <BottomBar>
                    <View style={s.bottomInfo}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.bottomLabel}>{selectedLabel}</Text>
                            <Text style={s.bottomValue}>{formatRp(totalPay)}</Text>
                            <Text style={s.bottomSub}>
                                {formatRp(amt)} + fee {formatRp(adminFee)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[s.btn, s.btnInline]}
                            onPress={handleCreate}
                        >
                            <Text style={s.btnText}>Bayar</Text>
                        </TouchableOpacity>
                    </View>
                </BottomBar>
            </>
        );
    };

    // ============================================================
    // RENDER: 3. INSTRUKSI PEMBAYARAN
    // ============================================================
    const renderPay = () => {
        if (!topup) return null;
        const totalText = formatRp(totalPay);
        const isVa = !!topup.virtual_account;
        const bankName = selectedBank?.label ?? 'Bank';

        const howSections = isVa
            ? buildHowVa(bankName, topup.virtual_account!, totalText)
            : buildHowQris(totalText);

        return (
            <>
                <Header title="Selesaikan Pembayaran" onBack={goBack} current={3} />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
                >
                    {!!topup.expired && (
                        <View
                            style={[
                                s.countdownBox,
                                isExpired && s.countdownBoxExpired,
                            ]}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        s.countdownLabel,
                                        isExpired && { color: COLORS.danger },
                                    ]}
                                >
                                    {isExpired
                                        ? 'Waktu pembayaran habis'
                                        : 'Selesaikan pembayaran dalam'}
                                </Text>
                                <Text style={s.countdownDeadline}>
                                    Batas bayar {formatExpiredLabel(topup.expired)}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    s.countdownValue,
                                    isExpired && { color: COLORS.danger },
                                ]}
                            >
                                {isExpired ? '00:00' : countdownText}
                            </Text>
                        </View>
                    )}

                    {/* ✅ Indikator auto-polling */}
                    {!isExpired && (
                        <View style={s.pollingBox}>
                            <View style={s.pollingDot} />
                            <Text style={s.pollingText}>
                                Memeriksa pembayaran otomatis...
                            </Text>
                        </View>
                    )}

                    <View style={s.payCard}>
                        <View style={s.payCardHead}>
                            {isVa && selectedBank ? (
                                <BankBadge bank={selectedBank} size={44} />
                            ) : (
                                <View style={[s.qrisIcon, { width: 44, height: 44 }]}>
                                    <Text style={s.qrisIconText}>QR</Text>
                                </View>
                            )}
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={s.payCardTitle}>
                                    {isVa ? `${bankName} Virtual Account` : 'QRIS'}
                                </Text>
                                <Text style={s.payCardSub}>
                                    {isVa
                                        ? 'Transfer ke nomor VA di bawah'
                                        : 'Scan dengan e-wallet atau m-banking'}
                                </Text>
                            </View>
                        </View>

                        <View style={s.dashed} />

                        {isVa ? (
                            <>
                                <Text style={s.fieldLabel}>Nomor Virtual Account</Text>
                                <View style={s.copyRow}>
                                    <Text style={s.vaText} selectable>
                                        {topup.virtual_account}
                                    </Text>
                                    <TouchableOpacity
                                        style={s.copyBtn}
                                        onPress={() =>
                                            copyText(topup.virtual_account!, 'Nomor VA')
                                        }
                                    >
                                        <Text style={s.copyBtnText}>Salin</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            !!topup.imageqris && (
                                <>
                                    <View ref={qrRef} collapsable={false} style={s.qrFrame}>
                                        <Image
                                            source={{ uri: toImageUri(topup.imageqris) }}
                                            style={{ width: '100%', height: 280 }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <TouchableOpacity
                                        style={s.btnSoft}
                                        onPress={handleSaveQris}
                                    >
                                        <Text style={s.btnSoftText}>
                                            Simpan QR ke Galeri
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )
                        )}

                        <View style={s.dashed} />

                        {/* ✅ Rincian: nominal + fee + total */}
                        <View style={s.totalRow}>
                            <Text style={s.fieldLabel}>Nominal top up</Text>
                            <Text style={s.fieldValue}>{formatRp(amt)}</Text>
                        </View>
                        <View style={s.totalRow}>
                            <Text style={s.fieldLabel}>Biaya admin</Text>
                            <Text style={s.fieldValue}>{formatRp(adminFee)}</Text>
                        </View>
                        <View style={s.totalRowHighlight}>
                            <Text style={s.fieldLabelBold}>Total bayar</Text>
                            <TouchableOpacity
                                style={s.totalRight}
                                onPress={() => copyText(String(totalPay), 'Total')}
                            >
                                <Text style={s.totalValue}>{totalText}</Text>
                                <Text style={s.totalCopy}>Salin</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={s.groupTitle}>Cara pembayaran</Text>
                    <View style={s.accWrap}>
                        {howSections.map((sec, i) => (
                            <Accordion
                                key={sec.title}
                                section={sec}
                                open={openHow === i}
                                onToggle={() => setOpenHow(openHow === i ? null : i)}
                            />
                        ))}
                    </View>

                    <Text style={s.footNote}>
                        Pembayaran akan terdeteksi otomatis. Kalau sudah bayar, tunggu
                        1–2 menit — halaman ini akan pindah sendiri ke status sukses.
                    </Text>
                </ScrollView>

                <BottomBar>
                    {isExpired ? (
                        <TouchableOpacity
                            style={s.btn}
                            onPress={() => {
                                setTopup(null);
                                setStep('method');
                            }}
                        >
                            <Text style={s.btnText}>Buat Pembayaran Baru</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={s.btnGhost} onPress={goBack}>
                            <Text style={s.btnGhostText}>
                                Ganti Metode Pembayaran
                            </Text>
                        </TouchableOpacity>
                    )}
                </BottomBar>
            </>
        );
    };

    // ============================================================
    // RENDER: 4. BERHASIL
    // ============================================================
    const renderSuccess = () => (
        <>
            <View style={s.successWrap}>
                <View style={s.successCircle}>
                    <Text style={s.successCheck}>✓</Text>
                </View>
                <Text style={s.successTitle}>Top up berhasil</Text>
                <Text style={s.successAmount}>{formatRp(amt)}</Text>
                <Text style={s.successSub}>
                    Saldo kamu sudah bertambah sebesar {formatRp(amt)}{'\n'}
                    (fee admin {formatRp(adminFee)} sudah dipotong).
                </Text>
            </View>
            <BottomBar>
                <TouchableOpacity style={s.btn} onPress={() => router.back()}>
                    <Text style={s.btnText}>Selesai</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnGhost} onPress={resetAll}>
                    <Text style={s.btnGhostText}>Top Up Lagi</Text>
                </TouchableOpacity>
            </BottomBar>
        </>
    );

    // ============================================================
    // ROOT
    // ============================================================
    return (
        <KeyboardAvoidingView
            style={[s.container, { paddingTop: insets.top }]}
            behavior="height"
            keyboardVerticalOffset={0}
        >
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

            {step === 'amount' && renderAmount()}
            {step === 'method' && renderMethod()}
            {step === 'pay' && renderPay()}
            {step === 'success' && renderSuccess()}

            {toast && (
                <View pointerEvents="none" style={s.toast}>
                    <Text style={s.toastText}>{toast}</Text>
                </View>
            )}

            <LoadingModal visible={loading || saving} />

            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={closeAlert}
            />
        </KeyboardAvoidingView>
    );
}

// ============================================================
// STYLES
// ============================================================
const shadow = {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
} as const;

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },

    // Header
    headerWrap: { backgroundColor: COLORS.card },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        height: 52,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 34, lineHeight: 36, color: COLORS.text, marginTop: -4 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
    stepBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
    stepBarSeg: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
    },

    // Section titles
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 14,
    },
    groupTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
        marginTop: 22,
        marginBottom: 10,
    },
    subGroupTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textMuted,
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Grid nominal
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    amountCard: {
        width: '31.5%',
        aspectRatio: 0.95,
        backgroundColor: COLORS.card,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        ...shadow,
    },
    amountCardActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primarySoft,
    },
    amountIcon: { fontSize: 38 },
    amountText: { fontSize: 14, fontWeight: '800', color: COLORS.text },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },

    customBtn: {
        marginTop: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 18,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
    },
    customBtnActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primarySoft,
    },
    plusDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#C4C4C4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusText: { color: '#fff', fontWeight: '800', fontSize: 14, lineHeight: 16 },
    customText: { fontSize: 15, fontWeight: '600', color: COLORS.text },

    inputWrap: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 16,
        paddingHorizontal: 16,
    },
    inputPrefix: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textMuted,
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.text,
    },
    hint: { marginTop: 8, marginLeft: 4, fontSize: 12, color: COLORS.textMuted },

    // Fee info box
    feeInfoBox: {
        marginTop: 20,
        backgroundColor: COLORS.primarySoft,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.primaryBorder,
    },
    feeInfoTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.primaryDark,
        marginBottom: 6,
    },
    feeInfoText: {
        fontSize: 12,
        color: '#374151',
        lineHeight: 18,
    },

    // Ringkasan dengan fee
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        ...shadow,
    },
    summaryRowItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    summaryLabel: { fontSize: 13, color: COLORS.textMuted },
    summaryValueSm: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    summaryDivider: {
        height: 1,
        backgroundColor: COLORS.divider,
        marginVertical: 6,
    },
    summaryLabelBold: { fontSize: 14, fontWeight: '800', color: COLORS.text },
    summaryValueBold: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.primary,
    },
    linkText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },

    // Group list
    group: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        overflow: 'hidden',
        ...shadow,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        backgroundColor: COLORS.card,
    },
    optionRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    optionRowActive: { backgroundColor: COLORS.primarySoft },
    optionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    optionSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: COLORS.primary,
    },

    qrisIcon: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: COLORS.secondarySoft,
        borderWidth: 1,
        borderColor: COLORS.secondaryBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qrisIconText: { color: COLORS.secondary, fontWeight: '900', fontSize: 14 },

    // Search bank
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 14,
        marginBottom: 14,
    },
    searchIcon: { fontSize: 20, color: COLORS.textLight, marginRight: 8 },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
    searchClear: { fontSize: 14, color: COLORS.textLight, paddingLeft: 8 },
    emptyBox: { alignItems: 'center', paddingVertical: 28 },
    emptyText: { color: COLORS.textMuted },

    // Bottom bar
    bottom: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    bottomInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    bottomLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
    bottomValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
    bottomSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

    btn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnInline: { paddingHorizontal: 40 },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    btnGhost: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    btnGhostText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
    btnSoft: {
        marginTop: 12,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: COLORS.primarySoft,
        alignItems: 'center',
    },
    btnSoftText: {
        color: COLORS.primaryDark,
        fontWeight: '800',
        fontSize: 14,
    },

    // Countdown
    countdownBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondarySoft,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.secondaryBorder,
        marginBottom: 14,
    },
    countdownBoxExpired: {
        backgroundColor: COLORS.dangerSoft,
        borderColor: '#F5B7B7',
    },
    countdownLabel: { fontSize: 13, color: '#8a6d3b', fontWeight: '700' },
    countdownDeadline: { fontSize: 11, color: '#a38a5d', marginTop: 3 },
    countdownValue: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.secondary,
        letterSpacing: 1,
        marginLeft: 10,
    },

    // Auto-polling indicator
    pollingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
    },
    pollingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
    },
    pollingText: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontStyle: 'italic',
    },

    // Kartu pembayaran
    payCard: {
        backgroundColor: COLORS.card,
        borderRadius: 18,
        padding: 16,
        ...shadow,
    },
    payCardHead: { flexDirection: 'row', alignItems: 'center' },
    payCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
    payCardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    dashed: {
        marginVertical: 16,
        borderTopWidth: 1.5,
        borderTopColor: COLORS.border,
        borderStyle: 'dashed',
    },
    fieldLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
    fieldLabelBold: { fontSize: 14, color: COLORS.text, fontWeight: '800' },
    fieldValue: { fontSize: 14, color: COLORS.text, fontWeight: '700' },
    copyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        gap: 10,
    },
    vaText: {
        flex: 1,
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 1.5,
        color: COLORS.text,
    },
    copyBtn: {
        backgroundColor: COLORS.primarySoft,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },
    copyBtnText: {
        color: COLORS.primaryDark,
        fontWeight: '800',
        fontSize: 13,
    },

    qrFrame: {
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    totalRowHighlight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        marginTop: 6,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    totalRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    totalValue: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.secondary,
    },
    totalCopy: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

    // Accordion cara bayar
    accWrap: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        overflow: 'hidden',
        ...shadow,
    },
    accItem: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    accHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    accTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
        flex: 1,
    },
    accChevron: { fontSize: 22, color: COLORS.textMuted, lineHeight: 22 },
    accBody: { paddingHorizontal: 16, paddingBottom: 16 },
    accStepRow: { flexDirection: 'row', marginBottom: 12 },
    accNum: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        marginTop: 1,
    },
    accNumText: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.primaryDark,
    },
    accStepText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 20,
        color: '#4B5563',
    },
    footNote: {
        marginTop: 16,
        fontSize: 12,
        lineHeight: 18,
        color: COLORS.textMuted,
        textAlign: 'center',
        paddingHorizontal: 12,
    },

    // Success
    successWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    successCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: COLORS.successSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    successCheck: {
        fontSize: 48,
        color: COLORS.success,
        fontWeight: '800',
    },
    successTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
    successAmount: {
        fontSize: 32,
        fontWeight: '900',
        color: COLORS.primary,
        marginTop: 8,
    },
    successSub: {
        fontSize: 14,
        color: COLORS.textMuted,
        marginTop: 10,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Toast
    toast: {
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: 120,
        alignItems: 'center',
    },
    toastText: {
        backgroundColor: 'rgba(17,24,39,0.92)',
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
        overflow: 'hidden',
    },
});