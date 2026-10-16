// app/keranjang.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

import AppAlert from '@/components/AppAlert';
import { useCart } from '@/lib/cart';

const BLUE = '#2F86EB';
const GREEN = '#1AA260';
const RED = '#DC2626';

const fmtRp = (n: number) =>
    `Rp ${Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

// ============================================================
// TYPES
// ============================================================
type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

// ============================================================
// SCREEN
// ============================================================
export default function KeranjangScreen() {
    const insets = useSafeAreaInsets();
    const cart = useCart();
    const [generalNote, setGeneralNote] = useState(cart.generalNote);

    // ============================================================
    // ✅ ALERT STATE — pakai AppAlert
    // ============================================================
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons?: AlertButton[];
    }>({
        visible: false,
        title: '',
        message: '',
        buttons: undefined,
    });

    const showAlert = (
        title: string,
        message: string,
        buttons?: AlertButton[]
    ) => {
        setAlertState({ visible: true, title, message, buttons });
    };

    const hideAlert = () =>
        setAlertState((a) => ({ ...a, visible: false }));

    const count = cart.totalQty();
    const total = cart.totalPrice();
    const merchantName = cart.items[0]?.merchantName ?? 'Resto';

    // ============================================================
    // ✅ CHECKOUT
    // ============================================================
    const goToCheckout = () => {
        if (count === 0) return;

        // Simpan general note ke cart
        cart.setGeneralNote(generalNote);

        router.push({
            pathname: '/checkout',
            params: {
                merchantId: cart.merchantId ?? '',
            },
        } as any);
    };

    // ============================================================
    // ✅ HAPUS ITEM — pakai showAlert
    // ============================================================
    const removeItem = (id: number, name: string) => {
        showAlert(
            'Hapus item?',
            `"${name}" akan dihapus dari keranjang.`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: () => {
                        hideAlert();
                        cart.remove(id);
                    },
                },
            ]
        );
    };

    // ============================================================
    // ✅ KOSONGKAN KERANJANG — pakai showAlert
    // ============================================================
    const clearCart = () => {
        showAlert(
            'Kosongkan keranjang?',
            'Semua item akan dihapus.',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Kosongkan',
                    style: 'destructive',
                    onPress: () => {
                        hideAlert();
                        cart.clear();
                    },
                },
            ]
        );
    };

    // ============================================================
    // EMPTY STATE
    // ============================================================
    if (count === 0) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={s.backBtn}
                    >
                        <Ionicons
                            name="arrow-back"
                            size={22}
                            color="#1B1B1B"
                        />
                    </Pressable>
                    <Text style={s.title}>Keranjang</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={s.center}>
                    <View style={s.emptyIcon}>
                        <Ionicons
                            name="cart-outline"
                            size={56}
                            color="#B0B5BD"
                        />
                    </View>
                    <Text style={s.emptyTitle}>
                        Keranjang masih kosong
                    </Text>

                </View>

                <AppAlert
                    visible={alertState.visible}
                    title={alertState.title}
                    message={alertState.message}
                    buttons={
                        alertState.buttons ?? [{ text: 'OK' }]
                    }
                    onClose={hideAlert}
                />
            </SafeAreaView>
        );
    }

    // ============================================================
    // WITH ITEMS
    // ============================================================
    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            {/* Header */}
            <View style={s.header}>
                <Pressable
                    onPress={() => router.back()}
                    style={s.backBtn}
                >
                    <Ionicons
                        name="arrow-back"
                        size={22}
                        color="#1B1B1B"
                    />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={s.title}>Keranjang</Text>
                    <Text style={s.subtitle} numberOfLines={1}>
                        {merchantName}
                    </Text>
                </View>
                <Pressable
                    onPress={clearCart}
                    style={s.clearBtn}
                >
                    <Ionicons
                        name="trash-outline"
                        size={20}
                        color={RED}
                    />
                </Pressable>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={
                    Platform.OS === 'ios' ? 'padding' : undefined
                }
            >
                <ScrollView
                    contentContainerStyle={s.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ================================================ */}
                    {/* DAFTAR ITEM                                     */}
                    {/* ================================================ */}
                    <View style={s.card}>
                        {cart.items.map((item, idx) => (
                            <View
                                key={item.id}
                                style={[
                                    s.itemRow,
                                    idx === cart.items.length - 1 &&
                                    s.itemRowLast,
                                ]}
                            >
                                {item.image_url ? (
                                    <Image
                                        source={{
                                            uri: item.image_url,
                                        }}
                                        style={s.itemImg}
                                    />
                                ) : (
                                    <View
                                        style={[
                                            s.itemImg,
                                            s.itemImgEmpty,
                                        ]}
                                    >
                                        <Ionicons
                                            name="fast-food-outline"
                                            size={26}
                                            color="#B0B5BD"
                                        />
                                    </View>
                                )}

                                <View style={s.itemInfo}>
                                    <Text
                                        style={s.itemName}
                                        numberOfLines={2}
                                    >
                                        {item.name}
                                    </Text>
                                    <Text style={s.itemPrice}>
                                        {fmtRp(item.price)}
                                    </Text>

                                    {/* Note per item (opsional) */}
                                    {!!item.note && (
                                        <View style={s.noteChip}>
                                            <Ionicons
                                                name="chatbubble-outline"
                                                size={11}
                                                color={BLUE}
                                            />
                                            <Text
                                                style={s.noteChipText}
                                                numberOfLines={1}
                                            >
                                                {item.note}
                                            </Text>
                                        </View>
                                    )}

                                    <Pressable
                                        style={s.deleteBtn}
                                        onPress={() =>
                                            removeItem(
                                                item.id,
                                                item.name
                                            )
                                        }
                                    >
                                        <Ionicons
                                            name="trash-outline"
                                            size={14}
                                            color={RED}
                                        />
                                        <Text style={s.deleteBtnText}>
                                            Hapus
                                        </Text>
                                    </Pressable>
                                </View>

                                {/* Qty control */}
                                <View style={s.qtyBox}>
                                    <Pressable
                                        style={s.qtyBtn}
                                        onPress={() =>
                                            cart.dec(item.id)
                                        }
                                    >
                                        <Ionicons
                                            name={
                                                item.qty === 1
                                                    ? 'trash-outline'
                                                    : 'remove'
                                            }
                                            size={16}
                                            color={
                                                item.qty === 1
                                                    ? RED
                                                    : BLUE
                                            }
                                        />
                                    </Pressable>
                                    <Text style={s.qtyNum}>
                                        {item.qty}
                                    </Text>
                                    <Pressable
                                        style={s.qtyBtn}
                                        onPress={() =>
                                            cart.inc(item.id)
                                        }
                                    >
                                        <Ionicons
                                            name="add"
                                            size={16}
                                            color={BLUE}
                                        />
                                    </Pressable>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* ================================================ */}
                    {/* CATATAN UMUM                                    */}
                    {/* ================================================ */}
                    <View style={s.card}>
                        <View style={s.noteHeader}>
                            <Ionicons
                                name="chatbubble-outline"
                                size={18}
                                color={BLUE}
                            />
                            <Text style={s.noteTitle}>
                                Catatan untuk resto
                            </Text>
                        </View>
                        <Text style={s.noteSub}>
                            Sampaikan permintaan khusus kamu, mis.
                            jangan pakai sambal
                        </Text>
                        <TextInput
                            style={s.noteInput}
                            placeholder="Contoh: jangan pakai sambal ya, tolong dipisah..."
                            placeholderTextColor="#8A8F98"
                            value={generalNote}
                            onChangeText={(text) => {
                                setGeneralNote(text);
                                cart.setGeneralNote(text);
                            }}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            maxLength={200}
                        />
                        <Text style={s.noteHint}>
                            {generalNote.length}/200 karakter
                        </Text>
                    </View>

                    {/* ================================================ */}
                    {/* RINGKASAN HARGA                                 */}
                    {/* ================================================ */}
                    <View style={s.card}>
                        <Text style={s.summaryTitle}>
                            Ringkasan Pesanan
                        </Text>

                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>
                                Subtotal ({count} item)
                            </Text>
                            <Text style={s.summaryValue}>
                                {fmtRp(total)}
                            </Text>
                        </View>

                        <View style={s.summaryRow}>
                            <Text style={s.summaryLabel}>
                                Ongkos kirim
                            </Text>
                            <Text style={s.summaryValueMuted}>
                                Dihitung di checkout
                            </Text>
                        </View>

                        <View style={s.divider} />

                        <View style={s.summaryRow}>
                            <Text style={s.summaryTotalLabel}>
                                Subtotal
                            </Text>
                            <Text style={s.summaryTotalValue}>
                                {fmtRp(total)}
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ==================================================== */}
            {/* FOOTER CTA                                           */}
            {/* ==================================================== */}
            <View
                style={[
                    s.footer,
                    { paddingBottom: Math.max(insets.bottom, 12) },
                ]}
            >
                <View style={{ flex: 1 }}>
                    <Text style={s.footerLabel}>Subtotal</Text>
                    <Text style={s.footerTotal}>
                        {fmtRp(total)}
                    </Text>
                </View>

                <Pressable style={s.cta} onPress={goToCheckout}>
                    <Text style={s.ctaText}>Lanjut Checkout</Text>
                    <Ionicons
                        name="arrow-forward"
                        size={18}
                        color="#fff"
                    />
                </Pressable>
            </View>

            {/* ✅ AppAlert */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons ?? [{ text: 'OK' }]}
                onClose={hideAlert}
            />
        </SafeAreaView>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F6F8FB' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#EEF0F3',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1B1B1B',
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    clearBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Empty
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 24,
    },
    emptyIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#F1F2F4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1B1B1B',
    },
    emptyHint: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    emptyBtn: {
        marginTop: 16,
        paddingHorizontal: 24,
        height: 48,
        borderRadius: 24,
        backgroundColor: BLUE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },

    // Scroll
    scroll: { padding: 16, gap: 12 },

    // Card
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
    },

    // Item
    itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F5',
        gap: 12,
    },
    itemRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    itemImg: {
        width: 72,
        height: 72,
        borderRadius: 12,
    },
    itemImgEmpty: {
        backgroundColor: '#F1F2F4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: { flex: 1, gap: 4 },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1B1B1B',
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '800',
        color: GREEN,
    },
    noteChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EAF3FE',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    noteChipText: {
        fontSize: 11,
        color: BLUE,
        fontWeight: '600',
        maxWidth: 140,
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        marginTop: 6,
    },
    deleteBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: RED,
    },

    // Qty
    qtyBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    qtyBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#CFE2FA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyNum: {
        minWidth: 24,
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '800',
        color: '#1B1B1B',
    },

    // Note
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    noteTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1B1B1B',
    },
    noteSub: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 10,
    },
    noteInput: {
        minHeight: 80,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#1B1B1B',
    },
    noteHint: {
        fontSize: 11,
        color: '#8A8F98',
        textAlign: 'right',
        marginTop: 6,
    },

    // Summary
    summaryTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1B1B1B',
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    summaryLabel: { fontSize: 13, color: '#6B7280' },
    summaryValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1B1B1B',
    },
    summaryValueMuted: {
        fontSize: 12,
        color: '#8A8F98',
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    summaryTotalLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1B1B1B',
    },
    summaryTotalValue: {
        fontSize: 16,
        fontWeight: '800',
        color: GREEN,
    },

    // Footer
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#EEF0F3',
    },
    footerLabel: { fontSize: 11, color: '#6B7280' },
    footerTotal: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1B1B1B',
    },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: BLUE,
        paddingHorizontal: 22,
        height: 52,
        borderRadius: 26,
    },
    ctaText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },
});