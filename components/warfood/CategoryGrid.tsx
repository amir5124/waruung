import type { FoodCategory } from '@/types/warfood';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
    categories: FoodCategory[];
    onPress?: (category: FoodCategory) => void;
    columns?: number;
};

export default function CategoryGrid({ categories, onPress, columns = 4 }: Props) {
    return (
        <View style={s.grid}>
            {categories.map((cat) => (
                <Pressable
                    key={cat.key}
                    style={[s.item, { width: `${100 / columns}%` }]}
                    onPress={() => onPress?.(cat)}
                >
                    <Image source={{ uri: cat.imageUrl }} style={s.image} />
                    <Text style={s.label} numberOfLines={1}>{cat.label}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const s = StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    item: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 },
    image: { width: 64, height: 64, borderRadius: 32, marginBottom: 6 },
    label: { fontSize: 12, fontWeight: '600', color: '#1B1B1B', textAlign: 'center' },
});