// lib/driver-adapter.ts
import type { DriverInfo as ApiDriver, OrderResponse } from '@/lib/api';
import type { DriverStatus, DriverInfo as UIDriver } from '@/types/gosend';

export function toUIDriver(api: ApiDriver): UIDriver {
    return {
        id: api.id,
        name: api.full_name ?? 'Driver',
        rating: api.rating_avg ?? 0,
        totalTrips: api.total_trips ?? undefined,
        photoUrl: api.avatar_url ?? undefined,
        vehicleType: normalizeVehicleType(api.vehicle_type),
        vehiclePlate: api.plate_number ?? '—',
        vehicleModel: api.vehicle_brand ?? '-',
        phone: api.phone ?? '',
        coords: api.coords ?? { latitude: 0, longitude: 0 },
        etaMinutes: 5,
    };
}

function normalizeVehicleType(
    v: 'motor' | 'mobil' | 'motor_food' | null | undefined
): 'motor' | 'mobil' | 'motor_food' {
    if (v === 'mobil') return 'mobil';
    if (v === 'motor_food') return 'motor_food';
    return 'motor';
}

export function orderStatusToDriverStatus(
    status: OrderResponse['status']
): DriverStatus {
    switch (status) {
        case 'pending':
            return 'pending';
        case 'accepted':
            return 'accepted';
        case 'arrived':
            return 'arrived';
        case 'in_progress':
            return 'accepted';
        default:
            return 'searching';
    }
}