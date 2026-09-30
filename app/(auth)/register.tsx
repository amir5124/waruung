import { api, saveToken } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/push';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    primary: '#40a3ea',
    secondary: '#e68515',
    bg: '#ffffff',
    card: '#f7f9fb',
    border: '#e5e9f0',
    textDark: '#1f2933',
    textMuted: '#8a94a6',
    placeholder: '#a9b1bd',
};

export default function RegisterScreen() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agree, setAgree] = useState(false);
    const [loading, setLoading] = useState(false);

    // State untuk alert bottom sheet
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const showErrorModal = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        // Di iOS, modal baru tidak bisa muncul saat modal loading masih menutup
        setTimeout(() => setErrorModalVisible(true), Platform.OS === 'ios' ? 400 : 0);
    };

    const handleSignUp = async () => {
        // Validasi dasar
        if (!agree) {
            showErrorModal('Belum Disetujui', 'Kamu harus menyetujui Syarat & Ketentuan dulu.');
            return;
        }
        if (!name.trim() || !email.trim() || !password.trim()) {
            showErrorModal('Data belum lengkap', 'Nama, email, dan kata sandi wajib diisi.');
            return;
        }
        if (password.length < 6) {
            showErrorModal('Kata Sandi Terlalu Pendek', 'Kata sandi minimal 6 karakter.');
            return;
        }

        setLoading(true);
        console.log('[REGISTER] Mulai proses daftar untuk:', email.trim().toLowerCase());

        try {
            // 1. Register ke backend
            console.log('[REGISTER] Request ke /api/auth/register...');
            const res = await api.register({
                email: email.trim().toLowerCase(),
                password,
                full_name: name.trim(),
                role: 'customer',
            });
            console.log('[REGISTER] Response berhasil:', {
                userId: res.userId,
                role: res.role,
                tokenLength: res.token?.length,
            });

            // 2. Simpan JWT token
            await saveToken(res.token);
            console.log('[REGISTER] JWT token tersimpan di SecureStore');

            // 3. Update nomor HP kalau diisi (gagal tidak menghalangi registrasi)
            if (phone.trim()) {
                try {
                    await api.updateProfile({ phone: phone.trim() });
                    console.log('[REGISTER] Nomor HP tersimpan');
                } catch (err: any) {
                    console.warn('[REGISTER] Gagal simpan nomor HP:', err.message);
                }
            }

            // 4. Cache profil + registrasi push notification
            //    (TERPISAH dari registrasi: kalau gagal, akun tetap berhasil dibuat)
            try {
                const profile = await api.me();
                await AsyncStorage.setItem('profile', JSON.stringify(profile));
                console.log('[REGISTER] Profil tersimpan di AsyncStorage');

                console.log('[REGISTER] Memulai registrasi push notification...');
                const pushToken = await registerForPushNotifications();
                if (pushToken) {
                    console.log('[REGISTER] Push token berhasil didapat:', pushToken);
                    const updated = await api.me();
                    await AsyncStorage.setItem('profile', JSON.stringify(updated));
                } else {
                    console.warn('[REGISTER] Push token tidak didapat (mungkin izin ditolak atau di emulator)');
                }
            } catch (postErr: any) {
                console.warn('[REGISTER] Langkah lanjutan gagal (registrasi tetap lanjut):', postErr?.message);
            }

            // 5. Redirect ke tab utama
            console.log('[REGISTER] Registrasi sukses, redirect ke tabs');
            router.replace('/(tabs)' as any);
        } catch (err: any) {
            console.error('[REGISTER] Gagal:', err.message);
            showErrorModal('Gagal Daftar', err.message || 'Terjadi kesalahan, coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignUp = () => {
        console.log('Daftar dengan Google');
        showErrorModal('Segera Hadir', 'Daftar dengan Google belum tersedia.');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>Buat Akun</Text>
                        <Text style={styles.subtitle}>
                            Lengkapi data di bawah ini atau daftar dengan akun sosial media
                        </Text>
                    </View>

                    {/* Nama */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Nama Lengkap</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nama kamu"
                            placeholderTextColor={COLORS.placeholder}
                            value={name}
                            onChangeText={setName}
                            editable={!loading}
                        />
                    </View>

                    {/* Nomor HP */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Nomor HP</Text>
                        <View style={styles.phoneWrapper}>
                            <View style={styles.phonePrefix}>
                                <Text style={styles.phonePrefixText}>+62</Text>
                                <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
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
                    </View>

                    {/* Email */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="contoh@gmail.com"
                            placeholderTextColor={COLORS.placeholder}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={email}
                            onChangeText={setEmail}
                            editable={!loading}
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Kata Sandi</Text>
                        <View style={styles.passwordWrapper}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Buat kata sandi"
                                placeholderTextColor={COLORS.placeholder}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                                editable={!loading}
                            />
                            <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                                <Ionicons
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color={COLORS.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Checkbox S&K */}
                    <TouchableOpacity
                        style={styles.agreeRow}
                        activeOpacity={0.8}
                        onPress={() => setAgree((v) => !v)}
                    >
                        <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
                            {agree && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                        </View>
                        <Text style={styles.agreeText}>
                            Saya setuju dengan{' '}
                            <Text style={styles.footerLink} onPress={() => router.push('/')}>
                                Syarat & Ketentuan
                            </Text>
                        </Text>
                    </TouchableOpacity>

                    {/* Tombol Daftar (tanpa spinner, loading pakai modal) */}
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            (!agree || loading) && styles.primaryButtonDisabled,
                        ]}
                        activeOpacity={0.85}
                        onPress={handleSignUp}
                        disabled={!agree || loading}
                    >
                        <Text style={styles.primaryButtonText}>Daftar</Text>
                    </TouchableOpacity>

                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>Atau daftar dengan</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                        style={styles.googleButton}
                        activeOpacity={0.85}
                        onPress={handleGoogleSignUp}
                        disabled={loading}
                    >
                        <AntDesign name="google" size={20} color="#EA4335" />
                        <Text style={styles.googleButtonText}>Daftar dengan Google</Text>
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Sudah punya akun? </Text>
                        <TouchableOpacity onPress={() => router.push('/login' as any)}>
                            <Text style={styles.footerLink}>Masuk</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── MODAL LOADING ── */}
            <Modal
                animationType="fade"
                transparent
                visible={loading}
                onRequestClose={() => { }}
            >
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                </View>
            </Modal>

            {/* ── ALERT BOTTOM SHEET ── */}
            <Modal
                visible={errorModalVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setErrorModalVisible(false)}
            >
                <View style={styles.sheetOverlay}>
                    <TouchableWithoutFeedback onPress={() => setErrorModalVisible(false)}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>

                    <View style={styles.sheetContainer}>
                        <TouchableOpacity
                            onPress={() => setErrorModalVisible(false)}
                            style={styles.sheetCloseButton}
                        >
                            <Ionicons name="close" size={24} color="#1c1c1c" />
                        </TouchableOpacity>

                        <Text style={styles.sheetTitle}>{errorTitle}</Text>
                        <Text style={styles.sheetDescription}>{errorMessage}</Text>

                        <TouchableOpacity
                            onPress={() => setErrorModalVisible(false)}
                            style={styles.sheetButton}
                        >
                            <Text style={styles.sheetButtonText}>Mengerti</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
    header: { marginBottom: 24 },
    title: { fontSize: 26, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
    subtitle: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
    field: { marginBottom: 16 },
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
    phonePrefixText: {
        fontSize: 14,
        color: COLORS.textDark,
        marginRight: 4,
        fontWeight: '600',
    },
    phoneDivider: {
        width: 1,
        height: 20,
        backgroundColor: COLORS.border,
        marginHorizontal: 10,
    },
    phoneInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.textDark },
    passwordWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    passwordInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.textDark },
    agreeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    agreeText: { fontSize: 13, color: COLORS.textMuted, flexShrink: 1 },
    primaryButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 30,
        paddingVertical: 15,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    primaryButtonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: { marginHorizontal: 12, fontSize: 12, color: COLORS.textMuted },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 30,
        paddingVertical: 13,
        marginBottom: 28,
        backgroundColor: COLORS.bg,
    },
    googleButtonText: { marginLeft: 10, fontSize: 14, fontWeight: '600', color: COLORS.textDark },
    footer: { flexDirection: 'row', justifyContent: 'center' },
    footerText: { fontSize: 13, color: COLORS.textMuted },
    footerLink: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },

    // ── Style Loading Modal ──
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    // ── Style Alert Bottom Sheet ──
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 50,
        width: '100%',
        position: 'relative',
    },
    sheetCloseButton: {
        position: 'absolute',
        right: 24,
        top: -64,
        backgroundColor: '#fff',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 5,
    },
    sheetTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textDark,
        marginBottom: 10,
    },
    sheetDescription: {
        fontSize: 15,
        color: '#555555',
        lineHeight: 22,
        marginBottom: 32,
    },
    sheetButton: {
        width: '100%',
        borderRadius: 100,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    sheetButtonText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 16,
    },
});