import { SEARCH_CATEGORIES, TRENDING_KEYWORDS } from '@/constants/warfood-data';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CategoryGrid from './CategoryGrid';

type Props = {
    onBack: () => void;
    onSearch: (query: string) => void;
    onPressCategory: (categoryKey: string) => void;
};

export default function SearchFoodStep({ onBack, onSearch, onPressCategory }: Props) {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');

    return (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
            <View style={s.header}>
                <Pressable onPress={onBack} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#1B1B1B" />
                </Pressable>
                <View style={s.searchBar}>
                    <Ionicons name="search" size={18} color="#8A8F98" />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Mau makan apa hari ini?"
                        placeholderTextColor="#8A8F98"
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={() => onSearch(query)}
                        autoFocus
                        returnKeyType="search"
                    />
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Paling banyak dicari</Text>
                    <View style={s.keywordGrid}>
                        {TRENDING_KEYWORDS.map((kw) => (
                            <Pressable key={kw} style={s.keywordChip} onPress={() => onSearch(kw)}>
                                <Text style={s.keywordText}>{kw}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={s.divider} />

                <View style={s.section}>
                    <Text style={s.sectionTitle}>Eksplor aneka kuliner</Text>
                    <CategoryGrid
                        categories={SEARCH_CATEGORIES}
                        columns={3}
                        onPress={(cat) => onPressCategory(cat.key)}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    searchBar: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1.5, borderColor: '#1B1B1B', borderRadius: 24, paddingHorizontal: 16, height: 46,
    },
    searchInput: { flex: 1, fontSize: 14, color: '#1B1B1B' },
    section: { paddingHorizontal: 16, marginTop: 16 },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1B1B1B', marginBottom: 14 },
    keywordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    keywordChip: { borderWidth: 1, borderColor: '#1AA260', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
    keywordText: { fontSize: 13, fontWeight: '600', color: '#1AA260' },
    divider: { height: 8, backgroundColor: '#F5F6F8', marginTop: 20 },
});