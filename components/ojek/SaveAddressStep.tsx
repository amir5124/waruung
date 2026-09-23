import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import type { SavedKind } from '@/hooks/use-saved-addresses';
import { reverseGeocode } from '@/services/google-maps';
import type { Coords, PlaceLoc } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER, PinDot } from './parts';
import PlaceSearchOverlay from './PlaceSearchOverlay';

type Props = {
    kind: SavedKind;
    /** titik awal di peta (name = nama singkat, address boleh kosong -> dicari otomatis) */
    initial: PlaceLoc;
    /** isi awal kolom "Nama alamat" */
    initialLabel: string;
    userCoords?: Coords | null;
    onBack: () => void;
    onSave: (place: PlaceLoc) => void;
};

const PIN = 44;
const PIN_HEIGHT = PIN + 14;

export default function SaveAddressStep({ kind, initial, initialLabel, userCoords, onBack, onSave }: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [picked, setPicked] = useState<PlaceLoc>(initial);
    const [label, setLabel] = useState(initialLabel);
    const [resolving, setResolving] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const moved = useRef(false);
    const skipNext = useRef(false);
    const reqId = useRef(0);
    const lift = useSharedValue(0);

    const resolve = async (c: Coords) => {
        const id = ++reqId.current;
        setResolving(true);
        const r = await reverseGeocode(c);
        if (id !== reqId.current) return;
        setPicked({ coords: c, name: r.name, address: r.address });
        setResolving(false);
    };

    useEffect(() => {
        if (!initial.address) resolve(initial.coords);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // saat pencarian terbuka, tombol back menutup pencarian dulu
    useEffect(() => {
        if (!showSearch) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setShowSearch(false);
            return true;
        });
        return () => sub.remove();
    }, [showSearch]);

    const onRegionComplete = (r: Region) => {
        lift.value = withSpring(0, { damping: 14 });
        if (skipNext.current) {
            skipNext.current = false;
            return;
        }
        if (!moved.current) return;
        resolve({ latitude: r.latitude, longitude: r.longitude });
    };

    const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -PIN_HEIGHT / 2 + lift.value }] }));

    const handleSearchSelect = (p: PlaceLoc) => {
        setShowSearch(false);
        reqId.current++; // batalkan reverse-geocode yang sedang jalan
        setResolving(false);
        setPicked({ coords: p.coords, name: p.name, address: p.address });
        skipNext.current = true;
        mapRef.current?.animateToRegion({ ...p.coords, ...MAP_DELTA }, 400);
    };

    const canSave = !!label.trim() && !resolving && !!picked.address;

    return (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={{ flex: 1 }}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    initialRegion={{ ...initial.coords, ...MAP_DELTA }}
                    showsUserLocation
                    showsMyLocationButton={false}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    onPanDrag={() => {
                        moved.current = true;
                        lift.value = withSpring(-14, { damping: 14 });
                    }}
                    onRegionChangeComplete={onRegionComplete}
                />

                <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.pinWrap]}>
                    <Animated.View style={[{ alignItems: 'center' }, pinStyle]}>
                        <View style={s.pinBorder}>
                            <PinDot type="origin" size={PIN - 6} />
                        </View>
                        <View style={s.stem} />
                    </Animated.View>
                    <View style={s.shadowDot} />
                </View>

                <View style={{ position: 'absolute', top: insets.top + 12, left: 16 }}>
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>
                {userCoords && (
                    <View style={{ position: 'absolute', right: 16, bottom: 40 }}>
                        <CircleButton
                            icon="locate"
                            onPress={() => {
                                moved.current = true;
                                mapRef.current?.animateToRegion({ ...userCoords, ...MAP_DELTA }, 400);
                            }}
                        />
                    </View>
                )}
            </View>

            <Animated.View entering={FadeInUp.duration(300)} style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={s.titleRow}>
                    <Text style={s.title}>{kind === 'home' ? 'Simpan alamat rumah' : 'Simpan alamat kantor'}</Text>
                    <Pressable onPress={() => setShowSearch(true)} style={s.searchBtn}>
                        <Text style={s.searchText}>Cari</Text>
                    </Pressable>
                </View>

                <View style={s.placeRow}>
                    <Ionicons name="location-sharp" size={30} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={s.placeName} numberOfLines={1}>{resolving ? 'Mencari alamat…' : picked.name || '—'}</Text>
                        <Text style={s.placeAddr} numberOfLines={3}>{resolving ? ' ' : picked.address}</Text>
                    </View>
                    {resolving && <ActivityIndicator size="small" color={colors.primary} />}
                </View>

                <View style={s.labelRow}>
                    <Ionicons name="bookmark" size={26} color="#4b5563" />
                    <View style={s.labelField}>
                        <Text style={s.labelCaption}>Nama alamat</Text>
                        <TextInput
                            value={label}
                            onChangeText={setLabel}
                            placeholder="Cth: Sekolah, Rumah nenek"
                            placeholderTextColor="#b0b5bd"
                            style={s.labelInput}
                            maxLength={30}
                        />
                    </View>
                </View>

                <Pressable
                    disabled={!canSave}
                    onPress={() => onSave({ ...picked, name: label.trim() })}
                    style={[s.saveBtn, canSave && { backgroundColor: colors.primary }]}
                >
                    <Text style={[s.saveText, canSave && { color: '#fff' }]}>Simpan</Text>
                </Pressable>
            </Animated.View>

            {showSearch && (
                <PlaceSearchOverlay userCoords={userCoords} onClose={() => setShowSearch(false)} onSelect={handleSearchSelect} />
            )}
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    pinWrap: { alignItems: 'center', justifyContent: 'center' },
    pinBorder: {
        width: PIN,
        height: PIN,
        borderRadius: PIN / 2,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
    },
    stem: { width: 3, height: PIN_HEIGHT - PIN, backgroundColor: colors.primary, borderRadius: 2 },
    shadowDot: { position: 'absolute', width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.25)' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -24,
        padding: 20,
        gap: 18,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 20, fontWeight: '800', color: colors.text },
    searchBtn: { paddingHorizontal: 22, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.primary, justifyContent: 'center' },
    searchText: { color: colors.primary, fontWeight: '800' },
    placeRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    placeName: { fontSize: 18, fontWeight: '800', color: colors.text },
    placeAddr: { color: colors.textMuted, marginTop: 6, lineHeight: 22, fontSize: 15 },
    labelRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginTop: 4 },
    labelField: { flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 4 },
    labelCaption: { fontSize: 13, fontWeight: '700', color: '#374151' },
    labelInput: { fontSize: 20, fontWeight: '600', color: colors.text, paddingVertical: 4 },
    saveBtn: { height: 54, borderRadius: 27, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
    saveText: { fontSize: 17, fontWeight: '800', color: '#9ca3af' },
});