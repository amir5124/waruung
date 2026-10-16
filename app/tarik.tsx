// app/tarik.tsx
// Alur ala Gojek/Grab: Isi nominal → Konfirmasi (bottom sheet) → Berhasil
import AppAlert, { AlertButton } from '@/components/AppAlert';
import LoadingModal from '@/components/LoadingModal';
import { api } from '@/lib/api';
import { router, Stack } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
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
    dangerBorder: '#F5B7B7',
    success: '#16A34A',
    successSoft: '#E8F7EE',
};

// ============================================================
// DATA
// ============================================================
const WITHDRAW_FEE = 3000;        // ⬅️ FEE ADMIN WITHDRAW
const MIN_WITHDRAW = 10000;
const MAX_ACCOUNTS = 2;
const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

type SavedAccount = {
    id: number;
    bank_code: string;
    account_number: string;
    account_name: string;
    created_at: string;
};

type BankMeta = {
    code: string;
    label: string;
    short: string;
    color: string;
    dark?: boolean;
};

const BANKS: BankMeta[] = [
    { code: 'BRI', label: 'BRI', short: 'BRI', color: '#00529C' },
    { code: 'BNI', label: 'BNI', short: 'BNI', color: '#F15A23' },
    { code: 'MANDIRI', label: 'Mandiri', short: 'MDR', color: '#003D79' },
    { code: 'BCA', label: 'BCA', short: 'BCA', color: '#0060AF' },
    { code: 'PERMATA', label: 'Permata', short: 'PMT', color: '#6CB33F' },
    { code: 'CIMB', label: 'CIMB Niaga', short: 'CIMB', color: '#EC1C24' },
];

const getBank = (code: string): BankMeta =>
    BANKS.find((b) => b.code === code.toUpperCase()) ?? {
        code,
        label: code,
        short: code.slice(0, 3).toUpperCase(),
        color: '#6B7280',
    };

const minFor = (_code?: string | null) => MIN_WITHDRAW;

const formatRp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

const maskNumber = (n: string) =>
    n.length <= 6
        ? n
        : `${n.slice(0, 3)}${'•'.repeat(Math.max(n.length - 6, 3))}${n.slice(-3)}`;

// ============================================================
// KOMPONEN KECIL
// ============================================================
function BankBadge({ bank, size = 42 }: { bank: BankMeta; size?: number }) {
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
                    fontSize: bank.short.length > 3 ? size * 0.25 : size * 0.3,
                }}
            >
                {bank.short}
            </Text>
        </View>
    );
}

function RadioDot({ selected }: { selected: boolean }) {
    return (
        <View
            style={[s.radioOuter, selected && { borderColor: COLORS.primary }]}
        >
            {selected && <View style={s.radioInner} />}
        </View>
    );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
    return (
        <View style={s.headerWrap}>
            <View style={s.header}>
                <TouchableOpacity
                    onPress={onBack}
                    style={s.backBtn}
                    hitSlop={10}
                >
                    <Text style={s.backIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={s.headerTitle}>{title}</Text>
                <View style={{ width: 36 }} />
            </View>
        </View>
    );
}

function BottomBar({ children }: { children: React.ReactNode }) {
    const insets = useSafeAreaInsets();
    return (
        <View
            style={[
                s.bottom,
                { paddingBottom: Math.max(insets.bottom, 12) + 4 },
            ]}
        >
            {children}
        </View>
    );
}

function SummaryRow({
    label,
    value,
    bold,
    danger,
}: {
    label: string;
    value: string;
    bold?: boolean;
    danger?: boolean;
}) {
    return (
        <View style={s.sumRow}>
            <Text style={bold ? s.sumLabelBold : s.sumLabel}>{label}</Text>
            <Text
                style={[
                    bold ? s.sumValueBold : s.sumValue,
                    danger && { color: COLORS.danger },
                ]}
            >
                {value}
            </Text>
        </View>
    );
}

// ============================================================
// SCREEN
// ============================================================
export default function TarikScreen() {
    const insets = useSafeAreaInsets();

    const [step, setStep] = useState<'form' | 'success'>('form');
    const [wallet, setWallet] = useState<{
        balance: number;
        pending_balance: number;
        net_balance: number;
        updated_at: string;
    } | null>(null);
    const [accounts, setAccounts] = useState<SavedAccount[]>([]);
    const [selected, setSelected] = useState<SavedAccount | null>(null);
    const [amount, setAmount] = useState('');

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [showConfirm, setShowConfirm] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [newBank, setNewBank] = useState('BRI');
    const [newAccNum, setNewAccNum] = useState('');
    const [newAccName, setNewAccName] = useState('');

    const [doneAmount, setDoneAmount] = useState(0);
    const [doneTotal, setDoneTotal] = useState(0);
    const [doneAccount, setDoneAccount] = useState<SavedAccount | null>(null);

    const [kbHeight, setKbHeight] = useState(0);

    useEffect(() => {
        const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const a = Keyboard.addListener(showEvt, (e) =>
            setKbHeight(e.endCoordinates.height)
        );
        const b = Keyboard.addListener(hideEvt, () => setKbHeight(0));

        return () => {
            a.remove();
            b.remove();
        };
    }, []);

    // ============================================================
    // ALERT
    // ============================================================
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons?: AlertButton[];
    }>({ visible: false, title: '', message: '' });

    const showAlert = (
        title: string,
        message: string,
        buttons?: AlertButton[]
    ) => setAlertState({ visible: true, title, message, buttons });

    const closeAlert = () =>
        setAlertState((p) => ({ ...p, visible: false }));

    // ============================================================
    // LOAD
    // ============================================================
    const load = async () => {
        try {
            const [w, accs] = await Promise.all([
                api.wallet.get(),
                api.wallet.savedAccounts(),
            ]);
            setWallet(w);
            setAccounts(accs);
            setSelected((prev) => {
                if (prev && accs.some((a: SavedAccount) => a.id === prev.id))
                    return prev;
                return accs[0] ?? null;
            });
        } catch (err: any) {
            showAlert(
                'Gagal memuat data',
                err?.message ?? 'Terjadi kesalahan. Coba lagi.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================================================
    // TURUNAN
    // ============================================================
    const balance = wallet?.balance ?? 0;
    const amt = Number(amount) || 0;
    const minAmt = minFor(selected?.bank_code);

    // ✅ Total yang dipotong = nominal + fee
    const totalDeduction = amt + WITHDRAW_FEE;

    const maxWithdraw = Math.max(0, balance - WITHDRAW_FEE);

    const amountError = useMemo(() => {
        if (!amt) return null;
        if (amt < minAmt) return `Minimal penarikan ${formatRp(minAmt)}`;
        if (totalDeduction > balance) {
            return `Saldo tidak cukup. Butuh ${formatRp(
                totalDeduction
            )} (nominal + fee)`;
        }
        return null;
    }, [amt, minAmt, balance, totalDeduction]);

    const canSubmit =
        !!selected &&
        amt >= minAmt &&
        totalDeduction <= balance &&
        !amountError;

    // ============================================================
    // REKENING
    // ============================================================
    const handleSaveAccount = async () => {
        const num = newAccNum.trim();
        const name = newAccName.trim();
        if (num.length < 6 || !name) {
            showAlert(
                'Data belum lengkap',
                'Isi nomor rekening dan nama pemilik dengan benar.'
            );
            return;
        }
        setSubmitting(true);
        try {
            await api.wallet.saveAccount({
                bank_code: newBank,
                account_number: num,
                account_name: name,
            });
            setShowAdd(false);
            setNewAccNum('');
            setNewAccName('');
            await load();
        } catch (err: any) {
            showAlert(
                'Gagal menyimpan',
                err?.message ?? 'Tidak bisa menyimpan rekening.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteAccount = (acc: SavedAccount) => {
        showAlert(
            'Hapus rekening?',
            `${getBank(acc.bank_code).label} • ${acc.account_number}`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.wallet.deleteAccount(acc.id);
                            if (selected?.id === acc.id) setSelected(null);
                            await load();
                        } catch (err: any) {
                            showAlert(
                                'Gagal menghapus',
                                err?.message ?? 'Coba lagi.'
                            );
                        }
                    },
                },
            ] as AlertButton[]
        );
    };

    // ============================================================
    // WITHDRAW: inquiry → execute
    // ============================================================
    const handleWithdraw = async () => {
        if (!selected || !canSubmit) return;

        setSubmitting(true);
        try {
            const inq = await api.wallet.withdrawInquiry({
                amount: amt,
                bank_code: selected.bank_code,
                account_number: selected.account_number,
            });

            const inquiryReff =
                inq?.inquiry_reff ??
                inq?.partner_reff ??
                inq?.data?.inquiry_reff;
            if (!inquiryReff)
                throw new Error('Inquiry gagal: tidak ada inquiry_reff');

            await api.wallet.withdrawExecute(inquiryReff);

            setShowConfirm(false);
            setDoneAmount(amt);
            setDoneTotal(totalDeduction);
            setDoneAccount(selected);
            setStep('success');
        } catch (err: any) {
            setShowConfirm(false);
            showAlert(
                'Penarikan gagal',
                err?.message ?? 'Terjadi kesalahan. Coba lagi.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    // ============================================================
    // RENDER: FORM
    // ============================================================
    const renderForm = () => {
        return (
            <>
                <Header title="Tarik Saldo" onBack={() => router.back()} />
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            padding: 16,
                            paddingBottom: 140,
                            flexGrow: 1,
                        }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Saldo */}
                        <View style={s.balanceCard}>
                            <Text style={s.balanceLabel}>Saldo tersedia</Text>
                            <Text style={s.balanceValue}>{formatRp(balance)}</Text>
                            <Text style={s.balanceHint}>
                                Biaya admin pencairan {formatRp(WITHDRAW_FEE)}
                            </Text>
                        </View>


                        {/* Rekening tujuan */}
                        <View style={s.rowBetween}>
                            <Text style={s.sectionTitle}>Rekening tujuan</Text>
                            {accounts.length < MAX_ACCOUNTS && (
                                <TouchableOpacity
                                    onPress={() => setShowAdd(true)}
                                    hitSlop={10}
                                >
                                    <Text style={s.linkText}>+ Tambah</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {accounts.length === 0 ? (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={s.emptyCard}
                                onPress={() => setShowAdd(true)}
                            >
                                <View style={s.plusDot}>
                                    <Text style={s.plusText}>+</Text>
                                </View>
                                <Text style={s.emptyText}>
                                    Tambah rekening bank
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={s.group}>
                                {accounts.map((a, i) => {
                                    const bank = getBank(a.bank_code);
                                    const active = selected?.id === a.id;
                                    return (
                                        <TouchableOpacity
                                            key={a.id}
                                            activeOpacity={0.7}
                                            onPress={() => setSelected(a)}
                                            style={[
                                                s.accRow,
                                                i < accounts.length - 1 &&
                                                s.accRowBorder,
                                                active && s.accRowActive,
                                            ]}
                                        >
                                            <BankBadge bank={bank} />
                                            <View
                                                style={{
                                                    flex: 1,
                                                    marginLeft: 14,
                                                }}
                                            >
                                                <Text style={s.accTitle}>
                                                    {bank.label} •{' '}
                                                    {maskNumber(
                                                        a.account_number
                                                    )}
                                                </Text>
                                                <Text
                                                    style={s.accSub}
                                                    numberOfLines={1}
                                                >
                                                    {a.account_name}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() =>
                                                    handleDeleteAccount(a)
                                                }
                                                hitSlop={10}
                                                style={{ paddingHorizontal: 10 }}
                                            >
                                                <Text style={s.deleteText}>
                                                    Hapus
                                                </Text>
                                            </TouchableOpacity>
                                            <RadioDot selected={active} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Nominal */}
                        <Text style={[s.sectionTitle, { marginTop: 22 }]}>
                            Nominal penarikan
                        </Text>
                        <View
                            style={[
                                s.inputWrap,
                                !!amountError && {
                                    borderColor: COLORS.danger,
                                },
                            ]}
                        >
                            <Text style={s.inputPrefix}>Rp</Text>
                            <TextInput
                                style={s.input}
                                keyboardType="numeric"
                                value={
                                    amount
                                        ? Number(amount).toLocaleString('id-ID')
                                        : ''
                                }
                                onChangeText={(t) =>
                                    setAmount(t.replace(/[^0-9]/g, ''))
                                }
                                placeholder="0"
                                placeholderTextColor={COLORS.textLight}
                            />
                        </View>

                        {/* Hint minimal / maksimal */}
                        <Text
                            style={[
                                s.hint,
                                !!amountError && { color: COLORS.danger },
                            ]}
                        >
                            {amountError ??
                                `Minimal ${formatRp(minAmt)} • Maksimal ${formatRp(
                                    maxWithdraw
                                )}`}
                        </Text>

                        {/* ✅ Breakdown: nominal + fee = total */}
                        {amt > 0 && (
                            <View style={s.breakdownBox}>
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabel}>
                                        Nominal penarikan
                                    </Text>
                                    <Text style={s.breakdownValue}>
                                        {formatRp(amt)}
                                    </Text>
                                </View>
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabel}>
                                        Biaya admin
                                    </Text>
                                    <Text style={s.breakdownValue}>
                                        {formatRp(WITHDRAW_FEE)}
                                    </Text>
                                </View>
                                <View style={s.breakdownDivider} />
                                <View style={s.breakdownRow}>
                                    <Text style={s.breakdownLabelBold}>
                                        Total dipotong
                                    </Text>
                                    <Text style={s.breakdownValueBold}>
                                        {formatRp(totalDeduction)}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Quick amounts */}
                        <View style={s.chipsRow}>
                            {QUICK_AMOUNTS.map((v) => {
                                const disabled = v + WITHDRAW_FEE > balance;
                                const active = amount === String(v);
                                return (
                                    <TouchableOpacity
                                        key={v}
                                        disabled={disabled}
                                        activeOpacity={0.8}
                                        onPress={() => setAmount(String(v))}
                                        style={[
                                            s.chip,
                                            active && s.chipActive,
                                            disabled && { opacity: 0.4 },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                s.chipText,
                                                active && s.chipTextActive,
                                            ]}
                                        >
                                            {formatRp(v)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity
                                disabled={balance < minAmt + WITHDRAW_FEE}
                                activeOpacity={0.8}
                                onPress={() =>
                                    setAmount(String(Math.floor(maxWithdraw)))
                                }
                                style={[
                                    s.chip,
                                    balance < minAmt + WITHDRAW_FEE && {
                                        opacity: 0.4,
                                    },
                                ]}
                            >
                                <Text style={s.chipText}>Semua</Text>
                            </TouchableOpacity>
                        </View>

                        {selected && (
                            <Text style={s.footNote}>
                                Dana dikirim ke {getBank(selected.bank_code).label}.
                                Proses biasanya selesai dalam beberapa menit.
                            </Text>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>

                <BottomBar>
                    <TouchableOpacity
                        style={[s.btn, !canSubmit && { opacity: 0.5 }]}
                        disabled={!canSubmit}
                        onPress={() => setShowConfirm(true)}
                    >
                        <Text style={s.btnText}>
                            {amt >= minAmt
                                ? `Tarik ${formatRp(amt)} · Total ${formatRp(
                                    totalDeduction
                                )}`
                                : 'Lanjut'}
                        </Text>
                    </TouchableOpacity>
                </BottomBar>
            </>
        );
    };

    // ============================================================
    // RENDER: BERHASIL
    // ============================================================
    const renderSuccess = () => (
        <>
            <View style={s.successWrap}>
                <View style={s.successCircle}>
                    <Text style={s.successCheck}>✓</Text>
                </View>
                <Text style={s.successTitle}>Penarikan diproses</Text>
                <Text style={s.successAmount}>{formatRp(doneAmount)}</Text>
                <Text style={s.successSub}>
                    Biaya admin: {formatRp(WITHDRAW_FEE)}
                    {'\n'}
                    Total dipotong: {formatRp(doneTotal)}
                </Text>
                {doneAccount && (
                    <Text style={[s.successSub, { marginTop: 10 }]}>
                        Dikirim ke {getBank(doneAccount.bank_code).label}
                        {'\n'}
                        {doneAccount.account_number} •{' '}
                        {doneAccount.account_name}
                    </Text>
                )}
                <Text style={[s.successSub, { marginTop: 14 }]}>
                    Kamu akan menerima notifikasi saat dana sudah masuk.
                </Text>
            </View>
            <BottomBar>
                <TouchableOpacity
                    style={s.btn}
                    onPress={() => router.back()}
                >
                    <Text style={s.btnText}>Selesai</Text>
                </TouchableOpacity>
            </BottomBar>
        </>
    );

    // ============================================================
    // ROOT
    // ============================================================
    if (loading) {
        return (
            <View
                style={[
                    s.container,
                    s.center,
                    { paddingTop: insets.top },
                ]}
            >
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>

            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar
                barStyle="dark-content"
                backgroundColor={COLORS.card}
            />

            {step === 'form' ? renderForm() : renderSuccess()}

            {/* ============ Bottom sheet: Konfirmasi ============ */}
            <Modal
                visible={showConfirm}
                transparent
                animationType="slide"
                onRequestClose={() =>
                    !submitting && setShowConfirm(false)
                }
                statusBarTranslucent
            >
                <View style={s.overlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() =>
                            !submitting && setShowConfirm(false)
                        }
                    />
                    <View
                        style={[
                            s.sheet,
                            {
                                paddingBottom:
                                    Math.max(insets.bottom, 12) + 8,
                            },
                        ]}
                    >
                        <View style={s.sheetHandle} />
                        <Text style={s.sheetTitle}>
                            Konfirmasi penarikan
                        </Text>

                        {selected && (
                            <View style={s.destCard}>
                                <BankBadge
                                    bank={getBank(selected.bank_code)}
                                />
                                <View
                                    style={{ flex: 1, marginLeft: 12 }}
                                >
                                    <Text style={s.accTitle}>
                                        {
                                            getBank(selected.bank_code)
                                                .label
                                        }
                                    </Text>
                                    <Text style={s.accSub}>
                                        {selected.account_number} •{' '}
                                        {selected.account_name}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <View style={{ marginTop: 14 }}>
                            <SummaryRow
                                label="Nominal penarikan"
                                value={formatRp(amt)}
                            />
                            <SummaryRow
                                label="Biaya admin"
                                value={formatRp(WITHDRAW_FEE)}
                            />
                            <View style={s.sumDivider} />
                            <SummaryRow
                                label="Total dipotong"
                                value={formatRp(totalDeduction)}
                                bold
                            />
                            <SummaryRow
                                label="Saldo saat ini"
                                value={formatRp(balance)}
                            />
                            <SummaryRow
                                label="Sisa saldo"
                                value={formatRp(balance - totalDeduction)}
                            />
                        </View>

                        <TouchableOpacity
                            style={[
                                s.btn,
                                { marginTop: 18 },
                                submitting && { opacity: 0.6 },
                            ]}
                            onPress={handleWithdraw}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={s.btnText}>
                                    Konfirmasi & Tarik
                                </Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={s.btnGhost}
                            onPress={() => setShowConfirm(false)}
                            disabled={submitting}
                        >
                            <Text style={s.btnGhostText}>Batal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ============ Bottom sheet: Tambah rekening ============ */}
            <Modal
                visible={showAdd}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAdd(false)}
                statusBarTranslucent
            >
                <View style={s.overlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => {
                            Keyboard.dismiss();
                            setShowAdd(false);
                        }}
                    />

                    <View
                        style={[
                            s.sheet,
                            {
                                marginBottom: kbHeight,
                                paddingBottom:
                                    kbHeight > 0 ? 12 : Math.max(insets.bottom, 12) + 8,
                            },
                        ]}
                    >
                        <View style={s.sheetHandle} />
                        <Text style={s.sheetTitle}>Tambah rekening</Text>

                        <ScrollView
                            style={{ maxHeight: 460 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 8 }}
                        >
                            <Text style={s.fieldLabel}>Bank</Text>
                            <View style={s.bankGrid}>
                                {BANKS.map((b) => {
                                    const active = newBank === b.code;
                                    return (
                                        <TouchableOpacity
                                            key={b.code}
                                            activeOpacity={0.8}
                                            onPress={() =>
                                                setNewBank(b.code)
                                            }
                                            style={[
                                                s.bankItem,
                                                active &&
                                                s.bankItemActive,
                                            ]}
                                        >
                                            <BankBadge
                                                bank={b}
                                                size={36}
                                            />
                                            <Text
                                                style={s.bankItemText}
                                                numberOfLines={1}
                                            >
                                                {b.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={s.fieldLabel}>
                                Nomor rekening
                            </Text>
                            <TextInput
                                style={s.textField}
                                keyboardType="numeric"
                                value={newAccNum}
                                onChangeText={(t) =>
                                    setNewAccNum(
                                        t.replace(/[^0-9]/g, '')
                                    )
                                }
                                placeholder="1234567890"
                                placeholderTextColor={COLORS.textLight}
                            />

                            <Text style={s.fieldLabel}>
                                Nama pemilik
                            </Text>
                            <TextInput
                                style={s.textField}
                                value={newAccName}
                                onChangeText={setNewAccName}
                                placeholder="Sesuai nama di rekening"
                                placeholderTextColor={COLORS.textLight}
                                autoCapitalize="words"
                            />
                        </ScrollView>

                        <TouchableOpacity
                            style={[
                                s.btn,
                                { marginTop: 16 },
                                submitting && { opacity: 0.6 },
                            ]}
                            onPress={handleSaveAccount}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={s.btnText}>
                                    Simpan rekening
                                </Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={s.btnGhost}
                            onPress={() => setShowAdd(false)}
                        >
                            <Text style={s.btnGhostText}>Batal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <LoadingModal visible={loading && !submitting} />

            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={closeAlert}
            />
        </View>
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
    center: { alignItems: 'center', justifyContent: 'center' },

    // Header
    headerWrap: { backgroundColor: COLORS.card },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        height: 52,
    },
    backBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backIcon: {
        fontSize: 34,
        lineHeight: 36,
        color: COLORS.text,
        marginTop: -4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.text,
    },

    // Saldo
    balanceCard: {
        backgroundColor: COLORS.primary,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        ...shadow,
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontWeight: '600',
    },
    balanceValue: {
        color: '#fff',
        fontSize: 30,
        fontWeight: '900',
        marginTop: 6,
    },
    balanceHint: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        marginTop: 8,
    },

    // Warning utang
    warnBox: {
        backgroundColor: COLORS.dangerSoft,
        borderColor: COLORS.dangerBorder,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
    },
    warnTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.danger,
    },
    warnText: {
        fontSize: 12,
        color: '#7f2f2f',
        marginTop: 4,
        lineHeight: 18,
    },
    warnBtn: {
        alignSelf: 'flex-start',
        marginTop: 10,
        backgroundColor: COLORS.danger,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },
    warnBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

    // Section
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 10,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    linkText: {
        color: COLORS.primary,
        fontWeight: '800',
        fontSize: 14,
        marginBottom: 10,
    },

    // Daftar rekening
    group: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        overflow: 'hidden',
        ...shadow,
    },
    accRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        backgroundColor: COLORS.card,
    },
    accRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    accRowActive: { backgroundColor: COLORS.primarySoft },
    accTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    accSub: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    deleteText: {
        color: COLORS.danger,
        fontWeight: '700',
        fontSize: 12,
    },

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

    emptyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 20,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: COLORS.primaryBorder,
        backgroundColor: COLORS.primarySoft,
    },
    plusDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
        lineHeight: 17,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primaryDark,
    },

    // Input nominal
    inputWrap: {
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
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.text,
    },
    hint: {
        marginTop: 8,
        marginLeft: 4,
        fontSize: 12,
        color: COLORS.textMuted,
    },

    // Breakdown box
    breakdownBox: {
        marginTop: 14,
        padding: 14,
        borderRadius: 12,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    breakdownLabel: {
        fontSize: 13,
        color: COLORS.textMuted,
    },
    breakdownValue: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    breakdownLabelBold: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.text,
    },
    breakdownValueBold: {
        fontSize: 16,
        fontWeight: '900',
        color: COLORS.primary,
    },
    breakdownDivider: {
        height: 1,
        backgroundColor: COLORS.divider,
        marginVertical: 6,
    },

    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 14,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
    },
    chipActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primarySoft,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
    },
    chipTextActive: { color: COLORS.primaryDark },

    footNote: {
        marginTop: 20,
        fontSize: 12,
        lineHeight: 18,
        color: COLORS.textMuted,
        textAlign: 'center',
        paddingHorizontal: 12,
    },

    // Bottom bar & tombol
    bottom: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    btn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    btnGhost: {
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    btnGhostText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 14,
    },

    // Sheet
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(17,24,39,0.5)',
        justifyContent: 'flex-end',
    },
    overlayBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(17,24,39,0.5)',
    },
    sheet: {
        backgroundColor: COLORS.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        marginBottom: 14,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 14,
    },
    destCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        borderRadius: 14,
        padding: 12,
    },
    sumRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    sumLabel: { fontSize: 13, color: COLORS.textMuted },
    sumValue: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    sumLabelBold: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.text,
    },
    sumValueBold: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.primary,
    },
    sumDivider: {
        height: 1,
        backgroundColor: COLORS.divider,
        marginVertical: 6,
    },

    // Form tambah rekening
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textMuted,
        marginTop: 14,
        marginBottom: 8,
    },
    bankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    bankItem: {
        width: '31%',
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
        gap: 6,
    },
    bankItemActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primarySoft,
    },
    bankItemText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.text,
    },
    textField: {
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 16,
        color: COLORS.text,
        backgroundColor: COLORS.card,
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
    successTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.text,
    },
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
});