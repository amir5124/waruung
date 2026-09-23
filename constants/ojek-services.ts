import type { ServiceType } from '@/types/ojek';

export type RideOption = {
    id: string;
    name: string;
    eta: string;
    capacity: number;
    desc: string;
    baseFare: number;
    perKm: number;
    minFare: number;
};

export type ServiceConfig = {
    label: string;
    options: RideOption[];
};

// TODO: GANTI dengan tarif & ETA asli dari backend. Angka di bawah hanya placeholder.
export const SERVICES: Record<ServiceType, ServiceConfig> = {
    motor: {
        label: 'Motor',
        options: [
            { id: 'motor-cepat', name: 'Motor Cepat', eta: '2 menit', capacity: 1, desc: 'Cepat dijemput sesuai estimasi', baseFare: 4000, perKm: 3000, minFare: 9000 },
            { id: 'motor-hemat', name: 'Motor Hemat', eta: '5-7 menit', capacity: 1, desc: 'Paling hemat setiap hari', baseFare: 3000, perKm: 2200, minFare: 7000 },
            { id: 'motor-nyaman', name: 'Motor Nyaman', eta: '3-5 menit', capacity: 1, desc: 'Driver terbaik, helm bersih', baseFare: 5000, perKm: 3500, minFare: 11000 },
        ],
    },
    mobil: {
        label: 'Mobil',
        options: [
            { id: 'mobil-hemat', name: 'Mobil Hemat', eta: '4-6 menit', capacity: 4, desc: 'Pilihan hemat untuk berempat', baseFare: 7000, perKm: 4500, minFare: 15000 },
            { id: 'mobil-nyaman', name: 'Mobil Nyaman', eta: '3-5 menit', capacity: 4, desc: 'AC dingin, mobil lebih baru', baseFare: 9000, perKm: 5500, minFare: 18000 },
            { id: 'mobil-xl', name: 'Mobil XL', eta: '5-8 menit', capacity: 6, desc: 'Muat sampai 6 penumpang', baseFare: 11000, perKm: 6500, minFare: 22000 },
        ],
    },
};

export const calcFare = (o: RideOption, distanceMeters: number) => {
    const raw = Math.max(o.minFare, o.baseFare + (distanceMeters / 1000) * o.perKm);
    return Math.round(raw / 500) * 500;
};

export const formatRupiah = (n: number) =>
    'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const formatDistance = (m: number) =>
    m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;