import { api } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    primary: '#1AAD5B',
    bg: '#F5F6F8',
    card: '#ffffff',
    border: '#e5e9f0',
    textDark: '#1f2933',
    textMuted: '#8a94a6',
    placeholder: '#a9b1bd',
};

type Profile = {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string;
    avatar_url?: string | null;
};

export default function EditProfileScreen() {
    const router = useRouter();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Muat profil setiap kali layar difokuskan — cache + refresh backend
    useFocusEffect(
        useCallback(() => {
            (async () => {
                // 1. Tampilkan cache dulu (biar tidak flicker)
                const raw = await AsyncStorage.getItem('profile');
                if (raw) {
                    const cached: Profile = JSON.parse(raw);
                    setProfile(cached);
                    setFullName(cached.full_name || '');
                    setPhone((cached.phone || '').replace(/^\+62/, ''));
                }

                // 2. Refresh dari backend
                try {
                    const fresh = await api.me();
                    setProfile(fresh);
                    setFullName(fresh.full_name || '');
                    setPhone((fresh.phone || '').replace(/^\+62/, ''));
                    await AsyncStorage.setItem('profile', JSON.stringify(fresh));
                } catch (err) {
                    console.warn('Gagal refresh profile:', err);
                } finally {
                    setLoading(false);
                }
            })();
        }, [])
    );

    const handleSave = async () => {
        if (!fullName.trim()) {
            Alert.alert('Data tidak lengkap', 'Nama tidak boleh kosong.');
            return;
        }

        setSaving(true);
        try {
            const payload: { full_name?: string; phone?: string } = {
                full_name: fullName.trim(),
            };
            if (phone.trim()) payload.phone = phone.trim();

            // 1. Kirim ke backend
            await api.updateProfile(payload);

            // 2. Ambil data terbaru dari backend (sumber kebenaran)
            const fresh = await api.me();
            setProfile(fresh);
            setFullName(fresh.full_name || '');
            setPhone((fresh.phone || '').replace(/^\+62/, ''));

            // 3. Perbarui cache
            await AsyncStorage.setItem('profile', JSON.stringify(fresh));

            Alert.alert('Berhasil', 'Profil kamu sudah diperbarui.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert('Gagal Menyimpan', err?.message || 'Coba lagi.');
        } finally {
            setSaving(false);
        }
    };

    const initial = (fullName || 'U').charAt(0).toUpperCase();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
                </Pressable>
                <Text style={styles.headerTitle}>Edit Profil</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Avatar inisial */}
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatar}>
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.avatarText}>{initial}</Text>
                            )}
                        </View>
                    </View>

                    {/* Nama */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Nama Lengkap</Text>
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
                            <Text style={styles.readonlyText}>{profile?.email || '-'}</Text>
                            <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
                        </View>
                        <Text style={styles.helpText}>
                            Email tidak dapat diubah karena dipakai untuk login.
                        </Text>
                    </View>

                    {/* Nomor HP */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Nomor HP</Text>
                        <View style={styles.phoneWrapper}>
                            <View style={styles.phonePrefix}>
                                <Text style={styles.phonePrefixText}>+62</Text>
                            </View>
                            <View style={styles.phoneDivider} />
                            <TextInput
                                style={styles.phoneInput}
                                placeholder="81234567890"
                                placeholderTextColor={COLORS.placeholder}
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                                editable={!loading}
                            />
                        </View>
                        <Text style={styles.helpText}>
                            Nomor ini dipakai driver untuk menghubungi kamu.
                        </Text>
                    </View>

                    {/* Simpan */}
                    <Pressable
                        style={[styles.saveBtn, (saving || loading) && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving || loading}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
                        )}
                    </Pressable>

                    {/* Ruang untuk FAB footer */}
                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>
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
    headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textDark },

    scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

    avatarWrap: { alignItems: 'center', marginBottom: 24 },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },

    field: { marginBottom: 18 },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textDark, marginBottom: 8 },
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
    phonePrefix: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    phonePrefixText: { fontSize: 14, color: COLORS.textDark, fontWeight: '600' },
    phoneDivider: {
        width: 1,
        height: 20,
        backgroundColor: COLORS.border,
        marginHorizontal: 10,
    },
    phoneInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.textDark },

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
});