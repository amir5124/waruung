import { StyleSheet, View } from 'react-native';

const hexToRgb = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

type Props = { from?: string; to?: string; steps?: number };

export default function GradientBackground({
    from = '#D6E8FF',
    to = '#F7FAFF',
    steps = 40,
}: Props) {
    const a = hexToRgb(from);
    const b = hexToRgb(to);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {Array.from({ length: steps }).map((_, i) => {
                const t = i / (steps - 1);
                const [r, g, bl] = a.map((v, k) => Math.round(v + (b[k] - v) * t));
                return (
                    <View key={i} style={{ flex: 1, backgroundColor: `rgb(${r},${g},${bl})` }} />
                );
            })}
        </View>
    );
}