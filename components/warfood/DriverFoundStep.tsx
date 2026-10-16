// components/warfood/DriverFoundStep.tsx
// Tahap "Driver ditemukan" — peta bergaya mapStyle + banner + bottom sheet (sesuai desain 06-Driver-Ditemukan).
// Semua data dari API (order.driver, order.order_items, dst). Posisi driver REALTIME dari order.driver.coords.
import { mapStyle } from '@/constants/ojek-map-style';
import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import type { OrderResponse } from '@/lib/api';
import { getRoute } from '@/services/google-maps';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, MarkerAnimated, Polyline } from 'react-native-maps';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_PROVIDER } from '../ojek/parts';

const PRIMARY = (colors as any).primary ?? '#40a3ea';
const SECONDARY = (colors as any).secondary ?? '#e68515';
const PRIMARY_SOFT = '#E8F4FD';
const PRIMARY_DARK = '#1F6FAE';
const TEXT = '#172019';
const MUTED = '#5F6B64';
const TRACK = '#E3E8E5';

const SHEET_BASE_H = 470;
const BANNER_H = 52;

const MARKER_PICKUP = require('@/assets/images/marker-origin.png');
const MARKER_DROP = require('@/assets/images/marker-destination.png');

const VEHICLE_IMG = {
    motor: require('@/assets/images/motor-map.png'),
    mobil: require('@/assets/images/mobil-map.png'),
};

// Sedikit lebih pendek dari interval polling order (3 dtk) di mencari-driver.tsx
const MARKER_ANIM_MS = 2800;
const HEADING_MIN_METERS = 5;
// 0 jika gambar ikon menghadap ke atas (utara); ubah (90/180/-90) jika berbeda
const ICON_HEADING_OFFSET = 0;
// Kamera hanya di-fit SEKALI saat layar dibuka (tidak ada auto-zoom lanjutan).
// Jika rute/posisi driver belum lengkap, fit tetap dijalankan setelah jeda ini.
const FIT_FALLBACK_MS = 2500;
const FIT_PAD = 28;
const REROUTE_MIN_INTERVAL_MS = 10000;
const REROUTE_MIN_MOVE_M = 100;
const ROUTE_RETRY_MS = 5000;
const ROAD_FACTOR = 1.3;
const AVG_SPEED_KMH = 25;
const ARRIVE_METERS = 50;

type LatLng = { latitude: number; longitude: number };
type RouteResult = { poly: LatLng[]; dist: number; dur: number };

const toRad = (d: number) => (d * Math.PI) / 180;
function haversine(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
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
/** Baca koordinat dari berbagai bentuk ({latitude,longitude} / {lat,lng}); null jika tidak valid */
function readCoord(c: any): LatLng | null {
    if (!c) return null;
    const lat = toNum(c.latitude ?? c.lat);
    const lng = toNum(c.longitude ?? c.lng ?? c.lon);
    if (lat == null || lng == null || (lat === 0 && lng === 0)) return null;
    return { latitude: lat, longitude: lng };
}

/** Region awal yang memuat semua titik, dengan ruang untuk banner (atas) dan sheet (bawah) */
function regionFor(points: (LatLng | null)[]) {
    const pts = points.filter(Boolean) as LatLng[];
    if (!pts.length) return null;
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 2.8, 0.01);
    const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.01);
    return {
        // pusat peta digeser ke selatan supaya titik tampil di bagian atas (bagian bawah tertutup sheet)
        latitude: (minLat + maxLat) / 2 - latDelta * 0.23,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
    };
}

// ============================================================
// RUTE JALAN
// 1) getRoute (Google Directions) — hanya dipakai jika hasilnya benar-benar rute (> 2 titik)
// 2) cadangan: OSRM (tanpa API key) supaya garis tetap mengikuti jalan
// Tidak ada garis lurus: kalau kedua sumber gagal, garis tidak digambar.
// ============================================================
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
        console.warn('[DriverFound] getRoute tidak mengembalikan rute jalan, memakai OSRM. Hasil:', r?.polyline?.length);
    } catch (e: any) {
        console.warn('[DriverFound] getRoute gagal:', e?.message);
    }
    try {
        return await fetchOsrm(from, to);
    } catch (e: any) {
        console.warn('[DriverFound] OSRM gagal:', e?.message);
        return null;
    }
}

const STAGES = ['Cari driver', 'Ke resto', 'Beli pesanan', 'Diantar', 'Tiba'];

/** Tahap aktif stepper dari status order (sesuaikan dengan status di backend Anda) */
function stageFromStatus(st?: string | null): number {
    switch (st) {
        case 'arrived':
        case 'arrived_pickup':
        case 'purchasing':
        case 'buying':
            return 2;
        case 'picked_up':
        case 'started':
        case 'on_the_way':
        case 'in_progress':
            return 3;
        case 'completed':
            return 4;
        default:
            return 1; // accepted → driver menuju resto
    }
}

type Props = {
    order: OrderResponse;
    onChat: () => void;
    onCall: () => void;
    onTrack: () => void;
};

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

const payLabel = (pm?: string | null) =>
    pm === 'cash' ? 'Tunai' : pm === 'wallet' ? 'Saldo' : pm === 'qris' ? 'QRIS' : 'Transfer Bank';

const fmtRating = (n: any) => {
    const v = toNum(n);
    return v == null ? '—' : v.toFixed(1).replace('.', ',');
};
const fmtThousands = (n: any) => String(Math.round(toNum(n) ?? 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export default function DriverFoundStep({ order, onChat, onCall, onTrack }: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const [expanded, setExpanded] = useState(false);
    const driver: any = order.driver;
    const o: any = order;

    // Tinggi sheet diukur otomatis (teks bisa 2 baris / ringkasan dibuka)
    const [sheetH, setSheetH] = useState(SHEET_BASE_H + insets.bottom);
    const sheetHRef = useRef(sheetH);
    sheetHRef.current = sheetH;
    const [sheetMeasured, setSheetMeasured] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [showFit, setShowFit] = useState(false);
    const TOP_INSET = insets.top + 12 + BANNER_H + 16;

    // ---------- Data dari API ----------
    const pickup = useMemo(() => readCoord(o.pickup_coords), [o.pickup_coords?.latitude, o.pickup_coords?.longitude]); // eslint-disable-line
    const dropoff = useMemo(() => readCoord(o.dropoff_coords), [o.dropoff_coords?.latitude, o.dropoff_coords?.longitude]); // eslint-disable-line

    // Posisi driver REALTIME: order.driver.coords ikut diperbarui oleh polling di mencari-driver.tsx.
    // Tidak ada posisi bawaan/dummy — marker baru muncul setelah koordinat asli dari server tersedia.
    const rawDriver = readCoord(driver?.coords ?? driver?.location ?? driver);
    const dLat = rawDriver?.latitude;
    const dLng = rawDriver?.longitude;
    const driverPos = useMemo<LatLng | null>(
        () => (dLat != null && dLng != null ? { latitude: dLat, longitude: dLng } : null),
        [dLat, dLng],
    );

    const items: any[] = o.order_items ?? o.items ?? [];
    const itemCount = items.reduce((n, it) => n + (Number(it.qty) || 1), 0);
    const name: string = driver?.full_name ?? 'Driver';
    const storeName = o.merchant?.store_name ?? o.pickup_name ?? 'Resto';
    const vehicle = [driver?.vehicle_brand].filter(Boolean).join(' ');
    const vehicleKey = (driver?.vehicle_type === 'mobil' ? 'mobil' : 'motor') as 'motor' | 'mobil';
    const activeStage = stageFromStatus(o.status);

    // ---------- Marker driver animasi ----------
    const animRegion = useRef(
        new AnimatedRegion({
            latitude: driverPos?.latitude ?? pickup?.latitude ?? 0,
            longitude: driverPos?.longitude ?? pickup?.longitude ?? 0,
            latitudeDelta: 0,
            longitudeDelta: 0,
        }),
    ).current;
    const hadPosRef = useRef(!!driverPos);
    const [trackView, setTrackView] = useState(true);

    // Geser marker halus tiap koordinat baru dari server
    useEffect(() => {
        if (!driverPos) return;
        const cfg: any = {
            latitude: driverPos.latitude,
            longitude: driverPos.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0,
            duration: MARKER_ANIM_MS,
            useNativeDriver: false,
        };
        if (!hadPosRef.current) {
            hadPosRef.current = true;
            (animRegion as any).setValue(cfg); // posisi pertama: langsung, tanpa meluncur dari resto
        } else {
            (animRegion as any).timing(cfg).start();
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

    // resto → tujuan (sekali; dicoba ulang beberapa kali jika gagal)
    const [dropRoute, setDropRoute] = useState<LatLng[] | null>(null);
    useEffect(() => {
        if (!pickup || !dropoff) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const run = async (attempt: number) => {
            const r = await fetchRoadRoute(pickup, dropoff);
            if (cancelled || !mountedRef.current) return;
            if (r) setDropRoute(r.poly);
            else if (attempt < 3) timer = setTimeout(() => run(attempt + 1), ROUTE_RETRY_MS);
        };
        run(1);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [pickup?.latitude, pickup?.longitude, dropoff?.latitude, dropoff?.longitude]); // eslint-disable-line

    // driver → resto (diulang saat driver bergerak cukup jauh)
    const [pickupRoute, setPickupRoute] = useState<RouteResult | null>(null);
    const lastRouteRef = useRef<{ t: number; pos: LatLng | null }>({ t: 0, pos: null });
    const reqRef = useRef(0);
    useEffect(() => {
        if (!driverPos || !pickup) return;
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
        fetchRoadRoute(from, pickup).then((r) => {
            if (!mountedRef.current || id !== reqRef.current) return;
            if (r) {
                lastRouteRef.current = { t: Date.now(), pos: from };
                setPickupRoute(r);
            }
        });
    }, [driverPos?.latitude, driverPos?.longitude, pickup?.latitude, pickup?.longitude]); // eslint-disable-line

    // Garis driver → resto: dipotong dari posisi driver sekarang (hanya jika rute jalan tersedia)
    const { driverLine, remainingM } = useMemo(() => {
        if (!driverPos || !pickup) return { driverLine: null as LatLng[] | null, remainingM: null as number | null };
        const poly = pickupRoute?.poly;
        if (poly && poly.length > 1) {
            const idx = nearestIndex(poly, driverPos);
            return {
                driverLine: [driverPos, ...poly.slice(idx + 1)],
                remainingM: haversine(driverPos, poly[idx]) + remainingDistance(poly, idx),
            };
        }
        // rute belum ada: hanya perkiraan jarak untuk ETA, garis TIDAK digambar
        return { driverLine: null as LatLng[] | null, remainingM: haversine(driverPos, pickup) * ROAD_FACTOR };
    }, [pickupRoute, driverPos, pickup]);

    // ETA dari sisa rute
    let liveEta: number | null = null;
    if (remainingM != null) {
        if (pickupRoute?.dur && pickupRoute.dist) {
            const sec = pickupRoute.dur * Math.min(1, remainingM / pickupRoute.dist);
            liveEta = Math.max(1, Math.ceil(sec / 60));
        } else {
            liveEta = Math.max(1, Math.ceil((remainingM / 1000 / AVG_SPEED_KMH) * 60));
        }
    }
    const nearPickup = remainingM != null && remainingM <= ARRIVE_METERS;
    const eta = liveEta ?? Number(o.driver_eta_min ?? o.eta_pickup_min ?? driver?.eta_min);

    // ---------- Kamera ----------
    // Dilakukan SEKALI saat layar dibuka: seluruh rute (resto, tujuan, driver + garis jalan) masuk layar.
    // Setelah itu kamera tidak bergerak/zoom sendiri. Tombol "tampilkan rute" muncul jika peta digeser.
    const fittedRef = useRef(false);
    const fit = (animated: boolean) => {
        const pts = [pickup, dropoff, driverPos, ...(dropRoute ?? []), ...(pickupRoute?.poly ?? [])].filter(
            Boolean,
        ) as LatLng[];
        if (!pts.length) return;
        mapRef.current?.fitToCoordinates(pts, {
            edgePadding: {
                top: TOP_INSET + FIT_PAD,
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
        const complete = !!driverPos && !!dropRoute && !!pickupRoute;
        const tm = setTimeout(
            () => {
                if (fittedRef.current) return;
                fittedRef.current = true;
                fit(false);
            },
            complete ? 100 : FIT_FALLBACK_MS,
        );
        return () => clearTimeout(tm);
    }, [mapReady, sheetMeasured, !!driverPos, !!dropRoute, !!pickupRoute, pickup?.latitude, dropoff?.latitude]); // eslint-disable-line

    // Region awal sudah memuat semua titik, jadi tidak ada lonjakan zoom saat fit pertama
    const initialRegion = useRef(
        regionFor([pickup, dropoff, driverPos]) ?? {
            latitude: -6.9426,
            longitude: 109.7937,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        },
    ).current;

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
                {/* rute resto → tujuan (putus-putus, mengikuti jalan) */}
                {dropRoute && dropRoute.length > 1 && (
                    <Polyline
                        coordinates={dropRoute}
                        strokeColor="#9FB8A9"
                        strokeWidth={4}
                        lineDashPattern={[2, 8]}
                        lineCap="round"
                        lineJoin="round"
                    />
                )}
                {/* rute driver → resto (mengikuti jalan, terpotong saat driver bergerak) */}
                {driverLine && driverLine.length > 1 && (
                    <Polyline coordinates={driverLine} strokeColor={PRIMARY} strokeWidth={5} lineCap="round" lineJoin="round" />
                )}
                {pickup && <Marker coordinate={pickup} image={MARKER_PICKUP} anchor={{ x: 0.5, y: 1 }} />}
                {dropoff && <Marker coordinate={dropoff} image={MARKER_DROP} anchor={{ x: 0.5, y: 1 }} />}
                {driverPos && (
                    <MarkerAnimated
                        coordinate={animRegion as any}
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

            {/* Banner */}
            <Animated.View entering={FadeInUp.duration(300)} style={[s.banner, { top: insets.top + 12 }]}>
                <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
                <Text style={s.bannerText}>Driver ditemukan!</Text>
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

            {/* Sheet */}
            <Animated.View
                entering={FadeInUp.delay(150).duration(350)}
                onLayout={(e) => {
                    setSheetH(e.nativeEvent.layout.height);
                    setSheetMeasured(true);
                }}
                style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}
            >
                <View style={s.handle} />

                <View style={s.headRow}>
                    <View style={s.headIcon}>
                        <Ionicons name="navigate" size={22} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headTitle}>{nearPickup ? 'Driver tiba di resto' : 'Driver menuju resto'}</Text>
                        <Text style={s.headSub} numberOfLines={2}>
                            {nearPickup ? `Driver sudah tiba di ${storeName}` : `Akan membeli pesananmu di ${storeName}`}
                        </Text>
                    </View>
                    {Number.isFinite(eta) && eta > 0 && (
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.etaNum}>{Math.round(eta)}</Text>
                            <Text style={s.etaUnit}>menit</Text>
                        </View>
                    )}
                </View>

                {/* Kartu driver */}
                <View style={s.driverCard}>
                    {driver?.avatar_url ? (
                        <Image source={{ uri: driver.avatar_url }} style={s.avatar} />
                    ) : (
                        <View style={[s.avatar, { backgroundColor: SECONDARY, alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={s.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                    )}

                    {/* Info: nama, rating, plat — satu kolom yang boleh menyusut, tidak menimpa tombol */}
                    <View style={s.infoCol}>
                        <Text style={s.driverName} numberOfLines={1}>
                            {name}
                        </Text>
                        <View style={s.metaRow}>
                            <Ionicons name="star" size={13} color="#F5A623" />
                            <Text style={s.metaText} numberOfLines={1}>
                                {fmtRating(driver?.rating_avg)} · {fmtThousands(driver?.total_trips)} trip
                            </Text>
                        </View>
                        {!!driver?.plate_number && (
                            <View style={s.plate}>
                                <Text style={s.plateText} numberOfLines={1}>
                                    {driver.plate_number}
                                </Text>
                            </View>
                        )}
                        {!!vehicle && (
                            <Text style={s.plateSub} numberOfLines={1}>
                                {vehicle}
                            </Text>
                        )}
                    </View>

                    {/* Tombol: ukuran tetap, tidak ikut menyusut */}
                    <View style={s.actions}>
                        <Pressable style={s.circleBtn} onPress={onChat} accessibilityLabel="Chat driver">
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color={TEXT} />
                        </Pressable>
                        <Pressable style={[s.circleBtn, s.circleBtnPrimary]} onPress={onCall} accessibilityLabel="Telepon driver">
                            <Ionicons name="call" size={20} color="#fff" />
                        </Pressable>
                    </View>
                </View>

                <Stepper active={activeStage} />

                {/* Ringkasan (bisa dibuka) */}
                <Pressable style={s.summary} onPress={() => setExpanded((v) => !v)}>
                    <View style={s.summaryRow}>
                        <Ionicons name="restaurant-outline" size={18} color={PRIMARY} />
                        <Text style={s.summaryName} numberOfLines={1}>
                            {storeName} · {itemCount} item
                        </Text>
                        <Text style={s.summaryPrice}>{formatRupiah(order.total_fare)}</Text>
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#7B8680" />
                    </View>
                    {expanded && (
                        <View style={s.detail}>
                            {items.map((it, i) => (
                                <View key={it.id ?? i} style={s.detailRow}>
                                    <Text style={[s.detailLabel, { flex: 1 }]} numberOfLines={1}>
                                        {it.qty}x {it.name}
                                        {it.variant ? ` (${it.variant})` : ''}
                                    </Text>
                                    <Text style={s.detailValue}>{formatRupiah(it.subtotal ?? it.price * it.qty)}</Text>
                                </View>
                            ))}
                            {Number(o.delivery_fee) > 0 && (
                                <View style={s.detailRow}>
                                    <Text style={s.detailLabel}>Ongkir</Text>
                                    <Text style={s.detailValue}>{formatRupiah(o.delivery_fee)}</Text>
                                </View>
                            )}
                            <View style={s.detailRow}>
                                <Text style={s.detailLabel}>Antar ke</Text>
                                <Text style={s.detailValue} numberOfLines={2}>
                                    {o.dropoff_name ?? o.dropoff_address ?? '-'}
                                </Text>
                            </View>
                            <View style={s.detailRow}>
                                <Text style={s.detailLabel}>Pembayaran</Text>
                                <Text style={s.detailValue}>{payLabel(o.payment_method)}</Text>
                            </View>
                        </View>
                    )}
                </Pressable>

                <Pressable style={s.trackBtn} onPress={onTrack}>
                    <Ionicons name="navigate" size={18} color="#fff" />
                    <Text style={s.trackText}>Lacak pesanan</Text>
                </Pressable>
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    banner: {
        position: 'absolute',
        left: 16,
        right: 16,
        height: BANNER_H,
        borderRadius: BANNER_H / 2,
        backgroundColor: PRIMARY_DARK,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 18,
        elevation: 6,
        shadowColor: PRIMARY_DARK,
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
    },
    bannerText: { color: '#fff', fontSize: 15, fontWeight: '800' },

    driverMarker: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },

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
        paddingTop: 10,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADFDC', alignSelf: 'center', marginBottom: 16 },

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
    etaNum: { fontSize: 20, fontWeight: '800', color: PRIMARY_DARK, lineHeight: 22 },
    etaUnit: { fontSize: 11, fontWeight: '700', color: MUTED },

    // Kartu driver: avatar | info (flex, boleh menyusut) | tombol (tetap)
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 18,
        backgroundColor: '#F4F6F5',
        borderRadius: 18,
        padding: 14,
    },
    avatar: { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
    avatarLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
    infoCol: { flex: 1, minWidth: 0 },
    driverName: { fontSize: 16, fontWeight: '800', color: TEXT },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    metaText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: '#4A554F' },
    plate: {
        alignSelf: 'flex-start',
        maxWidth: '100%',
        marginTop: 6,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#DDE3E0',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    plateText: { fontSize: 13, fontWeight: '800', color: TEXT },
    plateSub: { fontSize: 12, fontWeight: '600', color: MUTED, marginTop: 4 },
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
    circleBtnPrimary: { backgroundColor: PRIMARY_DARK, borderColor: PRIMARY_DARK },

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

    summary: {
        marginTop: 18,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E1E6E3',
        borderRadius: 14,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    summaryName: { flex: 1, fontSize: 13, fontWeight: '700', color: TEXT },
    summaryPrice: { fontSize: 14, fontWeight: '800', color: TEXT },
    detail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: TRACK, gap: 6 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
    detailLabel: { fontSize: 12, color: MUTED },
    detailValue: { fontSize: 13, fontWeight: '700', color: TEXT, textAlign: 'right', flexShrink: 1 },

    trackBtn: {
        marginTop: 12,
        height: 48,
        borderRadius: 24,
        backgroundColor: PRIMARY_DARK,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    trackText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});