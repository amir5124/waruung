// lib/push.ts (customer)
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

// ============================================================
// 🔔 KONFIGURASI CHANNEL CUSTOMER
// ============================================================
// ⚠️ HARUS SAMA dengan:
// - CUSTOMER_CHANNEL_ID & CUSTOMER_SOUND di app/_layout.tsx
// - defaultChannel & sounds di app.json
// - CHANNEL_MAP.customer & SOUND_MAP.customer di backend
//   (notification.service.ts)
//
// Nama resource Android: huruf kecil, angka, underscore
// (TANPA tanda hubung).
// File suara: assets/sounds/customer.mp3
//   → di build native jadi android/app/src/main/res/raw/customer.mp3
// ============================================================
const ANDROID_CHANNEL_ID = 'customer-notif-v2';

// Handler notif di foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function registerForPushNotifications() {
    // ============================================================
    // 1. Cek device fisik
    // ============================================================
    if (!Device.isDevice) {
        console.warn('[push-customer] Bukan device fisik, skip');
        return null;
    }

    // ============================================================
    // 2. Minta permission notifikasi
    // ============================================================
    const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('[push-customer] Izin notifikasi ditolak');
        return null;
    }

    // ============================================================
    // 3. Android: VERIFIKASI channel (JANGAN buat di sini)
    // ------------------------------------------------------------
    // Channel dibuat di app/_layout.tsx (setupNotificationChannel).
    // Di sini cukup cek apakah channel ada & suaranya sudah custom.
    //
    // Android hanya mengembalikan 'default' atau 'custom' untuk
    // properti sound, bukan nama file.
    // ============================================================
    if (Platform.OS === 'android') {
        try {
            const ch = await Notifications.getNotificationChannelAsync(
                ANDROID_CHANNEL_ID
            );

            if (!ch) {
                console.warn(
                    '[push-customer] ⚠️ Channel belum dibuat! Cek _layout.tsx setupNotificationChannel()'
                );
            } else {
                console.log(
                    '[push-customer] ✅ Channel OK:',
                    ANDROID_CHANNEL_ID,
                    '| sound:',
                    ch.sound,
                    '| importance:',
                    ch.importance
                );

                if (!ch.sound || ch.sound === 'default') {
                    console.warn(
                        '[push-customer] ⚠️ Channel masih suara default. ' +
                        'Cek file customer.mp3 di res/raw, atau naikkan ID channel ' +
                        '(suara channel tidak bisa diubah setelah dibuat).'
                    );
                }
            }
        } catch (err: any) {
            console.warn('[push-customer] Cek channel gagal:', err.message);
        }
    }

    // ============================================================
    // 4. Ambil EAS projectId dari app.json
    // ============================================================
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
        console.warn(
            '[push-customer] projectId kosong di app.json. Jalankan `eas init` dulu.'
        );
        return null;
    }

    // ============================================================
    // 5. Ambil Expo Push Token
    // ============================================================
    let token: string | null = null;
    try {
        const result = await Notifications.getExpoPushTokenAsync({
            projectId,
        });
        token = result.data;
        console.log('[push-customer] Expo Push Token:', token);
    } catch (err: any) {
        console.error('[push-customer] Gagal ambil token:', err.message);
        return null;
    }

    if (!token) {
        console.warn('[push-customer] Token kosong');
        return null;
    }

    // ============================================================
    // 6. Simpan token ke backend (profiles.fcm_token)
    // ============================================================
    try {
        await api.updateProfile({ fcm_token: token });
        console.log('[push-customer] Token tersimpan di backend');
    } catch (err: any) {
        console.warn('[push-customer] Gagal simpan token:', err.message);
    }

    return token;
}