export type ServiceType = 'motor' | 'mobil';

export type Coords = { latitude: number; longitude: number };

export type PlaceLoc = {
    name: string;
    address: string;
    coords: Coords;
    placeId?: string;
    /** true = otomatis dari GPS pengguna */
    isCurrent?: boolean;
};

export type PlaceSuggestion = {
    placeId: string;
    mainText: string;
    secondaryText: string;
    distanceMeters?: number;
    matches: { start: number; end: number }[];
};

export type RouteInfo = {
    distanceMeters: number;
    durationSec: number;
    polyline: Coords[];
    /** true kalau Routes API gagal dan kita pakai garis lurus */
    isEstimate?: boolean;
};

export type OrderPayload = {
    service: ServiceType;
    optionId: string;
    optionName: string;
    price: number;
    origin: PlaceLoc;
    destination: PlaceLoc;
    distanceMeters: number;
    durationSec: number;
};