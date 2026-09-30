import { colors } from '@/constants/ojek-theme';
import type { PlaceLoc } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import {
    ImageBackground,
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import Animated, {
    Easing,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton } from '../ojek/parts';
import { PulsingDot } from './PulsingDot';

type Props = {
    origin: PlaceLoc | null;
    destination: PlaceLoc | null;
    onBack: () => void;
    onPressDestination: () => void;
    onSwap: () => void;
    onEditOrigin: () => void;
};

function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1, {
                duration: 700,
                easing: Easing.inOut(Easing.ease),
            }),
            -1,
            true
        );
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={[s.skeletonBase, style, animStyle]} />
    );
}

export default function HomeStep({
    origin,
    destination,
    onBack,
    onPressDestination,
    onSwap,
    onEditOrigin,
}: Props) {
    const insets = useSafeAreaInsets();
    const isLoadingLocation = !origin;

    // ⬇️ Swap boleh kapan saja selama origin & destination sudah ada
    const canSwap = !!origin && !!destination;

    return (
        <View style={{ flex: 1, backgroundColor: colors.homeBg }}>
            <ImageBackground
                source={require('@/assets/images/bg-ojek.png')}
                resizeMode="cover"
                style={{ height: 300 + insets.top }}
            >
                <View
                    style={{
                        paddingTop: insets.top + 12,
                        paddingHorizontal: 16,
                    }}
                >
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>
            </ImageBackground>

            <Animated.View entering={FadeInDown.duration(350)} style={s.card}>
                {/* ===== Baris titik jemput — BISA DI-TAP untuk edit ===== */}
                <View style={s.row}>
                    {isLoadingLocation ? (
                        <Skeleton
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                            }}
                        />
                    ) : (
                        <View style={s.originDot}>
                            <Ionicons
                                name="arrow-up"
                                size={14}
                                color="#fff"
                            />
                        </View>
                    )}

                    <Pressable
                        style={({ pressed }) => [
                            { flex: 1 },
                            pressed && s.rowPressed,
                        ]}
                        onPress={onEditOrigin}
                        disabled={isLoadingLocation}
                        hitSlop={8}
                    >
                        {isLoadingLocation ? (
                            <>
                                <Skeleton
                                    style={{
                                        width: 90,
                                        height: 10,
                                        borderRadius: 5,
                                    }}
                                />
                                <Skeleton
                                    style={{
                                        width: 170,
                                        height: 14,
                                        borderRadius: 7,
                                        marginTop: 6,
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <View style={s.labelRow}>
                                    <Text style={s.label}>
                                        Ambil paket di
                                    </Text>

                                </View>
                                <Text
                                    style={s.value}
                                    numberOfLines={1}
                                >
                                    {origin.name || 'Lokasimu saat ini'}
                                </Text>
                                {origin.address ? (
                                    <Text
                                        style={s.subValue}
                                        numberOfLines={1}
                                    >
                                        {origin.address}
                                    </Text>
                                ) : null}
                            </>
                        )}
                    </Pressable>

                    {/* ⬇️ Tombol swap — aktif kalau origin & destination ada */}
                    <Pressable
                        onPress={onSwap}
                        disabled={!canSwap}
                        style={[
                            s.swapBtn,
                            !canSwap && { opacity: 0.4 },
                        ]}
                        hitSlop={8}
                    >
                        <Ionicons
                            name="swap-vertical"
                            size={20}
                            color={
                                canSwap ? colors.primary : colors.textMuted
                            }
                        />
                    </Pressable>
                </View>

                <View style={s.divider} />

                {/* ===== Baris tujuan — BISA DI-TAP untuk cari/pilih ===== */}
                <View style={s.row}>
                    {isLoadingLocation ? (
                        <Skeleton
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                            }}
                        />
                    ) : (
                        <View
                            style={{
                                width: 24,
                                height: 24,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <PulsingDot
                                color={colors.secondary}
                                icon="arrow-down"
                                size={20}
                            />
                        </View>
                    )}

                    <Pressable
                        style={({ pressed }) => [
                            { flex: 1 },
                            pressed && s.rowPressed,
                        ]}
                        onPress={onPressDestination}
                        disabled={isLoadingLocation}
                        hitSlop={8}
                    >
                        {isLoadingLocation ? (
                            <Skeleton
                                style={{
                                    width: 140,
                                    height: 14,
                                    borderRadius: 7,
                                }}
                            />
                        ) : (
                            <>
                                <View style={s.labelRow}>
                                    <Text style={s.label}>
                                        Antar ke
                                    </Text>

                                </View>
                                <Text
                                    style={
                                        destination
                                            ? s.value
                                            : s.placeholder
                                    }
                                    numberOfLines={1}
                                >
                                    {destination?.name ??
                                        'Kirim paket ke mana?'}
                                </Text>
                                {destination?.address ? (
                                    <Text
                                        style={s.subValue}
                                        numberOfLines={1}
                                    >
                                        {destination.address}
                                    </Text>
                                ) : null}
                            </>
                        )}
                    </Pressable>
                </View>

                <Pressable
                    style={s.friendBanner}
                    disabled={isLoadingLocation}
                >
                    <Text style={s.friendText}>
                        Makin aman dengan kode paket
                    </Text>
                    <View style={s.badge}>
                        <Text style={s.badgeText}>Baru</Text>
                    </View>
                    <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.primary}
                        style={{ marginLeft: 'auto' }}
                    />
                </Pressable>
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginTop: -40,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 4,
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
    },
    // ⬇️ Feedback visual saat baris di-tap
    rowPressed: {
        opacity: 0.6,
    },
    originDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ⬇️ Layout label + ikon pensil
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    label: { fontSize: 12, color: colors.textMuted },
    value: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginTop: 2,
    },
    subValue: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 2,
    },
    placeholder: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
    swapBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.field,
        borderWidth: 1,
        borderColor: colors.border,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 36,
    },
    friendBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        marginBottom: 12,
        paddingVertical: 10,
    },
    friendText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    badge: {
        backgroundColor: '#E8433D',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    skeletonBase: { backgroundColor: '#E1E4E8' },
});