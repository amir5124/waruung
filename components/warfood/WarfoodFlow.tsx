import type { FilterState, RestoItem, WarfoodStep } from '@/types/warfood';
import { DEFAULT_FILTER } from '@/types/warfood';
import { useState } from 'react';
import CheapDeliveryStep from './CheapDeliveryStep';
import FilterModal from './FilterModal';
import HomeStep from './HomeStep';
import NearbyStep from './NearbyStep';
import PromoStep from './PromoStep';
import SearchFoodStep from './SearchFoodStep';

type Props = {
    locationLabel: string;
    onExit: () => void;
    onSelectResto?: (item: RestoItem) => void;
};

export default function WarfoodFlow({ locationLabel, onExit, onSelectResto }: Props) {
    const [step, setStep] = useState<WarfoodStep>('home');
    const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
    const [showFilterModal, setShowFilterModal] = useState(false);

    const handleSelectResto = (item: RestoItem) => {
        // TODO: sambungkan ke halaman detail resto
        console.log('Buka resto:', item.name);
        onSelectResto?.(item);
    };

    switch (step) {
        case 'home':
            return (
                <>
                    <HomeStep
                        locationLabel={locationLabel}
                        onClose={onExit}
                        onPressSearch={() => setStep('search-food')}
                        onPressNearby={() => setStep('nearby')}
                        onPressCheapDelivery={() => setStep('cheap-delivery')}
                        onPressPromo={() => setStep('promo')}
                        onPressResto={handleSelectResto}
                        onPressSeeAll={() => setStep('search-food')}
                    />
                </>
            );

        case 'nearby':
            return (
                <>
                    <NearbyStep
                        filter={filter}
                        onBack={() => setStep('home')}
                        onPressFilter={() => setShowFilterModal(true)}
                        onPressResto={handleSelectResto}
                    />
                    <FilterModal
                        visible={showFilterModal}
                        initial={filter}
                        onClose={() => setShowFilterModal(false)}
                        onApply={(f) => {
                            setFilter(f);
                            setShowFilterModal(false);
                        }}
                    />
                </>
            );

        case 'cheap-delivery':
            return (
                <>
                    <CheapDeliveryStep
                        onBack={() => setStep('home')}
                        onPressFilter={() => setShowFilterModal(true)}
                        onPressResto={handleSelectResto}
                    />
                    <FilterModal
                        visible={showFilterModal}
                        initial={filter}
                        onClose={() => setShowFilterModal(false)}
                        onApply={(f) => {
                            setFilter(f);
                            setShowFilterModal(false);
                        }}
                    />
                </>
            );

        case 'promo':
            return <PromoStep onBack={() => setStep('home')} />;

        case 'search-food':
            return (
                <SearchFoodStep
                    onBack={() => setStep('home')}
                    onSearch={(query) => {
                        // TODO: arahkan ke halaman hasil pencarian dengan query ini
                        console.log('Cari:', query);
                    }}
                    onPressCategory={(categoryKey) => {
                        // TODO: arahkan ke halaman daftar resto berdasarkan kategori
                        console.log('Kategori:', categoryKey);
                    }}
                />
            );

        default:
            return null;
    }
}