// app/promo.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PromoScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
                <Ionicons name="arrow-back" size={26} color="#1B1B1B" />
            </Pressable>
            <Text style={s.title}>Serba Promo</Text>
            <Text style={s.subtitle}>Semua diskon dan promo resto ada di sini.</Text>

            {/* TODO: sambungkan ke endpoint promo */}
            <View style={s.empty}>
                <Ionicons name="pricetags-outline" size={48} color="#B0B5BD" />
                <Text style={s.emptyText}>Segera hadir</Text>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
    back: { width: 36, height: 36, justifyContent: 'center', marginBottom: 6 },
    title: { fontSize: 24, fontWeight: '800', color: '#1B1B1B' },
    subtitle: { fontSize: 15, color: '#3A3F47', marginTop: 2 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyText: { fontSize: 14, color: '#5C6470' },
});