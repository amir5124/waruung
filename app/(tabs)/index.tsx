import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BannerCarousel from '../../components/BannerCarousel';
import PromoCard from '../../components/PromoCard';
import ServiceMenuItem from '../../components/ServiceMenuItem';

const BANNERS = [
  require('../../assets/images/banner-1.png'),
];

const SERVICES = [
  { label: 'Ojek Motor', icon: require('../../assets/images/motor.png'), route: '/services/ojek-motor' },
  { label: 'Ojek Mobil', icon: require('../../assets/images/mobil.png'), route: '/services/ojek-mobil' },
  { label: 'Warfood', icon: require('../../assets/images/food.png'), route: '/services/warfood' },
  { label: 'Kurir', icon: require('../../assets/images/send.png'), route: '/services/kurir' },
];

const PROMOS = [
  {
    id: '1',
    title: 'Smart Shopping',
    address: 'House: 00, Road: 00, City-000',
    rating: 4.6,
    reviewCount: '100+',
    discount: '10% off',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400',
  },
  {
    id: '2',
    title: 'Smart Shopping',
    address: 'House: 00, Road: 00, City-000',
    rating: 4.6,
    reviewCount: '100+',
    discount: '10% off',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400',
  },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: lokasi + notifikasi */}
        <View style={styles.headerRow}>
          <Pressable style={styles.locationPill}>
            <Ionicons name="location" size={18} color="#2F86EB" />
            <Text style={styles.locationText} numberOfLines={1}>
              Jl Soekarno Hatta Malang, Jawa...
            </Text>
            <Ionicons name="chevron-down" size={16} color="#1B1B1B" />
          </Pressable>
          <Pressable style={styles.bellButton}>
            <Ionicons name="notifications-outline" size={20} color="#1B1B1B" />
            <View style={styles.dot} />
          </Pressable>
        </View>

        {/* Banner promo */}
        <BannerCarousel images={BANNERS} />

        {/* Menu layanan */}
        <View style={styles.serviceRow}>
          {SERVICES.map((service) => (
            <ServiceMenuItem key={service.label} {...service} />
          ))}
        </View>

        {/* Rekomendasi Hangat */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rekomendasi Hangat</Text>
          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { paddingBottom: 120 },
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
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
  },
  locationText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1B1B1B' },
  bellButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 12,
    right: 13,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53935',
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: '#DCEBFC',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#1B1B1B', lineHeight: 24 },
  bannerTitleBlue: { color: '#2F86EB' },
  bannerSubtitle: { fontSize: 11, color: '#5C6470', marginTop: 6, marginBottom: 12 },
  shopButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#2F86EB',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  shopButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bannerImage: { width: 100, height: 100, resizeMode: 'contain' },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1B1B1B' },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#2F86EB' },
  promoList: { paddingLeft: 16, paddingRight: 4 },
});