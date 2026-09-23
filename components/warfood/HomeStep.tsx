import { FOOD_CATEGORIES, NEARBY_RESTOS } from '@/constants/warfood-data';
import type { RestoItem } from '@/types/warfood';
import { Ionicons } from '@expo/vector-icons';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CategoryGrid from './CategoryGrid';
import RestoCard from './RestoCard';

const RED = '#D71920';
const RED_DARK = '#A81419';

type Props = {
    locationLabel: string;
    onClose: () => void;
    onPressSearch: () => void;
    onPressNearby: () => void;
    onPressCheapDelivery: () => void;
    onPressPromo: () => void;
    onPressResto: (item: RestoItem) => void;
    onPressSeeAll: () => void;
};

export default function HomeStep({
    locationLabel, onClose, onPressSearch, onPressNearby,
    onPressCheapDelivery, onPressPromo, onPressResto, onPressSeeAll,
}: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* ---- Header merah dengan banner promo ---- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800' }}
                    style={[s.header, { paddingTop: insets.top }]}
                    imageStyle={{ opacity: 0.25 }}
                >
                    <View style={s.headerTop}>
                        <Pressable style={s.circleBtn} onPress={onClose}>
                            <Ionicons name="close" size={22} color="#1B1B1B" />
                        </Pressable>
                        <View style={s.locationPill}>
                            <Ionicons name="location" size={14} color="#fff" />
                            <Text style={s.locationText} numberOfLines={1}>{locationLabel}</Text>
                        </View>
                        <Pressable style={s.circleBtn} onPress={onPressPromo}>
                            <Ionicons name="heart-half-outline" size={20} color="#1B1B1B" />
                        </Pressable>
                        <Pressable style={s.circleBtn}>
                            <Ionicons name="receipt-outline" size={20} color="#1B1B1B" />
                        </Pressable>
                    </View>

                    <View style={s.bannerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.bannerBrand}>KFC · Coca-Cola</Text>
                            <Text style={s.bannerTitle}>2 Chicken n Coke</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                                <Text style={s.bannerOldPrice}>70rb</Text>
                                <Text style={s.bannerPrice}>50rb</Text>
                            </View>
                            <View style={s.bannerCta}>
                                <Text style={s.bannerCtaText}>Pesan sekarang</Text>
                                <Ionicons name="chevron-forward" size={14} color={RED} />
                            </View>
                        </View>
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=300' }}
                            style={s.bannerImage}
                        />
                    </View>
                </ImageBackground>

                {/* ---- Search bar mengambang di batas header ---- */}
                <View style={s.searchWrap}>
                    <Pressable style={s.searchBar} onPress={onPressSearch}>
                        <Ionicons name="search" size={18} color="#8A8F98" />
                        <Text style={s.searchPlaceholder}>Lagi mau mamam apa?</Text>
                        <Ionicons name="restaurant" size={18} color={RED} />
                    </Pressable>
                </View>

                {/* ---- 3 menu ikon: Resto Terdekat, Ongkir Murah, Promo ---- */}
                <View style={s.quickMenuRow}>
                    <Pressable style={s.quickMenu} onPress={onPressNearby}>
                        <Text style={s.quickMenuEmoji}>🗺️</Text>
                        <Text style={s.quickMenuLabel}>Resto{'\n'}Terdekat</Text>
                    </Pressable>
                    <Pressable style={s.quickMenu} onPress={onPressCheapDelivery}>
                        <View>
                            <Text style={s.quickMenuEmoji}>🛵</Text>
                            <View style={s.quickMenuBadge}>
                                <Text style={s.quickMenuBadgeText}>-50%</Text>
                            </View>
                        </View>
                        <Text style={s.quickMenuLabel}>Ongkir{'\n'}MURAAAH</Text>
                    </Pressable>
                    <Pressable style={s.quickMenu} onPress={onPressPromo}>
                        <Text style={s.quickMenuEmoji}>🎉</Text>
                        <Text style={s.quickMenuLabel}>Serba{'\n'}Promo</Text>
                    </Pressable>
                </View>

                {/* ---- Banner group order / promo ---- */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.promoScroll}>
                    <View style={s.promoBanner}>
                        <View style={s.promoBadge}>
                            <Text style={s.promoBadgeText}>Jajan barengan</Text>
                        </View>
                        <Text style={s.promoTitle}>MURAAAH pakai{'\n'}GROUP ORDER</Text>
                        <Pressable style={s.promoCta}>
                            <Text style={s.promoCtaText}>Cek sekarang</Text>
                        </Pressable>
                    </View>

                    <Pressable style={s.dealCard} onPress={onPressPromo}>
                        <View style={s.dealBadge}><Text style={s.dealBadgeText}>50% off</Text></View>
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1633436375153-d7045cb93e38?w=300' }}
                            style={s.dealImage}
                        />
                        <View style={s.dealNewBadge}><Text style={s.dealNewBadgeText}>Baru</Text></View>
                        <View style={s.dealBody}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="star" size={11} color="#F5A623" />
                                <Text style={s.dealMeta}>4.8 (3rb+) • 50-60 ...</Text>
                            </View>
                            <Text style={s.dealTitle} numberOfLines={2}>SeIndonesia (Sei Sapi Dan Ayam), Pe...</Text>
                            <Text style={s.dealOngkir}>Ongkir 66rb</Text>
                        </View>
                    </Pressable>
                </ScrollView>

                {/* ---- Kategori kuliner (Gambar 2) ---- */}
                <View style={s.section}>
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionTitle}>Kuliner sesuai seleramu</Text>
                        <Pressable onPress={onPressSeeAll}>
                            <Text style={s.seeAll}>Lihat Semua</Text>
                        </Pressable>
                    </View>
                    <CategoryGrid categories={FOOD_CATEGORIES} />
                </View>

                {/* ---- Rekomendasi resto ---- */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Makan siang enak buat kamu</Text>
                    <Text style={s.sectionSub}>Coba yang Baru di WarFood!</Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
                        <View style={s.chip}><Ionicons name="options-outline" size={16} color="#1B1B1B" /></View>
                        <View style={s.chip}><Text style={s.chipText}>Dibawah 5rb</Text></View>
                        <View style={s.chip}><Text style={s.chipText}>Menu 30rb</Text></View>
                    </ScrollView>

                    {NEARBY_RESTOS.map((item) => (
                        <RestoCard key={item.id} item={item} onPress={() => onPressResto(item)} />
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingBottom: 24, backgroundColor: RED },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    locationPill: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10,
    },
    locationText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
    bannerRow: { flexDirection: 'row', alignItems: 'center' },
    bannerBrand: { color: '#fff', fontWeight: '700', fontSize: 12, marginBottom: 4 },
    bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 6 },
    bannerOldPrice: { color: '#fff', fontSize: 13, textDecorationLine: 'line-through', opacity: 0.7 },
    bannerPrice: { color: '#fff', fontWeight: '800', fontSize: 26 },
    bannerCta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', alignSelf: 'flex-start', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
    bannerCtaText: { color: RED, fontWeight: '700', fontSize: 12 },
    bannerImage: { width: 130, height: 110, resizeMode: 'contain' },

    searchWrap: { paddingHorizontal: 16, marginTop: -20 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, height: 52,
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
    },
    searchPlaceholder: { flex: 1, fontSize: 14, color: '#8A8F98' },

    quickMenuRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 20, gap: 12 },
    quickMenu: {
        flex: 1, alignItems: 'center', gap: 8,
        backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14,
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    },
    quickMenuEmoji: { fontSize: 28 },
    quickMenuLabel: { fontSize: 12, fontWeight: '700', color: '#1B1B1B', textAlign: 'center' },
    quickMenuBadge: {
        position: 'absolute', top: -6, right: -10,
        backgroundColor: RED, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
    },
    quickMenuBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

    promoScroll: { marginTop: 20 },
    promoBanner: {
        width: 220, backgroundColor: RED, borderRadius: 16, padding: 16, marginLeft: 16,
        justifyContent: 'space-between',
    },
    promoBadge: { backgroundColor: '#B6F09C', alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10 },
    promoBadgeText: { fontSize: 11, fontWeight: '800', color: '#1B1B1B' },
    promoTitle: { color: '#fff', fontWeight: '800', fontSize: 18, lineHeight: 24, marginBottom: 12 },
    promoCta: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 8, alignItems: 'center' },
    promoCtaText: { color: '#1B1B1B', fontWeight: '700', fontSize: 13 },

    dealCard: { width: 190, backgroundColor: '#fff', borderRadius: 16, marginLeft: 12, marginRight: 4, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6 },
    dealBadge: { position: 'absolute', top: 8, left: 0, backgroundColor: RED, paddingHorizontal: 8, paddingVertical: 3, borderTopRightRadius: 8, borderBottomRightRadius: 8, zIndex: 2 },
    dealBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    dealImage: { width: '100%', height: 110 },
    dealNewBadge: { position: 'absolute', top: 100, left: 10, backgroundColor: '#1AA260', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    dealNewBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    dealBody: { padding: 10 },
    dealMeta: { fontSize: 11, color: '#5C6470' },
    dealTitle: { fontSize: 13, fontWeight: '800', color: '#1B1B1B', marginTop: 4, lineHeight: 17 },
    dealOngkir: { fontSize: 11, color: '#5C6470', marginTop: 4 },

    section: { paddingHorizontal: 16, marginTop: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1B1B1B' },
    sectionSub: { fontSize: 13, color: '#5C6470', marginTop: 2 },
    seeAll: { fontSize: 13, fontWeight: '700', color: '#1AA260' },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    },
    chipText: { fontSize: 12, fontWeight: '600', color: '#1B1B1B' },
});