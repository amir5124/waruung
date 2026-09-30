import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Stack, router, usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  OrderProvider,
  useOrder,
  type ServiceRoute,
} from '../contexts/OrderContext';
import { api } from '../lib/api';

const ONBOARDING_KEY = 'hasSeenOnboarding';

type OnboardingContextType = {
  markOnboardingComplete: () => void;
};

const OnboardingContext = createContext<OnboardingContextType>({
  markOnboardingComplete: () => { },
});

export const useOnboarding = () => useContext(OnboardingContext);

// ============ Helper: tentukan route service ============

/** order.type: 'send' -> kurir, 'food' -> warfood, 'ride' -> null (lihat tariff_code) */
const routeFromType = (type?: string): ServiceRoute | null => {
  switch (type) {
    case 'send':
      return '/services/kurir';
    case 'food':
      return '/services/warfood';
    default:
      return null;
  }
};

const routeFromTariff = (code?: string | null): ServiceRoute | null => {
  const c = (code ?? '').toLowerCase();
  if (c.startsWith('warsend') || c.includes('send')) return '/services/kurir';
  if (c.startsWith('warfood')) return '/services/warfood';
  if (c.startsWith('warcar')) return '/services/ojek-mobil';
  if (c.startsWith('warjek')) return '/services/ojek-motor';
  return null;
};

/**
 * Urutan: tipe dari data notif -> tariff_code dari data notif
 * -> ambil order dari API -> default ojek motor.
 */
const resolveService = async (
  data: any,
  orderId: number
): Promise<ServiceRoute> => {
  const fromData =
    routeFromType(data.order_type ?? data.service_type) ??
    routeFromTariff(data.tariff_code);
  if (fromData) return fromData;

  try {
    const order = await api.getOrder(orderId);
    return (
      routeFromType(order.type) ??
      routeFromTariff(order.tariff_code) ??
      '/services/ojek-motor'
    );
  } catch (err: any) {
    console.warn('[notif] Gagal resolve service:', err.message);
    return '/services/ojek-motor';
  }
};

// ============ Handler Tap Notifikasi ============
function NotificationHandler() {
  const { setActiveOrder, setActiveRoomId } = useOrder();
  const handledRef = useRef<string | null>(null);
  const coldStartHandledRef = useRef(false);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        console.log('[notif] User tap (background):', data);
        handleTapOnce(data);
      });

    if (!coldStartHandledRef.current) {
      coldStartHandledRef.current = true;
      Notifications.getLastNotificationResponseAsync().then(
        (response) => {
          if (response) {
            const data = response.notification.request.content
              .data as any;
            console.log('[notif] Cold start tap:', data);
            handleTapOnce(data);
          }
        }
      );
    }

    return () => {
      responseListener.remove();
    };
  }, []);

  /**
   * Guard 1: cegah 1 notif diproses 2x
   */
  const handleTapOnce = (data: any) => {
    if (!data) return;
    const key = `${data.type}-${data.order_id ?? data.room_id ?? 'none'}`;

    if (handledRef.current === key) {
      console.log('[notif] Skip — sudah ditangani:', key);
      return;
    }
    handledRef.current = key;

    setTimeout(() => {
      if (handledRef.current === key) handledRef.current = null;
    }, 8000);

    handleTap(data);
  };

  const handleTap = (data: any) => {
    if (!data) return;

    console.log(
      '[notif] handle tap, type:',
      data.type,
      'tariff:',
      data.tariff_code
    );

    // ===== Chat =====
    if (data.type === 'chat_message' && data.room_id) {
      const target = `/chat/${data.room_id}`;

      setActiveRoomId(Number(data.room_id));

      setTimeout(() => {
        // Guard 2: cek route saat ini sebelum push
        if (pathnameRef.current === target) {
          console.log('[notif] Sudah di', target, '— skip push');
          return;
        }
        router.push(target as any);
      }, 300);
      return;
    }

    // ===== Order =====
    if (data.order_id) {
      const orderId = Number(data.order_id);

      // Driver notif order baru → ke tab
      if (data.type === 'new_order') {
        setActiveOrder(orderId, null);
        setTimeout(() => {
          if (pathnameRef.current.startsWith('/(tabs)')) {
            console.log('[notif] Sudah di (tabs) — skip push');
            return;
          }
          router.push('/(tabs)' as any);
        }, 300);
        return;
      }

      // Tentukan route service (async, fallback ke API)
      resolveService(data, orderId).then((target) => {
        console.log('[notif] redirect ke:', target, 'orderId:', orderId);

        setActiveOrder(orderId, target);

        setTimeout(() => {
          // Guard 2: jangan push kalau sudah di route target
          if (pathnameRef.current === target) {
            console.log(
              '[notif] Sudah di route target',
              target,
              '— skip push'
            );
            return;
          }
          router.push(target as any);
        }, 300);
      });
    }
  };

  return null;
}

// ============ Root Layout ============
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

  const markOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (error) {
      console.error('Gagal menyimpan status onboarding:', error);
    } finally {
      setHasSeenOnboarding(true);
    }
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
        }}
      >
        <ActivityIndicator size="large" color="#40a3ea" />
      </View>
    );
  }

  return (
    <OrderProvider>
      <OnboardingContext.Provider value={{ markOnboardingComplete }}>
        <NotificationHandler />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!hasSeenOnboarding}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>

          <Stack.Protected guard={hasSeenOnboarding}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="services" />
            <Stack.Screen name="chat/[roomId]" />
          </Stack.Protected>
        </Stack>
      </OnboardingContext.Provider>
    </OrderProvider>
  );
}