import AppAlert from '@/components/AppAlert';
import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import { reverseGeocode } from '@/services/google-maps';
import type { Coords, PlaceLoc } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

// ⚠️ Hanya 'home' & 'office' (tidak ada 'other')
export type SaveAddressKind = 'home' | 'office';

type Props = {
    kind: SaveAddressKind;
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

// Konstanta animasi
const INITIAL_ZOOM_MULT = 8;
const ZOOM_DURATION_MS = 900;
const ZOOM_START_DELAY_MS = 400;

// Label per jenis alamat
const KIND_LABEL: Record<SaveAddressKind, string> = {
    home: 'rumah',
    office: 'kantor',
};

type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

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

    // ============================================================
    // ALERT STATE — pakai AppAlert
    // ============================================================
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons?: AlertButton[];
    }>({
        visible: false,
        title: '',
        message: '',
        buttons: undefined,
    });

    const showAlert = (
        title: string,
        message: string,
        buttons?: AlertButton[]
    ) => {
        setAlertState({ visible: true, title, message, buttons });
    };

    const hideAlert = () => {
        setAlertState((a) => ({ ...a, visible: false }));
    };

    const moved = useRef(false);
    const reqId = useRef(0);
    const autoZoomed = useRef(false);
    const lift = useSharedValue(0);

    // ============================================================
    // Penanda gerakan peta lewat kode (bukan geseran user)
    // ============================================================
    const programmatic = useRef(false);
    const progTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flyTo = (c: Coords, duration = 500) => {
        programmatic.current = true;
        if (progTimer.current) clearTimeout(progTimer.current);
        progTimer.current = setTimeout(() => {
            programmatic.current = false;
        }, duration + 400);
        mapRef.current?.animateToRegion({ ...c, ...MAP_DELTA }, duration);
    };

    useEffect(() => {
        return () => {
            if (progTimer.current) clearTimeout(progTimer.current);
        };
    }, []);

    const isEdit = mode === 'edit';
    const kindLabel = KIND_LABEL[kind];

    // ============================================================
    // 🎯 Target zoom
    // - mode='edit'   → alamat tersimpan (initial.coords)
    // - mode='create' → lokasi user (userCoords) ?? initial.coords
    // ============================================================
    const targetCoords: Coords = useMemo(() => {
        if (isEdit) return initial.coords;
        return userCoords ?? initial.coords;
    }, [
        isEdit,
        initial.coords.latitude,
        initial.coords.longitude,
        userCoords?.latitude,
        userCoords?.longitude,
    ]);

    const targetSource = isEdit
        ? 'saved_address'
        : userCoords
            ? 'user_location'
            : 'fallback';

    // ---------- Reverse geocode ----------
    const resolve = async (c: Coords) => {
        const id = ++reqId.current;
        setResolving(true);
        try {
            const r = await reverseGeocode(c);
            if (id !== reqId.current) return;
            setPicked({
                coords: c,
                name: r.name,
                address: r.address,
            });
        } finally {
            if (id === reqId.current) setResolving(false);
        }
    };

    // Resolve kalau initial.address kosong
    useEffect(() => {
        if (!initial.address) resolve(initial.coords);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================================================
    // Auto-zoom saat halaman dibuka
    // ============================================================
    useEffect(() => {
        if (autoZoomed.current) return;
        autoZoomed.current = true;

        console.log('[SAVE ADDR] Auto-zoom:', {
            mode,
            kind,
            source: targetSource,
            lat: targetCoords.latitude,
            lng: targetCoords.longitude,
            address: initial.address || '(kosong)',
        });

        const timer = setTimeout(() => {
            flyTo(targetCoords, ZOOM_DURATION_MS);
        }, ZOOM_START_DELAY_MS);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================================================
    // Mode edit: kalau data alamat tersimpan berubah / telat datang,
    // marker + detail alamat ikut alamat tersimpan
    // ============================================================
    const firstSync = useRef(true);
    useEffect(() => {
        if (firstSync.current) {
            firstSync.current = false;
            return;
        }
        if (!isEdit) return;
        reqId.current++; // batalkan geocode yang masih jalan
        setResolving(false);
        setPicked(initial);
        setLabel(initialLabel);
        flyTo(initial.coords, 600);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isEdit,
        initial.coords.latitude,
        initial.coords.longitude,
        initial.address,
        initial.name,
        initialLabel,
    ]);

    // Tombol back Android: tutup overlay
    useEffect(() => {
        if (!showSearch) return;
        const sub = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                setShowSearch(false);
                return true;
            }
        );
        return () => sub.remove();
    }, [showSearch]);

    // ---------- Pan & zoom handler ----------
    const onRegionComplete = (
        r: Region,
        details?: { isGesture?: boolean }
    ) => {
        lift.value = withSpring(0, { damping: 14 });

        // Abaikan perpindahan karena kode (zoom awal, cari, tombol locate)
        if (programmatic.current) return;
        // Hanya geocode kalau benar-benar digeser user
        if (!moved.current && !details?.isGesture) return;

        resolve({ latitude: r.latitude, longitude: r.longitude });
    };

    const pinStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -PIN_HEIGHT / 2 + lift.value }],
    }));

    const handleSearchSelect = (p: PlaceLoc) => {
        setShowSearch(false);
        reqId.current++;
        setResolving(false);
        setPicked({
            coords: p.coords,
            name: p.name,
            address: p.address,
        });
        flyTo(p.coords, 500);
    };

    const canSave =
        !!label.trim() &&
        !resolving &&
        !!picked.address &&
        !saving &&
        !deleting;

    // ============================================================
    // Simpan
    // ============================================================
    const handleSave = async () => {
        if (!canSave) return;
        const payload: PlaceLoc = { ...picked, name: label.trim() };
        console.log(
            '[SAVE ADDR] Kirim ke onSave:',
            JSON.stringify(payload, null, 2)
        );

        setSaving(true);
        try {
            await onSave(payload);
            console.log('[SAVE ADDR] Berhasil disimpan');
        } catch (err: any) {
            console.error('[SAVE ADDR] Gagal simpan:', err?.message);
            showAlert(
                'Gagal Menyimpan',
                err?.message || 'Coba lagi beberapa saat.',
                [{ text: 'Mengerti' }]
            );
        } finally {
            setSaving(false);
        }
    };

    // ============================================================
    // Hapus
    // ============================================================
    const askDelete = () => {
        showAlert(
            `Hapus alamat ${kindLabel}?`,
            'Alamat ini akan dihapus dari daftar. Kamu bisa menyimpannya lagi nanti.',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, Hapus',
                    style: 'destructive',
                    onPress: confirmDelete,
                },
            ]
        );
    };

    const confirmDelete = async () => {
        hideAlert();
        if (!onDelete) return;
        setDeleting(true);
        try {
            await onDelete();
            console.log('[SAVE ADDR] Berhasil dihapus');
        } catch (err: any) {
            console.error('[SAVE ADDR] Gagal hapus:', err?.message);
            showAlert(
                'Gagal Menghapus',
                err?.message || 'Coba lagi beberapa saat.',
                [{ text: 'Mengerti' }]
            );
        } finally {
            setDeleting(false);
        }
    };

    // ---------- Judul ----------
    const titleText = isEdit
        ? `Edit alamat ${kindLabel}`
        : `Simpan alamat ${kindLabel}`;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: '#fff' }}
        >
            <View style={{ flex: 1 }}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={MAP_PROVIDER}
                    initialRegion={{
                        ...targetCoords,
                        latitudeDelta:
                            MAP_DELTA.latitudeDelta * INITIAL_ZOOM_MULT,
                        longitudeDelta:
                            MAP_DELTA.longitudeDelta * INITIAL_ZOOM_MULT,
                    }}
                    showsUserLocation
                    showsMyLocationButton={false}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    onPanDrag={() => {
                        // User mulai menggeser: hentikan mode "gerakan kode"
                        programmatic.current = false;
                        moved.current = true;
                        lift.value = withSpring(-14, { damping: 14 });
                    }}
                    onRegionChangeComplete={onRegionComplete}
                />

                {/* Pin di tengah */}
                <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, s.pinWrap]}
                >
                    <Animated.View
                        style={[{ alignItems: 'center' }, pinStyle]}
                    >
                        <View style={s.pinBorder}>
                            <PinDot type="origin" size={PIN - 6} />
                        </View>
                        <View style={s.stem} />
                    </Animated.View>
                    <View style={s.shadowDot} />
                </View>

                {/* Back button */}
                <View
                    style={{
                        position: 'absolute',
                        top: insets.top + 12,
                        left: 16,
                    }}
                >
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>

                {/* Locate button — pindah ke lokasi user */}
                {userCoords && (
                    <View
                        style={{
                            position: 'absolute',
                            right: 16,
                            bottom: 40,
                        }}
                    >
                        <CircleButton
                            icon="locate"
                            onPress={() => flyTo(userCoords, 500)}
                        />
                    </View>
                )}
            </View>

            {/* ===== SHEET ===== */}
            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}
            >
                <View style={s.titleRow}>
                    <Text style={s.title}>{titleText}</Text>
                    <Pressable
                        onPress={() => setShowSearch(true)}
                        style={s.searchBtn}
                    >
                        <Text style={s.searchText}>Cari</Text>
                    </Pressable>
                </View>

                <View style={s.placeRow}>
                    <Ionicons
                        name="location-sharp"
                        size={30}
                        color={colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={s.placeName} numberOfLines={1}>
                            {resolving
                                ? 'Mencari alamat…'
                                : picked.name || '—'}
                        </Text>
                        <Text style={s.placeAddr} numberOfLines={3}>
                            {resolving ? ' ' : picked.address}
                        </Text>
                    </View>
                    {resolving && (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary}
                        />
                    )}
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
                    style={[
                        s.saveBtn,
                        canSave && { backgroundColor: colors.primary },
                    ]}
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
                        <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#e5484d"
                        />
                        <Text style={s.deleteText}>Hapus alamat</Text>
                    </Pressable>
                )}
            </Animated.View>

            {/* Search overlay */}
            {showSearch && (
                <PlaceSearchOverlay
                    userCoords={userCoords}
                    onClose={() => setShowSearch(false)}
                    onSelect={handleSearchSelect}
                />
            )}

            {/* ===== LOADING MODAL (save + delete) ===== */}
            <Modal
                animationType="fade"
                transparent
                visible={saving || deleting}
                onRequestClose={() => { }}
            >
                <View style={s.loadingOverlay}>
                    <View style={s.loadingContainer}>
                        <ActivityIndicator
                            size="large"
                            color={colors.primary}
                        />
                    </View>
                </View>
            </Modal>

            {/* ===== APP ALERT ===== */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={hideAlert}
            />
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
    stem: {
        width: 3,
        height: PIN_HEIGHT - PIN,
        backgroundColor: colors.primary,
        borderRadius: 2,
    },
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
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
    },
    searchBtn: {
        paddingHorizontal: 22,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.primary,
        justifyContent: 'center',
    },
    searchText: {
        color: colors.primary,
        fontWeight: '800',
    },
    placeRow: {
        flexDirection: 'row',
        gap: 14,
        alignItems: 'flex-start',
    },
    placeName: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
    },
    placeAddr: {
        color: colors.textMuted,
        marginTop: 6,
        lineHeight: 22,
        fontSize: 15,
    },
    labelRow: {
        flexDirection: 'row',
        gap: 14,
        alignItems: 'flex-start',
        marginTop: 4,
    },
    labelField: {
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 4,
    },
    labelCaption: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
    },
    labelInput: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
        paddingVertical: 4,
    },
    saveBtn: {
        height: 54,
        borderRadius: 27,
        backgroundColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: {
        fontSize: 17,
        fontWeight: '800',
        color: '#9ca3af',
    },

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
    deleteText: {
        color: '#e5484d',
        fontWeight: '800',
        fontSize: 15,
    },

    // Loading modal
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
});