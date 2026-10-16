// app/tracking/[orderId].tsx
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Tracking page — redirect ke flow mencari-driver
 * yang sudah handle semua step (searching → found → trip → completed).
 */
export default function TrackingRedirect() {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    return (
        <Redirect
            href={{
                pathname: '/mencari-driver',
                params: { orderId: String(orderId) },
            } as any}
        />
    );
}