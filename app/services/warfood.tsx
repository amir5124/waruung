// app/services/warfood.tsx
import WarfoodFlow from '@/components/warfood/WarfoodFlow';
import type { NearbyMerchant } from '@/lib/api';
import { Stack, useRouter } from 'expo-router';
import React from 'react';

export default function WarfoodScreen() {
    const router = useRouter();
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <WarfoodFlow
                locationLabel="Jl. Raya Tambahrejo, Jawa Tengah"
                onExit={() => router.back()}
                onSelectResto={(m: NearbyMerchant) => {
                    router.push({ pathname: '/resto/[id]', params: { id: m.user_id } } as any);
                }}
            />
        </>
    );
}