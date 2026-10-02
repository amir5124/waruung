import AppAlert from '@/components/AppAlert';
import LoadingModal from '@/components/LoadingModal';
import { api, clearToken } from '@/lib/api'; // ⬅️ TAMBAH clearToken
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Profile = {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
};

type MenuItem = {
    icon: React.ReactNode;
    label: string;
    subtitle?: string;
    /** Kalau true, tampil alert "Dalam Pengembangan" */
    comingSoon?: boolean;
    /** Rute navigasi — dipakai kalau comingSoon != true */
    route?: string;
    /** Custom handler — dipakai kalau butuh aksi selain navigasi */
    onPress?: () => void;
};

type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

export default function MenuScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    // AppAlert state
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
    // Load profil
    // ============================================================
    useFocusEffect(
        useCallback(() => {
            (async () => {
                const raw = await AsyncStorage.getItem('profile');
                if (raw) setProfile(JSON.parse(raw));

                try {
                    const fresh = await api.me();
                    setProfile(fresh);
                    await AsyncStorage.setItem(
                        'profile',
                        JSON.stringify(fresh)
                    );
                } catch (err) {
                    console.warn('Gagal refresh:', err);
                }
            })();
        }, [])
    );

    // ============================================================
    // Handlers
    // ============================================================
    const handleLogout = () => {
        showAlert('Keluar', 'Yakin mau keluar dari akun?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Keluar',
                style: 'destructive',
                onPress: async () => {
                    // 1. Hapus token JWT dari SecureStore (yang dipakai app untuk auth)
                    await clearToken();

                    // 2. Hapus cache profil & sisa data lokal
                    await AsyncStorage.multiRemove([
                        'auth_token',      // legacy — kalau ada sisa, bersihkan
                        'profile',
                    ]);

                    // 3. Redirect ke login
                    router.replace('/(auth)/login' as any);
                },
            },
        ]);
    };

    const handleMenuItem = (item: MenuItem) => {
        // Menu yang masih dalam pengembangan
        if (item.comingSoon) {
            showAlert(
                'Dalam Pengembangan',
                `Fitur "${item.label}" sedang dalam pengembangan. Pantau terus update dari kami ya! 🚀`,
                [{ text: 'Oke, ngerti' }]
            );
            return;
        }

        // Menu dengan custom handler
        if (item.onPress) {
            item.onPress();
            return;
        }

        // Menu dengan route
        if (item.route) {
            router.push(item.route as any);
            return;
        }
    };

    // ============================================================
    // Menu Akun
    // ============================================================
    const accountItems: MenuItem[] = [
        {
            icon: (
                <Ionicons
                    name="person-outline"
                    size={22}
                    color="#40a3ea"
                />
            ),
            label: 'Data Diri',
            subtitle: 'Nama, nomor HP, email',
            route: '/edit-profile',
        },
        {
            icon: (
                <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={22}
                    color="#40a3ea"
                />
            ),
            label: 'Alamat Tersimpan',
            subtitle: 'Rumah, kantor, dll',
            route: '/saved-addresses',
        },
    ];

    // ============================================================
    // Menu Lainnya
    // ============================================================
    const otherItems: MenuItem[] = [
        {
            icon: (
                <Ionicons
                    name="document-text-outline"
                    size={22}
                    color="#555"
                />
            ),
            label: 'Syarat & Ketentuan',
            comingSoon: true,
        },
        {
            icon: (
                <Ionicons
                    name="shield-outline"
                    size={22}
                    color="#555"
                />
            ),
            label: 'Kebijakan Privasi',
            comingSoon: true,
        },
        {
            icon: (
                <Ionicons
                    name="help-circle-outline"
                    size={22}
                    color="#555"
                />
            ),
            label: 'Pusat Bantuan',
            subtitle: 'FAQ & kontak CS',
            comingSoon: true,
        },
        {
            icon: (
                <Ionicons
                    name="information-circle-outline"
                    size={22}
                    color="#555"
                />
            ),
            label: 'Tentang Aplikasi',
            subtitle: 'Waruung v1.0.0',
            onPress: () =>
                showAlert(
                    'Waruung',
                    'Versi 1.0.0\n\nAplikasi layanan ojek, kurir, dan makanan.\n© 2026 PT Waruung Teknologi Indonesia',
                    [{ text: 'OK' }]
                ),
        },
    ];

    // ============================================================
    // Render
    // ============================================================
    const renderItem = (item: MenuItem, isLast: boolean) => (
        <Pressable
            key={item.label}
            style={({ pressed }) => [
                styles.menuRow,
                !isLast && styles.menuRowBorder,
                pressed && styles.menuRowPressed,
            ]}
            onPress={() => handleMenuItem(item)}
        >
            <View style={styles.menuIconWrap}>{item.icon}</View>

            <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.subtitle ? (
                    <Text style={styles.menuSubtitle}>
                        {item.subtitle}
                    </Text>
                ) : null}
            </View>

            <Ionicons name="chevron-forward" size={18} color="#bbb" />
        </Pressable>
    );

    const displayName = profile?.full_name || 'Pengguna';
    const displayPhone = profile?.phone || 'Nomor HP belum diisi';
    const displayEmail = profile?.email || '-';
    const avatarUri =
        profile?.avatar_url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
            displayName
        )}&background=40a3ea&color=fff&size=128`;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header profil */}
                <View style={styles.header}>
                    <View style={styles.profileRow}>
                        <Image
                            source={{ uri: avatarUri }}
                            style={styles.avatar}
                        />
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={styles.userName} numberOfLines={1}>
                                {displayName}
                            </Text>
                            <Text style={styles.userPhone} numberOfLines={1}>
                                {displayPhone}
                            </Text>
                            <Text style={styles.userEmail} numberOfLines={1}>
                                {displayEmail}
                            </Text>
                        </View>
                        <Pressable
                            style={styles.editBtn}
                            onPress={() =>
                                router.push('/edit-profile' as any)
                            }
                        >
                            <Ionicons
                                name="pencil"
                                size={16}
                                color="#40a3ea"
                            />
                        </Pressable>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Akun</Text>
                <View style={styles.card}>
                    {accountItems.map((item, i) =>
                        renderItem(item, i === accountItems.length - 1)
                    )}
                </View>

                <Text style={styles.sectionTitle}>Lainnya</Text>
                <View style={styles.card}>
                    {otherItems.map((item, i) =>
                        renderItem(item, i === otherItems.length - 1)
                    )}
                </View>

                <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons
                        name="log-out-outline"
                        size={20}
                        color="#e5484d"
                    />
                    <Text style={styles.logoutText}>Keluar</Text>
                </Pressable>

                <Text style={styles.versionText}>Versi 1.0.0</Text>
            </ScrollView>

            {/* ===== AppAlert ===== */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={hideAlert}
            />

            {/* ===== LoadingModal ===== */}
            <LoadingModal visible={loadingProfile} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F6F8' },
    scrollContent: { paddingBottom: 140 },

    header: {
        backgroundColor: '#40a3ea',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 28,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 62,
        height: 62,
        borderRadius: 31,
        borderWidth: 2,
        borderColor: '#fff',
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    userPhone: {
        fontSize: 13,
        color: '#e6f2fc',
        marginTop: 2,
    },
    userEmail: {
        fontSize: 12,
        color: '#d0e7f9',
        marginTop: 2,
    },
    editBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },

    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#888',
        marginTop: 20,
        marginBottom: 8,
        marginHorizontal: 20,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    card: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 16,
        overflow: 'hidden',
    },
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 12,
        backgroundColor: '#fff',
    },
    menuRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eee',
    },
    menuRowPressed: { backgroundColor: '#f7f7f7' },
    menuIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#EAF4FD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuLabel: {
        fontSize: 14.5,
        fontWeight: '600',
        color: '#222',
    },
    menuSubtitle: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },

    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5484d',
        borderRadius: 14,
        marginHorizontal: 16,
        marginTop: 24,
        paddingVertical: 14,
    },
    logoutText: {
        color: '#e5484d',
        fontWeight: '700',
        fontSize: 15,
    },

    versionText: {
        textAlign: 'center',
        color: '#bbb',
        fontSize: 12,
        marginTop: 16,
    },
});