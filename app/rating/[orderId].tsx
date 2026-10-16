// app/rating/[orderId].tsx
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';

const BLUE = '#2F86EB';
const GOLD = '#F5A623';

const DRIVER_TAGS = [
    'Ramah',
    'Cepat',
    'Bersih',
    'Komunikatif',
    'Sesuai rute',
];
const RESTO_TAGS = [
    'Porsi pas',
    'Rasa enak',
    'Kemasan rapi',
    'Sesuai pesanan',
    'Cepat',
];

// Id unik per kelompok: "driver:Cepat" berbeda dari "resto:Cepat"
const toTags = (group: 'driver' | 'resto', labels: string[]) =>
    labels.map((label) => ({ id: `${group}:${label}`, label }));

const DRIVER_TAG_ITEMS = toTags('driver', DRIVER_TAGS);
const RESTO_TAG_ITEMS = toTags('resto', RESTO_TAGS);

type TagItem = { id: string; label: string };

export default function RatingScreen() {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    const insets = useSafeAreaInsets();

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [driverRating, setDriverRating] = useState(0);
    const [restoRating, setRestoRating] = useState(0);
    const [comment, setComment] = useState('');
    const [tags, setTags] = useState<string[]>([]); // berisi id berprefix
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const o = await api.orders.get(Number(orderId));
                setOrder(o);
            } catch (e) {
                console.warn('[Rating] load gagal', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [orderId]);

    const toggleTag = (id: string) => {
        setTags((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const submit = async () => {
        if (driverRating === 0) {
            Alert.alert('Beri rating driver dulu');
            return;
        }
        setSubmitting(true);
        try {
            await api.submitRating({
                orderId: Number(orderId),
                rating: driverRating,
                comment,
                tags,
            });
            Alert.alert('Terima kasih!', 'Rating kamu sangat membantu.', [
                {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)' as any),
                },
            ]);
        } catch (e: any) {
            Alert.alert('Gagal', e?.message ?? 'Coba lagi');
        } finally {
            setSubmitting(false);
        }
    };

    const renderTags = (items: TagItem[]) => (
        <View style={s.tagList}>
            {items.map((t) => {
                const active = tags.includes(t.id);
                return (
                    <Pressable
                        key={t.id}
                        style={[s.tag, active && s.tagActive]}
                        onPress={() => toggleTag(t.id)}
                    >
                        <Text style={[s.tagText, active && s.tagTextActive]}>
                            {t.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );

    if (loading) {
        return (
            <View style={[s.center, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={BLUE} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScrollView
                contentContainerStyle={{
                    padding: 20,
                    paddingTop: insets.top + 20,
                    paddingBottom: 120,
                }}
            >
                <Text style={s.title}>Gimana pesananmu?</Text>
                <Text style={s.subtitle}>Bantu kami tingkatkan layanan</Text>

                {/* ===== DRIVER ===== */}
                <View style={s.card}>
                    <Text style={s.sectionTitle}>Rating Driver</Text>
                    <Text style={s.driverName}>
                        {order?.driver?.full_name ?? 'Driver'}
                    </Text>
                    <Stars value={driverRating} onChange={setDriverRating} />
                    {renderTags(DRIVER_TAG_ITEMS)}
                </View>

                {/* ===== RESTO ===== */}
                <View style={s.card}>
                    <Text style={s.sectionTitle}>Rating Resto</Text>
                    <Text style={s.driverName}>
                        {order?.merchant?.store_name ?? 'Resto'}
                    </Text>
                    <Stars value={restoRating} onChange={setRestoRating} />
                    {renderTags(RESTO_TAG_ITEMS)}
                </View>

                {/* ===== COMMENT ===== */}
                <View style={s.card}>
                    <Text style={s.sectionTitle}>Komentar (opsional)</Text>
                    <TextInput
                        style={s.textarea}
                        placeholder="Tulis pengalamanmu…"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>
            </ScrollView>

            <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
                <Pressable
                    style={[s.submitBtn, submitting && { opacity: 0.7 }]}
                    onPress={submit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={s.submitText}>Kirim Rating</Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

// ============================================================
// STARS
// ============================================================
function Stars({
    value,
    onChange,
}: {
    value: number;
    onChange: (n: number) => void;
}) {
    return (
        <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
                    <Ionicons
                        name={i <= value ? 'star' : 'star-outline'}
                        size={36}
                        color={GOLD}
                    />
                </Pressable>
            ))}
        </View>
    );
}

const s = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B1B1B',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 6,
    },

    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#EEF0F3',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1B1B1B',
        marginBottom: 6,
    },
    driverName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4B5563',
        marginBottom: 10,
    },

    starsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 6,
    },

    tagList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 14,
    },
    tag: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
    },
    tagActive: {
        backgroundColor: BLUE,
        borderColor: BLUE,
    },
    tagText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
    },
    tagTextActive: { color: '#fff' },

    textarea: {
        minHeight: 100,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 12,
        fontSize: 14,
        color: '#1B1B1B',
        marginTop: 8,
    },

    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#EEF0F3',
    },
    submitBtn: {
        height: 54,
        borderRadius: 27,
        backgroundColor: BLUE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
    },
});