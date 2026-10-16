// AddressSearchModal.tsx (taruh satu folder dengan HomeStep.tsx)
import { autocompletePlaces, getPlaceDetails, newSessionToken } from '@/services/google-maps';
import type { PlaceSuggestion } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RED = '#D71920';
const GREEN = '#1AA260';

export type PickedAddress = {
    label: string;
    latitude: number;
    longitude: number;
};

type Props = {
    visible: boolean;
    currentLabel?: string;
    userCoords?: { latitude: number; longitude: number } | null;
    onClose: () => void;
    onSelect: (addr: PickedAddress) => void;
    /** Dipanggil saat "Gunakan lokasi saat ini" ditekan. Harus mengembalikan promise. */
    onUseCurrent: () => Promise<void>;
};

// PlaceLoc dari getPlaceDetails: baca koordinat secara defensif
function coordsOf(p: any): { latitude: number; longitude: number } | null {
    const lat = p?.coords?.latitude ?? p?.latitude ?? p?.lat;
    const lng = p?.coords?.longitude ?? p?.longitude ?? p?.lng ?? p?.lon;
    return typeof lat === 'number' && typeof lng === 'number'
        ? { latitude: lat, longitude: lng }
        : null;
}

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function AddressSearchModal({
    visible, currentLabel, userCoords, onClose, onSelect, onUseCurrent,
}: Props) {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const token = useRef(newSessionToken());

    const lat = userCoords?.latitude;
    const lng = userCoords?.longitude;

    // reset tiap modal dibuka
    useEffect(() => {
        if (visible) {
            setQuery('');
            setResults([]);
            setError(false);
            token.current = newSessionToken();
        }
    }, [visible]);

    // autocomplete (debounce 350ms)
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

    const pick = async (sug: PlaceSuggestion) => {
        if (resolvingId) return;
        try {
            setResolvingId(sug.placeId);
            const place: any = await getPlaceDetails(sug.placeId, token.current);
            token.current = newSessionToken();
            const c = coordsOf(place);
            if (!c) throw new Error('Koordinat tidak ditemukan');
            Keyboard.dismiss();
            onSelect({
                label: place?.name ?? sug.mainText,
                latitude: c.latitude,
                longitude: c.longitude,
            });
        } catch {
            Alert.alert('Gagal', 'Detail lokasi belum bisa diambil. Coba lagi ya.');
        } finally {
            setResolvingId(null);
        }
    };

    const useCurrent = async () => {
        if (gpsLoading) return;
        setGpsLoading(true);
        try {
            await onUseCurrent();
        } finally {
            setGpsLoading(false);
        }
    };

    const showList = query.trim().length >= 2;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={[s.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
                <View style={s.header}>
                    <Pressable onPress={onClose} hitSlop={12}>
                        <Ionicons name="close" size={28} color="#1B1B1B" />
                    </Pressable>
                    <Text style={s.title}>Mau dikirim ke mana?</Text>
                </View>

                <View style={s.inputWrap}>
                    <Ionicons name="search" size={20} color="#8A8F98" />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        autoFocus
                        placeholder="Cari alamat pengantaran"
                        placeholderTextColor="#8A8F98"
                        style={s.input}
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <Pressable onPress={() => setQuery('')} hitSlop={10}>
                            <Ionicons name="close-circle" size={18} color="#B0B5BD" />
                        </Pressable>
                    )}
                </View>

                <Pressable style={s.currentRow} onPress={useCurrent} disabled={gpsLoading}>
                    <View style={s.currentIcon}>
                        {gpsLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="navigate" size={18} color="#fff" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.currentTitle}>Gunakan lokasi saat ini</Text>
                        <Text style={s.currentSub} numberOfLines={1}>
                            {gpsLoading ? 'Mencari lokasi...' : 'Ambil ulang dari GPS'}
                        </Text>
                    </View>
                </Pressable>

                {currentLabel ? (
                    <Text style={s.activeLabel} numberOfLines={1}>
                        Alamat aktif: {currentLabel}
                    </Text>
                ) : null}

                <View style={s.line} />

                {!showList ? (
                    <View style={s.tip}>
                        <Ionicons name="restaurant-outline" size={36} color="#B0B5BD" />
                        <Text style={s.tipText}>
                            Ketik nama jalan, gedung, atau area untuk menemukan resto di sekitar sana.
                        </Text>
                    </View>
                ) : loading && results.length === 0 ? (
                    <View style={s.tip}>
                        <ActivityIndicator color={RED} />
                    </View>
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
                            <Pressable
                                onPress={() => pick(item)}
                                style={({ pressed }) => [s.result, pressed && { backgroundColor: '#F4F5F7' }]}
                            >
                                <View style={s.resultLeft}>
                                    {resolvingId === item.placeId ? (
                                        <ActivityIndicator size="small" color={RED} />
                                    ) : (
                                        <Ionicons name="location-sharp" size={26} color="#b7bcc4" />
                                    )}
                                    {item.distanceMeters != null && (
                                        <Text style={s.dist}>{fmtDist(item.distanceMeters)}</Text>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.resultMain}>{item.mainText}</Text>
                                    {!!item.secondaryText && <Text style={s.resultSub}>{item.secondaryText}</Text>}
                                </View>
                            </Pressable>
                        )}
                    />
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 12 },
    title: { fontSize: 20, fontWeight: '800', color: '#1B1B1B' },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 20, marginTop: 4, height: 52, paddingHorizontal: 16,
        backgroundColor: '#F4F5F7', borderRadius: 26, borderWidth: 1, borderColor: '#E5E8EC',
    },
    input: { flex: 1, fontSize: 16, color: '#1B1B1B', paddingVertical: 0 },
    currentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
    currentIcon: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN,
        alignItems: 'center', justifyContent: 'center',
    },
    currentTitle: { fontSize: 15, fontWeight: '800', color: '#1B1B1B' },
    currentSub: { fontSize: 12, color: '#5C6470', marginTop: 2 },
    activeLabel: { fontSize: 12, color: '#8A8F98', paddingHorizontal: 20, marginBottom: 10 },
    line: { height: 1, backgroundColor: '#E5E8EC' },
    tip: { alignItems: 'center', gap: 12, padding: 40 },
    tipText: { textAlign: 'center', color: '#5C6470', lineHeight: 20 },
    result: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
    resultLeft: { width: 52, alignItems: 'center', gap: 2 },
    dist: { fontSize: 12, color: '#8A8F98' },
    resultMain: { fontSize: 16, fontWeight: '700', color: '#1B1B1B' },
    resultSub: { color: '#5C6470', marginTop: 4, lineHeight: 20 },
    empty: { textAlign: 'center', color: '#5C6470', padding: 32 },
});