// components/order/OrderStep.tsx
import { mapStyle } from '@/constants/ojek-map-style';
import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { useDriverEta } from '@/hooks/use-driver-eta';
import { pickMarkerIcon, useMapMarkers } from '@/hooks/use-map-markers';
import { useTariffs } from '@/hooks/use-tariffs';
import { api, Tariff } from '@/lib/api';
import { trackQuote } from '@/lib/behaviorTracker';
import { getRoute } from '@/services/google-maps';
import type { OrderPayload, PlaceLoc, RouteInfo, ServiceType } from '@/types/ojek';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    Animated as RNAnimated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER } from './parts';

// ✅ Pakai LoadingModal + AppAlert yang sama
import AppAlert from '@/components/AppAlert';
import LoadingModal from '@/components/LoadingModal';

// ============================================================
// TYPES
// ============================================================
type Props = {
    serviceType: ServiceType;
    origin: PlaceLoc;
    destination: PlaceLoc;
    onBack: () => void;
    onOrder: (p: OrderPayload) => void | Promise<void>;
    onEdit: () => void;
    paymentLabel?: string;
    voucherText?: string;
    onVoucherPress?: () => void;
    discountLabel?: string;
    businessLabel?: string;
    onBusinessPress?: () => void;
};

type PaymentMethod = 'cash' | 'wallet' | 'qris' | 'bank_transfer';

type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

type DriverPoint = {
    id: string;
    latitude: number;
    longitude: number;
    heading: number;
};

// ============================================================
// CONSTANTS
// ============================================================
const VEHICLE_IMG = {
    motor: require('@/assets/images/motor.png'),
    mobil: require('@/assets/images/mobil.png'),
};

const MARKER_IMG = {
    origin: require('@/assets/images/marker-origin.png'),
    destination: require('@/assets/images/marker-destination.png'),
};

const ORANGE = '#f26b21';
const CYAN = '#12a8d8';
const CORAL = '#ee6c6c';
const PURPLE = '#8B5CF6';
const GREEN = '#16A34A';

const DRIVER_ICON_SIZE = 40;
const MAX_DRIVER_MARKERS = 30;

// ✅ Minimal VA LinkQu
const VA_MIN_AMOUNT = 10000;

// ---- Pengaturan zoom to fit ----
const FIT_ZOOM_OUT = 1.5;
const FIT_MIN_DELTA = 0.012;
const FIT_SIDE_PAD = 50;

const BANKS = [
    { code: 'BRI', label: 'BRI', short: 'BRI', color: '#00529C' },
    { code: 'BNI', label: 'BNI', short: 'BNI', color: '#F15A23' },
    { code: 'MANDIRI', label: 'Mandiri', short: 'MDR', color: '#003D79' },
    { code: 'BCA', label: 'BCA', short: 'BCA', color: '#0060AF' },
    { code: 'PERMATA', label: 'Permata', short: 'PMT', color: '#6CB33F' },
    { code: 'CIMB', label: 'CIMB Niaga', short: 'CIMB', color: '#EC1C24' },
];

// ============================================================
// HELPERS
// ============================================================
function isValidCoords(c: any): boolean {
    return (
        c &&
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        Number.isFinite(c.latitude) &&
        Number.isFinite(c.longitude) &&
        !(c.latitude === 0 && c.longitude === 0)
    );
}

function toDriverPoint(d: any, i: number): DriverPoint | null {
    if (!d) return null;
    const lat = Number(
        d.coords?.latitude ?? d.coords?.lat ?? d.latitude ?? d.lat
    );
    const lng = Number(
        d.coords?.longitude ?? d.coords?.lng ?? d.longitude ?? d.lng ?? d.lon
    );
    if (!isValidCoords({ latitude: lat, longitude: lng })) return null;
    const heading = Number(d.heading ?? d.bearing ?? d.rotation ?? 0);
    return {
        id: String(d.id ?? d.driver_id ?? d.driverId ?? `drv-${i}`),
        latitude: lat,
        longitude: lng,
        heading: Number.isFinite(heading) ? heading : 0,
    };
}

function getPaymentLabel(method: PaymentMethod, bankLabel?: string): string {
    switch (method) {
        case 'cash':
            return 'Tunai';
        case 'wallet':
            return 'Saldo Waruung';
        case 'qris':
            return 'QRIS';
        case 'bank_transfer':
            return bankLabel ? `VA ${bankLabel}` : 'Transfer Bank';
    }
}

function getPaymentIcon(method: PaymentMethod): keyof typeof Ionicons.glyphMap {
    switch (method) {
        case 'cash':
            return 'cash-outline';
        case 'wallet':
            return 'wallet';
        case 'qris':
            return 'qr-code-outline';
        case 'bank_transfer':
            return 'card-outline';
    }
}

function getPaymentColor(method: PaymentMethod): string {
    switch (method) {
        case 'cash':
            return GREEN;
        case 'wallet':
            return CYAN;
        case 'qris':
            return ORANGE;
        case 'bank_transfer':
            return PURPLE;
    }
}

// ============================================================
// SUB-COMPONENTS
// ============================================================
function RouteDot({ type }: { type: 'origin' | 'destination' }) {
    if (type === 'origin') {
        return (
            <View style={[s.routeDot, { backgroundColor: colors.primary }]}>
                <Ionicons name="arrow-up" size={14} color="#fff" />
            </View>
        );
    }
    return (
        <View style={[s.routeDot, { backgroundColor: ORANGE }]}>
            <View style={s.routeDotInner} />
        </View>
    );
}

const DriverMarker = React.memo(function DriverMarker({
    driver,
    iconUri,
    fallback,
}: {
    driver: DriverPoint;
    iconUri?: string;
    fallback: any;
}) {
    const [tracks, setTracks] = useState(true);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setTracks(true);
        setFailed(false);
        const t = setTimeout(() => setTracks(false), 1500);
        return () => clearTimeout(t);
    }, [iconUri]);

    const source = iconUri && !failed ? { uri: iconUri } : fallback;

    return (
        <Marker
            coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={driver.heading}
            tracksViewChanges={tracks}
            zIndex={4}
            tappable={false}
        >
            <Image
                source={source}
                style={{ width: DRIVER_ICON_SIZE, height: DRIVER_ICON_SIZE }}
                resizeMode="contain"
                onLoadEnd={() => setTracks(false)}
                onError={() => setFailed(true)}
            />
        </Marker>
    );
});

function PaymentOption({
    icon,
    color,
    title,
    subtitle,
    selected,
    disabled,
    onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    title: string;
    subtitle?: string;
    selected: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={[
                s.payOpt,
                selected && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primarySoft,
                },
                disabled && { opacity: 0.5 },
            ]}
        >
            <View style={[s.payOptIcon, { backgroundColor: color }]}>
                <Ionicons name={icon} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.payOptTitle}>{title}</Text>
                {!!subtitle && <Text style={s.payOptSub}>{subtitle}</Text>}
            </View>
            <View
                style={[s.radio, selected && { borderColor: colors.primary }]}
            >
                {selected && <View style={s.radioInner} />}
            </View>
        </Pressable>
    );
}

// ============================================================
// SKELETON SHIMMER
// ============================================================
function SkeletonBox({
    width,
    height,
    borderRadius = 6,
    style,
}: {
    width: number | string;
    height: number;
    borderRadius?: number;
    style?: any;
}) {
    const shimmer = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        const loop = RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(shimmer, {
                    toValue: 1,
                    duration: 900,
                    useNativeDriver: true,
                }),
                RNAnimated.timing(shimmer, {
                    toValue: 0,
                    duration: 900,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [shimmer]);

    const opacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 0.9],
    });

    return (
        <RNAnimated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: '#E5E7EB',
                    opacity,
                },
                style,
            ]}
        />
    );
}

function TariffSkeleton() {
    return (
        <View style={s.option}>
            <View style={s.optionIcon}>
                <SkeletonBox width={52} height={52} borderRadius={12} />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBox width={110} height={16} />
                <SkeletonBox width={150} height={12} />
                <SkeletonBox width={90} height={12} />
            </View>
            <SkeletonBox width={70} height={18} />
        </View>
    );
}

function TariffSkeletonList({ count = 3 }: { count?: number }) {
    return (
        <View>
            {Array.from({ length: count }).map((_, i) => (
                <TariffSkeleton key={i} />
            ))}
        </View>
    );
}

function OptionRow({
    option,
    service,
    price,
    etaMin,
    selected,
    loading,
    onPress,
}: {
    option: Tariff;
    service: ServiceType;
    price: number;
    etaMin: number | null;
    selected: boolean;
    loading: boolean;
    onPress: () => void;
}) {
    const etaLabel =
        etaMin != null ? `${etaMin} mnt` : `± ${option.eta_min} mnt`;

    return (
        <Pressable
            onPress={onPress}
            style={[
                s.option,
                selected && { backgroundColor: colors.primarySoft },
            ]}
        >
            <View style={s.optionIcon}>
                <Image
                    source={VEHICLE_IMG[service]}
                    style={{ width: 52, height: 52 }}
                    resizeMode="contain"
                />
            </View>
            <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                    <Text style={s.optionName} numberOfLines={1}>
                        {option.label}
                    </Text>
                </View>
                <View style={s.meta}>
                    <Text style={s.eta}>{etaLabel}</Text>
                    <View style={s.dot} />
                    <Ionicons name="person" size={12} color={colors.textMuted} />
                    <Text style={s.metaText}>{option.capacity} penumpang</Text>
                </View>
                {!!option.desc_text && (
                    <Text style={s.optionDesc}>{option.desc_text}</Text>
                )}
            </View>
            {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
            ) : (
                <Text style={s.price}>{formatRupiah(price)}</Text>
            )}
            <View style={s.separator} />
        </Pressable>
    );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function OrderStep({
    serviceType,
    origin,
    destination,
    onBack,
    onOrder,
    onEdit,
    paymentLabel = 'Tunai',
    voucherText = 'Voucher s.d. 10rb jika penjemputan tertunda',
    onVoucherPress,
    discountLabel = 'Diskon s.d. 10rb',
    businessLabel = 'Aktifkan profil bisnis',
    onBusinessPress,
}: Props) {
    const insets = useSafeAreaInsets();
    const { height, width } = useWindowDimensions();
    const EXPANDED = Math.min(height * 0.6, 540);
    const COLLAPSED = Math.min(EXPANDED - 80, 340 + insets.bottom);
    const MID = (EXPANDED + COLLAPSED) / 2;
    const mapRef = useRef<MapView>(null);

    const [service, setService] = useState<ServiceType>(serviceType);
    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [routeError, setRouteError] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [mapReady, setMapReady] = useState(false);

    // ============================================================
    // ✅ ALERT STATE — pakai AppAlert (bukan Alert.alert)
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

    const hideAlert = () =>
        setAlertState((a) => ({ ...a, visible: false }));

    // ============================================================
    // ✅ LOADING STATE — loading tambahan untuk redirect payment
    // ============================================================
    const [redirecting, setRedirecting] = useState(false);

    // ============================================================
    // ETA REAL + DRIVER ONLINE
    // ============================================================
    const driverEta = useDriverEta(origin?.coords ?? null, {
        radius: 5000,
        limit: 30,
        pollMs: 15000,
        service: service,
    });

    // ============================================================
    // ICON MARKER DARI DATABASE (motor_map / mobil_map)
    // ============================================================
    const { icons: markerIcons } = useMapMarkers();
    const driverMarkerKey = `${service}_map`;
    const driverIconUri = pickMarkerIcon(markerIcons, driverMarkerKey);

    const driverPoints = useMemo<DriverPoint[]>(() => {
        const raw: any[] = (driverEta as any)?.drivers ?? [];
        return raw
            .map(toDriverPoint)
            .filter((d): d is DriverPoint => d !== null)
            .slice(0, MAX_DRIVER_MARKERS);
    }, [driverEta]);

    // ============================================================
    // PAYMENT STATE
    // ============================================================
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [bankCode, setBankCode] = useState<string | null>(null);
    const [selectedBankLabel, setSelectedBankLabel] = useState<string>('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [customerBalance, setCustomerBalance] = useState<number>(0);

    // ============================================================
    // SUBMIT STATE
    // ============================================================
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const mountedRef = useRef(true);

    // ============================================================
    // SKELETON STATE
    // ============================================================
    const [switchingTab, setSwitchingTab] = useState(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        setService(serviceType);
    }, [serviceType]);

    const { tariffs, loading: tariffsLoading, calcPrice } = useTariffs(service);

    const filteredTariffs = useMemo(() => {
        return tariffs.filter((t) => t.service_type === service);
    }, [tariffs, service]);

    const showSkeleton = tariffsLoading || switchingTab;

    useEffect(() => {
        setSelectedId(null);
    }, [service]);

    useEffect(() => {
        setSwitchingTab(true);
        const t = setTimeout(() => setSwitchingTab(false), 400);
        return () => clearTimeout(t);
    }, [service]);

    useEffect(() => {
        if (!filteredTariffs.length) return;
        const stillValid = filteredTariffs.some((t) => t.code === selectedId);
        if (!stillValid) {
            setSelectedId(filteredTariffs[0].code);
        }
    }, [filteredTariffs, selectedId]);

    useEffect(() => {
        (async () => {
            try {
                const wallet = await api.wallet.get();
                setCustomerBalance(Number(wallet.balance ?? 0));
            } catch (err) {
                console.warn('[OrderStep] Gagal load saldo:', err);
            }
        })();
    }, []);

    const coordsValid =
        isValidCoords(origin?.coords) && isValidCoords(destination?.coords);

    useEffect(() => {
        if (!coordsValid) {
            console.warn('[OrderStep] koordinat tidak valid saat mount', {
                origin: origin?.coords,
                destination: destination?.coords,
            });
            setRouteError(true);
        }
    }, [coordsValid, origin?.coords, destination?.coords]);

    // ---- bottom sheet drag ----
    const sheetH = useSharedValue(EXPANDED);
    const startH = useSharedValue(EXPANDED);
    const SPRING = { damping: 24, stiffness: 240 };

    const pan = Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-24, 24])
        .onStart(() => {
            startH.value = sheetH.value;
        })
        .onUpdate((e) => {
            sheetH.value = Math.min(
                EXPANDED,
                Math.max(COLLAPSED, startH.value - e.translationY)
            );
        })
        .onEnd((e) => {
            const target =
                e.velocityY < -500
                    ? EXPANDED
                    : e.velocityY > 500
                        ? COLLAPSED
                        : sheetH.value > MID
                            ? EXPANDED
                            : COLLAPSED;
            sheetH.value = withSpring(target, SPRING);
        });
    const tap = Gesture.Tap().onEnd(() => {
        sheetH.value = withSpring(
            sheetH.value > MID ? COLLAPSED : EXPANDED,
            SPRING
        );
    });

    const sheetStyle = useAnimatedStyle(() => ({ height: sheetH.value }));
    const floatStyle = useAnimatedStyle(() => ({ bottom: sheetH.value + 12 }));

    // ---- Ambil rute ----
    useEffect(() => {
        if (!coordsValid) {
            setRoute({
                distanceMeters: 0,
                durationSec: 0,
                polyline: [origin.coords, destination.coords],
                isEstimate: true,
            });
            return;
        }

        let alive = true;
        setRouteError(false);

        getRoute(origin.coords, destination.coords)
            .then((r) => {
                if (!alive) return;
                setRoute(r);
                if (r.isEstimate) setRouteError(true);
            })
            .catch((err) => {
                if (!alive) return;
                console.warn('[OrderStep] getRoute gagal:', err?.message);
                setRouteError(true);
                setRoute({
                    distanceMeters: 0,
                    durationSec: 0,
                    polyline: [origin.coords, destination.coords],
                    isEstimate: true,
                });
            });

        return () => {
            alive = false;
        };
    }, [origin.coords, destination.coords, coordsValid]);

    // ---- Zoom to fit ----
    const fit = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;

        const pts = [
            origin?.coords,
            destination?.coords,
            ...(route?.polyline ?? []),
        ].filter(isValidCoords) as { latitude: number; longitude: number }[];

        if (pts.length === 0) return;

        if (pts.length === 1) {
            map.animateToRegion(
                {
                    latitude: pts[0].latitude,
                    longitude: pts[0].longitude,
                    latitudeDelta: FIT_MIN_DELTA,
                    longitudeDelta: FIT_MIN_DELTA,
                },
                400
            );
            return;
        }

        const lats = pts.map((p) => p.latitude);
        const lngs = pts.map((p) => p.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const routeCenterLat = (minLat + maxLat) / 2;
        const routeCenterLng = (minLng + maxLng) / 2;

        const topInset = insets.top + 130;
        const bottomInset = EXPANDED + 20;
        const visibleH = Math.max(height - topInset - bottomInset, 200);
        const visibleW = Math.max(width - FIT_SIDE_PAD * 2, 150);

        const latDelta = Math.max(
            (maxLat - minLat) * FIT_ZOOM_OUT * (height / visibleH),
            FIT_MIN_DELTA
        );
        const lngDelta = Math.max(
            (maxLng - minLng) * FIT_ZOOM_OUT * (width / visibleW),
            FIT_MIN_DELTA * (width / height)
        );

        const offsetPx = height / 2 - (topInset + visibleH / 2);
        const centerLat = routeCenterLat - (offsetPx / height) * latDelta;

        map.animateToRegion(
            {
                latitude: centerLat,
                longitude: routeCenterLng,
                latitudeDelta: latDelta,
                longitudeDelta: lngDelta,
            },
            400
        );
    }, [
        origin?.coords,
        destination?.coords,
        route?.polyline,
        insets.top,
        EXPANDED,
        height,
        width,
    ]);

    useEffect(() => {
        if (!mapReady || !route) return;
        const t = setTimeout(fit, 250);
        return () => clearTimeout(t);
    }, [mapReady, route, fit]);

    const selected = useMemo(() => {
        if (!filteredTariffs.length) return null;
        return (
            filteredTariffs.find((o) => o.code === selectedId) ??
            filteredTariffs[0]
        );
    }, [filteredTariffs, selectedId]);

    const priceOf = (t: Tariff) =>
        calcPrice(t.code, route?.distanceMeters ?? 0);

    const currentPrice = selected ? priceOf(selected) : 0;

    // ============================================================
    // ✅ CEK APAKAH VA BISA DIPAKAI (minimal Rp 10.000)
    // ============================================================
    const canUseVA = currentPrice >= VA_MIN_AMOUNT;

    useEffect(() => {
        if (!canUseVA && paymentMethod === 'bank_transfer') {
            setPaymentMethod('cash');
            setBankCode(null);
            setSelectedBankLabel('');
        }
    }, [canUseVA, paymentMethod]);

    // ---- Track quote ----
    useEffect(() => {
        if (!origin || !destination) return;
        if (!selected) return;
        if (!route || route.distanceMeters <= 0) return;
        if (currentPrice <= 0) return;

        trackQuote({
            service: 'ride',
            origin: {
                name: origin.name || origin.address || 'Lokasi jemput',
                coords: {
                    latitude: origin.coords.latitude,
                    longitude: origin.coords.longitude,
                },
            },
            destination: {
                name: destination.name || destination.address || 'Tujuan',
                coords: {
                    latitude: destination.coords.latitude,
                    longitude: destination.coords.longitude,
                },
            },
            optionName: selected.label,
            price: currentPrice,
            etaMin: driverEta.etaMin ?? selected.eta_min,
            distanceKm: route.distanceMeters / 1000,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selected?.code,
        currentPrice,
        route?.distanceMeters,
        origin?.name,
        destination?.name,
        driverEta.etaMin,
    ]);

    const isSaldoEnough = customerBalance >= currentPrice;

    // ---- tab indicator ----
    const tabPos = useRef<Record<ServiceType, { x: number; w: number }>>({
        motor: { x: 0, w: 0 },
        mobil: { x: 0, w: 0 },
    });
    const indX = useSharedValue(0);
    const indW = useSharedValue(0);

    const moveIndicator = (t: ServiceType, animated = true) => {
        const p = tabPos.current[t];
        if (!p.w) return;
        indX.value = animated ? withTiming(p.x, { duration: 220 }) : p.x;
        indW.value = animated ? withTiming(p.w, { duration: 220 }) : p.w;
    };

    const switchService = (t: ServiceType) => {
        if (t === service) return;
        setService(t);
        setSelectedId(null);
        setSwitchingTab(true);
        moveIndicator(t);
    };

    const indicator = useAnimatedStyle(() => ({
        width: indW.value,
        transform: [{ translateX: indX.value }],
    }));

    const canOrder =
        coordsValid &&
        !!route &&
        !routeError &&
        route.distanceMeters > 0 &&
        !!selected;

    // ============================================================
    // HANDLE ORDER — pakai showAlert bukan Alert.alert
    // ============================================================
    const handleOrder = async () => {
        if (submittingRef.current) return;
        if (!route || !selected) return;

        // ✅ Validasi saldo wallet — pakai showAlert
        if (paymentMethod === 'wallet' && !isSaldoEnough) {
            showAlert(
                'Saldo tidak cukup',
                `Saldo kamu ${formatRupiah(
                    customerBalance
                )}, butuh ${formatRupiah(currentPrice)}. Top up dulu atau pilih metode lain.`,
                [
                    { text: 'Tutup', style: 'cancel' },
                    {
                        text: 'Top Up',
                        onPress: () => {
                            hideAlert();
                            // onPressTopup?.();
                        },
                    },
                ]
            );
            return;
        }

        // ✅ Validasi bank VA — pakai showAlert
        if (paymentMethod === 'bank_transfer' && !bankCode) {
            showAlert(
                'Bank belum dipilih',
                'Pilih bank untuk transfer VA dulu.',
                [
                    { text: 'Tutup', style: 'cancel' },
                    {
                        text: 'Pilih Bank',
                        onPress: () => {
                            hideAlert();
                            setShowBankModal(true);
                        },
                    },
                ]
            );
            return;
        }

        // ✅ Validasi minimum VA
        if (paymentMethod === 'bank_transfer' && !canUseVA) {
            showAlert(
                'Minimal Rp 10.000',
                `Transfer Bank (VA) minimal Rp 10.000. Total orderanmu ${formatRupiah(
                    currentPrice
                )}. Pilih metode lain atau tambah orderan.`,
                [{ text: 'Mengerti' }]
            );
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);

        try {
            await onOrder({
                service,
                optionId: selected.code,
                optionName: selected.label,
                price: priceOf(selected),
                origin,
                destination,
                distanceMeters: route.distanceMeters,
                durationSec: route.durationSec,
                payment_method: paymentMethod,
                bank_code:
                    paymentMethod === 'bank_transfer' && bankCode
                        ? bankCode
                        : undefined,
            });
        } catch (err: any) {
            // ✅ Error dari onOrder — pakai showAlert
            console.warn('[OrderStep] onOrder gagal:', err?.message);
            showAlert(
                'Gagal membuat pesanan',
                err?.message || 'Coba lagi sebentar.',
                [
                    { text: 'Tutup', style: 'cancel' },
                    {
                        text: 'Coba Lagi',
                        onPress: () => {
                            hideAlert();
                            setTimeout(() => handleOrder(), 300);
                        },
                    },
                ]
            );
        } finally {
            submittingRef.current = false;
            if (mountedRef.current) setSubmitting(false);
        }
    };

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                customMapStyle={mapStyle}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                showsPointsOfInterest={false}
                showsBuildings={false}
                showsTraffic={false}
                onMapReady={() => setMapReady(true)}
                initialRegion={{
                    ...(isValidCoords(origin?.coords)
                        ? origin.coords
                        : { latitude: -6.2, longitude: 106.63 }),
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                {route?.polyline && route.polyline.length >= 2 && (
                    <>
                        <Polyline
                            coordinates={route.polyline}
                            strokeColor="#ffffff"
                            strokeWidth={9}
                            lineCap="round"
                            lineJoin="round"
                        />
                        <Polyline
                            coordinates={route.polyline}
                            strokeColor={colors.primary}
                            strokeWidth={5}
                            lineCap="round"
                            lineJoin="round"
                        />
                    </>
                )}

                {driverPoints.map((d) => (
                    <DriverMarker
                        key={`${service}-${d.id}`}
                        driver={d}
                        iconUri={driverIconUri}
                        fallback={VEHICLE_IMG[service]}
                    />
                ))}

                {isValidCoords(origin?.coords) && (
                    <Marker
                        coordinate={origin.coords}
                        image={MARKER_IMG.origin}
                        anchor={{ x: 0.5, y: 1 }}
                        title={origin.name}
                        description="Titik jemput"
                        zIndex={3}
                    />
                )}
                {isValidCoords(destination?.coords) && (
                    <Marker
                        coordinate={destination.coords}
                        image={MARKER_IMG.destination}
                        anchor={{ x: 0.5, y: 1 }}
                        title={destination.name}
                        description="Tujuan"
                        zIndex={3}
                    />
                )}
            </MapView>

            {/* Kartu asal-tujuan */}
            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[s.routeCard, { top: insets.top + 12 }]}
            >
                <View style={{ flex: 1 }}>
                    <View style={s.routeRow}>
                        <RouteDot type="origin" />
                        <Text style={s.routeText} numberOfLines={1}>
                            {origin.name || 'Titik jemput'}
                        </Text>
                    </View>
                    <View style={s.routeDivider} />
                    <View style={s.routeRow}>
                        <RouteDot type="destination" />
                        <Text style={s.routeText} numberOfLines={1}>
                            {destination.name || 'Tujuan'}
                        </Text>
                    </View>
                </View>
                <Pressable onPress={onEdit} style={s.addBtn}>
                    <AntDesign name="edit" size={20} color={ORANGE} />
                    <Text style={s.addText}>Edit</Text>
                </Pressable>
            </Animated.View>

            {/* Tombol back */}
            <Animated.View
                pointerEvents="box-none"
                style={[s.floatRow, floatStyle]}
            >
                <View style={s.floatBack}>
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>
            </Animated.View>

            {/* Bottom sheet */}
            <Animated.View style={[s.sheet, sheetStyle]}>
                <GestureDetector gesture={pan}>
                    <View>
                        <GestureDetector gesture={tap}>
                            <View style={s.handleArea}>
                                <View style={s.handle} />
                            </View>
                        </GestureDetector>

                        <View style={s.tabs}>
                            {(['motor', 'mobil'] as ServiceType[]).map((t) => (
                                <Pressable
                                    key={t}
                                    style={s.tab}
                                    hitSlop={{ left: 20, right: 20 }}
                                    onPress={() => switchService(t)}
                                    onLayout={(e) => {
                                        const { x, width } =
                                            e.nativeEvent.layout;
                                        tabPos.current[t] = { x, w: width };
                                        if (t === service)
                                            moveIndicator(t, false);
                                    }}
                                >
                                    <Text
                                        style={[
                                            s.tabText,
                                            service === t && {
                                                color: colors.primary,
                                            },
                                        ]}
                                    >
                                        {t === 'motor' ? 'Motor' : 'Mobil'}
                                    </Text>
                                </Pressable>
                            ))}
                            <Animated.View
                                style={[s.indicator, indicator]}
                            />
                        </View>
                    </View>
                </GestureDetector>

                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                >
                    {showSkeleton && <TariffSkeletonList count={3} />}

                    {!showSkeleton && filteredTariffs.length === 0 && (
                        <TariffSkeletonList count={2} />
                    )}

                    {!showSkeleton &&
                        filteredTariffs.map((o, idx) => (
                            <Animated.View
                                key={o.code}
                                entering={FadeInUp.delay(
                                    idx * 40
                                ).duration(220)}
                            >
                                <OptionRow
                                    option={o}
                                    service={service}
                                    price={priceOf(o)}
                                    etaMin={driverEta.etaMin}
                                    loading={!route}
                                    selected={selected?.code === o.code}
                                    onPress={() => setSelectedId(o.code)}
                                />
                            </Animated.View>
                        ))}
                </ScrollView>

                <View
                    style={[
                        s.footer,
                        { paddingBottom: insets.bottom + 12 },
                    ]}
                >
                    {route?.isEstimate && (
                        <Text style={s.estimate}>
                            {routeError
                                ? 'Rute tidak tersedia, harga berdasarkan perkiraan jarak.'
                                : 'Rute belum tersedia, harga berdasarkan perkiraan jarak.'}
                        </Text>
                    )}

                    <View style={s.payLine}>
                        <Pressable
                            style={{ flexShrink: 1 }}
                            onPress={() => setShowPaymentModal(true)}
                        >
                            <View style={s.payRow}>
                                <View
                                    style={[
                                        s.payIcon,
                                        {
                                            backgroundColor:
                                                getPaymentColor(
                                                    paymentMethod
                                                ),
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name={getPaymentIcon(paymentMethod)}
                                        size={12}
                                        color="#fff"
                                    />
                                </View>
                                <Text style={s.payText}>
                                    {getPaymentLabel(
                                        paymentMethod,
                                        selectedBankLabel
                                    )}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={14}
                                    color={colors.text}
                                />
                            </View>
                            {paymentMethod === 'wallet' && (
                                <Text
                                    style={[
                                        s.balance,
                                        {
                                            color: isSaldoEnough
                                                ? colors.primary
                                                : CORAL,
                                        },
                                    ]}
                                >
                                    Saldo:{' '}
                                    {formatRupiah(customerBalance)}
                                </Text>
                            )}
                        </Pressable>

                        {!!discountLabel && (
                            <Pressable style={s.discount}>
                                <View style={s.discountIcon}>
                                    <Ionicons
                                        name="pricetag"
                                        size={11}
                                        color="#fff"
                                    />
                                </View>
                                <Text style={s.discountText}>
                                    {discountLabel}
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    <Pressable
                        disabled={!canOrder || !selected || submitting}
                        onPress={handleOrder}
                        style={[
                            s.cta,
                            {
                                opacity:
                                    canOrder && selected && !submitting
                                        ? 1
                                        : 0.6,
                            },
                        ]}
                    >
                        <Text style={s.ctaText} numberOfLines={1}>
                            {submitting
                                ? 'Memproses pesanan…'
                                : `Cari ${selected?.label ?? 'kendaraan'}`}
                        </Text>
                        {submitting ? (
                            <ActivityIndicator
                                color="#fff"
                                style={{ marginRight: 4 }}
                            />
                        ) : (
                            <Text style={s.ctaPrice}>
                                {route && selected
                                    ? formatRupiah(priceOf(selected))
                                    : '…'}
                            </Text>
                        )}
                        <View style={s.ctaArrow}>
                            <Ionicons
                                name="arrow-forward"
                                size={18}
                                color={colors.primary}
                            />
                        </View>
                    </Pressable>
                </View>
            </Animated.View>

            {/* ============================================================ */}
            {/* MODAL: Pilih Metode Pembayaran                                */}
            {/* ============================================================ */}
            <Modal
                visible={showPaymentModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPaymentModal(false)}
                statusBarTranslucent
            >
                <View style={s.modalOverlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setShowPaymentModal(false)}
                    />
                    <View
                        style={[
                            s.modalSheet,
                            { paddingBottom: insets.bottom + 12 },
                        ]}
                    >
                        <View style={s.modalHandle} />
                        <Text style={s.modalTitle}>
                            Pilih Metode Pembayaran
                        </Text>

                        <PaymentOption
                            icon="cash-outline"
                            color={GREEN}
                            title="Tunai"
                            subtitle="Bayar langsung ke driver"
                            selected={paymentMethod === 'cash'}
                            onPress={() => {
                                setPaymentMethod('cash');
                                setBankCode(null);
                                setSelectedBankLabel('');
                                setShowPaymentModal(false);
                            }}
                        />

                        <PaymentOption
                            icon="wallet"
                            color={CYAN}
                            title="Saldo Waruung"
                            subtitle={`Saldo: ${formatRupiah(
                                customerBalance
                            )}`}
                            selected={paymentMethod === 'wallet'}
                            disabled={customerBalance < currentPrice}
                            onPress={() => {
                                if (customerBalance < currentPrice) {
                                    // ✅ Pakai showAlert
                                    setShowPaymentModal(false);
                                    showAlert(
                                        'Saldo tidak cukup',
                                        `Saldo kamu ${formatRupiah(
                                            customerBalance
                                        )}, butuh ${formatRupiah(
                                            currentPrice
                                        )}. Top up dulu atau pilih metode lain.`,
                                        [{ text: 'Mengerti' }]
                                    );
                                    return;
                                }
                                setPaymentMethod('wallet');
                                setBankCode(null);
                                setSelectedBankLabel('');
                                setShowPaymentModal(false);
                            }}
                        />

                        <PaymentOption
                            icon="qr-code-outline"
                            color={ORANGE}
                            title="QRIS"
                            subtitle="Scan QRIS via LinkQu"
                            selected={paymentMethod === 'qris'}
                            onPress={() => {
                                setPaymentMethod('qris');
                                setBankCode(null);
                                setSelectedBankLabel('');
                                setShowPaymentModal(false);
                            }}
                        />

                        {/* ✅ VA DISABLED jika total < Rp 10.000 */}
                        <PaymentOption
                            icon="card-outline"
                            color={PURPLE}
                            title="Transfer Bank (VA)"
                            subtitle={
                                !canUseVA
                                    ? `Minimal Rp 10.000 (total ${formatRupiah(
                                        currentPrice
                                    )})`
                                    : bankCode
                                        ? `VA ${selectedBankLabel}`
                                        : 'BRI, BNI, Mandiri, BCA, dll'
                            }
                            selected={paymentMethod === 'bank_transfer'}
                            disabled={!canUseVA}
                            onPress={() => {
                                if (!canUseVA) {
                                    setShowPaymentModal(false);
                                    showAlert(
                                        'Minimal Rp 10.000',
                                        `Transfer Bank (VA) minimal Rp 10.000. Total orderanmu ${formatRupiah(
                                            currentPrice
                                        )}. Pilih metode lain atau tambah orderan dulu.`,
                                        [{ text: 'Mengerti' }]
                                    );
                                    return;
                                }
                                setPaymentMethod('bank_transfer');
                                setShowPaymentModal(false);
                                setShowBankModal(true);
                            }}
                        />

                        {/* Info minimum VA */}
                        {!canUseVA && (
                            <View style={s.vaHint}>
                                <Ionicons
                                    name="information-circle-outline"
                                    size={14}
                                    color={colors.textMuted}
                                />
                                <Text style={s.vaHintText}>
                                    Transfer Bank (VA) minimal Rp 10.000
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ============================================================ */}
            {/* MODAL: Pilih Bank                                             */}
            {/* ============================================================ */}
            <Modal
                visible={showBankModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowBankModal(false)}
                statusBarTranslucent
            >
                <View style={s.modalOverlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setShowBankModal(false)}
                    />
                    <View
                        style={[
                            s.modalSheet,
                            { paddingBottom: insets.bottom + 12 },
                        ]}
                    >
                        <View style={s.modalHandle} />
                        <Text style={s.modalTitle}>Pilih Bank</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {BANKS.map((b, i) => (
                                <Pressable
                                    key={b.code}
                                    onPress={() => {
                                        setBankCode(b.code);
                                        setSelectedBankLabel(b.label);
                                        setShowBankModal(false);
                                    }}
                                    style={[
                                        s.bankRow,
                                        i < BANKS.length - 1 &&
                                        s.bankRowBorder,
                                        bankCode === b.code &&
                                        s.bankRowActive,
                                    ]}
                                >
                                    <View
                                        style={[
                                            s.bankBadge,
                                            { backgroundColor: b.color },
                                        ]}
                                    >
                                        <Text style={s.bankBadgeText}>
                                            {b.short}
                                        </Text>
                                    </View>
                                    <Text style={s.bankLabel}>
                                        {b.label}
                                    </Text>
                                    {bankCode === b.code && (
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={22}
                                            color={colors.primary}
                                        />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ✅ Loading Modal untuk submitting & redirect */}
            <LoadingModal visible={submitting || redirecting} />

            {/* ✅ AppAlert untuk semua notifikasi */}
            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={
                    alertState.buttons ?? [{ text: 'OK' }]
                }
                onClose={hideAlert}
            />
        </GestureHandlerRootView>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    routeCard: {
        position: 'absolute',
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingLeft: 14,
        paddingRight: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        height: 36,
    },
    routeText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    routeDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 36,
    },
    routeDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    routeDotInner: {
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: '#fff',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 46,
        paddingLeft: 12,
        paddingRight: 18,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#fff',
        marginLeft: 14,
    },
    addText: { fontSize: 15, fontWeight: '500', color: colors.text },

    floatRow: {
        position: 'absolute',
        left: 16,
        right: 16,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    floatBack: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },

    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
    },
    handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#c9ccd1',
    },

    tabs: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
    tab: { paddingVertical: 10 },
    tabText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textMuted,
    },
    indicator: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: 3,
        borderRadius: 2,
        backgroundColor: colors.primary,
    },

    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    optionIcon: { width: 56, alignItems: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    optionName: {
        flexShrink: 1,
        fontSize: 17,
        fontWeight: '800',
        color: colors.text,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 3,
    },
    eta: { color: colors.text, fontSize: 13, fontWeight: '700' },
    metaText: { color: colors.textMuted, fontSize: 13 },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#c4c8cf',
    },
    optionDesc: { color: colors.textMuted, marginTop: 3, fontSize: 13 },
    price: { fontSize: 17, fontWeight: '700', color: colors.text },
    separator: {
        position: 'absolute',
        bottom: 0,
        left: 90,
        right: 20,
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
    },

    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: '#fff',
    },
    estimate: { fontSize: 12, color: colors.secondary },

    payLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    payRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    payIcon: {
        width: 20,
        height: 20,
        borderRadius: 5,
        backgroundColor: CYAN,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payText: { fontWeight: '700', fontSize: 15, color: colors.text },
    balance: { marginTop: 2, fontSize: 13, fontWeight: '600' },

    discount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 38,
        paddingHorizontal: 14,
        borderRadius: 19,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
    },
    discountIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    discountText: { fontSize: 14, fontWeight: '700', color: colors.text },

    cta: {
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        paddingLeft: 22,
        paddingRight: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    ctaText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 16 },
    ctaPrice: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
        marginRight: 4,
    },
    ctaArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ===== Modal =====
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(17,24,39,0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    modalHandle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E5E7EB',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 14,
    },

    // ===== Payment option =====
    payOpt: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: '#fff',
        marginBottom: 10,
    },
    payOptIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payOptTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.text,
    },
    payOptSub: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },

    // ✅ Hint minimum VA
    vaHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 4,
        paddingTop: 4,
    },
    vaHintText: {
        fontSize: 12,
        color: colors.textMuted,
        fontStyle: 'italic',
    },

    // ===== Bank row =====
    bankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
    },
    bankRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    bankRowActive: {
        backgroundColor: colors.primarySoft,
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    bankBadge: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
    },
    bankLabel: {
        flex: 1,
        marginLeft: 14,
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
});