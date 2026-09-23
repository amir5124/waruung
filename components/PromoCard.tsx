import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import DiscountBadge from './DiscountBadge';

type Props = {
    title: string;
    address: string;
    rating: number;
    reviewCount: string;
    discount?: string;
    imageUrl: string;
};

export default function PromoCard({
    title,
    address,
    rating,
    reviewCount,
    discount,
    imageUrl,
}: Props) {
    return (
        <View style={styles.card}>
            {discount && (
                <View style={styles.badgeWrap}>
                    <DiscountBadge label={discount} />
                </View>
            )}
            <View style={styles.imageWrap}>
                <Image source={{ uri: imageUrl }} style={styles.image} />
                <Pressable style={styles.heart}>
                    <Ionicons name="heart-outline" size={16} color="#1B1B1B" />
                </Pressable>
            </View>
            <View style={styles.info}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.address} numberOfLines={1}>
                    {address}
                </Text>
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#FFC107" />
                    <Text style={styles.rating}>
                        {rating} ({reviewCount})
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        width: 200,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginRight: 12,
        marginTop: 8, // beri ruang supaya badge yang overflow ke atas tidak terpotong ScrollView
        borderWidth: 1,
        borderColor: '#EEF1F5',
    },
    imageWrap: {
        position: 'relative',
        overflow: 'hidden',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    image: { width: '100%', height: 120 },
    badgeWrap: {
        position: 'absolute',
        top: 8,
        left: 0,
        zIndex: 10,
    },
    heart: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#fff',
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: { padding: 10 },
    title: { fontSize: 14, fontWeight: '700', color: '#1B1B1B', marginBottom: 2 },
    address: { fontSize: 12, color: '#8A8F98', marginBottom: 6 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rating: { fontSize: 12, fontWeight: '600', color: '#1B1B1B' },
});