// components/order/OrderStep.tsx
import { formatRupiah } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { useTariffs } from '@/hooks/use-tariffs';
import { api, Tariff } from '@/lib/api';
import { trackQuote } from '@/lib/behaviorTracker';
import { getRoute } from '@/services/google-maps';
import type { OrderPayload, PlaceLoc, RouteInfo, ServiceType } from '@/types/ojek';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
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

// ============================================================
// TYPES
// ============================================================
type Props = {
    serviceType: ServiceType;
    origin: PlaceLoc;
    destination: PlaceLoc;
    onBack: () => void;
    onOrder: (p: OrderPayload) => void;
    onEdit: () => void;
    paymentLabel?: string;
    voucherText?: string;
    onVoucherPress?: () => void;
    discountLabel?: string;
    businessLabel?: string;
    onBusinessPress?: () => void;
};

type PaymentMethod = 'cash' | 'wallet' | 'qris' | 'bank_transfer';

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

function OptionRow({
    option,
    service,
    price,
    selected,
    loading,
    onPress,
}: {
    option: Tariff;
    service: ServiceType;
    price: number;
    selected: boolean;
    loading: boolean;
    onPress: () => void;
}) {
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
                    <Text style={s.eta}>{option.eta_min} mnt</Text>
                    <View style={s.dot} />
                    <Ionicons
                        name="person"
                        size={12}
                        color={colors.textMuted}
                    />
                    <Text style={s.metaText}>
                        {option.capacity} penumpang
                    </Text>
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
    const { height } = useWindowDimensions();
    const EXPANDED = Math.min(height * 0.6, 540);
    const COLLAPSED = Math.min(EXPANDED - 80, 340 + insets.bottom);
    const MID = (EXPANDED + COLLAPSED) / 2;
    const mapRef = useRef<MapView>(null);

    const [service, setService] = useState<ServiceType>(serviceType);
    const [route, setRoute] = useState<RouteInfo | null>(null);
    const [routeError, setRouteError] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // ============================================================
    // ✅ PAYMENT STATE
    // ============================================================
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [bankCode, setBankCode] = useState<string | null>(null);
    const [selectedBankLabel, setSelectedBankLabel] = useState<string>('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [customerBalance, setCustomerBalance] = useState<number>(0);

    // ---- Tarif dari backend ----
    const { tariffs, loading: tariffsLoading, calcPrice } = useTariffs(service);

    useEffect(() => {
        if (!selectedId && tariffs.length > 0) {
            setSelectedId(tariffs[0].code);
        }
    }, [tariffs, selectedId]);

    // ============================================================
    // ✅ FETCH SALDO CUSTOMER
    // ============================================================
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

    const fit = () => {
        const pts = route?.polyline?.length
            ? route.polyline
            : [origin.coords, destination.coords].filter(isValidCoords);
        if (pts.length < 1) return;
        mapRef.current?.fitToCoordinates(pts as any, {
            edgePadding: {
                top: insets.top + 130,
                bottom: EXPANDED + 70,
                left: 60,
                right: 60,
            },
            animated: true,
        });
    };
    useEffect(() => {
        if (route) fit();
    }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Pilihan ----
    const selected = useMemo(() => {
        if (!tariffs.length) return null;
        return tariffs.find((o) => o.code === selectedId) ?? tariffs[0];
    }, [tariffs, selectedId]);

    const priceOf = (t: Tariff) =>
        calcPrice(t.code, route?.distanceMeters ?? 0);

    const currentPrice = selected ? priceOf(selected) : 0;

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
            etaMin: selected.eta_min,
            distanceKm: route.distanceMeters / 1000,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selected?.code,
        currentPrice,
        route?.distanceMeters,
        origin?.name,
        destination?.name,
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
        setService(t);
        setSelectedId(null);
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
    // HANDLE ORDER
    // ============================================================
    const handleOrder = () => {
        if (!route || !selected) return;

        // Validasi tambahan
        if (paymentMethod === 'wallet' && !isSaldoEnough) {
            Alert.alert(
                'Saldo tidak cukup',
                `Saldo kamu ${formatRupiah(
                    customerBalance
                )}, butuh ${formatRupiah(currentPrice)}`
            );
            return;
        }

        if (paymentMethod === 'bank_transfer' && !bankCode) {
            Alert.alert(
                'Bank belum dipilih',
                'Pilih bank untuk transfer VA dulu.'
            );
            return;
        }

        onOrder({
            service,
            optionId: selected.code,
            optionName: selected.label,
            price: priceOf(selected),
            origin,
            destination,
            distanceMeters: route.distanceMeters,
            durationSec: route.durationSec,
            payment_method: paymentMethod, // ✅ KIRIM
            bank_code:
                paymentMethod === 'bank_transfer' && bankCode
                    ? bankCode
                    : undefined, // ✅ KIRIM
        });
    };

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                onMapReady={fit}
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
                {isValidCoords(origin?.coords) && (
                    <Marker
                        coordinate={origin.coords}
                        image={MARKER_IMG.origin}
                        anchor={{ x: 0.5, y: 1 }}
                        title={origin.name}
                        description="Titik jemput"
                        zIndex={2}
                    />
                )}
                {isValidCoords(destination?.coords) && (
                    <Marker
                        coordinate={destination.coords}
                        image={MARKER_IMG.destination}
                        anchor={{ x: 0.5, y: 1 }}
                        title={destination.name}
                        description="Tujuan"
                        zIndex={2}
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
                    {tariffsLoading && (
                        <View
                            style={{
                                padding: 20,
                                alignItems: 'center',
                            }}
                        >
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    )}

                    {!tariffsLoading && tariffs.length === 0 && (
                        <View
                            style={{
                                padding: 20,
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: colors.textMuted }}>
                                Tarif belum tersedia untuk layanan ini.
                            </Text>
                        </View>
                    )}

                    {!tariffsLoading &&
                        tariffs.map((o) => (
                            <OptionRow
                                key={o.code}
                                option={o}
                                service={service}
                                price={priceOf(o)}
                                loading={!route}
                                selected={selected?.code === o.code}
                                onPress={() => setSelectedId(o.code)}
                            />
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
                        {/* ✅ TOMBOL PAYMENT — BUKA MODAL */}
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
                        disabled={!canOrder || !selected}
                        onPress={handleOrder}
                        style={[
                            s.cta,
                            {
                                opacity:
                                    canOrder && selected ? 1 : 0.6,
                            },
                        ]}
                    >
                        <Text style={s.ctaText} numberOfLines={1}>
                            Cari {selected?.label ?? 'kendaraan'}
                        </Text>
                        <Text style={s.ctaPrice}>
                            {route && selected
                                ? formatRupiah(priceOf(selected))
                                : '…'}
                        </Text>
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

            {/* ============================================================
                MODAL: Pilih Metode Pembayaran
            ============================================================ */}
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
                                    Alert.alert(
                                        'Saldo tidak cukup',
                                        `Saldo kamu ${formatRupiah(
                                            customerBalance
                                        )}, butuh ${formatRupiah(
                                            currentPrice
                                        )}`
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

                        <PaymentOption
                            icon="card-outline"
                            color={PURPLE}
                            title="Transfer Bank (VA)"
                            subtitle={
                                bankCode
                                    ? `VA ${selectedBankLabel}`
                                    : 'BRI, BNI, Mandiri, BCA, dll'
                            }
                            selected={paymentMethod === 'bank_transfer'}
                            onPress={() => {
                                setPaymentMethod('bank_transfer');
                                setShowPaymentModal(false);
                                setShowBankModal(true);
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* ============================================================
                MODAL: Pilih Bank (untuk VA)
            ============================================================ */}
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