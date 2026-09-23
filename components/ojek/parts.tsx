import { colors } from '@/constants/ojek-theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

// Google provider di Android saja (iOS butuh setup SDK tambahan); iOS pakai Apple Maps
export const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

export function CircleButton({
    icon,
    onPress,
    style,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <Pressable onPress={onPress} hitSlop={8} style={[s.circle, style]} android_ripple={{ color: '#0001', radius: 26 }}>
            <Ionicons name={icon} size={24} color={colors.text} />
        </Pressable>
    );
}

/** Titik asal (biru + panah) / tujuan (oranye + titik putih) */
export function PinDot({ type, size = 28 }: { type: 'origin' | 'destination'; size?: number }) {
    const bg = type === 'origin' ? colors.primary : colors.secondary;
    return (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
            {type === 'origin' ? (
                <Ionicons name="arrow-up" size={size * 0.62} color="#fff" />
            ) : (
                <View style={{ width: size * 0.36, height: size * 0.36, borderRadius: size, backgroundColor: '#fff' }} />
            )}
        </View>
    );
}

export function HighlightedText({
    text,
    matches,
    style,
    highlightColor = colors.primary,
}: {
    text: string;
    matches: { start: number; end: number }[];
    style?: StyleProp<TextStyle>;
    highlightColor?: string;
}) {
    if (!matches.length) return <Text style={style}>{text}</Text>;
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    [...matches]
        .sort((a, b) => a.start - b.start)
        .forEach((m, i) => {
            if (m.start > cursor) parts.push(<Text key={`t${i}`}>{text.slice(cursor, m.start)}</Text>);
            parts.push(
                <Text key={`m${i}`} style={{ color: highlightColor }}>
                    {text.slice(m.start, m.end)}
                </Text>
            );
            cursor = m.end;
        });
    if (cursor < text.length) parts.push(<Text key="end">{text.slice(cursor)}</Text>);
    return <Text style={style}>{parts}</Text>;
}

export function PrimaryButton({
    label,
    right,
    onPress,
    disabled,
}: {
    label: string;
    right?: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [s.btn, { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 }]}
        >
            <Text style={s.btnText}>{label}</Text>
            {right}
        </Pressable>
    );
}

const s = StyleSheet.create({
    circle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    btn: {
        height: 54,
        borderRadius: 27,
        backgroundColor: colors.primary,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700', flexShrink: 1 },
});