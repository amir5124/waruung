// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWalletBalance } from '@/hooks/use-wallet-balance';
import ActiveOrderBanner from '../../components/ActiveOrderBanner';
import AppAlert from '../../components/AppAlert';
import BannerCarousel from '../../components/BannerCarousel';
import GradientBackground from '../../components/GradientBackground';
import HotRecommendations from '../../components/HotRecommendations';
import LoadingModal from '../../components/LoadingModal';
import SaldoCard from '../../components/SaldoCard';
import ServiceMenuItem from '../../components/ServiceMenuItem';

import { api, type PublicAsset } from '../../lib/api';

// ============================================================
// CONFIG
// ============================================================
const DEFAULT_LOCATION = 'Jl Soekarno Hatta Malang, Jawa...';

// ✅ Pakai PREFIX key — TANPA fallbackIcon
const SERVICE_MAP: Array<{
  keyPrefix: string;
  label: string;
  route: string;
}> = [
    {
      keyPrefix: 'warjek',
      label: 'URide',
      route: '/services/ojek-motor',
    },
    {
      keyPrefix: 'warcar',
      label: 'UCar',
      route: '/services/ojek-mobil',
    },
    {
      keyPrefix: 'warfood',
      label: 'UFood',
      route: '/services/warfood',
    },
    {
      keyPrefix: 'warsend',
      label: 'USend',
      route: '/services/kurir',
    },
  ];

// ============================================================
// HELPER — Cari icon berdasarkan prefix
// ============================================================
function findIconByPrefix(
  icons: Record<string, string>,
  prefix: string
): string | undefined {
  if (icons[prefix]) return icons[prefix];
  const foundKey = Object.keys(icons).find(
    (k) => k === prefix || k.startsWith(prefix + '_')
  );
  return foundKey ? icons[foundKey] : undefined;
}

// ============================================================
// SCREEN
// ============================================================
export default function HomeScreen() {
  const [locationText, setLocationText] = useState('Mengambil lokasi...');
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recoKey, setRecoKey] = useState(0);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Banner dari backend
  const [banners, setBanners] = useState<PublicAsset[]>([]);

  // Icon services dari backend (keyed by asset.key)
  const [serviceIcons, setServiceIcons] = useState<
    Record<string, string>
  >({});

  const { balance, refresh } = useWalletBalance({
    pollInterval: 30_000,
  });

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // ============================================================
  // FETCH ASSETS DARI BACKEND
  // ============================================================
  const fetchAssets = useCallback(async () => {
    try {
      // 1. Banner
      const bannerRes = await api.public.assets({
        category: 'banner',
        limit: 10,
      });

      // ✅ REVERSE: backend kirim terbaru dulu → kita mau terlama dulu
      const orderedBanners = [...(bannerRes.items ?? [])].reverse();

      console.log(
        '[HOME] banners loaded:',
        orderedBanners.length,
        orderedBanners.map((b) => b.key)
      );
      setBanners(orderedBanners);

      // 2. Icon
      const iconRes = await api.public.assets({
        category: 'icon',
        limit: 20,
      });
      console.log(
        '[HOME] icons loaded:',
        iconRes.items.length,
        iconRes.items.map((i) => i.key)
      );

      const iconMap: Record<string, string> = {};
      (iconRes.items ?? []).forEach((a) => {
        iconMap[a.key] = a.url;
      });
      setServiceIcons(iconMap);

      // Debug prefix matching
      SERVICE_MAP.forEach((s) => {
        const found = findIconByPrefix(iconMap, s.keyPrefix);
        console.log(
          `[HOME] ${s.label} (${s.keyPrefix}):`,
          found ? `✅` : '⚠️ fallback'
        );
      });
    } catch (e: any) {
      console.warn('[HOME] fetch assets gagal:', e?.message);
      // Tidak ada fallback — biarkan kosong
      setBanners([]);
      setServiceIcons({});
    }
  }, []);

  // ============================================================
  // FETCH LOKASI
  // ============================================================
  const fetchLocation = useCallback(async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationText(DEFAULT_LOCATION);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      const geocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (geocode && geocode.length > 0) {
        const addr = geocode[0];
        const parts = [
          addr.street || addr.name,
          addr.district || addr.subregion,
          addr.city || addr.region,
        ].filter(Boolean);

        const formatted = parts.join(', ');
        setLocationText(
          formatted.length > 0 ? formatted : DEFAULT_LOCATION
        );
      } else {
        setLocationText(DEFAULT_LOCATION);
      }
    } catch (err) {
      console.log('Gagal mengambil lokasi:', err);
      setLocationText(DEFAULT_LOCATION);
    }
  }, []);

  // ============================================================
  // LOAD PERTAMA KALI
  // ============================================================
  useEffect(() => {
    let isMounted = true;

    (async () => {
      await Promise.all([fetchLocation(), fetchAssets()]);
      if (isMounted) setLoadingLocation(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [fetchLocation, fetchAssets]);

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchLocation(), fetchAssets()]);
      setRecoKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLocation, fetchAssets]);

  // ============================================================
  // HANDLER KLIK MENU
  // ============================================================
  const handleServicePress = (
    service: (typeof SERVICE_MAP)[number]
  ) => {
    if (service.label === 'UFood') {
      router.push('/services/warfood' as any);
      return;
    }
    router.push(service.route as any);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <View style={styles.container}>
      <GradientBackground />

      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2F86EB']}
              tintColor="#2F86EB"
              title="Memperbarui..."
              titleColor="#2F86EB"
            />
          }
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable style={styles.locationPill}>
              <Ionicons
                name="location-outline"
                size={22}
                color="#1B1B1B"
              />
              <Text
                style={styles.locationText}
                numberOfLines={1}
              >
                {locationText}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color="#1B1B1B"
              />
            </Pressable>

            <Pressable style={styles.bellButton}>
              <Ionicons
                name="notifications-outline"
                size={24}
                color="#1B1B1B"
              />
              <View style={styles.dot} />
            </Pressable>
          </View>

          <ActiveOrderBanner />

          {/* ✅ Banner — TANPA fallback, hanya tampil kalau ada dari backend */}
          {banners.length > 0 && (
            <BannerCarousel
              images={banners.map((b) => b.url)}
            />
          )}

          <SaldoCard
            balance={balance}
            coins={0}
            badgeCount={8}
            onPressAdd={() => router.push('/topup' as any)}
            onPressTopup={() => router.push('/topup' as any)}
            onPressWithdraw={() => router.push('/tarik' as any)}
            onPressHistory={() => router.push('/riwayat' as any)}
            onPressMore={() => router.push('/lainnya' as any)}
          />

          {/* ✅ Services — TANPA fallback, hanya yang punya icon dari backend */}
          <View style={styles.serviceRow}>
            {SERVICE_MAP.map((service) => {
              const remoteUrl = findIconByPrefix(
                serviceIcons,
                service.keyPrefix
              );

              // Skip kalau tidak ada icon di backend
              if (!remoteUrl) return null;

              return (
                <ServiceMenuItem
                  key={service.keyPrefix}
                  label={service.label}
                  icon={remoteUrl}
                  route={service.route}
                  onPress={() =>
                    handleServicePress(service)
                  }
                />
              );
            })}
          </View>

          {/* Rekomendasi */}
          <HotRecommendations refreshKey={recoKey} />
        </ScrollView>
      </SafeAreaView>

      <LoadingModal visible={loadingLocation} />

      <AppAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 130 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  locationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#2F86EB',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  bellButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F86EB',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dot: {
    position: 'absolute',
    top: 11,
    right: 13,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53935',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 18,
    gap: 10,
  },
});