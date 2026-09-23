import type { Coords, PlaceLoc } from '@/types/ojek';

// Satukan tipe lokasi dengan yang sudah dipakai di flow Ojek,
// supaya tidak ada dua definisi PlaceLoc yang beda-beda (penyebab garis merah sebelumnya).
export type { Coords, PlaceLoc };

export type ContactInfo = {
    name: string;
    phone: string;
};

export type PackageSize = 'kecil' | 'sedang' | 'besar';
export type ProtectionType = 'silver' | 'gold' | null;

export type PackageInfo = {
    type: string | null;
    size: PackageSize | null;
    weight: string | null;
    protection: ProtectionType;
    receiveCode: boolean;
};

export type GoSendCourierOption = {
    id: string;
    name: string;
    tag?: string;
    eta: string;
    price: number;
};

export type OrderPayload = {
    origin: PlaceLoc;
    destination: PlaceLoc;
    sender: ContactInfo | null;
    receiver: ContactInfo | null;
    packageInfo: PackageInfo;
    option: GoSendCourierOption;
};

export type DriverInfo = {
    id: string;
    name: string;
    rating: number;
    photoUrl?: string;
    vehiclePlate: string;
    vehicleModel: string;
    phone: string;
    coords: Coords; // posisi driver saat ini
    etaMinutes: number;
};

export type GoSendStep =
    | 'home'
    | 'search-destination'
    | 'pick-map'
    | 'delivery-detail'
    | 'pickup-form'
    | 'dropoff-form'
    | 'package-options'
    | 'package-size'
    | 'searching-driver'
    | 'driver-found'; // ⬅️ tambahkan ini