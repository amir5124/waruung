import { AntDesign, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ---- Warna sesuai brand TangerangFast ----
const COLORS = {
    primary: '#40a3ea',   // biru
    secondary: '#e68515', // oranye
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

    const handleSignUp = () => {
        if (!agree) {
            console.log('Harus menyetujui Syarat & Ketentuan dulu');
            return;
        }
        // TODO: sambungkan ke logic pendaftaran akun
        console.log('Daftar dengan', { name, phone, email, password });
    };

    const handleGoogleSignUp = () => {
        // TODO: sambungkan ke @react-native-google-signin/google-signin
        console.log('Daftar dengan Google');
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
                                placeholder="Masukkan nomor HP"
                                placeholderTextColor={COLORS.placeholder}
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
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
                            value={email}
                            onChangeText={setEmail}
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

                    {/* Checkbox setuju S&K */}
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
                            <Text
                                style={styles.footerLink}
                                onPress={() => router.push('/')}
                            >
                                Syarat & Ketentuan
                            </Text>
                        </Text>
                    </TouchableOpacity>

                    {/* Tombol Daftar */}
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            !agree && styles.primaryButtonDisabled,
                        ]}
                        activeOpacity={0.85}
                        onPress={handleSignUp}
                    >
                        <Text style={styles.primaryButtonText}>Daftar</Text>
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>Atau daftar dengan</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Tombol Google */}
                    <TouchableOpacity
                        style={styles.googleButton}
                        activeOpacity={0.85}
                        onPress={handleGoogleSignUp}
                    >
                        <AntDesign name="google" size={20} color="#EA4335" />
                        <Text style={styles.googleButtonText}>Daftar dengan Google</Text>
                    </TouchableOpacity>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Sudah punya akun? </Text>
                        <TouchableOpacity onPress={() => router.push('/login' as any)}>
                            <Text style={styles.footerLink}>Masuk</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: COLORS.textDark,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        color: COLORS.textMuted,
        lineHeight: 18,
    },
    field: {
        marginBottom: 16,
    },
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
        marginRight: 4,
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
    passwordInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 14,
        color: COLORS.textDark,
    },
    agreeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
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
    checkboxChecked: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    agreeText: {
        fontSize: 13,
        color: COLORS.textMuted,
        flexShrink: 1,
    },
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
    primaryButtonDisabled: {
        opacity: 0.5,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        marginHorizontal: 12,
        fontSize: 12,
        color: COLORS.textMuted,
    },
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
    googleButtonText: {
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textDark,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    footerText: {
        fontSize: 13,
        color: COLORS.textMuted,
    },
    footerLink: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.secondary,
    },
});