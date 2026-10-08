import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type Props = {
    balance: number;
    coins?: number;
    badgeCount?: number;
    onPressAdd?: () => void;
    onPressTopup?: () => void;
    onPressHistory?: () => void;
    onPressMore?: () => void;
};

const BLUE = '#2F86EB';
const BLUE_SOFT = '#E3EEFC';

const formatRupiah = (value: number) =>
    'Rp' + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Skala berdasarkan lebar layar (acuan 390dp), dibatasi supaya tidak terlalu kecil/besar */
const useScale = () => {
    const { width } = useWindowDimensions();
    return Math.min(Math.max(width / 390, 0.82), 1.1);
};

type ActionProps = {
    label: string;
    s: number;
    onPress?: () => void;
    badge?: number;
    children: React.ReactNode;
};

function Action({ label, s, onPress, badge, children }: ActionProps) {
    const size = Math.round(38 * s);
    return (
        <Pressable
            style={({ pressed }) => [styles.action, { width: Math.round(54 * s) }, pressed && { opacity: 0.6 }]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <View
                style={[
                    styles.actionCircle,
                    { width: size, height: size, borderRadius: size / 2 },
                ]}
            >
                {children}
                {!!badge && badge > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText} allowFontScaling={false}>
                            {badge > 99 ? '99+' : badge}
                        </Text>
                    </View>
                )}
            </View>
            <Text
                style={[styles.actionLabel, { fontSize: Math.round(11 * s) }]}
                numberOfLines={1}
                allowFontScaling={false}
            >
                {label}
            </Text>
        </Pressable>
    );
}

export default function SaldoCard({
    balance,
    coins = 0,
    badgeCount = 0,
    onPressAdd,
    onPressTopup,
    onPressHistory,
    onPressMore,
}: Props) {
    const s = useScale();
    const walletSize = Math.round(44 * s);
    const iconSize = Math.round(22 * s);
    const coinSize = Math.round(14 * s);

    return (
        <View style={[styles.card, { paddingVertical: Math.round(12 * s), paddingHorizontal: Math.round(10 * s) }]}>
            {/* Kiri: dompet + saldo */}
            <View style={styles.left}>
                <View
                    style={[
                        styles.walletCircle,
                        { width: walletSize, height: walletSize, borderRadius: walletSize / 2 },
                    ]}
                >
                    <Ionicons name="wallet" size={Math.round(22 * s)} color={BLUE} />
                </View>

                <View style={styles.balanceBox}>
                    <View style={styles.balanceRow}>
                        <Text
                            style={[styles.balanceText, { fontSize: Math.round(17 * s) }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                            allowFontScaling={false}
                        >
                            {formatRupiah(balance)}
                        </Text>
                        {/* <Pressable onPress={onPressAdd} hitSlop={8} accessibilityLabel="Tambah saldo">
                            <Ionicons name="add-circle-outline" size={Math.round(20 * s)} color="#8A8A8A" />
                        </Pressable> */}
                    </View>
                    <View style={styles.coinRow}>
                        <View
                            style={[
                                styles.coinDot,
                                { width: coinSize, height: coinSize, borderRadius: coinSize / 2 },
                            ]}
                        >
                            <View
                                style={{
                                    width: coinSize * 0.55,
                                    height: coinSize * 0.55,
                                    borderRadius: coinSize * 0.3,
                                    backgroundColor: '#F5A623',
                                }}
                            />
                        </View>
                        <Text
                            style={[styles.coinText, { fontSize: Math.round(12 * s) }]}
                            numberOfLines={1}
                            allowFontScaling={false}
                        >
                            {coins} coins
                        </Text>
                    </View>
                </View>
            </View>

            {/* Kanan: aksi */}
            <View style={styles.actions}>
                <View style={[styles.divider, { height: Math.round(44 * s) }]} />
                <Action label="Topup" s={s} onPress={onPressTopup}>
                    <Ionicons name="arrow-up" size={iconSize} color={BLUE} />
                </Action>

                <View style={[styles.divider, { height: Math.round(44 * s) }]} />
                <Action label="Riwayat" s={s} onPress={onPressHistory}>
                    <Ionicons name="document-text-outline" size={iconSize} color={BLUE} />
                    <View style={styles.clockBadge}>
                        <Ionicons name="time" size={9} color="#fff" />
                    </View>
                </Action>

                <View style={[styles.divider, { height: Math.round(44 * s) }]} />
                <Action label="Lainnya" s={s} onPress={onPressMore} badge={badgeCount}>
                    <Ionicons name="ellipsis-horizontal" size={iconSize} color={BLUE} />
                </Action>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 22,
        marginHorizontal: 16,
        marginTop: 16,
        shadowColor: BLUE,
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    left: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletCircle: {
        backgroundColor: BLUE_SOFT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceBox: { flex: 1, minWidth: 0, marginLeft: 8, marginRight: 4 },
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    balanceText: { fontWeight: '800', color: '#1B1B1B', flexShrink: 1 },
    coinRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
    coinDot: {
        backgroundColor: '#FFC24D',
        alignItems: 'center',
        justifyContent: 'center',
    },
    coinText: { color: '#8A8A8A', fontWeight: '500', flexShrink: 1 },

    actions: { flexDirection: 'row', alignItems: 'center' },
    divider: { width: 1, backgroundColor: '#E8E8E8' },
    action: { alignItems: 'center', gap: 4 },
    actionCircle: {
        backgroundColor: BLUE_SOFT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionLabel: { color: '#1B1B1B', fontWeight: '500' },
    clockBadge: {
        position: 'absolute',
        right: 3,
        bottom: 3,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: BLUE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: -5,
        right: -5,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        backgroundColor: '#E53935',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});