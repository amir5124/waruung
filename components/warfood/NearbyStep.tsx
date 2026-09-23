import { NEARBY_RESTOS } from '@/constants/warfood-data';
import type { FilterState, RestoItem } from '@/types/warfood';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RestoCard from './RestoCard';

type Props = {
    filter: FilterState;
    onBack: () => void;
    onPressFilter: () => void;
    onPressResto: (item: RestoItem) => void;
};

export default function NearbyStep({ filter, onBack, onPressFilter, onPressResto }: Props) {
    const insets = useSafeAreaInsets();
    const activeCount = Object.values(filter).filter(Boolean).length;

    return (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
            <View style={s.header}>
                <Pressable onPress={onBack} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#1B1B1B" />
                </Pressable>
                <View style={{ marginLeft: 12 }}>
                    <Text style={s.title}>Terdekat</Text>
                    <Text style={s.subtitle}>Resto yummy di deket sini.</Text>
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsRow}>
                <Pressable style={s.filterBtn} onPress={onPressFilter}>
                    <Ionicons name="options" size={16} color="#1B1B1B" />
                    {activeCount > 0 && (
                        <View style={s.filterBadge}><Text style={s.filterBadgeText}>{activeCount}</Text></View>
                    )}
                </Pressable>
                <View style={[s.chip, filter.under5k && s.chipActive]}>
                    <Text style={s.chipText}>Dibawah 5rb 🛵</Text>
                </View>
                <View style={[s.chip, filter.priceUnder30k && s.chipActive]}>
                    <Text style={s.chipText}>Menu 30rb 🍴</Text>
                </View>
            </ScrollView>

            <FlatList
                data={NEARBY_RESTOS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
                renderItem={({ item }) => <RestoCard item={item} onPress={() => onPressResto(item)} />}
            />
        </View>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    title: { fontSize: 20, fontWeight: '800', color: '#1B1B1B' },
    subtitle: { fontSize: 13, color: '#5C6470', marginTop: 2 },
    chipsRow: { paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
    filterBtn: {
        width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E5E8EC',
        alignItems: 'center', justifyContent: 'center', marginRight: 8,
    },
    filterBadge: {
        position: 'absolute', top: -4, right: -4, backgroundColor: '#D71920',
        width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    },
    filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    chip: { borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 },
    chipActive: { borderColor: '#1AA260', backgroundColor: '#E9F9EF' },
    chipText: { fontSize: 12, fontWeight: '600', color: '#1B1B1B' },
});