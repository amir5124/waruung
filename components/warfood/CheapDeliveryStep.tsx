import { CHEAP_DELIVERY_RESTOS } from '@/constants/warfood-data';
import type { RestoItem } from '@/types/warfood';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
    onBack: () => void;
    onPressFilter: () => void;
    onPressResto: (item: RestoItem) => void;
};

export default function CheapDeliveryStep({ onBack, onPressFilter, onPressResto }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: '#F5F6F8' }}>
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800' }}
                style={[s.header, { paddingTop: insets.top + 12 }]}
                imageStyle={{ opacity: 0.3 }}
            >
                <View style={s.headerTop}>
                    <Pressable style={s.circleBtn} onPress={onBack}>
                        <Ionicons name="arrow-back" size={20} color="#1B1B1B" />
                    </Pressable>
                    <View style={s.badge}>
                        <Text style={s.badgeText}>Beli makan siang</Text>
                    </View>
                </View>
                <Text style={s.title}>Selalu ada{'\n'}ONGKIR MURAAAH</Text>
            </ImageBackground>

            <View style={s.body}>
                <Text style={s.subtitle}>Ongkir muraaahnya, kaaak</Text>
                <Text style={s.desc}>Makan enak & murah seharian, ongkir bukan halangan.</Text>

                <View style={s.chipsRow}>
                    <Pressable style={s.filterBtn} onPress={onPressFilter}>
                        <Ionicons name="options" size={16} color="#1B1B1B" />
                    </Pressable>
                    <View style={s.chip}><Text style={s.chipText}>Dibawah 5rb 🛵</Text></View>
                    <View style={s.chip}><Text style={s.chipText}>Menu 30rb 🍴</Text></View>
                </View>

                <FlatList
                    data={CHEAP_DELIVERY_RESTOS}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
                    renderItem={({ item }) => (
                        <Pressable style={s.simpleCard} onPress={() => onPressResto(item)}>
                            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={s.simpleImage} />}
                            <View style={{ flex: 1 }}>
                                <Text style={s.simpleName} numberOfLines={1}>{item.name}</Text>
                                <Text style={s.simpleCategory}>{item.category}</Text>
                                <Text style={s.simpleMeta}>{item.ongkir} | {item.duration}</Text>
                            </View>
                        </Pressable>
                    )}
                />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingBottom: 20, backgroundColor: '#D71920' },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    badge: { backgroundColor: '#B6F09C', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: '800', color: '#1B1B1B' },
    title: { color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 32 },

    body: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -16, paddingHorizontal: 16, paddingTop: 20 },
    subtitle: { fontSize: 18, fontWeight: '800', color: '#1B1B1B' },
    desc: { fontSize: 13, color: '#5C6470', marginTop: 4 },

    chipsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    filterBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E5E8EC', alignItems: 'center', justifyContent: 'center' },
    chip: { borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
    chipText: { fontSize: 12, fontWeight: '600', color: '#1B1B1B' },

    simpleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F5F6F8', borderRadius: 14, padding: 12 },
    simpleImage: { width: 56, height: 56, borderRadius: 10 },
    simpleName: { fontSize: 14, fontWeight: '800', color: '#1B1B1B' },
    simpleCategory: { fontSize: 12, color: '#5C6470', marginTop: 2 },
    simpleMeta: { fontSize: 12, color: '#5C6470', marginTop: 2 },
});