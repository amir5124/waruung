import { colors } from '@/constants/ojek-theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

type Props = {
    color?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    size?: number;
};

export function PulsingDot({ color = colors.primary, icon = 'arrow-up', size = 24 }: Props) {
    const ring1 = useSharedValue(0);
    const ring2 = useSharedValue(0);

    useEffect(() => {
        ring1.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false);
        const t = setTimeout(() => {
            ring2.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false);
        }, 900);
        return () => clearTimeout(t);
    }, []);

    const ring1Style = useAnimatedStyle(() => ({
        transform: [{ scale: 1 + ring1.value * 2 }],
        opacity: 1 - ring1.value,
    }));
    const ring2Style = useAnimatedStyle(() => ({
        transform: [{ scale: 1 + ring2.value * 2 }],
        opacity: 1 - ring2.value,
    }));

    return (
        <View style={[m.wrap, { width: size * 2.5, height: size * 2.5 }]}>
            <Animated.View style={[m.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring1Style]} />
            <Animated.View style={[m.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring2Style]} />
            <View style={[m.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
                <Ionicons name={icon} size={size * 0.6} color="#fff" />
            </View>
        </View>
    );
}

const m = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', opacity: 0.35 },
    dot: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
});