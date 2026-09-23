import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

const ONBOARDING_KEY = 'hasSeenOnboarding';

// ---- Context supaya halaman lain bisa "memberi tahu" root layout ----
type OnboardingContextType = {
  markOnboardingComplete: () => void;
};

const OnboardingContext = createContext<OnboardingContextType>({
  markOnboardingComplete: () => { },
});

export const useOnboarding = () => useContext(OnboardingContext);

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => {
        if (isMounted) {
          setHasSeenOnboarding(value === 'true');
        }
      })
      .catch((error) => {
        console.error('Gagal cek status onboarding:', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Dipanggil dari onboarding.tsx saat user selesai/skip
  const markOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (error) {
      console.error('Gagal menyimpan status onboarding:', error);
    } finally {
      setHasSeenOnboarding(true); // ini yang bikin Stack.Protected switch ke (auth)
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#40a3ea" />
      </View>
    );
  }

  return (
    <OnboardingContext.Provider value={{ markOnboardingComplete }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!hasSeenOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={hasSeenOnboarding}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="services" />
        </Stack.Protected>
      </Stack>
    </OnboardingContext.Provider>
  );
}