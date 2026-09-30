import AppAlert from '@/components/AppAlert';
import LoadingModal from '@/components/LoadingModal';
import { colors, MAP_DELTA } from '@/constants/ojek-theme';
import { useNearbyDrivers } from '@/hooks/use-nearby-drivers';
import { api } from '@/lib/api';
import { reverseGeocode } from '@/services/google-maps';
import {
    findMainRoadSuggestion,
    type RoadSuggestion,
} from '@/services/main-road';
import type { ContactInfo, PlaceLoc } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_PROVIDER, PinDot } from '../ojek/parts';

const KURIR_IMG = require('@/assets/images/kurir-map.png');

const PIN_SIZE = 26;
const STEM_H = 14;
const PIN_TOTAL_H = PIN_SIZE + STEM_H;

const LANDMARK_MAX = 100;

type LatLng = { latitude: number; longitude: number };

// garis putus-putus "berjalan" menuju saran jalan
const DASH = 10;
const GAP = 8;
const PERIOD = DASH + GAP;
const EPS = 0.01;

function dashPatternAt(offset: number): number[] {
    const s = ((offset % PERIOD) + PERIOD) % PERIOD;
    if (s < 0.5) return [DASH, GAP];
    if (s < DASH) return [DASH - s, GAP, s, EPS];
    const r = PERIOD - s;
    return [EPS, r, DASH, GAP - r];
}

function MarchingLine({ coords, color }: { coords: LatLng[]; color: string }) {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setPhase((p) => (p + 3) % PERIOD), 60);
        return () => clearInterval(t);
    }, []);

    return (
        <Polyline
            coordinates={coords}
            strokeColor={color}
            strokeWidth={4}
            lineCap="butt"
            lineDashPattern={dashPatternAt(PERIOD - phase)}
            zIndex={10}
        />
    );
}

type Mode = 'pickup' | 'dropoff';

type Props = {
    mode: Mode;
    place: PlaceLoc;
    initialContact?: ContactInfo | null;
    myContact?: ContactInfo | null;
    onBack: () => void;
    onEditAddress: () => void;
    onSubmit: (contact: ContactInfo, saveAddress: boolean) => void;
    /** Dipanggil saat titik berubah karena peta di-geser / di-tap. Opsional. */
    onChangePlace?: (p: PlaceLoc) => void;
};

export default function ContactFormStep({
    mode,
    place,
    initialContact,
    myContact,
    onBack,
    onEditAddress,
    onSubmit,
    onChangePlace,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [name, setName] = useState(initialContact?.name ?? '');
    const [phone, setPhone] = useState(initialContact?.phone ?? '');
    // ⬇️ State baru untuk patokan terdekat
    const [landmark, setLandmark] = useState(initialContact?.landmark ?? '');
    const [saveAddress, setSaveAddress] = useState(false);

    // Titik yang sedang dipilih (bisa berubah kalau peta digeser)
    const [picked, setPicked] = useState<PlaceLoc>(place);
    const [resolving, setResolving] = useState(false);
    const [mapTouching, setMapTouching] = useState(false);
    const moved = useRef(false);
    const reqId = useRef(0);
    const roadAbort = useRef<AbortController | null>(null);
    const [suggestion, setSuggestion] = useState<
        (RoadSuggestion & { from: LatLng }) | null
    >(null);

    const isPickup = mode === 'pickup';
    const accent = isPickup ? colors.primary : colors.secondary;
    const title = isPickup ? 'Detail pengambilan paket' : 'Lokasi pengiriman';
    const fieldLabel = isPickup ? 'Nama pengirim' : 'Nama penerima';
    const canSubmit =
        name.trim().length > 0 && phone.trim().length > 0 && !resolving;

    // Kurir online di sekitar titik (radius 3 km), di-poll tiap 5 detik
    const { drivers } = useNearbyDrivers(picked.coords, {
        radius: 3000,
        limit: 20,
        pollMs: 5000,
    });
    const validDrivers = drivers.filter((d) => d.coords);

    // ---- Saran jalan utama (hanya untuk titik jemput) ----
    const searchRoad = (c: LatLng, id: number) => {
        if (!isPickup) return;
        roadAbort.current?.abort();
        const ctrl = new AbortController();
        roadAbort.current = ctrl;
        findMainRoadSuggestion(c, ctrl.signal).then((sug) => {
            const ok = id === reqId.current;
            if (__DEV__) console.log('[main-road] hasil', !!sug, 'dipakai', ok);
            if (ok) setSuggestion(sug ? { ...sug, from: c } : null);
        });
    };

    const goToSuggestion = () => {
        if (!suggestion) return;
        moved.current = true;
        mapRef.current?.animateToRegion(
            { ...suggestion.coords, ...MAP_DELTA },
            500
        );
    };

    // Cari saran jalan untuk titik awal, batalkan request saat unmount
    useEffect(() => {
        searchRoad(place.coords, reqId.current);
        return () => roadAbort.current?.abort();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Koordinat garis putus-putus dari titik terpilih ke saran jalan
    const lineCoords: LatLng[] | null = (() => {
        if (!suggestion) return null;
        const a = {
            latitude: Number(suggestion.from?.latitude),
            longitude: Number(suggestion.from?.longitude),
        };
        const b = {
            latitude: Number(suggestion.coords?.latitude),
            longitude: Number(suggestion.coords?.longitude),
        };
        const ok = [
            a.latitude,
            a.longitude,
            b.latitude,
            b.longitude,
        ].every(Number.isFinite);
        return ok ? [a, b] : null;
    })();
    const lineKey = lineCoords
        ? `${lineCoords[0].latitude.toFixed(6)},${lineCoords[0].longitude.toFixed(6)}-${lineCoords[1].latitude.toFixed(6)},${lineCoords[1].longitude.toFixed(6)}`
        : 'none';

    // Animasi zoom-in ke titik saat pertama kali muncul
    useEffect(() => {
        const timer = setTimeout(() => {
            mapRef.current?.animateToRegion(
                { ...place.coords, ...MAP_DELTA },
                900
            );
        }, 300);
        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Kalau `place` berubah dari luar (misal setelah Edit alamat), ikuti + animasi
    useEffect(() => {
        const same =
            Math.abs(place.coords.latitude - picked.coords.latitude) < 1e-7 &&
            Math.abs(place.coords.longitude - picked.coords.longitude) < 1e-7;
        if (same) return;
        moved.current = false; // jangan resolve ulang, alamat sudah dari luar
        setResolving(false);
        setSuggestion(null);
        setPicked(place);
        searchRoad(place.coords, ++reqId.current);
        mapRef.current?.animateToRegion(
            { ...place.coords, ...MAP_DELTA },
            600
        );
    }, [place]); // eslint-disable-line react-hooks/exhaustive-deps

    const resolve = async (c: LatLng) => {
        const id = ++reqId.current;
        setResolving(true);
        setSuggestion(null);
        searchRoad(c, id);
        try {
            const r = await reverseGeocode(c);
            if (id !== reqId.current) return;
            const next: PlaceLoc = {
                coords: c,
                name: r.name,
                address: r.address,
            };
            setPicked(next);
            onChangePlace?.(next);
        } catch {
            if (id !== reqId.current) return;
        }
        setResolving(false);
    };

    const onRegionComplete = (r: Region) => {
        setMapTouching(false);
        if (!moved.current) return;
        resolve({ latitude: r.latitude, longitude: r.longitude });
    };

    const handleMapPress = (e: { nativeEvent: { coordinate: LatLng } }) => {
        moved.current = true;
        mapRef.current?.animateToRegion(
            { ...e.nativeEvent.coordinate, ...MAP_DELTA },
            400
        );
    };

    // ---- Profil user yang sedang login (sama seperti MenuScreen) ----
    const [profile, setProfile] = useState<{
        full_name?: string | null;
        phone?: string | null;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // 1. Cache dulu supaya tombol langsung siap dipakai
            try {
                const raw = await AsyncStorage.getItem('profile');
                if (raw && !cancelled) setProfile(JSON.parse(raw));
            } catch { }

            // 2. Ambil data terbaru dari backend
            try {
                const fresh = await api.me();
                if (cancelled) return;
                setProfile(fresh);
                await AsyncStorage.setItem(
                    'profile',
                    JSON.stringify(fresh)
                );
            } catch (err) {
                console.warn('[ContactForm] Gagal ambil profil:', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Field +62 sudah ditampilkan, jadi buang awalan 0 / 62 / +62 dari nomor profil
    const normalizePhone = (p?: string | null) => {
        const digits = (p ?? '').replace(/\D/g, '');
        if (digits.startsWith('62')) return digits.slice(2);
        if (digits.startsWith('0')) return digits.slice(1);
        return digits;
    };

    const toContact = (p: typeof profile): ContactInfo | null =>
        p?.full_name
            ? {
                name: p.full_name,
                phone: normalizePhone(p.phone),
            }
            : null;

    // Prioritas: profil login; fallback ke prop myContact kalau ada
    const me: ContactInfo | null = toContact(profile) ?? myContact ?? null;

    // ---- Alert & loading (komponen AppAlert + LoadingModal) ----
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [alertState, setAlertState] = useState({
        visible: false,
        title: '',
        message: '',
    });

    const showAlert = (title: string, message: string) => {
        // Di iOS, modal baru tidak bisa muncul saat modal loading masih menutup
        setTimeout(
            () => setAlertState({ visible: true, title, message }),
            Platform.OS === 'ios' ? 400 : 0
        );
    };

    const fillFrom = (c: ContactInfo) => {
        setName(c.name);
        if (c.phone) {
            setPhone(c.phone);
        } else {
            showAlert(
                'Nomor HP belum diisi',
                'Nama sudah diisi. Lengkapi nomor HP di menu Data Diri, atau ketik manual di sini.'
            );
        }
        // ⬇️ Ikut isi patokan kalau ada
        if (c.landmark) setLandmark(c.landmark);
    };

    const handleUseMine = async () => {
        if (me) {
            fillFrom(me);
            return;
        }

        // Profil belum termuat -> ambil dari backend dengan loading modal
        setLoadingProfile(true);
        try {
            const fresh = await api.me();
            setProfile(fresh);
            await AsyncStorage.setItem('profile', JSON.stringify(fresh));
            const c = toContact(fresh);
            if (c) {
                fillFrom(c);
            } else {
                showAlert(
                    'Data diri belum lengkap',
                    'Nama di profilmu masih kosong. Lengkapi dulu di menu Data Diri.'
                );
            }
        } catch (err: any) {
            showAlert(
                'Gagal memuat profil',
                err?.message ||
                'Periksa koneksi internetmu lalu coba lagi.'
            );
        } finally {
            setLoadingProfile(false);
        }
    };

    // ⬇️ Handler submit: sertakan landmark kalau diisi
    const handleSubmit = () => {
        const trimmedLandmark = landmark.trim();
        onSubmit(
            {
                name: name.trim(),
                phone: phone.trim(),
                // hanya kirim kalau tidak kosong
                ...(trimmedLandmark
                    ? { landmark: trimmedLandmark }
                    : {}),
            },
            saveAddress
        );
    };

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: '#fff',
                paddingTop: insets.top,
            }}
        >
            <View style={s.header}>
                <Pressable onPress={onBack} hitSlop={10}>
                    <Ionicons
                        name="arrow-back"
                        size={22}
                        color={colors.text}
                    />
                </Pressable>
                <Text style={s.title}>{title}</Text>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={!mapTouching}
                    nestedScrollEnabled
                >
                    <View
                        style={s.mapWrap}
                        onTouchStart={() => setMapTouching(true)}
                        onTouchEnd={() => setMapTouching(false)}
                        onTouchCancel={() => setMapTouching(false)}
                    >
                        <MapView
                            ref={mapRef}
                            style={StyleSheet.absoluteFill}
                            provider={MAP_PROVIDER}
                            showsUserLocation
                            showsMyLocationButton={false}
                            toolbarEnabled={false}
                            showsCompass={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                            scrollEnabled
                            zoomEnabled
                            initialRegion={{
                                ...place.coords,
                                latitudeDelta:
                                    MAP_DELTA.latitudeDelta * 5,
                                longitudeDelta:
                                    MAP_DELTA.longitudeDelta * 5,
                            }}
                            onPress={handleMapPress}
                            onPanDrag={() => {
                                moved.current = true;
                                setSuggestion(null);
                            }}
                            onRegionChangeComplete={onRegionComplete}
                        >
                            {/* Saran jalan + garis putus-putus */}
                            {isPickup && suggestion && lineCoords && (
                                <>
                                    <MarchingLine
                                        key={lineKey}
                                        coords={lineCoords}
                                        color={colors.primary}
                                    />
                                    <Marker
                                        key={`m-${lineKey}`}
                                        coordinate={lineCoords[1]}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        onPress={goToSuggestion}
                                        zIndex={11}
                                    >
                                        <View style={s.sugDot} />
                                    </Marker>
                                </>
                            )}

                            {validDrivers.slice(0, 10).map((d) => (
                                <Marker
                                    key={d.id}
                                    coordinate={d.coords!}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                    tracksViewChanges={true}
                                    zIndex={5}
                                >
                                    <View
                                        style={s.driverMarker}
                                        collapsable={false}
                                    >
                                        <Image
                                            source={KURIR_IMG}
                                            style={{
                                                width: 28,
                                                height: 28,
                                            }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </Marker>
                            ))}
                        </MapView>

                        <View
                            pointerEvents="none"
                            style={[
                                StyleSheet.absoluteFill,
                                s.pinWrap,
                            ]}
                        >
                            <View
                                style={{
                                    alignItems: 'center',
                                    transform: [
                                        {
                                            translateY:
                                                -PIN_TOTAL_H / 2,
                                        },
                                    ],
                                }}
                            >
                                <PinDot
                                    type={
                                        isPickup
                                            ? 'origin'
                                            : 'destination'
                                    }
                                    size={PIN_SIZE}
                                />
                                <View
                                    style={[
                                        s.stem,
                                        { backgroundColor: accent },
                                    ]}
                                />
                            </View>
                        </View>

                        <View pointerEvents="none" style={s.tapPill}>
                            <View
                                style={[
                                    s.tapIcon,
                                    { backgroundColor: accent },
                                ]}
                            >
                                <Ionicons
                                    name={
                                        isPickup
                                            ? 'arrow-up'
                                            : 'arrow-down'
                                    }
                                    size={12}
                                    color="#fff"
                                />
                            </View>
                            <Text style={s.tapPillText}>Tap petanya</Text>
                        </View>
                    </View>

                    {isPickup && suggestion && !resolving && (
                        <Pressable
                            onPress={goToSuggestion}
                            style={s.suggest}
                        >
                            <Text
                                style={s.suggestText}
                                numberOfLines={2}
                            >
                                Lebih mudah dijemput di{' '}
                                {suggestion.name} ({suggestion.distance} m
                                dari sini)
                            </Text>
                            <Text style={s.suggestAction}>Pindah</Text>
                        </Pressable>
                    )}

                    <View style={s.addressCard}>
                        <View style={s.rowBetween}>
                            <Text
                                style={[s.placeName, { flex: 1 }]}
                                numberOfLines={1}
                            >
                                {resolving
                                    ? 'Mencari alamat…'
                                    : picked.name || '—'}
                            </Text>
                            {resolving ? (
                                <ActivityIndicator
                                    size="small"
                                    color={accent}
                                />
                            ) : (
                                <Pressable
                                    onPress={onEditAddress}
                                    style={s.editPill}
                                >
                                    <Text style={s.editText}>Edit</Text>
                                </Pressable>
                            )}
                        </View>
                        <Text style={s.placeAddress}>
                            {resolving ? ' ' : picked.address}
                        </Text>

                        {/* ⬇️ Input patokan terdekat — sekarang terhubung ke state */}
                        <View style={s.landmarkInput}>
                            <Ionicons
                                name="flag-outline"
                                size={16}
                                color={colors.textMuted}
                            />
                            <TextInput
                                style={{
                                    flex: 1,
                                    fontSize: 13,
                                    color: colors.text,
                                }}
                                placeholder="Ada patokan terdekat? (opsional)"
                                placeholderTextColor={colors.textMuted}
                                value={landmark}
                                onChangeText={setLandmark}
                                maxLength={LANDMARK_MAX}
                                returnKeyType="done"
                            />
                        </View>
                    </View>

                    <View style={s.rowBetween}>
                        <Text style={s.sectionLabel}>
                            {isPickup
                                ? 'Detail pengirim'
                                : 'Detail penerima'}
                        </Text>
                        <Pressable
                            onPress={handleUseMine}
                            style={s.editPill}
                        >
                            <Text style={s.editText}>
                                Pakai detail saya
                            </Text>
                        </Pressable>
                    </View>

                    <View style={s.field}>
                        <Text style={s.fieldLabel}>{fieldLabel} *</Text>
                        <View style={s.fieldRow}>
                            <TextInput
                                style={s.fieldInput}
                                placeholder={`Masukkan ${fieldLabel.toLowerCase()}...`}
                                placeholderTextColor={colors.textMuted}
                                value={name}
                                onChangeText={setName}
                                returnKeyType="next"
                            />
                            <View style={s.avatarIcon}>
                                <Ionicons
                                    name="person"
                                    size={14}
                                    color="#fff"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={s.field}>
                        <Text style={s.fieldLabel}>
                            Nomor telepon *
                        </Text>
                        <View style={s.phoneRow}>
                            <View style={s.countryCode}>
                                <Text>🇮🇩</Text>
                                <Text style={s.countryCodeText}>
                                    +62
                                </Text>
                            </View>
                            <TextInput
                                style={s.phoneInput}
                                placeholder="Masukkan nomor telepon"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                                returnKeyType="done"
                            />
                        </View>
                    </View>

                    <Pressable
                        style={s.rowBetween}
                        onPress={() => setSaveAddress((v) => !v)}
                    >
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <Ionicons
                                name={
                                    saveAddress
                                        ? 'bookmark'
                                        : 'bookmark-outline'
                                }
                                size={18}
                                color={colors.text}
                            />
                            <Text style={s.sectionLabel}>
                                Simpan alamat?
                            </Text>
                        </View>
                        <View style={s.editPill}>
                            <Text style={s.editText}>Simpan</Text>
                        </View>
                    </Pressable>
                </ScrollView>

                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingBottom: insets.bottom + 16,
                    }}
                >
                    <Pressable
                        disabled={!canSubmit}
                        onPress={handleSubmit}
                        style={[
                            s.submitBtn,
                            { opacity: canSubmit ? 1 : 0.5 },
                        ]}
                    >
                        <Text style={s.submitText}>
                            {isPickup ? 'Simpan' : 'Lanjut'}
                        </Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>

            <LoadingModal visible={loadingProfile} />

            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                onClose={() =>
                    setAlertState((a) => ({ ...a, visible: false }))
                }
            />
        </View>
    );
}

const s = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    title: { fontSize: 17, fontWeight: '800', color: colors.text },
    mapWrap: {
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    pinWrap: { alignItems: 'center', justifyContent: 'center' },
    stem: { width: 3, height: STEM_H, borderRadius: 2 },
    tapPill: {
        position: 'absolute',
        top: 12,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    tapIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tapPillText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
    },
    driverMarker: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sugDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 4,
        borderColor: colors.primary,
    },
    suggest: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: colors.secondarySoft,
        marginBottom: 16,
    },
    suggestText: {
        flex: 1,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 20,
    },
    suggestAction: { color: colors.primary, fontWeight: '800' },
    addressCard: { marginBottom: 20 },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    placeName: { fontSize: 16, fontWeight: '800', color: colors.text },
    placeAddress: {
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 18,
        marginBottom: 12,
    },
    editPill: {
        backgroundColor: '#E9F9EF',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    editText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 12,
    },
    landmarkInput: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.field,
        borderRadius: 20,
        paddingHorizontal: 14,
        height: 42,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
    },
    field: { marginBottom: 16 },
    fieldLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: 6,
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingBottom: 8,
    },
    fieldInput: { flex: 1, fontSize: 15, color: colors.text },
    avatarIcon: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingBottom: 8,
    },
    countryCode: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    countryCodeText: { fontSize: 15, color: colors.text },
    phoneInput: { flex: 1, fontSize: 15, color: colors.text },
    submitBtn: {
        height: 54,
        borderRadius: 27,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});