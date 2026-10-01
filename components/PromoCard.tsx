import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
    title: string;
    address: string;
    rating: number;
    reviewCount: string;
    discount: string;
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
    const [liked, setLiked] = useState(false);

    return (
        <View style={styles.card}>
            <View>
                <Image source={{ uri: imageUrl }} style={styles.image} />
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{discount}</Text>
                </View>
                <Pressable style={styles.heart} onPress={() => setLiked(!liked)}>
                    <Ionicons
                        name={liked ? 'heart' : 'heart-outline'}
                        size={22}
                        color={liked ? '#E53935' : '#1B1B1B'}
                    />
                </Pressable>
            </View>

            <View style={styles.info}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.row}>
                    <Ionicons name="location-outline" size={18} color="#6B7280" />
                    <Text style={styles.address} numberOfLines={1}>{address}</Text>
                </View>
                <View style={styles.row}>
                    <Ionicons name="star" size={18} color="#FFB400" />
                    <Text style={styles.rating}>{rating} ({reviewCount})</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        width: 260,
        backgroundColor: '#fff',
        borderRadius: 22,
        marginRight: 14,
        overflow: 'hidden',
        shadowColor: '#2F86EB',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    image: { width: '100%', height: 150 },
    badge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: '#F44336',
        borderRadius: 14,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    badgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    heart: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: { padding: 14, gap: 6 },
    title: { fontSize: 18, fontWeight: '800', color: '#1B1B1B' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    address: { flex: 1, fontSize: 13, color: '#6B7280' },
    rating: { fontSize: 14, fontWeight: '600', color: '#374151' },
});