import type { FoodCategory, RestoItem } from '@/types/warfood';

export const FOOD_CATEGORIES: FoodCategory[] = [
    { key: 'jajanan', label: 'Jajanan', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200' },
    { key: 'minuman', label: 'Minuman', imageUrl: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=200' },
    { key: 'nasi-goreng', label: 'Nasi Goreng', imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200' },
    { key: 'cepat-saji', label: 'Cepat saji', imageUrl: 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=200' },
    { key: 'aneka-nasi', label: 'Aneka nasi', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200' },
    { key: 'pizza-pasta', label: 'Pizza & pasta', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200' },
    { key: 'sweets', label: 'Sweets', imageUrl: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=200' },
    { key: 'ayam-bebek', label: 'Ayam & bebek', imageUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=200' },
];

export const SEARCH_CATEGORIES: FoodCategory[] = [
    { key: 'minuman', label: 'Minuman', imageUrl: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=200' },
    { key: 'jajanan', label: 'Jajanan', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200' },
    { key: 'sweets', label: 'Sweets', imageUrl: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=200' },
    { key: 'aneka-nasi', label: 'Aneka nasi', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200' },
    { key: 'ayam-bebek', label: 'Ayam & bebek', imageUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=200' },
    { key: 'cepat-saji', label: 'Cepat saji', imageUrl: 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=200' },
    { key: 'roti', label: 'Roti', imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200' },
    { key: 'jepang', label: 'Jepang', imageUrl: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200' },
    { key: 'bakso-soto', label: 'Bakso & soto', imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200' },
];

export const TRENDING_KEYWORDS = [
    'kfc', 'phd', 'sate', 'kebab', 'seblak', 'rocket', 'geprek', 'martabak', 'mie ayam', 'nasi goreng',
];

export const NEARBY_RESTOS: RestoItem[] = [
    {
        id: '1',
        name: 'Rumah Makan Padang RI...',
        imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300',
        category: 'Aneka nasi',
        rating: 4.7,
        ratingCount: 500,
        priceRange: '15rb-25rb',
        ongkir: 'Ongkir 46.5rb',
        duration: '45-55 min',
        discountLabel: 'Diskon 30%, maks. 25rb',
        discountLabel2: 'Disko...',
    },
    {
        id: '2',
        name: 'Nasi goreng  ayam goren...',
        imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300',
        category: 'Ayam & bebek',
        rating: 4.3,
        ratingCount: 20,
        ongkir: 'Ongkir 33rb',
        duration: '60-70 min',
        discountLabel: 'Diskon makanan s.d 30rb',
        discountLabel2: 'Disk...',
    },
    {
        id: '3',
        name: 'Bakso & Mie Ayam 2 Saud...',
        imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300',
        category: 'Bakso & soto',
        isNew: true,
        priceRange: '13.5rb',
        ongkir: 'Ongkir Rp100',
        duration: '35-45 min',
        discountLabel: 'Diskon 30%, maks. 25rb',
        discountLabel2: 'Disko...',
    },
    {
        id: '4',
        name: 'WARUNG CHICKEN KRISP...',
        imageUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=300',
        category: 'Ayam & bebek',
        rating: 4.8,
        ratingCount: 1000,
        priceRange: '25rb-35rb',
        ongkir: 'Ongkir 46.5rb',
        duration: '40-50 min',
        discountLabel: 'Diskon 30%, maks. 25rb',
        discountLabel2: 'Disko...',
        reviewQuote: '"...ayam nya juicy dan tepungnya enak',
    },
    {
        id: '5',
        name: 'Rm Bunga Lawang, Ayam ...',
        imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300',
        category: 'Aneka nasi',
        rating: 4.1,
        ratingCount: 200,
        priceRange: '25rb-35rb',
        ongkir: 'Ongkir 34.5rb',
        duration: '60-70 min',
        discountLabel: 'Disko...',
    },
];

export const CHEAP_DELIVERY_RESTOS: RestoItem[] = [
    {
        id: 'c1',
        name: 'Kedai Lexa Durian, Wonot...',
        imageUrl: 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=200',
        category: 'Jajanan',
        ongkir: 'Ongkir 14.5rb',
        duration: '35-45 min',
    },
];