import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
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

import AppAlert from '../../components/AppAlert';
import BannerCarousel from '../../components/BannerCarousel';
import GradientBackground from '../../components/GradientBackground';
import LoadingModal from '../../components/LoadingModal';
import PromoCard from '../../components/PromoCard';
import ServiceMenuItem from '../../components/ServiceMenuItem';

const BANNERS = [require('../../assets/images/banner-1.png')];

const SERVICES = [
  { label: 'WarJek', icon: require('../../assets/images/motor.png'), route: '/services/ojek-motor' },
  { label: 'WarCar', icon: require('../../assets/images/mobil.png'), route: '/services/ojek-mobil' },
  { label: 'WarFood', icon: require('../../assets/images/food.png'), route: '/services/warfood' },
  { label: 'WarSend', icon: require('../../assets/images/send.png'), route: '/services/kurir' },
];

const PROMOS = [
  {
    id: '1',
    title: 'Berry Smoothie',
    address: 'WarFood, Jl. Soekarno Hatta',
    rating: 4.6,
    reviewCount: '100+',
    discount: '10% off',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400',
  },
  {
    id: '2',
    title: 'Berry Smoothie',
    address: 'WarFood, Jl. Soekarno Hatta',
    rating: 4.6,
    reviewCount: '100+',
    discount: '10% off',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400',
  },
];

const DEFAULT_LOCATION = 'Jl Soekarno Hatta Malang, Jawa...';

export default function HomeScreen() {
  const [locationText, setLocationText] = useState('Mengambil lokasi...');
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  /* ============ AMBIL LOKASI SAAT INI ============ */
  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

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
        setLocationText(formatted.length > 0 ? formatted : DEFAULT_LOCATION);
      } else {
        setLocationText(DEFAULT_LOCATION);
      }
    } catch (err) {
      console.log('Gagal mengambil lokasi:', err);
      setLocationText(DEFAULT_LOCATION);
    }
  }, []);

  /* ============ LOAD PERTAMA KALI ============ */
  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (isMounted) await fetchLocation();
      if (isMounted) setLoadingLocation(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [fetchLocation]);

  /* ============ PULL TO REFRESH ============ */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh lokasi + (kalau ada) data lain seperti promo/banner.
      await fetchLocation();

      // Kalau nanti ada fetch data lain (API), tambahkan di sini.
      // await fetchPromos();
      // await fetchBanners();
    } finally {
      setRefreshing(false);
    }
  }, [fetchLocation]);

  /* ============ HANDLER KLIK MENU ============ */
  const handleServicePress = (service: (typeof SERVICES)[number]) => {
    if (service.label === 'WarFood') {
      setAlertTitle('Segera Hadir');
      setAlertMessage(
        'Fitur WarFood sedang dalam tahap pengembangan. Mohon ditunggu ya! 🚧'
      );
      setAlertVisible(true);
      return;
    }

    router.push(service.route as any);
  };

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
              <Ionicons name="location-outline" size={22} color="#1B1B1B" />
              <Text style={styles.locationText} numberOfLines={1}>
                {locationText}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#1B1B1B" />
            </Pressable>

            <Pressable style={styles.bellButton}>
              <Ionicons name="notifications-outline" size={24} color="#1B1B1B" />
              <View style={styles.dot} />
            </Pressable>
          </View>

          {/* Banner */}
          <BannerCarousel images={BANNERS} />

          {/* Layanan */}
          <View style={styles.serviceRow}>
            {SERVICES.map((service) => (
              <ServiceMenuItem
                key={service.label}
                {...service}
                onPress={() => handleServicePress(service)}
              />
            ))}
          </View>

          {/* Rekomendasi */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Rekomendasi Hangat</Text>
              <View style={styles.sectionUnderline} />
            </View>
            <Pressable style={styles.seeAllButton}>
              <Text style={styles.seeAll}>See All</Text>
              <Ionicons name="chevron-forward" size={16} color="#2F86EB" />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promoList}
          >
            {PROMOS.map((promo) => (
              <PromoCard key={promo.id} {...promo} />
            ))}
          </ScrollView>
        </ScrollView>
      </SafeAreaView>

      <LoadingModal visible={loadingLocation} />

      {/* ============ ALERT ============ */}
      <AppAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

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
  locationText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1B1B1B' },
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
    marginTop: 24,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1B1B1B' },
  sectionUnderline: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2F86EB',
    marginTop: 4,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CFE2FA',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 2,
  },
  seeAll: { fontSize: 14, fontWeight: '600', color: '#2F86EB' },
  promoList: { paddingLeft: 16, paddingRight: 4 },
});