import { formatDistance } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { autocompletePlaces, getPlaceDetails, newSessionToken } from '@/services/google-maps';
import type { Coords, PlaceLoc, PlaceSuggestion } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResultSkeleton from '../ojek/ResultSkeleteon';
import { HighlightedText, PinDot } from './parts';

export type SearchField = 'origin' | 'destination';

type Props = {
    origin: PlaceLoc | null;
    destination: PlaceLoc | null;
    userCoords?: Coords | null;
    initialFocus: SearchField;
    onClose: () => void;
    onSelectOrigin: (p: PlaceLoc) => void;
    onSelectDestination: (p: PlaceLoc) => void;
    onPickOnMap: (field: SearchField) => void;
};

const CURRENT_LABEL = 'Lokasi kamu sekarang';

export default function SearchStep({
    origin, destination, userCoords, initialFocus, onClose, onSelectOrigin, onSelectDestination, onPickOnMap,
}: Props) {
    const insets = useSafeAreaInsets();
    const [active, setActive] = useState<SearchField>(initialFocus);
    const [originText, setOriginText] = useState(origin ? (origin.isCurrent ? CURRENT_LABEL : origin.name) : '');
    const [destText, setDestText] = useState(destination?.name ?? '');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const token = useRef(newSessionToken());
    const destRef = useRef<TextInput>(null);

    // lokasi GPS baru masuk setelah layar ini terbuka
    useEffect(() => {
        if (origin?.isCurrent && active !== 'origin') setOriginText(CURRENT_LABEL);
    }, [origin?.isCurrent]); // eslint-disable-line react-hooks/exhaustive-deps

    const lat = userCoords?.latitude;
    const lng = userCoords?.longitude;

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
                    origin: lat != null && lng != null ? { latitude: lat, longitude: lng } : undefined,
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

    const onChange = (field: SearchField, text: string) => {
        if (field === 'origin') setOriginText(text);
        else setDestText(text);
        setQuery(text);
    };

    const onFocus = (field: SearchField) => {
        setActive(field);
        setQuery('');
        setResults([]);
    };

    const pick = async (sug: PlaceSuggestion) => {
        if (resolvingId) return;
        try {
            setResolvingId(sug.placeId);
            const place = await getPlaceDetails(sug.placeId, token.current);
            token.current = newSessionToken(); // sesi autocomplete berakhir setelah details
            setQuery('');
            setResults([]);
            if (active === 'origin') {
                setOriginText(place.name);
                onSelectOrigin(place);
                if (!destination) destRef.current?.focus();
            } else {
                setDestText(place.name);
                onSelectDestination(place);
            }
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
                // isi berhenti di atas bar navigasi sistem; latar putih tetap menyambung
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right,
            }}
        >
            <View style={s.header}>
                <Pressable onPress={onClose} hitSlop={12}>
                    <Ionicons name="close" size={28} color={colors.text} />
                </Pressable>
                <Text style={s.title}>Mau ke mana hari ini?</Text>
            </View>

            <View style={s.card}>
                <View style={s.row}>
                    <PinDot type="origin" size={26} />
                    <TextInput
                        value={originText}
                        onChangeText={(t) => onChange('origin', t)}
                        onFocus={() => onFocus('origin')}
                        selectTextOnFocus
                        placeholder={CURRENT_LABEL}
                        placeholderTextColor={colors.textMuted}
                        style={[s.input, { color: colors.textMuted }, active === 'origin' && { color: colors.text }]}
                        returnKeyType="search"
                    />
                </View>
                <View style={s.divider} />
                <View style={s.row}>
                    <PinDot type="destination" size={26} />
                    <TextInput
                        ref={destRef}
                        value={destText}
                        onChangeText={(t) => onChange('destination', t)}
                        onFocus={() => onFocus('destination')}
                        selectTextOnFocus
                        autoFocus={initialFocus === 'destination'}
                        placeholder="Cari lokasi tujuan"
                        placeholderTextColor={colors.textMuted}
                        style={[s.input, { color: colors.text }]}
                        returnKeyType="search"
                    />
                </View>
            </View>

            <View style={s.pills}>
                <Pressable style={s.pill} onPress={() => onPickOnMap(active)}>
                    <Ionicons name="map" size={18} color={colors.primary} />
                    <Text style={s.pillText}>Pilih lewat peta</Text>
                </Pressable>
                <Pressable
                    style={s.pill}
                    onPress={() => Alert.alert('Segera hadir', 'Fitur multi-tujuan belum tersedia.')}
                >
                    <Ionicons name="add-circle" size={18} color={colors.secondary} />
                    <Text style={s.pillText}>Tambah tujuan</Text>
                </Pressable>
            </View>
            <View style={s.line} />

            {!showList ? (
                <Animated.View entering={FadeInDown.duration(300)} style={s.tip}>
                    <View style={s.tipIcon}>
                        <Ionicons name="thumbs-up" size={34} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.tipTitle}>Yuk, berangkat naik ojek!</Text>
                        <Text style={s.tipSub}>Tinggal duduk manis, sampai tujuan dengan aman dan nyaman.</Text>
                    </View>
                </Animated.View>
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
                    // inset bawah sudah ditangani View luar, jadi cukup jarak kecil di sini
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
    input: { flex: 1, fontSize: 16, paddingVertical: 0 },
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