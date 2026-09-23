import { formatDistance } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { autocompletePlaces, getPlaceDetails, newSessionToken } from '@/services/google-maps';
import type { PlaceLoc } from '@/types/gosend';
import type { PlaceSuggestion } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResultSkeleton from '../ojek/ResultSkeleteon';
import { HighlightedText } from '../ojek/parts';

type Props = {
    origin: PlaceLoc;
    onBack: () => void;
    onSwap: () => void;
    onSelectDestination: (place: PlaceLoc) => void;
    onPickOnMap: () => void;
    recentAddresses: PlaceLoc[];
};

export default function SearchAddressStep({
    origin,
    onBack,
    onSwap,
    onSelectDestination,
    onPickOnMap,
    recentAddresses,
}: Props) {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const token = useRef(newSessionToken());

    const lat = origin.coords.latitude;
    const lng = origin.coords.longitude;

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setLoading(false);
            setError(false);
            return;
        }
        setLoading(true);
        setError(false);
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            try {
                const r = await autocompletePlaces(q, {
                    origin: { latitude: lat, longitude: lng },
                    sessionToken: token.current,
                    signal: ctrl.signal,
                });
                setResults(r);
            } catch (e: any) {
                if (e?.name !== 'AbortError') {
                    setResults([]);
                    setError(true);
                }
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 350);
        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [query, lat, lng]);

    const pick = async (sug: PlaceSuggestion) => {
        if (resolvingId) return;
        try {
            setResolvingId(sug.placeId);
            const place = await getPlaceDetails(sug.placeId, token.current);
            token.current = newSessionToken(); // sesi autocomplete berakhir setelah details
            setQuery('');
            setResults([]);
            onSelectDestination(place);
        } catch {
            Alert.alert('Gagal', 'Detail lokasi belum bisa diambil. Coba lagi ya.');
        } finally {
            setResolvingId(null);
        }
    };

    const showList = query.trim().length >= 2;

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: '#fff',
                paddingTop: insets.top + 8,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right,
            }}
        >
            <View style={s.header}>
                <Pressable onPress={onBack} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={s.title}>Mau kirim paket ke mana?</Text>
            </View>

            <View style={s.card}>
                <View style={s.row}>
                    <View style={s.originDot}>
                        <Ionicons name="arrow-up" size={12} color="#fff" />
                    </View>
                    <Text style={s.value} numberOfLines={1}>{origin.name}</Text>
                    <Pressable onPress={onSwap} style={s.swapBtn}>
                        <Ionicons name="swap-vertical" size={18} color={colors.text} />
                    </Pressable>
                </View>
                <View style={s.divider} />
                <View style={s.row}>
                    <View style={s.destDot}>
                        <Ionicons name="arrow-down" size={12} color="#fff" />
                    </View>
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Kirim paket ke mana?"
                        placeholderTextColor={colors.textMuted}
                        style={s.input}
                        autoFocus
                        returnKeyType="search"
                    />
                    {loading && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
            </View>

            <View style={s.pills}>
                <Pressable style={s.pill} onPress={onPickOnMap}>
                    <Ionicons name="map" size={18} color={colors.primary} />
                    <Text style={s.pillText}>Pilih lewat peta</Text>
                </Pressable>
                <Pressable
                    style={s.pill}
                    onPress={() => Alert.alert('Segera hadir', 'Fitur minta lokasi belum tersedia.')}
                >
                    <Ionicons name="location" size={18} color={colors.secondary} />
                    <Text style={s.pillText}>Minta lokasi</Text>
                </Pressable>
            </View>
            <View style={s.line} />

            {!showList ? (
                recentAddresses.length > 0 ? (
                    <Animated.View entering={FadeInDown.duration(300)}>
                        <Text style={s.sectionTitle}>Alamat terakhir</Text>
                        <FlatList
                            data={recentAddresses}
                            keyExtractor={(item, i) => `${item.name}-${item.address}-${i}`}
                            ItemSeparatorComponent={() => <View style={s.line} />}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={s.result}
                                    onPress={() => onSelectDestination(item)}
                                >
                                    <View style={s.resultLeft}>
                                        <Ionicons name="time-outline" size={26} color="#b7bcc4" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.resultMain} numberOfLines={1}>{item.name}</Text>
                                        <Text style={s.resultSub} numberOfLines={2}>{item.address}</Text>
                                    </View>
                                </Pressable>
                            )}
                        />
                    </Animated.View>
                ) : (
                    <Animated.View entering={FadeInDown.duration(300)} style={s.tip}>
                        <View style={s.tipIcon}>
                            <Ionicons name="cube" size={34} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.tipTitle}>Yuk, kirim paketmu!</Text>
                            <Text style={s.tipSub}>Cari alamat tujuan, driver kami siap antar dengan aman dan cepat.</Text>
                        </View>
                    </Animated.View>
                )
            ) : loading && results.length === 0 ? (
                <ResultSkeleton />
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(i) => i.placeId}
                    keyboardShouldPersistTaps="handled"
                    ItemSeparatorComponent={() => <View style={s.line} />}
                    ListEmptyComponent={
                        <Text style={s.empty}>
                            {error
                                ? 'Pencarian sedang bermasalah. Cek koneksi internet, lalu coba lagi.'
                                : 'Lokasi tidak ditemukan. Coba kata kunci lain.'}
                        </Text>
                    }
                    contentContainerStyle={{ paddingBottom: 16 }}
                    renderItem={({ item }) => (
                        <Animated.View entering={FadeIn.duration(150)}>
                            <Pressable
                                onPress={() => pick(item)}
                                style={({ pressed }) => [s.result, pressed && { backgroundColor: colors.field }]}
                            >
                                <View style={s.resultLeft}>
                                    {resolvingId === item.placeId ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Ionicons name="location-sharp" size={26} color="#b7bcc4" />
                                    )}
                                    {item.distanceMeters != null && <Text style={s.dist}>{formatDistance(item.distanceMeters)}</Text>}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <HighlightedText text={item.mainText} matches={item.matches} style={s.resultMain} />
                                    {!!item.secondaryText && <Text style={s.resultSub}>{item.secondaryText}</Text>}
                                </View>
                            </Pressable>
                        </Animated.View>
                    )}
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 12 },
    title: { fontSize: 20, fontWeight: '800', color: colors.text },
    card: {
        marginHorizontal: 20,
        marginTop: 8,
        backgroundColor: colors.field,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 16,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56 },
    originDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
    destDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
    value: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textMuted },
    input: { flex: 1, fontSize: 16, paddingVertical: 0, color: colors.text },
    swapBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: 38 },
    pills: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 14, marginBottom: 14 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.border,
    },
    pillText: { fontWeight: '600', color: colors.text },
    line: { height: 1, backgroundColor: colors.border },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },
    tip: { flexDirection: 'row', gap: 16, padding: 20, alignItems: 'center' },
    tipIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
    tipTitle: { fontWeight: '800', fontSize: 16, color: colors.text },
    tipSub: { color: colors.textMuted, marginTop: 2, lineHeight: 20 },
    result: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
    resultLeft: { width: 52, alignItems: 'center', gap: 2 },
    dist: { fontSize: 12, color: colors.textMuted },
    resultMain: { fontSize: 16, fontWeight: '700', color: colors.text },
    resultSub: { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
    empty: { textAlign: 'center', color: colors.textMuted, padding: 32 },
});