// components/Shimmer.tsx
// Skeleton shimmer tanpa library tambahan. Satu animasi dipakai bersama semua kotak.
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const PulseCtx = createContext<Animated.Value | null>(null);

/** Bungkus satu area skeleton; semua ShimmerBox di dalamnya berdenyut serempak. */
export function ShimmerGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return (
        <PulseCtx.Provider value={pulse}>
            <View style={style}>{children}</View>
        </PulseCtx.Provider>
    );
}

export function ShimmerBox({ style }: { style?: StyleProp<ViewStyle> }) {
    const pulse = useContext(PulseCtx);
    const opacity = pulse
        ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
        : 1;
    return <Animated.View style={[s.box, style, { opacity }]} />;
}

/** Skeleton kartu resto. full = halaman Terdekat, compact = halaman Ongkir. */
function CardSkeleton({ variant }: { variant: 'full' | 'compact' }) {
    if (variant === 'compact') {
        return (
            <View style={s.cardCompact}>
                <ShimmerBox style={{ width: 72, height: 72, borderRadius: 14 }} />
                <View style={{ flex: 1, gap: 8 }}>
                    <ShimmerBox style={{ width: '65%', height: 16 }} />
                    <ShimmerBox style={{ width: '45%', height: 12 }} />
                    <ShimmerBox style={{ width: 90, height: 22, borderRadius: 8 }} />
                </View>
            </View>
        );
    }
    return (
        <View style={s.card}>
            <View style={{ flexDirection: 'row', gap: 14 }}>
                <ShimmerBox style={{ width: 86, height: 86, borderRadius: 16 }} />
                <View style={{ flex: 1, gap: 9 }}>
                    <ShimmerBox style={{ width: '70%', height: 17 }} />
                    <ShimmerBox style={{ width: '55%', height: 13 }} />
                    <ShimmerBox style={{ width: '45%', height: 13 }} />
                    <ShimmerBox style={{ width: '80%', height: 11 }} />
                </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <ShimmerBox style={{ width: 100, height: 30, borderRadius: 10 }} />
                <ShimmerBox style={{ width: 110, height: 30, borderRadius: 10 }} />
                <ShimmerBox style={{ width: 60, height: 30, borderRadius: 10 }} />
            </View>
            <ShimmerBox style={{ width: '100%', height: 34, borderRadius: 12, marginTop: 12 }} />
        </View>
    );
}

export function RestoListSkeleton({
    variant = 'full',
    count = 5,
    bottomInset = 0,
}: {
    variant?: 'full' | 'compact';
    count?: number;
    bottomInset?: number;
}) {
    return (
        <ShimmerGroup style={{ padding: 16, paddingBottom: bottomInset + 24, gap: 12 }}>
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} variant={variant} />
            ))}
        </ShimmerGroup>
    );
}

const s = StyleSheet.create({
    box: { backgroundColor: '#E3E6EA', borderRadius: 6 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 14 },
    cardCompact: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 12 },
});