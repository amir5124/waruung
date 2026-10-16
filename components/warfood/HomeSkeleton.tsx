// HomeSkeleton.tsx (satu folder dengan HomeStep.tsx)
// Loading shimmer yang meniru susunan layar HomeStep.
// Tanpa dependency tambahan: satu animasi denyut (opacity) dipakai bersama
// oleh semua blok, jadi ringan walau banyak elemen.
import { useEffect } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

const RED = '#D71920';

// ---------- Animasi bersama ----------
const pulse = new Animated.Value(0.45);
let users = 0;
let loop: Animated.CompositeAnimation | null = null;

function startPulse() {
    if (loop) return;
    loop = Animated.loop(
        Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
    );
    loop.start();
}

function stopPulse() {
    loop?.stop();
    loop = null;
}

function usePulse() {
    useEffect(() => {
        users += 1;
        startPulse();
        return () => {
            users -= 1;
            if (users <= 0) {
                users = 0;
                stopPulse();
            }
        };
    }, []);
}

// ---------- Blok dasar ----------
type BlockProps = {
    w?: number | `${number}%`;
    h: number;
    r?: number;
    onRed?: boolean; // dipakai di atas latar merah
    style?: ViewStyle;
};

function Block({ w = '100%', h, r = 8, onRed, style }: BlockProps) {
    return (
        <Animated.View
            style={[
                { width: w, height: h, borderRadius: r, opacity: pulse },
                { backgroundColor: onRed ? 'rgba(255,255,255,0.35)' : '#E6E8EB' },
                style,
            ]}
        />
    );
}

// ---------- Bagian-bagian layar ----------
export function HeaderSkeleton({ paddingTop }: { paddingTop: number }) {
    usePulse();
    return (
        <View style={[s.header, { paddingTop }]}>
            <View style={s.headerTop}>
                <Block w={40} h={40} r={20} onRed />
                <View style={{ flex: 1 }}>
                    <Block h={38} r={19} onRed />
                </View>
                <Block w={40} h={40} r={20} onRed />
                <Block w={40} h={40} r={20} onRed />
            </View>
            <View style={s.bannerRow}>
                <View style={{ flex: 1, gap: 8 }}>
                    <Block w="55%" h={12} onRed />
                    <Block w="85%" h={22} onRed />
                    <Block w="45%" h={26} onRed />
                    <Block w={120} h={28} r={14} onRed style={{ marginTop: 4 }} />
                </View>
                <Block w={130} h={110} r={16} onRed />
            </View>
        </View>
    );
}

export function SearchBarSkeleton() {
    usePulse();
    return (
        <View style={s.searchWrap}>
            <View style={s.searchBar}>
                <Block h={52} r={26} />
            </View>
        </View>
    );
}

export function QuickMenuSkeleton() {
    usePulse();
    return (
        <View style={s.quickRow}>
            {[0, 1, 2].map((i) => (
                <View key={i} style={s.quickCard}>
                    <Block w={44} h={44} r={12} />
                    <Block w={56} h={10} />
                    <Block w={40} h={10} />
                </View>
            ))}
        </View>
    );
}

export function PromoRowSkeleton() {
    usePulse();
    return (
        <View style={s.promoRow}>
            <Block w={220} h={150} r={16} />
            {[0, 1].map((i) => (
                <View key={i} style={s.dealCard}>
                    <Block h={110} r={0} />
                    <View style={{ padding: 10, gap: 8 }}>
                        <Block w="60%" h={10} />
                        <Block w="90%" h={13} />
                        <Block w="50%" h={10} />
                    </View>
                </View>
            ))}
        </View>
    );
}

export function CategorySkeleton() {
    usePulse();
    return (
        <View style={s.section}>
            <View style={s.sectionHeader}>
                <Block w={180} h={18} />
                <Block w={60} h={14} />
            </View>
            <View style={s.catGrid}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <View key={i} style={s.catItem}>
                        <Block w={64} h={64} r={32} />
                        <Block w={50} h={10} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function ProductRowSkeleton() {
    usePulse();
    return (
        <View style={s.section}>
            <Block w={220} h={18} />
            <Block w={170} h={12} style={{ marginTop: 8 }} />
            <View style={s.productRow}>
                {[0, 1, 2].map((i) => (
                    <View key={i} style={s.productCard}>
                        <Block h={110} r={0} />
                        <View style={{ padding: 10, gap: 8 }}>
                            <Block w="90%" h={13} />
                            <Block w="50%" h={13} />
                            <Block w="70%" h={10} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

export function RestoListSkeleton({ count = 3 }: { count?: number }) {
    usePulse();
    return (
        <View style={{ marginTop: 12, gap: 12 }}>
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={s.restoCard}>
                    <Block w={72} h={72} r={14} />
                    <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
                        <Block w="75%" h={15} />
                        <Block w="55%" h={12} />
                        <Block w="40%" h={12} />
                    </View>
                </View>
            ))}
        </View>
    );
}

export function RestoSectionSkeleton() {
    return (
        <View style={s.section}>
            <View style={s.sectionHeader}>
                <Block w={150} h={18} />
                <Block w={60} h={14} />
            </View>
            <RestoListSkeleton />
        </View>
    );
}

// ---------- Layar penuh (saat mencari lokasi) ----------
export default function HomeSkeleton({ paddingTop }: { paddingTop: number }) {
    return (
        <View>
            <HeaderSkeleton paddingTop={paddingTop} />
            <SearchBarSkeleton />
            <QuickMenuSkeleton />
            <PromoRowSkeleton />
            <CategorySkeleton />
            <ProductRowSkeleton />
            <RestoSectionSkeleton />
        </View>
    );
}

const s = StyleSheet.create({
    header: { paddingHorizontal: 16, paddingBottom: 24, backgroundColor: RED },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

    searchWrap: { paddingHorizontal: 16, marginTop: -20 },
    searchBar: {
        backgroundColor: '#fff', borderRadius: 26, overflow: 'hidden',
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
    },

    quickRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 20, gap: 12 },
    quickCard: {
        flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12,
        backgroundColor: '#fff', borderRadius: 16, elevation: 2,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    },

    promoRow: { flexDirection: 'row', gap: 12, paddingLeft: 16, marginTop: 20, overflow: 'hidden' },
    dealCard: { width: 190, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6 },

    section: { paddingHorizontal: 16, marginTop: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 16 },
    catItem: { width: '25%', alignItems: 'center', gap: 8 },

    productRow: { flexDirection: 'row', gap: 12, marginTop: 12, overflow: 'hidden' },
    productCard: { width: 160, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5 },

    restoCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#EEF0F2' },
});