import type { Coords, PlaceLoc } from '@/types/ojek';

export type { Coords, PlaceLoc };

export type ContactInfo = {
    name: string;
    phone: string;
    landmark?: string;
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
    tariffCode?: string;
};

export type PaymentMethod = 'cash' | 'wallet' | 'qris' | 'bank_transfer';

export type OrderPayload = {
    origin: PlaceLoc;
    destination: PlaceLoc;
    sender: ContactInfo | null;
    receiver: ContactInfo | null;
    packageInfo: PackageInfo;
    option: GoSendCourierOption;
    // pembayaran (konsisten dengan flow ojek)
    payment_method?: PaymentMethod;
    bank_code?: string;
};

export type VehicleType = 'motor' | 'mobil' | 'motor_food';

export type DriverInfo = {
    id: string;
    name: string;
    rating: number;
    totalTrips?: number;
    photoUrl?: string;
    vehicleType: VehicleType;
    vehiclePlate: string;
    vehicleModel: string;
    phone: string;
    /** Posisi realtime, diperbarui oleh polling di parent */
    coords: Coords;
    etaMinutes: number;
};

/** Status order dari backend + 'searching' (fase lokal sebelum ada driver) */
export type DriverStatus =
    | 'searching'
    | 'pending'
    | 'accepted'
    | 'arrived'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

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
    | 'driver-found'
    | 'on-trip'
    | 'summary';

export type BookPayment = {
    payment_method: PaymentMethod;
    bank_code?: string;
};