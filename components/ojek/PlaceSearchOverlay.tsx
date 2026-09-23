import { formatDistance } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { autocompletePlaces, getPlaceDetails, newSessionToken } from '@/services/google-maps';
import type { Coords, PlaceLoc, PlaceSuggestion } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HighlightedText } from './parts';

type Props = {
    userCoords?: Coords | null;
    onClose: () => void;
    onSelect: (p: PlaceLoc) => void;
};

/** Layar cari alamat satu kolom, menutupi halaman di bawahnya */
export default function PlaceSearchOverlay({ userCoords, onClose, onSelect }: Props) {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const token = useRef(newSessionToken());
    const lat = userCoords?.latitude;
    const lng = userCoords?.longitude;

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            try {
                setResults(
                    await autocompletePlaces(q, {
                        origin: lat != null && lng != null ? { latitude: lat, longitude: lng } : undefined,
                        sessionToken: token.current,
                        signal: ctrl.signal,
                    })
                );
            } catch (e: any) {
                if (e?.name !== 'AbortError') setResults([]);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, 350);
        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [query, lat, lng]);

    const pick = async (s: PlaceSuggestion) => {
        if (resolvingId) return;
        try {
            setResolvingId(s.placeId);
            const place = await getPlaceDetails(s.placeId, token.current);
            token.current = newSessionToken();
            onSelect(place);
        } catch {
            Alert.alert('Gagal', 'Detail lokasi belum bisa diambil. Coba lagi ya.');
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', paddingTop: insets.top + 8 }]}>
            <View style={s.header}>
                <Pressable onPress={onClose} hitSlop={12}>
                    <Ionicons name="arrow-back" size={26} color={colors.text} />
                </Pressable>
                <View style={s.inputWrap}>
                    <TextInput
                        autoFocus
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Cari nama tempat atau alamat"
                        placeholderTextColor={colors.textMuted}
                        style={s.input}
                        returnKeyType="search"
                    />
                    {loading && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
            </View>
            <View style={s.line} />
            <FlatList
                data={results}
                keyExtractor={(i) => i.placeId}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={s.line} />}
                ListEmptyComponent={
                    query.trim().length >= 2 && !loading ? (
                        <Text style={s.empty}>Lokasi tidak ditemukan. Coba kata kunci lain.</Text>
                    ) : null
                }
                contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
                renderItem={({ item }) => (
                    <Pressable onPress={() => pick(item)} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.field }]}>
                        <View style={s.left}>
                            {resolvingId === item.placeId ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Ionicons name="location-sharp" size={26} color="#b7bcc4" />
                            )}
                            {item.distanceMeters != null && <Text style={s.dist}>{formatDistance(item.distanceMeters)}</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                            <HighlightedText text={item.mainText} matches={item.matches} style={s.main} />
                            {!!item.secondaryText && <Text style={s.sub}>{item.secondaryText}</Text>}
                        </View>
                    </Pressable>
                )}
            />
        </View>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
    inputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: 24,
        paddingHorizontal: 16,
        backgroundColor: colors.field,
        borderWidth: 1,
        borderColor: colors.border,
    },
    input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
    line: { height: 1, backgroundColor: colors.border },
    row: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
    left: { width: 52, alignItems: 'center', gap: 2 },
    dist: { fontSize: 12, color: colors.textMuted },
    main: { fontSize: 16, fontWeight: '700', color: colors.text },
    sub: { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
    empty: { textAlign: 'center', color: colors.textMuted, padding: 32 },
});