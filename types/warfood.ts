export type RestoItem = {
    id: string;
    name: string;
    imageUrl?: string;
    category: string;
    rating?: number;
    ratingCount?: number;
    priceRange?: string;
    ongkir: string;
    duration: string;
    discountLabel?: string;
    discountLabel2?: string;
    reviewQuote?: string;
    isNew?: boolean;
};

export type FoodCategory = {
    key: string;
    label: string;
    imageUrl: string;
};

export type FilterState = {
    priceUnder30k: boolean;
    fastDelivery15min: boolean;
    sortNearest: boolean;
    rating40: boolean;
    rating45: boolean;
    under5k: boolean;
    foodPromo: boolean;
};

export const DEFAULT_FILTER: FilterState = {
    priceUnder30k: false,
    fastDelivery15min: false,
    sortNearest: false,
    rating40: false,
    rating45: false,
    under5k: false,
    foodPromo: false,
};

export type WarfoodStep =
    | 'home'
    | 'nearby'
    | 'cheap-delivery'
    | 'promo'
    | 'search-food';