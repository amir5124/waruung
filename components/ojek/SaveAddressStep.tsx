import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import type { SavedKind } from '@/hooks/use-saved-addresses';
import { reverseGeocode } from '@/services/google-maps';
import type { Coords, PlaceLoc } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER, PinDot } from './parts';
import PlaceSearchOverlay from './PlaceSearchOverlay';

type Props = {
    kind: SavedKind;
    /** 'create' = alamat baru, 'edit' = ubah alamat yang sudah tersimpan */
    mode?: 'create' | 'edit';
    initial: PlaceLoc;
    initialLabel: string;
    userCoords?: Coords | null;
    onBack: () => void;
    onSave: (place: PlaceLoc) => void | Promise<void>;
    /** Hanya dipakai kalau mode='edit' */
    onDelete?: () => void | Promise<void>;
};

const PIN = 44;
const PIN_HEIGHT = PIN + 14;

export default function SaveAddressStep({
    kind,
    mode = 'create',
    initial,
    initialLabel,
    userCoords,
    onBack,
    onSave,
    onDelete,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [picked, setPicked] = useState<PlaceLoc>(initial);
    const [label, setLabel] = useState(initialLabel);
    const [resolving, setResolving] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Alert bottom sheet (single modal untuk error/sukses/konfirmasi hapus)
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [alertVariant, setAlertVariant] = useState<'error' | 'confirm-delete'>('error');

    const moved = useRef(false);
    const skipNext = useRef(false);
    const reqId = useRef(0);
    const autoZoomed = useRef(false);
    const lift = useSharedValue(0);

    const isEdit = mode === 'edit';

    const showAlert = (
        title: string,
        message: string,
        variant: 'error' | 'confirm-delete' = 'error'
    ) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertVariant(variant);
        setTimeout(
            () => setAlertVisible(true),
            Platform.OS === 'ios' ? 400 : 0
        );
    };

    // ---------- Reverse geocode ----------
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

    // ---------- Zoom-in saat halaman dibuka ----------
    useEffect(() => {
        if (autoZoomed.current) return;
        autoZoomed.current = true;
        const timer = setTimeout(() => {
            moved.current = true;
            mapRef.current?.animateToRegion({ ...initial.coords, ...MAP_DELTA }, 900);
        }, 400);
        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Tombol back Android: tutup overlay
    useEffect(() => {
        if (!showSearch) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setShowSearch(false);
            return true;
        });
        return () => sub.remove();
    }, [showSearch]);

    // ---------- Pan & zoom handler ----------
    const onRegionComplete = (r: Region) => {
        lift.value = withSpring(0, { damping: 14 });
        if (skipNext.current) {
            skipNext.current = false;
            return;
        }
        if (!moved.current) return;
        resolve({ latitude: r.latitude, longitude: r.longitude });
    };

    const pinStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -PIN_HEIGHT / 2 + lift.value }],
    }));

    const handleSearchSelect = (p: PlaceLoc) => {
        setShowSearch(false);
        reqId.current++;
        setResolving(false);
        setPicked({ coords: p.coords, name: p.name, address: p.address });
        skipNext.current = true;
        mapRef.current?.animateToRegion({ ...p.coords, ...MAP_DELTA }, 500);
    };

    const canSave = !!label.trim() && !resolving && !!picked.address && !saving && !deleting;

    // ---------- Simpan ----------
    const handleSave = async () => {
        if (!canSave) return;
        const payload: PlaceLoc = { ...picked, name: label.trim() };
        console.log('[SAVE ADDR] Kirim ke onSave:', JSON.stringify(payload, null, 2));

        setSaving(true);
        try {
            await onSave(payload);
            console.log('[SAVE ADDR] Berhasil disimpan');
        } catch (err: any) {
            console.error('[SAVE ADDR] Gagal simpan:', err?.message);
            showAlert('Gagal Menyimpan', err?.message || 'Coba lagi beberapa saat.');
        } finally {
            setSaving(false);
        }
    };

    // ---------- Hapus ----------
    const askDelete = () => {
        showAlert(
            `Hapus alamat ${kind === 'home' ? 'rumah' : 'kantor'}?`,
            'Alamat ini akan dihapus dari daftar. Kamu bisa menyimpannya lagi nanti.',
            'confirm-delete'
        );
    };

    const confirmDelete = async () => {
        setAlertVisible(false);
        if (!onDelete) return;
        setDeleting(true);
        try {
            await onDelete();
            console.log('[SAVE ADDR] Berhasil dihapus');
        } catch (err: any) {
            console.error('[SAVE ADDR] Gagal hapus:', err?.message);
            showAlert('Gagal Menghapus', err?.message || 'Coba lagi beberapa saat.');
        } finally {
            setDeleting(false);
        }
    };

    const titleText = isEdit
        ? kind === 'home'
            ? 'Edit alamat rumah'
            : 'Edit alamat kantor'
        : kind === 'home'
            ? 'Simpan alamat rumah'
            : 'Simpan alamat kantor';

    return (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={{ flex: 1 }}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    initialRegion={{
                        ...initial.coords,
                        latitudeDelta: MAP_DELTA.latitudeDelta * 8,
                        longitudeDelta: MAP_DELTA.longitudeDelta * 8,
                    }}
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
                                mapRef.current?.animateToRegion(
                                    { ...userCoords, ...MAP_DELTA },
                                    500
                                );
                            }}
                        />
                    </View>
                )}
            </View>

            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}
            >
                <View style={s.titleRow}>
                    <Text style={s.title}>{titleText}</Text>
                    <Pressable onPress={() => setShowSearch(true)} style={s.searchBtn}>
                        <Text style={s.searchText}>Cari</Text>
                    </Pressable>
                </View>

                <View style={s.placeRow}>
                    <Ionicons name="location-sharp" size={30} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={s.placeName} numberOfLines={1}>
                            {resolving ? 'Mencari alamat…' : picked.name || '—'}
                        </Text>
                        <Text style={s.placeAddr} numberOfLines={3}>
                            {resolving ? ' ' : picked.address}
                        </Text>
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
                            editable={!saving && !deleting}
                        />
                    </View>
                </View>

                <Pressable
                    disabled={!canSave}
                    onPress={handleSave}
                    style={[s.saveBtn, canSave && { backgroundColor: colors.primary }]}
                >
                    <Text style={[s.saveText, canSave && { color: '#fff' }]}>
                        {isEdit ? 'Simpan Perubahan' : 'Simpan'}
                    </Text>
                </Pressable>

                {isEdit && onDelete && (
                    <Pressable
                        disabled={saving || deleting}
                        onPress={askDelete}
                        style={s.deleteBtn}
                    >
                        <Ionicons name="trash-outline" size={18} color="#e5484d" />
                        <Text style={s.deleteText}>Hapus alamat</Text>
                    </Pressable>
                )}
            </Animated.View>

            {showSearch && (
                <PlaceSearchOverlay
                    userCoords={userCoords}
                    onClose={() => setShowSearch(false)}
                    onSelect={handleSearchSelect}
                />
            )}

            {/* ── MODAL LOADING (save + delete) ── */}
            <Modal
                animationType="fade"
                transparent
                visible={saving || deleting}
                onRequestClose={() => { }}
            >
                <View style={s.loadingOverlay}>
                    <View style={s.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </View>
            </Modal>

            {/* ── ALERT BOTTOM SHEET ── */}
            <Modal
                visible={alertVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setAlertVisible(false)}
            >
                <View style={s.sheetOverlay}>
                    <TouchableWithoutFeedback onPress={() => setAlertVisible(false)}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>

                    <View style={s.sheetContainer}>
                        <TouchableOpacity
                            onPress={() => setAlertVisible(false)}
                            style={s.sheetCloseButton}
                        >
                            <Ionicons name="close" size={24} color="#1c1c1c" />
                        </TouchableOpacity>

                        <Text style={s.sheetTitle}>{alertTitle}</Text>
                        <Text style={s.sheetDescription}>{alertMessage}</Text>

                        {alertVariant === 'confirm-delete' ? (
                            <>
                                <TouchableOpacity
                                    onPress={confirmDelete}
                                    style={[
                                        s.sheetButton,
                                        {
                                            backgroundColor: '#e5484d',
                                            borderColor: '#e5484d',
                                            marginBottom: 10,
                                        },
                                    ]}
                                >
                                    <Text style={[s.sheetButtonText, { color: '#fff' }]}>
                                        Ya, Hapus
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setAlertVisible(false)}
                                    style={[s.sheetButton, { borderColor: colors.border }]}
                                >
                                    <Text style={[s.sheetButtonText, { color: '#333' }]}>
                                        Batal
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setAlertVisible(false)}
                                style={s.sheetButton}
                            >
                                <Text style={s.sheetButtonText}>Mengerti</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
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
    shadowDot: {
        position: 'absolute',
        width: 10,
        height: 4,
        borderRadius: 5,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },

    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -24,
        padding: 20,
        gap: 14,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 20, fontWeight: '800', color: colors.text },
    searchBtn: {
        paddingHorizontal: 22,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.primary,
        justifyContent: 'center',
    },
    searchText: { color: colors.primary, fontWeight: '800' },
    placeRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    placeName: { fontSize: 18, fontWeight: '800', color: colors.text },
    placeAddr: { color: colors.textMuted, marginTop: 6, lineHeight: 22, fontSize: 15 },
    labelRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginTop: 4 },
    labelField: { flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 4 },
    labelCaption: { fontSize: 13, fontWeight: '700', color: '#374151' },
    labelInput: { fontSize: 20, fontWeight: '600', color: colors.text, paddingVertical: 4 },
    saveBtn: {
        height: 54,
        borderRadius: 27,
        backgroundColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: { fontSize: 17, fontWeight: '800', color: '#9ca3af' },

    deleteBtn: {
        height: 50,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: '#e5484d',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    deleteText: { color: '#e5484d', fontWeight: '800', fontSize: 15 },

    // ── Loading modal ──
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    // ── Alert bottom sheet ──
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 50,
        width: '100%',
        position: 'relative',
    },
    sheetCloseButton: {
        position: 'absolute',
        right: 24,
        top: -64,
        backgroundColor: '#fff',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 5,
    },
    sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 10 },
    sheetDescription: { fontSize: 15, color: '#555555', lineHeight: 22, marginBottom: 32 },
    sheetButton: {
        width: '100%',
        borderRadius: 100,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
    sheetButtonText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
});