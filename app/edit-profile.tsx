import AppAlert from '@/components/AppAlert';
import LoadingModal from '@/components/LoadingModal';
import { api } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

// 🎨 Warna customer (biru)
const COLORS = {
    primary: '#40a3ea',
    primarySoft: '#EAF4FD',
    bg: '#F5F6F8',
    card: '#ffffff',
    border: '#e5e9f0',
    textDark: '#1f2933',
    textMuted: '#8a94a6',
    placeholder: '#a9b1bd',
    danger: '#e5484d',
    secondary: '#e68515',
};

type Profile = {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string;
    avatar_url?: string | null;
};

type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

export default function EditProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets(); // ⬅️ TAMBAH

    const [profile, setProfile] = useState<Profile | null>(null);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Avatar
    const [localAvatar, setLocalAvatar] = useState<string | null>(null);
    const [avatarModalVisible, setAvatarModalVisible] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    // AppAlert
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

    // ============================================================
    // Load profile
    // ============================================================
    useFocusEffect(
        useCallback(() => {
            (async () => {
                const raw = await AsyncStorage.getItem('profile');
                if (raw) {
                    const cached: Profile = JSON.parse(raw);
                    setProfile(cached);
                    setFullName(cached.full_name || '');
                    setPhone(
                        (cached.phone || '').replace(/^\+62/, '')
                    );
                }

                try {
                    const fresh = await api.me();
                    setProfile(fresh);
                    setFullName(fresh.full_name || '');
                    setPhone((fresh.phone || '').replace(/^\+62/, ''));
                    await AsyncStorage.setItem(
                        'profile',
                        JSON.stringify(fresh)
                    );
                } catch (err) {
                    console.warn('Gagal refresh profile:', err);
                } finally {
                    setLoading(false);
                }
            })();
        }, [])
    );

    // ============================================================
    // Foto profil
    // ============================================================
    const uploadAvatar = async (
        asset: ImagePicker.ImagePickerAsset
    ) => {
        setLocalAvatar(asset.uri);
        setAvatarUploading(true);
        try {
            const res = await api.uploadAvatar(
                asset.uri,
                asset.mimeType ?? 'image/jpeg'
            );

            if (profile) {
                const next = {
                    ...profile,
                    avatar_url: res.avatar_url,
                };
                setProfile(next);
                await AsyncStorage.setItem(
                    'profile',
                    JSON.stringify(next)
                );
            }
            setLocalAvatar(null);
        } catch (err: any) {
            setLocalAvatar(null);
            showAlert(
                'Gagal mengunggah foto',
                err?.message ?? 'Coba lagi beberapa saat.'
            );
        } finally {
            setAvatarUploading(false);
        }
    };

    const pickAvatar = async (source: 'camera' | 'gallery') => {
        setAvatarModalVisible(false);
        await new Promise((r) =>
            setTimeout(r, Platform.OS === 'ios' ? 500 : 150)
        );

        try {
            if (source === 'camera') {
                const perm =
                    await ImagePicker.requestCameraPermissionsAsync();
                if (!perm.granted) {
                    showAlert(
                        'Izin kamera diperlukan',
                        'Aktifkan izin kamera di pengaturan untuk mengambil foto.',
                        [
                            { text: 'Batal', style: 'cancel' },
                            {
                                text: 'Buka Pengaturan',
                                onPress: () => Linking.openSettings(),
                            },
                        ]
                    );
                    return;
                }
            } else {
                const perm =
                    await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                    showAlert(
                        'Izin galeri diperlukan',
                        'Aktifkan izin galeri di pengaturan untuk memilih foto.',
                        [
                            { text: 'Batal', style: 'cancel' },
                            {
                                text: 'Buka Pengaturan',
                                onPress: () => Linking.openSettings(),
                            },
                        ]
                    );
                    return;
                }
            }

            const options: ImagePicker.ImagePickerOptions = {
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            };

            const result =
                source === 'camera'
                    ? await ImagePicker.launchCameraAsync(options)
                    : await ImagePicker.launchImageLibraryAsync(options);

            if (result.canceled || !result.assets?.[0]) return;
            await uploadAvatar(result.assets[0]);
        } catch (err: any) {
            console.warn('[PROFILE] Gagal pilih foto:', err?.message);
            showAlert(
                'Gagal',
                'Tidak dapat membuka kamera atau galeri.'
            );
        }
    };

    // ============================================================
    // Simpan profil
    // ============================================================
    const handleSave = async () => {
        if (!fullName.trim()) {
            showAlert(
                'Data tidak lengkap',
                'Nama tidak boleh kosong.'
            );
            return;
        }

        setSaving(true);
        try {
            const payload: { full_name?: string; phone?: string } = {
                full_name: fullName.trim(),
            };
            if (phone.trim()) payload.phone = phone.trim();

            await api.updateProfile(payload);

            const fresh = await api.me();
            setProfile(fresh);
            setFullName(fresh.full_name || '');
            setPhone((fresh.phone || '').replace(/^\+62/, ''));
            await AsyncStorage.setItem(
                'profile',
                JSON.stringify(fresh)
            );

            showAlert(
                'Berhasil',
                'Profil kamu sudah diperbarui.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back(),
                    },
                ]
            );
        } catch (err: any) {
            showAlert(
                'Gagal Menyimpan',
                err?.message || 'Coba lagi.'
            );
        } finally {
            setSaving(false);
        }
    };

    // ============================================================
    // Avatar helpers
    // ============================================================
    const initial = (fullName || 'U').charAt(0).toUpperCase();
    const avatarUri = localAvatar ?? profile?.avatar_url ?? null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.backBtn}
                    onPress={() => router.back()}
                >
                    <Ionicons
                        name="arrow-back"
                        size={22}
                        color={COLORS.textDark}
                    />
                </Pressable>
                <Text style={styles.headerTitle}>Edit Profil</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    // ⬇️ GANTI: pakai array + paddingBottom insets
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + 40 },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ===== AVATAR BISA DIKLIK ===== */}
                    <View style={styles.avatarWrap}>
                        <Pressable
                            style={styles.avatarPressable}
                            onPress={() =>
                                setAvatarModalVisible(true)
                            }
                            disabled={avatarUploading}
                        >
                            {avatarUri ? (
                                <Image
                                    source={{ uri: avatarUri }}
                                    style={styles.avatarImg}
                                />
                            ) : (
                                <View style={styles.avatar}>
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text
                                            style={
                                                styles.avatarText
                                            }
                                        >
                                            {initial}
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Overlay loading */}
                            {avatarUploading && (
                                <View style={styles.avatarLoading}>
                                    <ActivityIndicator color="#fff" />
                                </View>
                            )}

                            {/* Badge kamera */}
                            <View style={styles.cameraBadge}>
                                <Ionicons
                                    name="camera"
                                    size={14}
                                    color="#fff"
                                />
                            </View>
                        </Pressable>

                        <Text style={styles.avatarHint}>
                            Ketuk untuk ganti foto
                        </Text>
                    </View>

                    {/* Nama */}
                    <View style={styles.field}>
                        <Text style={styles.label}>
                            Nama Lengkap
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nama kamu"
                            placeholderTextColor={COLORS.placeholder}
                            value={fullName}
                            onChangeText={setFullName}
                            editable={!loading}
                        />
                    </View>

                    {/* Email (readonly) */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.readonlyInput}>
                            <Text style={styles.readonlyText}>
                                {profile?.email || '-'}
                            </Text>
                            <Ionicons
                                name="lock-closed"
                                size={14}
                                color={COLORS.textMuted}
                            />
                        </View>
                        <Text style={styles.helpText}>
                            Email tidak dapat diubah karena dipakai
                            untuk login.
                        </Text>
                    </View>

                    {/* Nomor HP */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Nomor HP</Text>
                        <View style={styles.phoneWrapper}>
                            <View style={styles.phonePrefix}>
                                <Text style={styles.phonePrefixText}>
                                    +62
                                </Text>
                            </View>
                            <View style={styles.phoneDivider} />
                            <TextInput
                                style={styles.phoneInput}
                                placeholder="81234567890"
                                placeholderTextColor={
                                    COLORS.placeholder
                                }
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                                editable={!loading}
                            />
                        </View>
                        <Text style={styles.helpText}>
                            Nomor ini dipakai driver untuk menghubungi
                            kamu.
                        </Text>
                    </View>

                    {/* Simpan */}
                    <Pressable
                        style={[
                            styles.saveBtn,
                            (saving || loading) &&
                            styles.saveBtnDisabled,
                        ]}
                        onPress={handleSave}
                        disabled={saving || loading}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>
                                Simpan Perubahan
                            </Text>
                        )}
                    </Pressable>

                    {/* ⬇️ HAPUS spacer <View style={{ height: 120 }} /> — 
                        sudah diganti paddingBottom insets di atas */}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ===== MODAL PILIH SUMBER FOTO ===== */}
            <Modal
                visible={avatarModalVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setAvatarModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback
                        onPress={() => setAvatarModalVisible(false)}
                    >
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>

                    {/* ⬇️ GANTI: pakai array + paddingBottom insets */}
                    <View
                        style={[
                            styles.modalSheet,
                            { paddingBottom: insets.bottom + 24 },
                        ]}
                    >
                        <Text style={styles.modalTitle}>
                            Foto Profil
                        </Text>
                        <Text style={styles.modalSub}>
                            Pilih sumber foto untuk profilmu
                        </Text>

                        <Pressable
                            style={styles.optionRow}
                            onPress={() => pickAvatar('camera')}
                        >
                            <View
                                style={[
                                    styles.optionIcon,
                                    {
                                        backgroundColor: `${COLORS.primary}25`,
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="camera-outline"
                                    size={20}
                                    color={COLORS.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.optionLabel}>
                                    Ambil Foto
                                </Text>
                                <Text style={styles.optionDesc}>
                                    Gunakan kamera sekarang
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            style={styles.optionRow}
                            onPress={() => pickAvatar('gallery')}
                        >
                            <View
                                style={[
                                    styles.optionIcon,
                                    {
                                        backgroundColor: `${COLORS.secondary}25`,
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="images-outline"
                                    size={20}
                                    color={COLORS.secondary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.optionLabel}>
                                    Pilih dari Galeri
                                </Text>
                                <Text style={styles.optionDesc}>
                                    Ambil foto yang sudah ada
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            style={styles.closeModalBtn}
                            onPress={() => setAvatarModalVisible(false)}
                        >
                            <Text style={styles.closeModalText}>
                                Batal
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* ===== APP ALERT ===== */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={hideAlert}
            />

            {/* ===== LOADING MODAL (upload foto) ===== */}
            <LoadingModal visible={avatarUploading} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.textDark,
    },

    // ⬇️ HAPUS paddingBottom statis — biar dinamis via inline insets
    scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

    // ===== Avatar =====
    avatarWrap: { alignItems: 'center', marginBottom: 24 },
    avatarPressable: {
        position: 'relative',
        width: 100,
        height: 100,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImg: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: '800',
        color: '#fff',
    },
    avatarLoading: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        borderWidth: 3,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarHint: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 10,
    },

    // ===== Field =====
    field: { marginBottom: 18 },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textDark,
        marginBottom: 8,
    },
    input: {
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: COLORS.textDark,
    },
    readonlyInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#eff2f7',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
    },
    readonlyText: { fontSize: 14, color: COLORS.textMuted },

    phoneWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    phonePrefix: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    phonePrefixText: {
        fontSize: 14,
        color: COLORS.textDark,
        fontWeight: '600',
    },
    phoneDivider: {
        width: 1,
        height: 20,
        backgroundColor: COLORS.border,
        marginHorizontal: 10,
    },
    phoneInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 14,
        color: COLORS.textDark,
    },

    helpText: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 6 },

    saveBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 30,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 8,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // ===== Modal foto =====
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 24,
        // ⬇️ HAPUS paddingBottom: 32 — diganti inline { paddingBottom: insets.bottom + 24 }
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textDark,
        marginBottom: 4,
    },
    modalSub: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginBottom: 16,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        marginBottom: 10,
    },
    optionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionLabel: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textDark,
    },
    optionDesc: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    closeModalBtn: {
        marginTop: 8,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
    },
    closeModalText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textDark,
    },
});