import { colors } from '@/constants/ojek-theme';
import type { ContactInfo, GoSendCourierOption, PackageInfo, PlaceLoc } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_PROVIDER } from '../ojek/parts';
import PackageTypeModal from './PackageTypeModal';

const MARKER_IMG = {
    origin: require('@/assets/images/marker-origin.png'),
    destination: require('@/assets/images/marker-destination.png'),
};

const COURIER_OPTIONS: GoSendCourierOption[] = [
    { id: 'motor-kecil', name: 'WarSend Motor - Kecil', tag: 'CEPAAAT', eta: '1-2 jam', price: 43000 },
    // { id: 'motor-sedang', name: 'WarSend Motor - Sedang', eta: '1-2 jam', price: 55000 },
    // { id: 'motor-besar', name: 'WarSend Motor - Besar', eta: '2-3 jam', price: 72000 },
];

const RECEIVE_CODE_FEE = 2000;

function formatRupiah(n: number) {
    return `Rp${n.toLocaleString('id-ID')}`;
}

type Props = {
    origin: PlaceLoc;
    destination: PlaceLoc;
    sender: ContactInfo | null;
    receiver: ContactInfo | null;
    packageInfo: PackageInfo;
    onBack: () => void;
    onPressPickupCard: () => void;
    onPressDropoffCard: () => void;
    onPressAddDetail: () => void;
    onChangePackageType: (type: string) => void;
    onPressPackageSize: () => void;
    onToggleReceiveCode: (value: boolean) => void;
    onBook: (option: GoSendCourierOption) => void;
};

export default function DeliveryDetailStep({
    origin, destination, sender, receiver, packageInfo,
    onBack, onPressPickupCard, onPressDropoffCard, onPressAddDetail,
    onChangePackageType, onPressPackageSize, onToggleReceiveCode, onBook,
}: Props) {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const mapRef = useRef<MapView>(null);
    const [selectedOptionId, setSelectedOptionId] = useState(COURIER_OPTIONS[0].id);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [showMissingSizeAlert, setShowMissingSizeAlert] = useState(false);

    const selectedOption = COURIER_OPTIONS.find((o) => o.id === selectedOptionId) ?? COURIER_OPTIONS[0];

    const hasContactAndType = !!(sender && receiver && packageInfo.type);
    const hasSize = !!packageInfo.size;
    const isComplete = hasContactAndType && hasSize;

    const totalPrice = selectedOption.price + (packageInfo.receiveCode ? RECEIVE_CODE_FEE : 0);

    // ---- bottom sheet yang bisa ditarik (2 posisi: ringkas / penuh) ----
    // tinggi EXPANDED dihitung cukup untuk menampung SEMUA konten tanpa perlu scroll internal
    const COLLAPSED = Math.min(windowHeight * 0.38, 320) + insets.bottom;
    const EXPANDED = Math.min(windowHeight * 0.62, 480) + insets.bottom;
    const MID = (EXPANDED + COLLAPSED) / 2;
    const SPRING = { damping: 24, stiffness: 240 };

    const sheetH = useSharedValue(COLLAPSED);
    const startH = useSharedValue(COLLAPSED);

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

    useEffect(() => {
        const pts = [origin.coords, destination.coords];
        const t = setTimeout(() => {
            mapRef.current?.fitToCoordinates(pts, {
                edgePadding: { top: 40, bottom: COLLAPSED + 40, left: 40, right: 40 },
                animated: true,
            });
        }, 300);
        return () => clearTimeout(t);
    }, [origin, destination]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePrimaryAction = () => {
        if (!hasContactAndType) {
            onPressAddDetail();
            return;
        }
        if (!hasSize) {
            setShowMissingSizeAlert(true);
            return;
        }
        onBook({ ...selectedOption, price: totalPrice });
    };

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={onBack} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </Pressable>
                <Ionicons name="cube" size={18} color="#fff" style={{ marginLeft: 12 }} />
                <Text style={s.headerTitle}>warsend</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={s.rowBetween}>
                    <Text style={s.sectionTitle}>Detail pengiriman</Text>
                    <Pressable style={s.addPill} onPress={onPressAddDetail}>
                        <Ionicons name="add-circle" size={16} color={colors.secondary} />
                        <Text style={s.addPillText}>Tambah pengiriman</Text>
                    </Pressable>
                </View>

                <Pressable style={s.card} onPress={onPressPickupCard}>
                    <View style={s.originDot}>
                        <Ionicons name="arrow-up" size={12} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle} numberOfLines={1}>{sender?.name ?? origin.name}</Text>
                        {sender && <Text style={s.cardPhone}>{sender.phone}</Text>}
                        <Text style={s.cardAddress} numberOfLines={1}>{origin.address}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                <View style={{ height: 6 }} />

                <Pressable style={s.card} onPress={onPressDropoffCard}>
                    <View style={s.destDot}>
                        <Ionicons name="arrow-down" size={12} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle} numberOfLines={1}>{receiver?.name ?? destination.name}</Text>
                        {receiver && <Text style={s.cardPhone}>{receiver.phone}</Text>}
                        <Text style={s.cardAddress} numberOfLines={1}>{destination.address}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>

                {hasContactAndType && (
                    <View style={s.metaRow}>
                        <Pressable onPress={() => setShowTypeModal(true)} style={{ flex: 1 }}>
                            <Text style={s.metaLabel}>{packageInfo.type}</Text>
                            <Text style={s.metaLink}>Tap buat ganti</Text>
                        </Pressable>
                        <View style={s.metaDivider} />
                        <View style={{ flex: 1 }}>
                            <Text style={s.metaLabel}>Terlindungi s.d. 5jt</Text>
                            <Text style={s.metaLink}>Rp1.000</Text>
                        </View>
                    </View>
                )}

                <Pressable
                    style={[s.rowItem, !hasSize && hasContactAndType && s.rowItemWarn]}
                    onPress={onPressPackageSize}
                >
                    <Text style={s.rowIcon}>⚖️</Text>
                    <Text style={s.rowLabel}>{isComplete ? 'Ukuran & berat' : 'Ukuran & berat paket'}</Text>
                    {!hasSize && hasContactAndType && <View style={s.warnDot} />}
                    <Text style={s.rowValue}>
                        {isComplete ? `${packageInfo.size === 'kecil' ? 'Kecil' : packageInfo.size} (${packageInfo.weight})` : 'Pilih'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>

                <View style={s.rowItem}>
                    <Text style={s.rowIcon}>📦</Text>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.rowLabel}>Kode terima paket</Text>
                            <View style={s.newBadge}><Text style={s.newBadgeText}>Baru</Text></View>
                        </View>
                        <Text style={s.rowSub}>Kode konfirmasi paket sampai ke penerima yang tepat.</Text>
                        {packageInfo.receiveCode && (
                            <Text style={s.receiveCodeFee}>+{formatRupiah(RECEIVE_CODE_FEE)}</Text>
                        )}
                    </View>
                    <Pressable
                        onPress={() => onToggleReceiveCode(!packageInfo.receiveCode)}
                        style={[s.toggle, packageInfo.receiveCode && s.toggleActive]}
                    >
                        <View style={[s.toggleKnob, packageInfo.receiveCode && s.toggleKnobActive]} />
                    </Pressable>
                </View>

                <View style={[s.mapCard, { height: 130 }]}>
                    <MapView
                        ref={mapRef}
                        style={{ flex: 1 }}
                        provider={MAP_PROVIDER}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                        toolbarEnabled={false}
                    >
                        <Polyline coordinates={[origin.coords, destination.coords]} strokeColor={colors.primary} strokeWidth={4} />
                        <Marker coordinate={origin.coords} image={MARKER_IMG.origin} anchor={{ x: 0.5, y: 1 }} />
                        <Marker coordinate={destination.coords} image={MARKER_IMG.destination} anchor={{ x: 0.5, y: 1 }} />
                    </MapView>
                </View>

            </ScrollView>


            {/* ---- Bottom sheet draggable: konten fixed (tidak scroll sendiri) ---- */}
            <Animated.View style={[s.sheet, sheetStyle]}>
                <GestureDetector gesture={pan}>
                    <View>
                        <GestureDetector gesture={tap}>
                            <View style={s.handleArea}>
                                <View style={s.handle} />
                            </View>
                        </GestureDetector>

                        <View style={{ paddingHorizontal: 16 }}>
                            <Text style={s.sheetTitle}>Pilih armada</Text>

                            {COURIER_OPTIONS.map((option) => {
                                const selected = option.id === selectedOptionId;
                                return (
                                    <Pressable
                                        key={option.id}
                                        style={[s.optionRow, selected && s.optionRowSelected]}
                                        onPress={() => setSelectedOptionId(option.id)}
                                    >
                                        <View style={[s.radio, selected && s.radioActive]}>
                                            {selected && <View style={s.radioDot} />}
                                        </View>
                                        <Image
                                            source={require('@/assets/images/motor.png')}
                                            style={{ width: 30, height: 30 }}
                                            resizeMode="contain"
                                        />
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                            <Text style={s.optionName}>{option.name}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                {option.tag && <Text style={s.tag}>{option.tag}</Text>}
                                                <Text style={s.eta}>{option.eta}</Text>
                                            </View>
                                        </View>
                                        <Text style={s.price}>{formatRupiah(option.price)}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </GestureDetector>

                <View style={[s.footerFixed, { paddingBottom: insets.bottom + 12 }]}>
                    {isComplete ? (
                        <>
                            <View style={s.payRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={s.payIcon}>
                                        <Ionicons name="cash" size={12} color="#fff" />
                                    </View>
                                    <View>
                                        <Text style={s.payLabel}>Tunai</Text>
                                        <Text style={s.payBalance}>Bayar langsung ke driver</Text>
                                    </View>
                                </View>
                                <Pressable style={s.voucherPill}>
                                    <Ionicons name="pricetag-outline" size={14} color={colors.secondary} />
                                    <Text style={s.voucherText}>Pakai voucher?</Text>
                                </Pressable>
                            </View>

                            <Pressable style={s.bookBtn} onPress={handlePrimaryAction}>
                                <Text style={s.bookText}>Book</Text>
                                <Text style={s.bookPrice}>{formatRupiah(totalPrice)}</Text>
                                <View style={s.bookArrow}>
                                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                                </View>
                            </Pressable>
                        </>
                    ) : (
                        <Pressable style={s.addDetailBtn} onPress={handlePrimaryAction}>
                            <Text style={s.addDetailText}>
                                {hasContactAndType ? 'Lengkapi ukuran & berat' : 'Tambah detail pengiriman'}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </Animated.View>

            <PackageTypeModal
                visible={showTypeModal}
                currentType={packageInfo.type}
                onClose={() => setShowTypeModal(false)}
                onSave={(type) => {
                    onChangePackageType(type);
                    setShowTypeModal(false);
                }}
            />

            {/* ---- Modal peringatan: padding bottom aman dari navigation bar HP ---- */}
            <Modal visible={showMissingSizeAlert} transparent animationType="fade">
                <Pressable style={s.modalBackdrop} onPress={() => setShowMissingSizeAlert(false)} />
                <View style={[s.alertSheet, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
                    <View style={s.alertHandle} />
                    <View style={s.alertIconWrap}>
                        <Ionicons name="alert-circle" size={30} color="#E8433D" />
                    </View>
                    <Text style={s.alertTitle}>Ukuran & berat paket{'\n'}belum diisi</Text>
                    <Text style={s.alertText}>
                        Isi dulu ukuran dan berat paketmu supaya{'\n'}kami bisa carikan driver yang pas.
                    </Text>
                    <View style={s.alertRow}>
                        <Pressable style={s.alertStayBtn} onPress={() => setShowMissingSizeAlert(false)}>
                            <Text style={s.alertStayText}>Nanti dulu</Text>
                        </Pressable>
                        <Pressable
                            style={s.alertConfirmBtn}
                            onPress={() => {
                                setShowMissingSizeAlert(false);
                                onPressPackageSize();
                            }}
                        >
                            <Text style={s.alertConfirmText}>Isi sekarang</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </GestureHandlerRootView>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.secondary },
    headerTitle: { color: '#fff', fontWeight: '800', fontSize: 18, marginLeft: 6 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    addPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
    addPillText: { fontSize: 12, fontWeight: '700', color: colors.text },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
    originDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    destDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    cardPhone: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    cardAddress: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    metaRow: { flexDirection: 'row', paddingVertical: 12, gap: 12 },
    metaLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
    metaLink: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    metaDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    rowItemWarn: { backgroundColor: '#FFF5F5', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 8 },
    warnDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8433D' },
    rowIcon: { fontSize: 20, width: 24, textAlign: 'center' },
    rowLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    rowValue: { flex: 1, fontSize: 13, color: colors.textMuted, marginRight: 4, textAlign: 'right' },
    newBadge: { backgroundColor: '#E8433D', paddingHorizontal: 6, borderRadius: 8 },
    newBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    receiveCodeFee: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 4 },

    toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#E5E8EC', padding: 3, justifyContent: 'center' },
    toggleActive: { backgroundColor: colors.primary },
    toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    toggleKnobActive: { alignSelf: 'flex-end' },

    mapCard: { borderRadius: 16, overflow: 'hidden', marginTop: 14, marginBottom: 8 },

    // ---- Bottom sheet draggable ----
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        elevation: 14,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        overflow: 'hidden',
        justifyContent: 'space-between',
    },
    handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#c9ccd1' },
    sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },

    optionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6,
    },
    optionRowSelected: { backgroundColor: colors.primarySoft ?? '#E9F9EF' },
    radio: {
        width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
    },
    radioActive: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    optionName: { fontSize: 14, fontWeight: '800', color: colors.text },
    tag: { fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: '#8E44AD', paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
    eta: { fontSize: 12, color: colors.textMuted },
    price: { fontSize: 14, fontWeight: '800', color: colors.text },

    footerFixed: {
        paddingHorizontal: 16, paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        backgroundColor: '#fff',
    },
    payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    payIcon: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#1AA260', alignItems: 'center', justifyContent: 'center' },
    payLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    payBalance: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    voucherPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
    voucherText: { fontSize: 12, fontWeight: '600', color: colors.text },
    bookBtn: { height: 54, borderRadius: 27, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingLeft: 22, paddingRight: 8 },
    bookText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 16 },
    bookPrice: { color: '#fff', fontWeight: '800', fontSize: 16, marginRight: 8 },
    bookArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    addDetailBtn: { height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    addDetailText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    // ---- Modal peringatan ----
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    alertSheet: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 12, alignItems: 'center',
        elevation: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10,
    },
    alertHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E8EC', marginBottom: 20 },
    alertIconWrap: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF0F0',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    alertTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', lineHeight: 24, marginBottom: 8 },
    alertText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
    alertRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
    alertStayBtn: { flex: 1, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    alertStayText: { color: colors.textMuted, fontWeight: '800', fontSize: 15 },
    alertConfirmBtn: { flex: 1, height: 50, borderRadius: 25, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    alertConfirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});