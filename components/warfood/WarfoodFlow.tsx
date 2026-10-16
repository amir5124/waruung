// components/warfood/WarfoodFlow.tsx
import type { NearbyMerchant } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import HomeStep from './HomeStep';
import SearchFoodStep from './SearchFoodStep';

type Step = 'home' | 'search-food';

type Props = {
    locationLabel: string;
    onExit: () => void;
    /**
     * Kalau parent mau handle sendiri (mis. dari tab),
     * pass handler ini. Kalau tidak, default: push ke /resto/[id]
     */
    onSelectResto?: (item: NearbyMerchant) => void;
};

export default function WarfoodFlow({
    locationLabel,
    onExit,
    onSelectResto,
}: Props) {
    const router = useRouter();
    const [step, setStep] = useState<Step>('home');

    // ============================================================
    // Handler pilih resto
    // ============================================================
    const handleSelectResto = (m: NearbyMerchant) => {
        console.log('[WARFOOD-FLOW] Pilih resto:', {
            user_id: m.user_id,
            store_name: m.store_name,
            distance_m: m.distance_m,
        });

        // Kalau parent mau handle sendiri
        if (onSelectResto) {
            onSelectResto(m);
            return;
        }

        // ✅ Default: navigasi ke halaman detail resto
        router.push({
            pathname: '/resto/[id]',
            params: { id: m.user_id },
        } as any);
    };

    // ============================================================
    // Handler pencarian
    // ============================================================
    const handleSearch = (query: string) => {
        console.log('[WARFOOD-FLOW] Search:', query);

        // Arahkan ke halaman hasil pencarian
        router.push({
            pathname: '/cari-resto',
            params: { q: query },
        } as any);
    };

    const handleCategory = (categoryKey: string) => {
        console.log('[WARFOOD-FLOW] Category:', categoryKey);

        // Arahkan ke halaman daftar resto berdasarkan kategori
        router.push({
            pathname: '/resto-terdekat',
            params: { category: categoryKey },
        } as any);
    };

    // ============================================================
    // Render step
    // ============================================================
    switch (step) {
        case 'home':
            return (
                <HomeStep
                    locationLabel={locationLabel}
                    onClose={onExit}
                    onPressSearch={() => setStep('search-food')}
                    onPressNearby={() => router.push('/resto-terdekat')}
                    onPressCheapDelivery={() => router.push('/ongkir-murah')}
                    onPressPromo={() => router.push('/promo')}
                    onPressResto={handleSelectResto}
                    onPressSeeAll={() => router.push('/resto-terdekat')}
                />
            );

        case 'search-food':
            return (
                <SearchFoodStep
                    onBack={() => setStep('home')}
                    onSearch={handleSearch}
                    onPressCategory={handleCategory}
                />
            );

        default:
            return null;
    }
}