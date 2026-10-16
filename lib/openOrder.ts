import { router } from 'expo-router';
import type { ServiceRoute } from '../contexts/OrderContext';
import type { OrderResponse } from './api';

export const ACTIVE_STATUSES = ['pending', 'accepted', 'arrived', 'in_progress'];

export function serviceOf(o: OrderResponse): ServiceRoute {
    if (o.type === 'food') return '/services/warfood';
    if (o.type === 'send') return '/services/kurir';
    const c = ((o as any).tariff_code ?? '').toLowerCase();
    return c.startsWith('warcar') ? '/services/ojek-mobil' : '/services/ojek-motor';
}

const isUnpaid = (o: any) =>
    (o.payment_method === 'qris' || o.payment_method === 'bank_transfer') &&
    o.payment_status === 'pending';

/** Buka layar live untuk order yang sedang berjalan. */
export function openOrder(
    o: OrderResponse,
    setActiveOrder: (id: number | null, s?: ServiceRoute | null) => void
) {
    if (isUnpaid(o)) {
        router.push({ pathname: '/payment/[orderId]', params: { orderId: String(o.id) } } as any);
        return;
    }
    const service = serviceOf(o);
    if (service === '/services/warfood') {
        router.push({ pathname: '/mencari-driver', params: { orderId: String(o.id) } } as any);
    } else {
        setActiveOrder(o.id, service); // flow ojek/kirim paket boot dari sini
        router.push(service as any);
    }
}