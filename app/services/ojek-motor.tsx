import OjekFlow from '@/components/ojek/OjekFlow';
import { Stack, useRouter } from 'expo-router';
import React from 'react';

export default function OjekMotorScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OjekFlow
        serviceType="motor"
        // userName={user?.displayName?.split(' ')[0]}
        onExit={() => router.back()}
        onOrder={(order) => {
          // TODO: kirim ke backend / navigasi ke halaman "mencari driver"
          console.log('ORDER', order);
        }}
      />
    </>
  );
}