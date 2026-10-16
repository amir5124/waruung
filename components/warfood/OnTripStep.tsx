// components/food/OnTripStep.tsx
// Tahap pelacakan pesanan WarFood (sesuai desain: peta + sheet status, stepper, kartu driver, banner tunai, struk).
// - Posisi driver REALTIME dari order.driver.coords (tanpa posisi dummy)
// - Rute mengikuti jalan (getRoute, cadangan OSRM) — tanpa garis lurus
// - Peta memakai mapStyle; kamera di-fit SEKALI saat dibuka, tidak zoom sendiri
import { mapStyle } from '@/constants/ojek-map-style';
import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import type { OrderResponse } from '@/lib/api';
import { mapOrderStatus } from '@/lib/orderFlow';
import { getRoute } from '@/services/google-maps';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, MarkerAnimated, Polyline } from 'react-native-maps';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_PROVIDER } from '../ojek/parts';

const PRIMARY = (colors as any).primary ?? '#40a3ea';
const PRIMARY_SOFT = (colors as any).primarySoft ?? '#E8F4FD';
const PRIMARY_DARK = '#1F6FAE';
const SECONDARY = (colors as any).secondary ?? '#e68515';
const TEXT = '#172019';
const MUTED = '#5F6B64';
const TRACK = '#E3E8E5';
const PASSED = '#B7C9BE';

const MARKER_PICKUP = require('@/assets/images/marker-origin.png');
const MARKER_DROP = require('@/assets/images/marker-destination.png');
const VEHICLE_IMG = {
    motor: require('@/assets/images/motor-map.png'),
    mobil: require('@/assets/images/mobil-map.png'),
};

// Sedikit lebih pendek dari interval polling order (3 dtk)
const MARKER_ANIM_MS = 2800;
const HEADING_MIN_METERS = 5;
// 0 jika gambar ikon menghadap ke atas (utara); ubah (90/180/-90) jika berbeda
const ICON_HEADING_OFFSET = 0;
const REROUTE_MIN_INTERVAL_MS = 10000;
const REROUTE_MIN_MOVE_M = 100;
const ROUTE_RETRY_MS = 5000;
const ARRIVE_METERS = 50;
const ROAD_FACTOR = 1.3;
const AVG_SPEED_KMH = 25;
// Kamera di-fit sekali; jika data belum lengkap, tetap fit setelah jeda ini
const FIT_FALLBACK_MS = 2500;
const FIT_PAD = 28;

const STAGES = ['Cari driver', 'Ke resto', 'Beli pesanan', 'Diantar', 'Tiba'];

type LatLng = { latitude: number; longitude: number };
type RouteResult = { poly: LatLng[]; dist: number; dur: number };

type Props = {
    order: OrderResponse;
    onChat: () => void;
    onCall: () => void;
    /** Tombol X di kiri atas (opsional; tombol hanya tampil jika diberikan) */
    onClose?: () => void;
};

// ============================================================
// HELPERS
// ============================================================
const toRad = (d: number) => (d * Math.PI) / 180;

function haversine(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(x));
}

function bearing(a: LatLng, b: LatLng): number {
    const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
    const x =
        Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
        Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function nearestIndex(poly: LatLng[], pos: LatLng): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
        const d = haversine(pos, poly[i]);
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

function remainingDistance(poly: LatLng[], fromIdx: number): number {
    let total = 0;
    for (let i = fromIdx; i < poly.length - 1; i++) total += haversine(poly[i], poly[i + 1]);
    return total;
}

const toNum = (v: any): number | null => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Baca koordinat dari {latitude,longitude} / {lat,lng}; null jika tidak valid */
function readCoord(c: any): LatLng | null {
    if (!c) return null;
    const lat = toNum(c.latitude ?? c.lat);
    const lng = toNum(c.longitude ?? c.lng ?? c.lon);
    if (lat == null || lng == null || (lat === 0 && lng === 0)) return null;
    return { latitude: lat, longitude: lng };
}

/** Region awal yang memuat semua titik, dengan ruang untuk sheet di bawah */
function regionFor(points: (LatLng | null)[]) {
    const pts = points.filter(Boolean) as LatLng[];
    if (!pts.length) return null;
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 3.2, 0.01);
    const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.01);
    return {
        latitude: (minLat + maxLat) / 2 - latDelta * 0.26,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
    };
}

function animateMarker(region: AnimatedRegion, to: LatLng, duration: number) {
    const config: any = {
        latitude: to.latitude,
        longitude: to.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration,
        useNativeDriver: false,
    };
    (region as any).timing(config).start();
}

// ---------- Rute jalan: getRoute (Google) → cadangan OSRM. Tidak ada garis lurus. ----------
async function fetchOsrm(from: LatLng, to: LatLng): Promise<RouteResult | null> {
    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const json: any = await res.json();
    const r = json?.routes?.[0];
    const coords = r?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return {
        poly: coords.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })),
        dist: r.distance ?? 0,
        dur: r.duration ?? 0,
    };
}

async function fetchRoadRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
    try {
        const r: any = await getRoute(from, to);
        if (r?.polyline?.length > 2) {
            return { poly: r.polyline, dist: r.distanceMeters ?? 0, dur: r.durationSec ?? 0 };
        }
        console.warn('[OnTrip] getRoute tidak mengembalikan rute jalan, memakai OSRM. Hasil:', r?.polyline?.length);
    } catch (e: any) {
        console.warn('[OnTrip] getRoute gagal:', e?.message);
    }
    try {
        return await fetchOsrm(from, to);
    } catch (e: any) {
        console.warn('[OnTrip] OSRM gagal:', e?.message);
        return null;
    }
}

const payLabel = (pm?: string | null) =>
    pm === 'cash' ? 'Tunai' : pm === 'wallet' ? 'Saldo' : pm === 'qris' ? 'QRIS' : 'Transfer Bank';

/** Tahap stepper dari status order */
function stageFromStep(step: string): number {
    switch (step) {
        case 'picking_up':
            return 2;
        case 'delivering':
            return 3;
        case 'arrived':
            return 4;
        default:
            return 1; // driver_found → driver menuju resto
    }
}

function Stepper({ active }: { active: number }) {
    return (
        <View style={s.stepper}>
            {STAGES.map((label, i) => {
                const done = i < active;
                const cur = i === active;
                return (
                    <View key={label} style={s.stepCol}>
                        <View style={s.stepLineRow}>
                            <View style={[s.line, i === 0 && { opacity: 0 }, (done || cur) && i > 0 && { backgroundColor: PRIMARY }]} />
                            <View
                                style={[
                                    s.stepDot,
                                    done && { backgroundColor: PRIMARY, borderColor: PRIMARY },
                                    cur && { borderColor: PRIMARY, borderWidth: 5 },
                                ]}
                            >
                                {done && <Ionicons name="checkmark" size={11} color="#fff" />}
                            </View>
                            <View style={[s.line, i === STAGES.length - 1 && { opacity: 0 }, done && { backgroundColor: PRIMARY }]} />
                        </View>
                        <Text style={[s.stepLabel, (cur || done) && { fontWeight: '800', color: TEXT }]} numberOfLines={1}>
                            {label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

// ============================================================
// MAIN
// ============================================================
export default function OnTripStep({ order, onChat, onCall, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const { height: screenH } = useWindowDimensions();
    const mapRef = useRef<MapView>(null);
    const o: any = order;
    const driver: any = order.driver;
    const step: string = mapOrderStatus(order.status) as any;

    // Tinggi sheet diukur otomatis
    const [sheetH, setSheetH] = useState(360 + insets.bottom);
    const sheetHRef = useRef(sheetH);
    sheetHRef.current = sheetH;
    const [sheetMeasured, setSheetMeasured] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [showFit, setShowFit] = useState(false);

    // ---------- Data dari API ----------
    const pickup = useMemo(() => readCoord(o.pickup_coords), [o.pickup_coords?.latitude, o.pickup_coords?.longitude]); // eslint-disable-line
    const dropoff = useMemo(() => readCoord(o.dropoff_coords), [o.dropoff_coords?.latitude, o.dropoff_coords?.longitude]); // eslint-disable-line

    // Posisi driver REALTIME: order.driver.coords diperbarui oleh polling order.
    // Tidak ada posisi dummy — marker baru muncul setelah koordinat asli tersedia.
    const rawDriver = readCoord(driver?.coords ?? driver?.location);
    const dLat = rawDriver?.latitude;
    const dLng = rawDriver?.longitude;
    const driverPos = useMemo<LatLng | null>(
        () => (dLat != null && dLng != null ? { latitude: dLat, longitude: dLng } : null),
        [dLat, dLng],
    );

    const items: any[] = o.order_items ?? o.items ?? [];
    const storeName: string = o.merchant?.store_name ?? o.pickup_name ?? 'Resto';
    const driverName: string = driver?.full_name ?? 'Driver';
    const vehicleKey = (driver?.vehicle_type === 'mobil' ? 'mobil' : 'motor') as 'motor' | 'mobil';
    const isCash = o.payment_method === 'cash';

    // Driver sekarang menuju mana?
    const isHeadingToUser = step === 'delivering' || step === 'arrived';
    const target = isHeadingToUser ? dropoff : pickup;
    const targetKey = isHeadingToUser ? 'user' : 'resto';

    // ---------- Marker driver animasi ----------
    const driverCoord = useRef(
        new AnimatedRegion({
            latitude: driverPos?.latitude ?? pickup?.latitude ?? 0,
            longitude: driverPos?.longitude ?? pickup?.longitude ?? 0,
            latitudeDelta: 0,
            longitudeDelta: 0,
        }),
    ).current;
    const hadPosRef = useRef(!!driverPos);
    const [trackView, setTrackView] = useState(true);

    useEffect(() => {
        if (!driverPos) return;
        if (!hadPosRef.current) {
            hadPosRef.current = true;
            (driverCoord as any).setValue({
                latitude: driverPos.latitude,
                longitude: driverPos.longitude,
                latitudeDelta: 0,
                longitudeDelta: 0,
            }); // posisi pertama: langsung, tanpa meluncur dari resto
        } else {
            animateMarker(driverCoord, driverPos, MARKER_ANIM_MS);
        }
    }, [driverPos?.latitude, driverPos?.longitude]); // eslint-disable-line

    // Arah ikon dari pergerakan terakhir
    const [heading, setHeading] = useState(0);
    const prevPosRef = useRef<LatLng | null>(driverPos);
    useEffect(() => {
        if (!driverPos) return;
        if (!prevPosRef.current) {
            prevPosRef.current = driverPos;
            return;
        }
        if (haversine(prevPosRef.current, driverPos) > HEADING_MIN_METERS) {
            setHeading(bearing(prevPosRef.current, driverPos));
            prevPosRef.current = driverPos;
        }
    }, [driverPos?.latitude, driverPos?.longitude]); // eslint-disable-line

    // ---------- Rute jalan ----------
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // resto → user (sekali; dicoba ulang jika gagal)
    const [fullRoute, setFullRoute] = useState<LatLng[] | null>(null);
    useEffect(() => {
        if (!pickup || !dropoff) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const run = async (attempt: number) => {
            const r = await fetchRoadRoute(pickup, dropoff);
            if (cancelled || !mountedRef.current) return;
            if (r) setFullRoute(r.poly);
            else if (attempt < 3) timer = setTimeout(() => run(attempt + 1), ROUTE_RETRY_MS);
        };
        run(1);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [pickup?.latitude, pickup?.longitude, dropoff?.latitude, dropoff?.longitude]); // eslint-disable-line

    // driver → target aktif (diulang saat driver bergerak jauh / target berganti)
    const [legRoute, setLegRoute] = useState<RouteResult | null>(null);
    const lastRouteRef = useRef<{ t: number; pos: LatLng | null }>({ t: 0, pos: null });
    const reqRef = useRef(0);

    // target berganti (resto → user): buang rute lama & paksa ambil ulang
    useEffect(() => {
        reqRef.current++;
        setLegRoute(null);
        lastRouteRef.current = { t: 0, pos: null };
    }, [targetKey]);

    useEffect(() => {
        if (!driverPos || !target) return;
        const last = lastRouteRef.current;
        const sinceMs = Date.now() - last.t;
        if (last.pos == null) {
            // belum pernah berhasil: coba (ulang) dengan jeda
            if (last.t && sinceMs < ROUTE_RETRY_MS) return;
        } else {
            const moved = haversine(driverPos, last.pos) > REROUTE_MIN_MOVE_M;
            if (!(moved && sinceMs > REROUTE_MIN_INTERVAL_MS)) return;
        }
        lastRouteRef.current = { t: Date.now(), pos: null };
        const id = ++reqRef.current;
        const from = driverPos;
        fetchRoadRoute(from, target).then((r) => {
            if (!mountedRef.current || id !== reqRef.current) return;
            if (r) {
                lastRouteRef.current = { t: Date.now(), pos: from };
                setLegRoute(r);
            }
        });
    }, [driverPos?.latitude, driverPos?.longitude, target?.latitude, target?.longitude, targetKey]); // eslint-disable-line

    // Garis driver → target (dipotong dari posisi driver) + sisa jarak. Tanpa garis lurus.
    const { aheadLine, remainingM } = useMemo(() => {
        if (!driverPos || !target) return { aheadLine: null as LatLng[] | null, remainingM: null as number | null };
        const poly = legRoute?.poly;
        if (poly && poly.length > 1) {
            const idx = nearestIndex(poly, driverPos);
            return {
                aheadLine: [driverPos, ...poly.slice(idx + 1)],
                remainingM: haversine(driverPos, poly[idx]) + remainingDistance(poly, idx),
            };
        }
        // rute belum ada: hanya perkiraan jarak untuk ETA
        return { aheadLine: null as LatLng[] | null, remainingM: haversine(driverPos, target) * ROAD_FACTOR };
    }, [legRoute, driverPos, target]);

    // Jalur yang sudah dilewati (resto → posisi driver), hanya saat mengantar
    const passedLine = useMemo(() => {
        if (!isHeadingToUser || !driverPos || !fullRoute || fullRoute.length < 2) return null;
        const idx = nearestIndex(fullRoute, driverPos);
        return [...fullRoute.slice(0, idx + 1), driverPos];
    }, [isHeadingToUser, fullRoute, driverPos]);

    // ETA dari sisa rute
    let minutes: number | null = null;
    if (remainingM != null) {
        if (legRoute?.dur && legRoute.dist) {
            const sec = legRoute.dur * Math.min(1, remainingM / legRoute.dist);
            minutes = Math.max(1, Math.ceil(sec / 60));
        } else {
            minutes = Math.max(1, Math.ceil((remainingM / 1000 / AVG_SPEED_KMH) * 60));
        }
    }
    const nearTarget = remainingM != null && remainingM <= ARRIVE_METERS;
    const showEta = (step === 'driver_found' || step === 'delivering') && minutes != null;

    // ---------- Label status ----------
    const statusIcon =
        step === 'picking_up' ? 'restaurant' : step === 'arrived' ? 'checkmark-circle' : step === 'delivering' ? 'bicycle' : 'navigate';
    const statusTitle =
        step === 'picking_up'
            ? 'Driver membeli pesananmu'
            : step === 'delivering'
                ? 'Pesanan sedang diantar'
                : step === 'arrived'
                    ? 'Driver sudah tiba'
                    : nearTarget
                        ? 'Driver tiba di resto'
                        : 'Driver menuju resto';
    const statusSub =
        step === 'picking_up'
            ? `Sedang menyiapkan pesanan di ${storeName}`
            : step === 'delivering'
                ? 'Tunggu ya, driver menuju alamatmu'
                : step === 'arrived'
                    ? 'Silakan terima pesananmu'
                    : `Akan membeli pesananmu di ${storeName}`;

    // ---------- Kamera ----------
    // Dilakukan SEKALI saat dibuka: seluruh rute (resto, tujuan, driver + garis jalan) masuk layar.
    // Setelah itu kamera tidak bergerak/zoom sendiri; tombol "tampilkan rute" muncul jika peta digeser.
    const fittedRef = useRef(false);
    const fit = (animated: boolean) => {
        const pts = [pickup, dropoff, driverPos, ...(fullRoute ?? []), ...(legRoute?.poly ?? [])].filter(
            Boolean,
        ) as LatLng[];
        if (!pts.length) return;
        mapRef.current?.fitToCoordinates(pts, {
            edgePadding: {
                top: insets.top + 90,
                bottom: sheetHRef.current + FIT_PAD,
                left: 50,
                right: 50,
            },
            animated,
        });
    };
    useEffect(() => {
        if (fittedRef.current || !mapReady || !sheetMeasured || !pickup || !dropoff) return;
        // tunggu data lengkap (driver + kedua rute); kalau lama, tetap fit dengan data yang ada
        const complete = !!driverPos && !!fullRoute && !!legRoute;
        const tm = setTimeout(
            () => {
                if (fittedRef.current) return;
                fittedRef.current = true;
                fit(false);
            },
            complete ? 100 : FIT_FALLBACK_MS,
        );
        return () => clearTimeout(tm);
    }, [mapReady, sheetMeasured, !!driverPos, !!fullRoute, !!legRoute, pickup?.latitude, dropoff?.latitude]); // eslint-disable-line

    // Region awal sudah memuat semua titik, jadi tidak ada lonjakan zoom saat fit pertama
    const initialRegion = useRef(
        regionFor([pickup, dropoff, driverPos]) ?? {
            latitude: -2.5,
            longitude: 118,
            latitudeDelta: 30,
            longitudeDelta: 30,
        },
    ).current;

    const call = () => {
        if (onCall) return onCall();
        const phone = driver?.phone;
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    // ---------- Struk ----------
    const deliveryFee = Number(o.delivery_fee) || 0;
    const packagingFee = Number(o.packaging_fee) || 0;
    const discount = Number(o.discount) || 0;

    return (
        <View style={{ flex: 1, backgroundColor: '#E8EEE9' }}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                customMapStyle={mapStyle}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                onMapReady={() => setMapReady(true)}
                onPanDrag={() => setShowFit(true)}
                initialRegion={initialRegion}
            >
                {/* resto → user (putus-putus, selama driver belum mengantar) */}
                {!isHeadingToUser && fullRoute && fullRoute.length > 1 && (
                    <Polyline
                        coordinates={fullRoute}
                        strokeColor="#9FB8A9"
                        strokeWidth={4}
                        lineDashPattern={[2, 8]}
                        lineCap="round"
                        lineJoin="round"
                    />
                )}

                {/* jalur yang sudah dilewati (pudar) */}
                {passedLine && passedLine.length > 1 && (
                    <Polyline coordinates={passedLine} strokeColor={PASSED} strokeWidth={5} lineCap="round" lineJoin="round" />
                )}

                {/* driver → target aktif (mengikuti jalan, terpotong saat driver bergerak) */}
                {aheadLine && aheadLine.length > 1 && (
                    <Polyline coordinates={aheadLine} strokeColor={PRIMARY} strokeWidth={5} lineCap="round" lineJoin="round" />
                )}

                {pickup && (
                    <Marker coordinate={pickup} image={MARKER_PICKUP} anchor={{ x: 0.5, y: 1 }} title={storeName} zIndex={1} />
                )}
                {dropoff && (
                    <Marker
                        coordinate={dropoff}
                        image={MARKER_DROP}
                        anchor={{ x: 0.5, y: 1 }}
                        title={o.dropoff_name ?? 'Lokasi kamu'}
                        zIndex={1}
                    />
                )}

                {/* Marker driver: realtime, berputar sesuai arah gerak */}
                {driverPos && (
                    <MarkerAnimated
                        coordinate={driverCoord as any}
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat
                        rotation={(heading + ICON_HEADING_OFFSET) % 360}
                        tracksViewChanges={trackView}
                        zIndex={3}
                    >
                        <View style={s.driverMarker}>
                            <Image
                                source={VEHICLE_IMG[vehicleKey]}
                                style={{ width: 34, height: 34 }}
                                resizeMode="contain"
                                onLoad={() => setTimeout(() => setTrackView(false), 150)}
                            />
                        </View>
                    </MarkerAnimated>
                )}
            </MapView>

            {/* Top bar: tutup + kode pesanan */}
            <Animated.View entering={FadeInUp.duration(300)} style={[s.topBar, { top: insets.top + 12 }]} pointerEvents="box-none">
                {onClose ? (
                    <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8} accessibilityLabel="Tutup">
                        <Ionicons name="close" size={24} color={TEXT} />
                    </Pressable>
                ) : (
                    <View />
                )}
                <View style={s.codePill}>
                    <Text style={s.codeText}>#{order.order_code}</Text>
                </View>
            </Animated.View>

            {/* Tombol tampilkan seluruh rute (muncul setelah peta digeser manual) */}
            {showFit && (
                <Pressable
                    style={[s.fitBtn, { bottom: sheetH + 12 }]}
                    onPress={() => {
                        fit(true);
                        setShowFit(false);
                    }}
                    accessibilityLabel="Tampilkan seluruh rute"
                >
                    <Ionicons name="scan-outline" size={20} color={PRIMARY_DARK} />
                </Pressable>
            )}

            {/* Bottom sheet */}
            <Animated.View
                entering={FadeInUp.duration(350)}
                onLayout={(e) => {
                    setSheetH(e.nativeEvent.layout.height);
                    setSheetMeasured(true);
                }}
                style={[s.sheet, { maxHeight: screenH * 0.66, paddingBottom: insets.bottom + 12 }]}
            >
                <View style={s.handleArea}>
                    <View style={s.handle} />
                </View>

                <ScrollView
                    style={{ flexShrink: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 4 }}
                >
                    {/* Status */}
                    <View style={s.headRow}>
                        <View style={s.headIcon}>
                            <Ionicons name={statusIcon as any} size={22} color={PRIMARY} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.headTitle}>{statusTitle}</Text>
                            <Text style={s.headSub} numberOfLines={2}>
                                {statusSub}
                            </Text>
                        </View>
                        {showEta && (
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={s.etaNum}>{minutes}</Text>
                                <Text style={s.etaUnit}>menit</Text>
                            </View>
                        )}
                    </View>

                    <Stepper active={stageFromStep(step)} />

                    {/* Kartu driver */}
                    <View style={s.driverCard}>
                        {driver?.avatar_url ? (
                            <Image source={{ uri: driver.avatar_url }} style={s.avatar} />
                        ) : (
                            <View style={[s.avatar, { backgroundColor: SECONDARY, alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={s.avatarLetter}>{driverName.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.driverName} numberOfLines={1}>
                                {driverName}
                            </Text>
                            <Text style={s.driverPlate} numberOfLines={1}>
                                {[driver?.plate_number, driver?.vehicle_brand].filter(Boolean).join(' · ') || '-'}
                            </Text>
                        </View>
                        <View style={s.actions}>
                            <Pressable onPress={onChat} style={s.circleBtn} accessibilityLabel="Chat driver">
                                <Ionicons name="chatbubble-ellipses-outline" size={20} color={TEXT} />
                            </Pressable>
                            <Pressable onPress={call} style={[s.circleBtn, s.circleBtnPrimary]} accessibilityLabel="Telepon driver">
                                <Ionicons name="call" size={20} color="#fff" />
                            </Pressable>
                        </View>
                    </View>

                    {/* Banner tunai */}
                    {isCash && (
                        <View style={s.cashBanner}>
                            <Ionicons name="cash-outline" size={22} color="#C77712" />
                            <Text style={s.cashText} numberOfLines={2}>
                                Siapkan uang tunai {formatRupiah(order.total_fare)} untuk driver
                            </Text>
                        </View>
                    )}

                    {/* Struk */}
                    <View style={s.receipt}>
                        <Text style={s.receiptStore} numberOfLines={1}>
                            {storeName}
                        </Text>
                        {items.map((it, i) => (
                            <View key={it.id ?? i} style={s.itemRow}>
                                <Text style={s.itemQty}>{it.qty ?? 1}×</Text>
                                <Text style={s.itemName} numberOfLines={1}>
                                    {it.name}
                                    {it.variant ? ` (${it.variant})` : ''}
                                </Text>
                                <Text style={s.itemPrice}>
                                    {formatRupiah(it.subtotal ?? (Number(it.price) || 0) * (Number(it.qty) || 1))}
                                </Text>
                            </View>
                        ))}
                        {packagingFee > 0 && (
                            <View style={s.itemRow}>
                                <Text style={s.itemQty} />
                                <Text style={s.feeName}>Biaya kemasan</Text>
                                <Text style={s.feePrice}>{formatRupiah(packagingFee)}</Text>
                            </View>
                        )}
                        {deliveryFee > 0 && (
                            <View style={s.itemRow}>
                                <Text style={s.itemQty} />
                                <Text style={s.feeName}>Ongkos kirim</Text>
                                <Text style={s.feePrice}>{formatRupiah(deliveryFee)}</Text>
                            </View>
                        )}
                        {discount > 0 && (
                            <View style={s.itemRow}>
                                <Text style={s.itemQty} />
                                <Text style={s.feeName}>Diskon</Text>
                                <Text style={s.feePrice}>-{formatRupiah(discount)}</Text>
                            </View>
                        )}
                        <View style={s.totalRow}>
                            <Text style={s.totalLabel}>Total · {payLabel(o.payment_method)}</Text>
                            <Text style={s.totalValue}>{formatRupiah(order.total_fare)}</Text>
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    driverMarker: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },

    topBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    closeBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    codePill: {
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 9,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    codeText: { fontSize: 13, fontWeight: '800', color: TEXT },

    fitBtn: {
        position: 'absolute',
        right: 16,
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },

    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
    },
    handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADFDC' },

    headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: PRIMARY_SOFT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
    headSub: { fontSize: 13, color: MUTED, marginTop: 2 },
    etaNum: { fontSize: 22, fontWeight: '800', color: PRIMARY, lineHeight: 24 },
    etaUnit: { fontSize: 11, fontWeight: '700', color: MUTED },

    stepper: { flexDirection: 'row', marginTop: 20 },
    stepCol: { flex: 1, alignItems: 'center' },
    stepLineRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
    line: { flex: 1, height: 3, backgroundColor: TRACK },
    stepDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#CBD2CE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepLabel: { fontSize: 11, fontWeight: '600', color: '#7B8680', marginTop: 6 },

    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 18,
        backgroundColor: '#F4F6F5',
        borderRadius: 18,
        padding: 12,
    },
    avatar: { width: 50, height: 50, borderRadius: 25, flexShrink: 0 },
    avatarLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
    driverName: { fontSize: 16, fontWeight: '800', color: TEXT },
    driverPlate: { fontSize: 13, fontWeight: '600', color: MUTED, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    circleBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#DDE3E0',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleBtnPrimary: { backgroundColor: PRIMARY, borderColor: PRIMARY },

    cashBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
        backgroundColor: '#FFF3E0',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    cashText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#8A4B08' },

    receipt: {
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#E1E6E3',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    receiptStore: { fontSize: 16, fontWeight: '800', color: TEXT, marginBottom: 8 },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    itemQty: { width: 28, fontSize: 14, fontWeight: '800', color: PRIMARY },
    itemName: { flex: 1, fontSize: 15, fontWeight: '500', color: TEXT, paddingRight: 8 },
    itemPrice: { fontSize: 15, fontWeight: '700', color: TEXT },
    feeName: { flex: 1, fontSize: 15, color: MUTED, paddingRight: 8 },
    feePrice: { fontSize: 15, fontWeight: '600', color: MUTED },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: TRACK,
    },
    totalLabel: { fontSize: 16, fontWeight: '800', color: TEXT },
    totalValue: { fontSize: 16, fontWeight: '800', color: TEXT },
});