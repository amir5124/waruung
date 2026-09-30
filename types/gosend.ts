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
    totalTrips?: number;
    photoUrl?: string;
    vehicleType: 'motor' | 'mobil' | 'motor_food';
    vehiclePlate: string;
    vehicleModel: string;
    phone: string;
    coords: Coords;
    etaMinutes: number;
};

export type DriverStatus = 'searching' | 'pending' | 'accepted' | 'arrived';

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
    | 'driver-found';