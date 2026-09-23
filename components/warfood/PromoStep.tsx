import { Ionicons } from '@expo/vector-icons';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
    onBack: () => void;
};

export default function PromoStep({ onBack }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=800' }}
                    style={[s.header, { paddingTop: insets.top + 12 }]}
                    imageStyle={{ opacity: 0.25 }}
                >
                    <Pressable style={s.circleBtn} onPress={onBack}>
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                    </Pressable>
                    <Text style={s.headerTitle}>Serba Promo</Text>
                    <View style={s.heroWrap}>
                        <Text style={s.heroTitle}>Banyak promo seru{'\n'}menantimu</Text>
                    </View>
                </ImageBackground>

                <View style={s.body}>
                    <View style={s.sectionBanner}>
                        <Text style={s.sectionBannerEmoji}>🐱</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={s.sectionBannerTitle}>Banting Harga s.d 35%</Text>
                            <Text style={s.sectionBannerSub}>Perut kenyang, dompet senang.</Text>
                        </View>
                        <Pressable>
                            <Text style={s.seeAll}>Lihat semua</Text>
                        </Pressable>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                        <View style={s.promoCard}>
                            <View style={s.discountBadge}><Text style={s.discountText}>-50%</Text></View>
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1633436375153-d7045cb93e38?w=300' }}
                                style={s.promoImage}
                            />
                            <View style={s.promoBody}>
                                <Text style={s.promoMeta}>22.44 km • 50-60 min</Text>
                                <Text style={s.promoTitle} numberOfLines={2}>Seipesial Berdua 50% 1</Text>
                                <Text style={s.promoResto}>SeIndonesia (Sei Sa...</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                                    <Text style={s.promoPrice}>70.400</Text>
                                    <Text style={s.promoOldPrice}>140.800</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <Text style={s.subTitle}>Kumpul sini yang nyari promo~</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                        <View style={[s.dealTile, { backgroundColor: '#1AA260' }]}>
                            <Text style={s.dealTileTitle}>Hemat{'\n'}s.d. 60%</Text>
                            <View style={s.dealTileFooter}>
                                <Text style={s.dealTileLink}>Cek resto</Text>
                                <Ionicons name="chevron-forward" size={14} color="#fff" />
                            </View>
                        </View>
                        <View style={[s.dealTile, { backgroundColor: '#E07C24' }]}>
                            <Text style={s.dealTileTitle}>Min. order{'\n'}s.d. 40rb</Text>
                            <View style={s.dealTileFooter}>
                                <Text style={s.dealTileLink}>Cek resto</Text>
                                <Ionicons name="chevron-forward" size={14} color="#fff" />
                            </View>
                        </View>
                        <View style={[s.dealTile, { backgroundColor: '#1D6FA5' }]}>
                            <Text style={s.dealTileTitle}>Diskon{'\n'}spesial</Text>
                            <View style={s.dealTileFooter}>
                                <Text style={s.dealTileLink}>Cek resto</Text>
                                <Ionicons name="chevron-forward" size={14} color="#fff" />
                            </View>
                        </View>
                    </ScrollView>

                    <View style={s.plusBanner}>
                        <View style={s.plusIcon}>
                            <Text style={{ fontSize: 20 }}>➕</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.plusTitle}>PLUS: Keuntungan baru, lebih hemat!</Text>
                            <Text style={s.plusSub}>Enjoy diskon s.d. 10r...</Text>
                        </View>
                        <Pressable style={s.plusBtn}>
                            <Text style={s.plusBtnText}>Dapatkan</Text>
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingBottom: 40, backgroundColor: '#D71920' },
    circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', position: 'absolute', top: 12, left: 68 },
    heroWrap: { alignItems: 'center', marginTop: 20 },
    heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 28 },

    body: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
    sectionBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FDEAEA', borderRadius: 16, padding: 12 },
    sectionBannerEmoji: { fontSize: 24 },
    sectionBannerTitle: { fontSize: 13, fontWeight: '800', color: '#D71920' },
    sectionBannerSub: { fontSize: 11, color: '#5C6470', marginTop: 2 },
    seeAll: { fontSize: 12, fontWeight: '700', color: '#1AA260' },

    promoCard: { width: 220, marginLeft: 4, marginRight: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6 },
    discountBadge: { position: 'absolute', top: 8, left: 0, backgroundColor: '#D71920', paddingHorizontal: 8, paddingVertical: 3, borderTopRightRadius: 8, borderBottomRightRadius: 8, zIndex: 2 },
    discountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    promoImage: { width: '100%', height: 120 },
    promoBody: { padding: 10 },
    promoMeta: { fontSize: 11, color: '#5C6470' },
    promoTitle: { fontSize: 14, fontWeight: '800', color: '#1B1B1B', marginTop: 4 },
    promoResto: { fontSize: 12, color: '#5C6470', marginTop: 2 },
    promoPrice: { fontSize: 14, fontWeight: '800', color: '#1B1B1B', marginTop: 4 },
    promoOldPrice: { fontSize: 12, color: '#8A8F98', textDecorationLine: 'line-through' },

    subTitle: { fontSize: 17, fontWeight: '800', color: '#1B1B1B', marginTop: 24 },
    dealTile: { width: 160, height: 100, borderRadius: 16, padding: 14, marginRight: 12, justifyContent: 'space-between' },
    dealTileTitle: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 20 },
    dealTileFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dealTileLink: { color: '#fff', fontSize: 12, fontWeight: '700' },

    plusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 16, padding: 12, marginTop: 24 },
    plusIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center' },
    plusTitle: { fontSize: 13, fontWeight: '700', color: '#1B1B1B' },
    plusSub: { fontSize: 11, color: '#5C6470', marginTop: 2 },
    plusBtn: { backgroundColor: '#E9F9EF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
    plusBtnText: { color: '#1AA260', fontWeight: '700', fontSize: 12 },
});