import { calcFare, formatRupiah, RideOption, SERVICES } from '@/constants/ojek-services';
import { colors } from '@/constants/ojek-theme';
import { getRoute } from '@/services/google-maps';
import type { OrderPayload, PlaceLoc, RouteInfo, ServiceType } from '@/types/ojek';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, MAP_PROVIDER } from './parts';

type Props = {
    serviceType: ServiceType;
    origin: PlaceLoc;
    destination: PlaceLoc;
    onBack: () => void;
    onOrder: (p: OrderPayload) => void;
    /** tombol "Tambah" di kartu asal-tujuan -> buka halaman pencarian */
    onEdit: () => void;
    paymentLabel?: string;
    /** banner biru di atas metode bayar. Kirim '' untuk menyembunyikan */
    voucherText?: string;
    onVoucherPress?: () => void;
    /** pil "Diskon" di kanan metode bayar. Kirim '' untuk menyembunyikan */
    discountLabel?: string;
    /** pil di samping tombol kembali. Kirim '' untuk menyembunyikan */
    businessLabel?: string;
    onBusinessPress?: () => void;
};

const VEHICLE_IMG = {
    motor: require('@/assets/images/motor.png'),
    mobil: require('@/assets/images/mobil.png'),
};

// Marker pakai gambar (paling stabil di Android). File @2x/@3x dipilih otomatis sesuai layar.
const MARKER_IMG = {
    origin: require('@/assets/images/marker-origin.png'),
    destination: require('@/assets/images/marker-destination.png'),
};

// Warna tambahan di luar tema
const ORANGE = '#f26b21';
const CYAN = '#12a8d8';
const CYAN_DARK = '#0b93c0';
const CORAL = '#ee6c6c';

// ---- saldo dummy untuk simulasi cek kecukupan saldo ----
const DUMMY_SALDO = 50000;

/** ikon bulat kecil di kartu asal-tujuan */
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

function OptionRow({
    option, service, price, selected, loading, onPress,
}: {
    option: RideOption; service: ServiceType; price: number; selected: boolean; loading: boolean; onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} style={[s.option, selected && { backgroundColor: colors.primarySoft }]}>
            <View style={s.optionIcon}>
                <Image source={VEHICLE_IMG[service]} style={{ width: 52, height: 52 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                    <Text style={s.optionName} numberOfLines={1}>{option.name}</Text>
                </View>
                <View style={s.meta}>
                    <Text style={s.eta}>{option.eta}</Text>
                    <View style={s.dot} />
                    <Ionicons name="person" size={12} color={colors.textMuted} />
                    <Text style={s.metaText}>{option.capacity} penumpang</Text>
                </View>
                <Text style={s.optionDesc}>{option.desc}</Text>
            </View>
            {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={s.price}>{formatRupiah(price)}</Text>}
            <View style={s.separator} />
        </Pressable>
    );
}

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
    const [selectedId, setSelectedId] = useState<string>(SERVICES[serviceType].options[0].id);

    // ---- bottom sheet yang bisa ditarik (2 posisi: penuh / ringkas) ----
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
            sheetH.value = Math.min(EXPANDED, Math.max(COLLAPSED, startH.value - e.translationY));
        })
        .onEnd((e) => {
            const target =
                e.velocityY < -500 ? EXPANDED : e.velocityY > 500 ? COLLAPSED : sheetH.value > MID ? EXPANDED : COLLAPSED;
            sheetH.value = withSpring(target, SPRING);
        });
    const tap = Gesture.Tap().onEnd(() => {
        sheetH.value = withSpring(sheetH.value > MID ? COLLAPSED : EXPANDED, SPRING);
    });

    const sheetStyle = useAnimatedStyle(() => ({ height: sheetH.value }));
    const floatStyle = useAnimatedStyle(() => ({ bottom: sheetH.value + 12 }));

    // ---- rute ----
    useEffect(() => {
        let alive = true;
        getRoute(origin.coords, destination.coords).then((r) => alive && setRoute(r));
        return () => {
            alive = false;
        };
    }, [origin.coords, destination.coords]);

    const fit = () => {
        const pts = route?.polyline?.length ? route.polyline : [origin.coords, destination.coords];
        mapRef.current?.fitToCoordinates(pts, {
            edgePadding: { top: insets.top + 130, bottom: EXPANDED + 70, left: 60, right: 60 },
            animated: true,
        });
    };
    useEffect(() => {
        if (route) fit();
    }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

    const options = SERVICES[service].options;
    const selected = useMemo(() => options.find((o) => o.id === selectedId) ?? options[0], [options, selectedId]);
    const priceOf = (o: RideOption) => calcFare(o, route?.distanceMeters ?? 0);

    // ---- saldo dinamis: biru kalau cukup, merah kalau kurang ----
    const currentPrice = priceOf(selected);
    const isSaldoEnough = DUMMY_SALDO >= currentPrice;
    const saldoText = `Saldo: ${formatRupiah(DUMMY_SALDO)}`;

    // ---- tab (garis bawah mengikuti lebar teks tab aktif) ----
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
        setSelectedId(SERVICES[t].options[0].id);
        moveIndicator(t);
    };

    const indicator = useAnimatedStyle(() => ({
        width: indW.value,
        transform: [{ translateX: indX.value }],
    }));

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={MAP_PROVIDER}
                toolbarEnabled={false}
                rotateEnabled={false}
                onMapReady={fit}
                initialRegion={{ ...origin.coords, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            >
                {route && (
                    <>
                        <Polyline coordinates={route.polyline} strokeColor="#ffffff" strokeWidth={9} lineCap="round" lineJoin="round" />
                        <Polyline coordinates={route.polyline} strokeColor={colors.primary} strokeWidth={5} lineCap="round" lineJoin="round" />
                    </>
                )}
                <Marker coordinate={origin.coords} image={MARKER_IMG.origin} anchor={{ x: 0.5, y: 1 }} title={origin.name} description="Titik jemput" zIndex={2} />
                <Marker coordinate={destination.coords} image={MARKER_IMG.destination} anchor={{ x: 0.5, y: 1 }} title={destination.name} description="Tujuan" zIndex={2} />
            </MapView>

            {/* kartu asal-tujuan + tombol Tambah */}
            <Animated.View entering={FadeInUp.duration(300)} style={[s.routeCard, { top: insets.top + 12 }]}>
                <View style={{ flex: 1 }}>
                    <View style={s.routeRow}>
                        <RouteDot type="origin" />
                        <Text style={s.routeText} numberOfLines={1}>{origin.name}</Text>
                    </View>
                    <View style={s.routeDivider} />
                    <View style={s.routeRow}>
                        <RouteDot type="destination" />
                        <Text style={s.routeText} numberOfLines={1}>{destination.name}</Text>
                    </View>
                </View>
                <Pressable onPress={onEdit} style={s.addBtn}>
                    <Ionicons name="add-circle" size={26} color={ORANGE} />
                    <Text style={s.addText}>Edit</Text>
                </Pressable>
            </Animated.View>

            {/* tombol kembali, menempel di atas sheet */}
            <Animated.View pointerEvents="box-none" style={[s.floatRow, floatStyle]}>
                <View style={s.floatBack}>
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>
            </Animated.View>

            {/* bottom sheet */}
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
                                        const { x, width } = e.nativeEvent.layout;
                                        tabPos.current[t] = { x, w: width };
                                        if (t === service) moveIndicator(t, false);
                                    }}
                                >
                                    <Text style={[s.tabText, service === t && { color: colors.primary }]}>{SERVICES[t].label}</Text>
                                </Pressable>
                            ))}
                            <Animated.View style={[s.indicator, indicator]} />
                        </View>
                    </View>
                </GestureDetector>

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    {options.map((o) => (
                        <OptionRow
                            key={o.id}
                            option={o}
                            service={service}
                            price={priceOf(o)}
                            loading={!route}
                            selected={o.id === selected.id}
                            onPress={() => setSelectedId(o.id)}
                        />
                    ))}
                </ScrollView>

                <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
                    {route?.isEstimate && <Text style={s.estimate}>Rute belum tersedia, harga berdasarkan perkiraan jarak.</Text>}

                    <View style={s.payLine}>
                        <Pressable style={{ flexShrink: 1 }}>
                            <View style={s.payRow}>
                                <View style={s.payIcon}>
                                    <Ionicons name="wallet" size={12} color="#fff" />
                                </View>
                                <Text style={s.payText}>{paymentLabel}</Text>
                                <Ionicons name="chevron-forward" size={14} color={colors.text} />
                            </View>
                            <Text style={[s.balance, { color: isSaldoEnough ? colors.primary : CORAL }]}>
                                {saldoText}
                            </Text>
                        </Pressable>

                        {!!discountLabel && (
                            <Pressable style={s.discount}>
                                <View style={s.discountIcon}>
                                    <Ionicons name="pricetag" size={11} color="#fff" />
                                </View>
                                <Text style={s.discountText}>{discountLabel}</Text>
                            </Pressable>
                        )}
                    </View>

                    <Pressable
                        disabled={!route}
                        onPress={() =>
                            route &&
                            onOrder({
                                service,
                                optionId: selected.id,
                                optionName: selected.name,
                                price: priceOf(selected),
                                origin,
                                destination,
                                distanceMeters: route.distanceMeters,
                                durationSec: route.durationSec,
                            })
                        }
                        style={[s.cta, { opacity: route ? 1 : 0.6 }]}
                    >
                        <Text style={s.ctaText} numberOfLines={1}>Cari {selected.name}</Text>
                        <Text style={s.ctaPrice}>{route ? formatRupiah(priceOf(selected)) : '…'}</Text>
                        <View style={s.ctaArrow}>
                            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                        </View>
                    </Pressable>
                </View>
            </Animated.View>
        </GestureHandlerRootView>
    );
}

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
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 36 },
    routeText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
    routeDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 36 },
    routeDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    routeDotInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
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
    floatBack: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' },
    bizPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: colors.primary,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
    },
    bizText: { fontSize: 15, fontWeight: '800', color: colors.primary },

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
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#c9ccd1' },

    tabs: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
    tab: { paddingVertical: 10 },
    tabText: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
    indicator: { position: 'absolute', left: 0, bottom: 0, height: 3, borderRadius: 2, backgroundColor: colors.primary },

    option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
    optionIcon: { width: 56, alignItems: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    optionName: { flexShrink: 1, fontSize: 17, fontWeight: '800', color: colors.text },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    eta: { color: colors.text, fontSize: 13, fontWeight: '700' },
    metaText: { color: colors.textMuted, fontSize: 13 },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#c4c8cf' },
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

    footer: { paddingHorizontal: 20, paddingTop: 12, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#fff' },
    estimate: { fontSize: 12, color: colors.secondary },

    voucher: {
        height: 44,
        borderRadius: 22,
        backgroundColor: CYAN,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
    },
    voucherText: { flex: 1, color: '#fff', fontSize: 15, paddingLeft: 20 },
    voucherBtn: { height: '100%', paddingHorizontal: 24, justifyContent: 'center', backgroundColor: CYAN_DARK },
    voucherBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

    payLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    payRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    payIcon: { width: 20, height: 20, borderRadius: 5, backgroundColor: CYAN, alignItems: 'center', justifyContent: 'center' },
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
    discountIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
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
    ctaPrice: { color: '#fff', fontWeight: '800', fontSize: 16, marginRight: 4 },
    ctaArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});