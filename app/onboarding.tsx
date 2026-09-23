import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    Image,
    ListRenderItemInfo,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboarding } from './_layout';

const { width, height } = Dimensions.get('window');

// ---- Warna sesuai referensi (background putih, aksen oranye) ----
const COLORS = {
    bg: '#ffffff',
    accent: '#ea7317',
    textDark: '#2b2118',
    textMuted: '#8a8f98',
    dotInactive: '#f0e0d0',
};

type Slide = {
    key: string;
    image: any;
    title: string;
    description: string;
};

const SLIDES: Slide[] = [
    {
        key: '1',
        image: require('../assets/images/onboard-1.png'),
        title: 'Pesan ojek, langsung jalan',
        description:
            'Tinggal pilih tujuan, driver terdekat siap jemput dalam hitungan menit.',
    },
    {
        key: '2',
        image: require('../assets/images/onboard-2.png'),
        title: 'Laper? Tinggal pesan',
        description:
            'Makanan favoritmu dari warung terdekat, diantar langsung ke depan pintu.',
    },
    {
        key: '3',
        image: require('../assets/images/onboard-3.png'),
        title: 'Kirim barang jadi gampang',
        description:
            'Paket atau dokumen kamu diantar aman dan cepat, bisa dipantau real-time.',
    },
];

export default function OnboardingScreen() {
    const { markOnboardingComplete } = useOnboarding();
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList<Slide>>(null);
    const isLastSlide = activeIndex === SLIDES.length - 1;

    const handleMomentumScrollEnd = (
        e: NativeSyntheticEvent<NativeScrollEvent>
    ) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        setActiveIndex(index);
    };

    const goToSlide = (index: number) => {
        flatListRef.current?.scrollToIndex({ index, animated: true });
        setActiveIndex(index); // ⬅️ tambahkan ini
    };
    const completeOnboarding = () => {
        markOnboardingComplete();
    };

    const handleGetStarted = () => {
        if (isLastSlide) {
            completeOnboarding();
        } else {
            goToSlide(activeIndex + 1);
        }
    };

    const handleSkip = () => {
        completeOnboarding();
    };

    const renderItem = ({ item }: ListRenderItemInfo<Slide>) => (
        <View style={styles.slide}>
            {/* Ilustrasi langsung, tanpa kartu pembungkus */}
            <View style={styles.imageWrapper}>
                <Image source={item.image} style={styles.image} resizeMode="contain" />
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>

            <TouchableOpacity
                style={styles.button}
                activeOpacity={0.85}
                onPress={handleGetStarted}
            >
                <Text style={styles.buttonText}>
                    {isLastSlide ? 'Mulai Sekarang' : 'Lanjut'}
                </Text>
            </TouchableOpacity>

            {/* Dot indicator */}
            <View style={styles.dotsContainer}>
                {SLIDES.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            i === activeIndex && styles.dotActive,
                        ]}
                    />
                ))}
            </View>
        </View>
    );

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

            {/* Tombol Lewati */}
            {!isLastSlide && (
                <SafeAreaView style={styles.skipWrapper}>
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                        <Text style={styles.skipText}>Lewati</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            )}

            <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                keyExtractor={(item) => item.key}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                scrollEventThrottle={16}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    skipWrapper: {
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 10,
    },
    skipButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        margin: 8,
    },
    skipText: {
        color: COLORS.textMuted,
        fontSize: 14,
        fontWeight: '600',
    },
    slide: {
        width,
        height,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: height * 0.1,
    },
    imageWrapper: {
        width: '100%',
        height: height * 0.42,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 36,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.accent,
        textAlign: 'center',
        marginBottom: 10,
    },
    description: {
        fontSize: 14,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
        paddingHorizontal: 12,
    },
    button: {
        backgroundColor: COLORS.accent,
        paddingVertical: 14,
        paddingHorizontal: 56,
        borderRadius: 30,
        shadowColor: COLORS.accent,
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.dotInactive,
        marginHorizontal: 4,
    },
    dotActive: {
        width: 20,
        backgroundColor: COLORS.accent,
    },
});