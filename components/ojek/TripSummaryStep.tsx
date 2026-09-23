import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import type { OrderPayload } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Driver } from './DriverFoundStep';

type Props = {
    payload: OrderPayload;
    driver: Driver;
    /** dipanggil saat pengguna menekan "Kirim ulasan" */
    onSubmit: (rating: number, message: string, tags: string[]) => void;
    /** dipanggil saat pengguna menekan "Lewati" */
    onSkip: () => void;
};

const TAGS_GOOD = ['Ramah', 'Aman berkendara', 'Tepat waktu', 'Kendaraan bersih'];
const TAGS_BAD = ['Terlambat', 'Rute memutar', 'Kurang sopan', 'Berkendara ugal-ugalan'];

function Avatar({ name, uri }: { name: string; uri?: string }) {
    const [failed, setFailed] = useState(false);
    const initials = name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('');
    if (uri && !failed) {
        return <Image source={{ uri }} style={s.avatar} onError={() => setFailed(true)} />;
    }
    return (
        <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarText}>{initials}</Text>
        </View>
    );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <View style={s.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
                    <Ionicons
                        name={n <= value ? 'star' : 'star-outline'}
                        size={38}
                        color={n <= value ? '#f5a623' : '#d8dce1'}
                        style={{ marginHorizontal: 4 }}
                    />
                </Pressable>
            ))}
        </View>
    );
}

const RATING_LABEL: Record<number, string> = {
    1: 'Sangat mengecewakan',
    2: 'Kurang memuaskan',
    3: 'Cukup baik',
    4: 'Baik',
    5: 'Sangat memuaskan',
};

export default function TripSummaryStep({ payload, driver, onSubmit, onSkip }: Props) {
    const insets = useSafeAreaInsets();
    const [rating, setRating] = useState(0);
    const [message, setMessage] = useState('');
    const [tags, setTags] = useState<string[]>([]);

    const tagOptions = rating > 0 && rating <= 3 ? TAGS_BAD : TAGS_GOOD;

    const toggleTag = (t: string) => {
        setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
    };

    const submit = () => onSubmit(rating, message.trim(), tags);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#fff' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* header sukses */}
                <Animated.View entering={FadeInUp.duration(300)} style={s.header}>
                    <View style={s.successCircle}>
                        <Ionicons name="checkmark" size={30} color="#fff" />
                    </View>
                    <Text style={s.headerTitle}>Perjalanan selesai!</Text>
                    <Text style={s.headerSub}>Terima kasih sudah menggunakan Waruung</Text>
                </Animated.View>

                {/* ringkasan rute */}
                <View style={s.routeCard}>
                    <View style={s.routeRow}>
                        <View style={[s.routeDot, { backgroundColor: colors.primary }]}>
                            <Ionicons name="arrow-up" size={12} color="#fff" />
                        </View>
                        <Text style={s.routeText} numberOfLines={1}>{payload.origin.name}</Text>
                    </View>
                    <View style={s.routeLine} />
                    <View style={s.routeRow}>
                        <View style={[s.routeDot, { backgroundColor: '#f26b21' }]}>
                            <View style={s.routeDotInner} />
                        </View>
                        <Text style={s.routeText} numberOfLines={1}>{payload.destination.name}</Text>
                    </View>

                    <View style={s.divider} />

                    <View style={s.fareRow}>
                        <Text style={s.fareLabel}>{payload.optionName}</Text>
                        <Text style={s.farePrice}>{formatRupiah(payload.price)}</Text>
                    </View>
                </View>

                {/* driver */}
                <View style={s.driverRow}>
                    <Avatar name={driver.name} uri={driver.photo} />
                    <View style={{ flex: 1 }}>
                        <Text style={s.driverName} numberOfLines={1}>{driver.name}</Text>
                        <Text style={s.driverPlate} numberOfLines={1}>{driver.vehicle} • {driver.plate}</Text>
                    </View>
                </View>

                {/* rating */}
                <View style={s.ratingSection}>
                    <Text style={s.ratingQuestion}>Bagaimana perjalananmu{'\n'}dengan {driver.name.split(' ')[0]}?</Text>
                    <StarRating value={rating} onChange={setRating} />
                    {rating > 0 && <Text style={s.ratingLabel}>{RATING_LABEL[rating]}</Text>}
                </View>

                {/* tag cepat */}
                {rating > 0 && (
                    <Animated.View entering={FadeInUp.duration(250)} style={s.tagWrap}>
                        {tagOptions.map((t) => {
                            const active = tags.includes(t);
                            return (
                                <Pressable
                                    key={t}
                                    onPress={() => toggleTag(t)}
                                    style={[s.tag, active && s.tagActive]}
                                >
                                    <Text style={[s.tagText, active && s.tagTextActive]}>{t}</Text>
                                </Pressable>
                            );
                        })}
                    </Animated.View>
                )}

                {/* pesan */}
                {rating > 0 && (
                    <Animated.View entering={FadeInUp.duration(250)}>
                        <TextInput
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Tulis pesan untuk driver (opsional)"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            style={s.input}
                        />
                    </Animated.View>
                )}

                <Pressable
                    disabled={rating === 0}
                    onPress={submit}
                    style={[s.submitBtn, { opacity: rating === 0 ? 0.5 : 1 }]}
                >
                    <Text style={s.submitText}>Kirim ulasan</Text>
                </Pressable>

                <Pressable onPress={onSkip} style={s.skipBtn}>
                    <Text style={s.skipText}>Lewati</Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    header: { alignItems: 'center', marginBottom: 24 },
    successCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

    routeCard: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 30 },
    routeDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    routeDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    routeText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
    routeLine: { height: 14, width: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 10 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 12 },
    fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    fareLabel: { fontSize: 13, color: colors.textMuted },
    farePrice: { fontSize: 16, fontWeight: '800', color: colors.text },

    driverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#F5F6F8',
        marginBottom: 24,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#dfe3e8' },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
    avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    driverName: { fontSize: 15, fontWeight: '800', color: colors.text },
    driverPlate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    ratingSection: { alignItems: 'center', marginBottom: 8 },
    ratingQuestion: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 22 },
    starRow: { flexDirection: 'row', marginTop: 16 },
    ratingLabel: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 10 },

    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 },
    tag: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tagActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    tagText: { fontSize: 13, color: colors.text },
    tagTextActive: { color: colors.primary, fontWeight: '700' },

    input: {
        marginTop: 20,
        minHeight: 90,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 14,
        fontSize: 14,
        color: colors.text,
        textAlignVertical: 'top',
    },

    submitBtn: {
        height: 54,
        borderRadius: 27,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
    },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    skipBtn: { alignItems: 'center', paddingVertical: 16 },
    skipText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});