import { Stack } from 'expo-router';

export default function ServicesLayout() {
    return (
        <Stack>
            <Stack.Screen name="ojek-motor" options={{ title: 'Ojek Motor' }} />
            <Stack.Screen name="ojek-mobil" options={{ title: 'Ojek Mobil' }} />
            <Stack.Screen name="warfood" options={{ title: 'Warfood' }} />
            <Stack.Screen name="kurir" options={{ title: 'Kurir' }} />
        </Stack>
    );
}