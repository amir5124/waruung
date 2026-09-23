import type { RestoItem } from '@/types/warfood';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

const RED = '#D71920';

export default function RestoCard({ item, onPress }: { item: RestoItem; onPress?: () => void }) {
    return (
        <Pressable style={s.card} onPress={onPress}>
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={s.image} />}
            <View style={{ flex: 1 }}>
                <View style={s.titleRow}>
                    <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                </View>

                <View style={s.metaRow}>
                    {item.isNew && (
                        <>
                            <Ionicons name="sparkles" size={12} color={RED} />
                            <Text style={s.newText}>Baru</Text>
                            <Text style={s.dot}>•</Text>
                        </>
                    )}
                    {item.rating != null && (
                        <>
                            <Ionicons name="star" size={12} color="#F5A623" />
                            <Text style={s.metaText}>
                                {item.rating.toFixed(1)} ({item.ratingCount! > 1000 ? `${Math.round(item.ratingCount! / 1000)}rb` : item.ratingCount}+ ratings)
                            </Text>
                        </>
                    )}
                    {item.priceRange && (
                        <>
                            <Text style={s.dot}>•</Text>
                            <Text style={s.metaText}>{item.priceRange}</Text>
                        </>
                    )}
                </View>

                {item.category && !item.rating && (
                    <Text style={s.metaText}>{item.category}</Text>
                )}

                <View style={s.ongkirRow}>
                    <Text style={s.ongkirText}>{item.ongkir}</Text>
                    <Text style={s.dot}>•</Text>
                    <Text style={s.metaText}>{item.duration}</Text>
                </View>

                {(item.discountLabel || item.discountLabel2) && (
                    <View style={s.badgeRow}>
                        {item.discountLabel && (
                            <View style={s.badge}>
                                <Ionicons name="pricetag" size={10} color={RED} />
                                <Text style={s.badgeText} numberOfLines={1}>{item.discountLabel}</Text>
                            </View>
                        )}
                        {item.discountLabel2 && (
                            <View style={s.badge}>
                                <Text style={s.badgeText}>{item.discountLabel2}</Text>
                            </View>
                        )}
                    </View>
                )}

                {item.reviewQuote && (
                    <View style={s.quoteRow}>
                        <Ionicons name="person-circle-outline" size={16} color="#8A8F98" />
                        <Text style={s.quoteText} numberOfLines={1}>{item.reviewQuote}</Text>
                    </View>
                )}
            </View>
        </Pressable>
    );
}

const s = StyleSheet.create({
    card: {
        flexDirection: 'row',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
    },
    image: { width: 72, height: 72, borderRadius: 12 },
    titleRow: { marginBottom: 2 },
    name: { fontSize: 15, fontWeight: '800', color: '#1B1B1B' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
    metaText: { fontSize: 12, color: '#5C6470' },
    newText: { fontSize: 12, fontWeight: '700', color: RED },
    dot: { fontSize: 12, color: '#C4C8CF', marginHorizontal: 2 },
    ongkirRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
    ongkirText: { fontSize: 12, fontWeight: '700', color: '#1B1B1B' },
    badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        borderWidth: 1, borderColor: '#F0E0E0', borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 3,
    },
    badgeText: { fontSize: 10, fontWeight: '600', color: '#1B1B1B' },
    quoteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    quoteText: { flex: 1, fontSize: 11, color: '#5C6470', fontStyle: 'italic' },
});