import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

// Nama channel — HARUS sama dengan yang dikirim backend
const ANDROID_CHANNEL_ID = 'orders';

// Handler notifikasi saat app di foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,       // ← SDK 51+ ganti dari shouldShowAlert
        shouldShowList: true,         // ← SDK 51+ untuk list
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function registerForPushNotifications() {
    // 1. Cek device fisik
    if (!Device.isDevice) {
        console.warn('[push] Bukan device fisik, skip');
        return null;
    }

    // 2. Minta permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('[push] Izin notifikasi ditolak');
        return null;
    }

    // 3. Android: buat channel dengan custom sound
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
            name: 'Order Notification',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'notification.mp3',              // ← custom sound
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#1AAD5B',
            lockscreenVisibility:
                Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: false,
            enableVibrate: true,
        });

        console.log('[push] Android channel dibuat:', ANDROID_CHANNEL_ID);
    }

    // 4. Cek projectId
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
        console.warn('[push] projectId tidak ada di app.json. Jalankan eas init dulu.');
        return null;
    }

    // 5. Ambil Expo Push Token
    let token: string | null = null;
    try {
        const result = await Notifications.getExpoPushTokenAsync({ projectId });
        token = result.data;
        console.log('[push] Expo Push Token:', token);
    } catch (err: any) {
        console.error('[push] Gagal ambil token:', err.message);
        return null;
    }

    if (!token) {
        console.warn('[push] Token kosong');
        return null;
    }

    // 6. Simpan token ke backend
    try {
        await api.updateProfile({ fcm_token: token });
        console.log('[push] Token tersimpan di backend');
    } catch (err: any) {
        console.warn('[push] Gagal simpan token:', err.message);
    }

    return token;
}