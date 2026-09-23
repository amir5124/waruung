import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** Placeholder baris hasil pencarian (lingkaran + 3 garis) dengan efek berdenyut */
export default function ResultSkeleton({ rows = 4 }: { rows?: number }) {
    const p = useSharedValue(0);

    useEffect(() => {
        p.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, [p]);

    const pulse = useAnimatedStyle(() => ({ opacity: 0.5 + 0.5 * p.value }));

    return (
        <Animated.View style={pulse} accessibilityLabel="Memuat hasil pencarian">
            {Array.from({ length: rows }).map((_, i) => (
                <View key={i}>
                    <View style={s.row}>
                        <View style={s.avatar} />
                        <View style={s.lines}>
                            <View style={[s.bar, { width: '38%' }]} />
                            <View style={[s.bar, { width: '92%' }]} />
                            <View style={[s.bar, { width: '80%' }]} />
                        </View>
                    </View>
                    {i < rows - 1 && <View style={s.sep} />}
                </View>
            ))}
        </Animated.View>
    );
}

const GRAY = '#e7e8ea';

const s = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
    avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: GRAY },
    lines: { flex: 1, gap: 8, paddingTop: 2 },
    bar: { height: 10, borderRadius: 5, backgroundColor: GRAY },
    sep: { height: 1, backgroundColor: '#eceded', marginLeft: 80 },
});