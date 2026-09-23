import { colors } from '@/constants/ojek-theme';
import type { PlaceLoc } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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

export default function HomeStep({ origin, destination, onBack, onPressDestination, onSwap, onEditOrigin }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: colors.homeBg }}>
            <ImageBackground
                source={require('@/assets/images/bg-ojek.png')}
                resizeMode="cover"
                style={{ height: 300 + insets.top }}
            >
                <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
                    <CircleButton icon="arrow-back" onPress={onBack} />
                </View>
            </ImageBackground>

            <Animated.View entering={FadeInDown.duration(350)} style={s.card}>
                <View style={s.row}>
                    <View style={s.originDot}>
                        <Ionicons name="arrow-up" size={14} color="#fff" />
                    </View>
                    <Pressable style={{ flex: 1 }} onPress={onEditOrigin}>
                        <Text style={s.label}>Ambil paket di</Text>
                        <Text style={s.value} numberOfLines={1}>
                            {origin?.name ?? 'Menentukan lokasi kamu...'}
                        </Text>
                    </Pressable>
                    <Pressable onPress={onSwap} style={s.swapBtn}>
                        <Ionicons name="swap-vertical" size={20} color={colors.text} />
                    </Pressable>
                </View>

                <View style={s.divider} />

                <View style={s.row}>
                    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <PulsingDot color={colors.secondary} icon="arrow-down" size={20} />
                    </View>
                    <Pressable style={{ flex: 1 }} onPress={onPressDestination}>
                        <Text style={destination ? s.value : s.placeholder} numberOfLines={1}>
                            {destination?.name ?? 'Kirim paket ke mana?'}
                        </Text>
                    </Pressable>
                </View>

                {origin && (
                    <>
                        <View style={s.dividerFull} />
                        <View style={s.row}>
                            <Ionicons name="time-outline" size={22} color={colors.textMuted} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.value}>{origin.name}</Text>
                                <Text style={s.subValue} numberOfLines={1}>{origin.address}</Text>
                            </View>
                        </View>
                    </>
                )}

                <Pressable style={s.friendBanner}>
                    <Text style={s.friendText}>Minta lokasi dari temanmu</Text>
                    <View style={s.badge}>
                        <Text style={s.badgeText}>Baru</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
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
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    originDot: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: colors.textMuted,
        alignItems: 'center', justifyContent: 'center',
    },
    label: { fontSize: 12, color: colors.textMuted },
    value: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
    subValue: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    placeholder: { fontSize: 15, color: colors.textMuted },
    swapBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 36 },
    dividerFull: { height: 6, backgroundColor: colors.field, marginHorizontal: -16, marginTop: 6 },
    friendBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 8, marginBottom: 12, paddingVertical: 10,
    },
    friendText: { fontSize: 14, fontWeight: '600', color: colors.text },
    badge: { backgroundColor: '#E8433D', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});