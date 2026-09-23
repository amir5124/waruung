import WarfoodFlow from '@/components/warfood/WarfoodFlow';
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
                onSelectResto={(item) => {
                    // TODO: navigasi ke halaman detail resto
                    console.log('SELECTED RESTO', item);
                }}
            />
        </>
    );
}