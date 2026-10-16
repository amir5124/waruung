// lib/orderFlow.ts
import type { OrderResponse } from '@/lib/api';

// ============================================================
// STEP UI
// ============================================================
export type FoodOrderStep =
    | 'searching'      // cari driver
    | 'driver_found'   // driver dapat, menuju resto
    | 'picking_up'     // driver di resto, ambil pesanan
    | 'delivering'     // driver antar ke user
    | 'arrived'        // driver tiba di user
    | 'completed'      // selesai
    | 'cancelled';     // dibatalkan

export const ORDER_STEP_LABEL: Record<FoodOrderStep, string> = {
    searching: 'Mencari driver',
    driver_found: 'Driver menuju resto',
    picking_up: 'Mengambil pesanan',
    delivering: 'Mengantar pesanan',
    arrived: 'Driver tiba',
    completed: 'Pesanan selesai',
    cancelled: 'Dibatalkan',
};

export const ORDER_STEP_SUB: Record<FoodOrderStep, string> = {
    searching: 'Ditunggu ya, yang booking lagi rame 🙏',
    driver_found: 'Driver sedang menuju ke resto',
    picking_up: 'Driver sedang mengambil pesananmu',
    delivering: 'Pesananmu sedang dalam perjalanan',
    arrived: 'Driver sudah sampai di lokasimu',
    completed: 'Terima kasih sudah pesan!',
    cancelled: 'Pesanan dibatalkan',
};

// ============================================================
// MAP BACKEND STATUS → STEP UI
// ============================================================
export function mapOrderStatus(status: string): FoodOrderStep {
    switch (status) {
        case 'pending':
            return 'searching';
        case 'accepted':
            return 'driver_found';
        case 'arrived':
            return 'picking_up';
        case 'in_progress':
            return 'delivering';
        case 'completed':
            return 'completed';
        case 'cancelled':
            return 'cancelled';
        default:
            return 'searching';
    }
}

// ============================================================
// HELPER — progress (0..1) untuk tiap step
// ============================================================
export function stepProgress(step: FoodOrderStep): number {
    switch (step) {
        case 'searching':
            return 0.1;
        case 'driver_found':
            return 0.35;
        case 'picking_up':
            return 0.55;
        case 'delivering':
            return 0.8;
        case 'arrived':
            return 0.95;
        case 'completed':
            return 1;
        case 'cancelled':
            return 1;
    }
}

// ============================================================
// HELPER — apakah order masih aktif (bisa di-track)
// ============================================================
export function isOrderActive(order: OrderResponse | null): boolean {
    if (!order) return false;
    return !['completed', 'cancelled'].includes(order.status);
}

// ============================================================
// HELPER — label ETA dinamis per step
// ============================================================
export function etaLabel(step: FoodOrderStep): string {
    switch (step) {
        case 'searching':
            return 'Mencari…';
        case 'driver_found':
            return 'Menuju resto';
        case 'picking_up':
            return 'Ambil pesanan';
        case 'delivering':
            return 'Antar ke kamu';
        case 'arrived':
            return 'Tiba';
        case 'completed':
            return 'Selesai';
        case 'cancelled':
            return 'Batal';
    }
}