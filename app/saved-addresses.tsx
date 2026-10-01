import AppAlert from '@/components/AppAlert';
import LoadingModal from '@/components/LoadingModal';
import { colors } from '@/constants/ojek-theme';
import { SavedKind, useSavedAddresses } from '@/hooks/use-saved-addresses';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

const KIND_META: Record<
    SavedKind,
    { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
    home: { label: 'Rumah', icon: 'home-outline' },
    office: { label: 'Kantor', icon: 'business-outline' },
};

// Jeda agar dua modal tidak bentrok saat berganti
const MODAL_GAP_MS = Platform.OS === 'ios' ? 400 : 150;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SavedAddressesScreen() {
    const insets = useSafeAreaInsets();
    const { saved, remove, refresh, loading } = useSavedAddresses();

    const [actionLoading, setActionLoading] = useState(false);

    // Alert state
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

    const hideAlert = () => {
        setAlertState((a) => ({ ...a, visible: false }));
    };

    // Reload saat halaman fokus
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    // ============================================================
    // Hapus alamat
    // 1) Tombol Hapus -> alert konfirmasi (belum menghapus apa pun)
    // 2) "Ya, hapus" -> alert ditutup -> LoadingModal -> remove()
    // ============================================================
    const runDelete = async (kind: SavedKind) => {
        hideAlert();
        await wait(MODAL_GAP_MS); // tunggu alert benar-benar tertutup

        setActionLoading(true);
        try {
            await remove(kind);
            setActionLoading(false);
        } catch (err: any) {
            setActionLoading(false);
            await wait(MODAL_GAP_MS); // tunggu loading tertutup
            showAlert(
                'Gagal Menghapus',
                err?.message ?? 'Coba lagi beberapa saat.',
                [{ text: 'Mengerti' }]
            );
        }
    };

    const confirmDelete = (kind: SavedKind) => {
        const meta = KIND_META[kind];
        showAlert(
            `Hapus alamat ${meta.label.toLowerCase()}?`,
            'Alamat ini akan dihapus dari daftar. Kamu bisa menyimpannya lagi kapan saja.',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, hapus',
                    style: 'destructive',
                    onPress: () => runDelete(kind),
                },
            ]
        );
    };

    // ============================================================
    // Edit / Tambah
    // ============================================================
    const openEdit = (kind: SavedKind) => {
        router.push(`/save-address/${kind}?mode=edit` as any);
    };

    const openCreate = (kind: SavedKind) => {
        router.push(`/save-address/${kind}?mode=create` as any);
    };

    const kinds: SavedKind[] = ['home', 'office'];

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={s.header}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={10}
                    style={s.backBtn}
                >
                    <Ionicons
                        name="arrow-back"
                        size={22}
                        color={colors.text}
                    />
                </Pressable>
                <Text style={s.headerTitle}>Alamat Tersimpan</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: insets.bottom + 24,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Intro */}
                <Text style={s.intro}>
                    Simpan alamat favoritmu biar lebih cepat saat pesan
                    ojek, kirim paket, atau pesan makanan.
                </Text>

                {/* List alamat */}
                {kinds.map((kind) => {
                    const place = saved[kind];
                    const meta = KIND_META[kind];

                    return (
                        <View key={kind} style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={s.iconWrap}>
                                    <Ionicons
                                        name={meta.icon}
                                        size={22}
                                        color={colors.primary}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.cardTitle}>
                                        {meta.label}
                                    </Text>
                                    {place ? (
                                        <>
                                            <Text
                                                style={s.cardName}
                                                numberOfLines={1}
                                            >
                                                {place.name}
                                            </Text>
                                            <Text
                                                style={s.cardAddress}
                                                numberOfLines={2}
                                            >
                                                {place.address}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={s.cardEmpty}>
                                            Belum disimpan
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {/* Actions */}
                            <View style={s.cardActions}>
                                {place ? (
                                    <>
                                        <Pressable
                                            style={s.actionBtn}
                                            onPress={() => openEdit(kind)}
                                        >
                                            <Ionicons
                                                name="pencil"
                                                size={14}
                                                color={colors.primary}
                                            />
                                            <Text style={s.actionBtnText}>
                                                Edit
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            style={[
                                                s.actionBtn,
                                                s.actionBtnDanger,
                                            ]}
                                            onPress={() =>
                                                confirmDelete(kind)
                                            }
                                        >
                                            <Ionicons
                                                name="trash-outline"
                                                size={14}
                                                color="#e5484d"
                                            />
                                            <Text
                                                style={[
                                                    s.actionBtnText,
                                                    { color: '#e5484d' },
                                                ]}
                                            >
                                                Hapus
                                            </Text>
                                        </Pressable>
                                    </>
                                ) : (
                                    <Pressable
                                        style={s.addBtn}
                                        onPress={() => openCreate(kind)}
                                    >
                                        <Ionicons
                                            name="add"
                                            size={16}
                                            color={colors.primary}
                                        />
                                        <Text style={s.addBtnText}>
                                            Tambah Alamat
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    );
                })}

                {loading && (
                    <View style={{ paddingVertical: 12 }}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                )}
            </ScrollView>

            {/* AppAlert */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={hideAlert}
            />

            {/* LoadingModal */}
            <LoadingModal visible={actionLoading} />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F6F8' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: colors.text,
    },

    intro: {
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 19,
        marginBottom: 16,
    },

    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#E9F9EF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.text,
    },
    cardName: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginTop: 2,
    },
    cardAddress: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 4,
        lineHeight: 17,
    },
    cardEmpty: {
        fontSize: 13,
        color: colors.textMuted,
        fontStyle: 'italic',
        marginTop: 4,
    },

    cardActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    actionBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#E9F9EF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    actionBtnDanger: { backgroundColor: '#FDE9E9' },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.primary,
    },
    addBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    addBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.primary,
    },
});