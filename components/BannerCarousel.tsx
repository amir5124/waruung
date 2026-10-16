// components/BannerCarousel.tsx
import { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ImageSourcePropType,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const AUTO_SLIDE_INTERVAL = 3000;

// ✅ Terima string URL ATAU require() lokal
export type BannerSource = ImageSourcePropType | string;

type Props = {
    images: BannerSource[];
    height?: number;
};

/** Convert string URL ke { uri } */
function toSource(item: BannerSource): ImageSourcePropType {
    if (typeof item === 'string') {
        return { uri: item };
    }
    return item;
}

export default function BannerCarousel({ images, height = 181 }: Props) {
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startAutoSlide = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (images.length <= 1) return; // jangan auto-slide kalau cuma 1

        intervalRef.current = setInterval(() => {
            setActiveIndex((prev) => {
                const next = (prev + 1) % images.length;
                flatListRef.current?.scrollToIndex({
                    index: next,
                    animated: true,
                });
                return next;
            });
        }, AUTO_SLIDE_INTERVAL);
    };

    useEffect(() => {
        startAutoSlide();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images.length]);

    const handleScroll = (
        e: NativeSyntheticEvent<NativeScrollEvent>
    ) => {
        const index = Math.round(
            e.nativeEvent.contentOffset.x / BANNER_WIDTH
        );
        setActiveIndex(index);
    };

    const handleScrollBeginDrag = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const handleScrollEndDrag = () => {
        startAutoSlide();
    };

    if (!images || images.length === 0) return null;

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, index) => index.toString()}
                onScroll={handleScroll}
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={handleScrollEndDrag}
                scrollEventThrottle={16}
                getItemLayout={(_, index) => ({
                    length: BANNER_WIDTH,
                    offset: BANNER_WIDTH * index,
                    index,
                })}
                renderItem={({ item }) => (
                    <Image
                        source={toSource(item)}   // ✅ support string URL
                        style={[styles.bannerImage, { height }]}
                    />
                )}
            />

            {/* Dot indicator — hanya kalau >1 banner */}
            {images.length > 1 && (
                <View style={styles.dotsContainer}>
                    {images.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === activeIndex && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginTop: 16,
    },
    bannerImage: {
        width: BANNER_WIDTH,
        height: 181,
        borderRadius: 24,
        resizeMode: 'cover',
        backgroundColor: '#EEF3F7',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#C7D2E0',
    },
    dotActive: {
        width: 18,
        backgroundColor: '#2F86EB',
    },
});