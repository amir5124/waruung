import GoSendFlow from '@/components/gosend/GoSendFlow';
import { Stack, useRouter } from 'expo-router';
import React from 'react';

export default function KurirScreen() {
    const router = useRouter();
    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <GoSendFlow
                onExit={() => router.back()}
                onOrder={(order) => {
                    // TODO: kirim ke backend / navigasi ke halaman "mencari driver"
                    console.log('GOSEND ORDER', order);
                }}
            />
        </>
    );
}