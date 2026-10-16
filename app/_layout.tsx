// app/_layout.tsx (customer)
import NetworkGuard from '@/components/NetworkGuard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  Stack,
  router,
  usePathname,
  useRootNavigationState,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';
import {
  OrderProvider,
  useOrder,
  type ServiceRoute,
} from '../contexts/OrderContext';
import { api, getToken } from '../lib/api';
import { setupBehaviorTracker } from '../lib/behaviorTracker';
import { registerForPushNotifications } from '../lib/push';

const ONBOARDING_KEY = 'hasSeenOnboarding';

// ============================================================
// 🌅 SPLASH SCREEN
// ============================================================
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

const SPLASH_MIN_DURATION = 1500;
const SPLASH_FADE_DURATION = 400;

function CustomSplash({
  ready,
  onImageReady,
  onFinish,
}: {
  ready: boolean;
  onImageReady: () => void;
  onFinish: () => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!ready) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: SPLASH_FADE_DURATION,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [ready]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity,
          backgroundColor: '#e4f5fe',
          zIndex: 999,
        },
      ]}
    >
      <Image
        source={require('../assets/images/splash.png')}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
        onLoadEnd={onImageReady}
      />
    </Animated.View>
  );
}

// ============================================================
// 🔔 NOTIFIKASI: Channel khusus CUSTOMER
// ============================================================
export const CUSTOMER_CHANNEL_ID = 'customer-notif-v2';
const CUSTOMER_SOUND = 'customer.mp3';

const OLD_CHANNEL_IDS = ['customer-notif-v1', 'orders'];

async function setupNotifications() {
  try {
    if (Platform.OS === 'android') {
      for (const id of OLD_CHANNEL_IDS) {
        try {
          await Notifications.deleteNotificationChannelAsync(id);
          console.log('[CUSTOMER-LAYOUT] Channel lama dihapus:', id);
        } catch { }
      }

      await Notifications.setNotificationChannelAsync(CUSTOMER_CHANNEL_ID, {
        name: 'Notifikasi',
        description: 'Notifikasi order dan transaksi',
        importance: Notifications.AndroidImportance.MAX,
        sound: CUSTOMER_SOUND,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });

      const ch = await Notifications.getNotificationChannelAsync(
        CUSTOMER_CHANNEL_ID
      );
      console.log(
        '[CUSTOMER-LAYOUT] ✅ Channel siap:',
        CUSTOMER_CHANNEL_ID,
        '| sound:',
        ch?.sound
      );

      if (!ch?.sound || ch.sound === 'default') {
        console.warn(
          '[CUSTOMER-LAYOUT] ⚠️ Channel masih suara default → cek customer.mp3'
        );
      }
    }

    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      await Notifications.requestPermissionsAsync();
    }
  } catch (err) {
    console.warn('[CUSTOMER-LAYOUT] Setup notifikasi gagal:', err);
  }
}

// ============================================================
// Onboarding Context
// ============================================================
type OnboardingContextType = {
  markOnboardingComplete: () => void;
  hasSeenOnboarding: boolean;
};

const OnboardingContext = createContext<OnboardingContextType>({
  markOnboardingComplete: () => { },
  hasSeenOnboarding: false,
});

export const useOnboarding = () => useContext(OnboardingContext);

// ============================================================
// Helper: tentukan route service dari order
// ============================================================
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

const resolveService = async (
  data: any,
  orderId: number
): Promise<ServiceRoute> => {
  // Backend mengirim jenis layanan lewat key `service` (food | send | ride)
  const fromData =
    routeFromType(data.order_type ?? data.service_type ?? data.service) ??
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

const smartTarget = (data: any): string => {
  const svc =
    routeFromTariff(data.option_name) ?? routeFromType(data.service);
  if (svc) return svc;
  if (data.service === 'ride') return '/services/ojek-motor';
  return '/(tabs)';
};

// ============================================================
// Handler Tap Notifikasi
// ============================================================
function NotificationHandler() {
  const { setActiveOrder, setActiveRoomId } = useOrder();
  const { hasSeenOnboarding } = useOnboarding();
  const navState = useRootNavigationState();
  const pathname = usePathname();

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const handledRef = useRef<string | null>(null);
  const coldStartHandledRef = useRef(false);
  const pendingRef = useRef<any>(null);

  const canNavigate = !!navState?.key && hasSeenOnboarding;
  const canNavigateRef = useRef(canNavigate);
  canNavigateRef.current = canNavigate;

  const handleTap = (data: any) => {
    if (!data) return;

    console.log(
      '[notif] handle tap, type:',
      data.type,
      'tariff:',
      data.tariff_code
    );

    // ===== Notifikasi pintar =====
    if (data.type === 'abandoned_quote' || data.type === 'reengage') {
      const target = smartTarget(data);
      console.log('[notif] smart notif ->', target, data.option_name);

      setTimeout(() => {
        if (pathnameRef.current === target) {
          console.log('[notif] Sudah di', target, '— skip push');
          return;
        }
        router.push(target as any);
      }, 300);
      return;
    }

    // ===== Chat =====
    if (data.type === 'chat_message' && data.room_id) {
      const target = `/chat/${data.room_id}`;
      setActiveRoomId(Number(data.room_id));

      setTimeout(() => {
        if (pathnameRef.current === target) {
          console.log('[notif] Sudah di', target, '— skip push');
          return;
        }
        router.push(target as any);
      }, 300);
      return;
    }

    // ===== Dompet =====
    if (String(data.type ?? '').startsWith('topup')) {
      setTimeout(() => router.push('/topup' as any), 300);
      return;
    }
    if (String(data.type ?? '').startsWith('withdraw')) {
      setTimeout(() => router.push('/tarik' as any), 300);
      return;
    }

    // ===== Order =====
    if (data.order_id) {
      const orderId = Number(data.order_id);

      resolveService(data, orderId).then((service) => {
        const isFood = service === '/services/warfood';
        let target: any;
        let targetPath: string;

        if (isFood) {
          // Food tidak punya flow sendiri -> halaman order / rating.
          // JANGAN setActiveOrder untuk food: tidak ada flow yang
          // menghabiskannya, nanti ojek/kirim paket salah mem-boot order food.
          const done =
            data.type === 'status_update' && data.status === 'completed';
          target = done
            ? {
              pathname: '/rating/[orderId]',
              params: { orderId: String(orderId) },
            }
            : {
              pathname: '/mencari-driver',
              params: { orderId: String(orderId) },
            };
          targetPath = done ? '/rating' : '/mencari-driver';
        } else {
          // Ojek / kirim paket: flow-nya boot sendiri dari activeOrderId
          setActiveOrder(orderId, service);
          target = service;
          targetPath = service;
        }

        console.log('[notif] buka order:', orderId, '->', targetPath);

        setTimeout(() => {
          if (pathnameRef.current.startsWith(targetPath)) {
            console.log('[notif] Sudah di halaman target, skip push');
            return;
          }
          router.push(target as any);
        }, 300);
      });
      return;
    }
  };

  const handleTapOnce = (data: any) => {
    if (!data) return;
    // status ikut di kunci agar notifikasi status berurutan tidak terblokir
    const key = `${data.type}-${data.status ?? ''}-${data.order_id ?? data.room_id ?? data.quote_session_id ?? 'none'
      }`;

    if (handledRef.current === key) {
      console.log('[notif] Skip — sudah ditangani:', key);
      return;
    }
    handledRef.current = key;

    setTimeout(() => {
      if (handledRef.current === key) handledRef.current = null;
    }, 8000);

    if (!canNavigateRef.current) {
      console.log('[notif] Navigasi belum siap — tap ditahan:', key);
      pendingRef.current = data;
      return;
    }

    handleTap(data);
  };

  const handleTapOnceRef = useRef(handleTapOnce);
  handleTapOnceRef.current = handleTapOnce;
  const handleTapRef = useRef(handleTap);
  handleTapRef.current = handleTap;

  useEffect(() => {
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        console.log('[notif] User tap (background):', data);
        handleTapOnceRef.current(data);
      });

    if (!coldStartHandledRef.current) {
      coldStartHandledRef.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          const data = response.notification.request.content.data as any;
          console.log('[notif] Cold start tap:', data);
          handleTapOnceRef.current(data);
        }
      });
    }

    return () => {
      responseListener.remove();
    };
  }, []);

  useEffect(() => {
    if (!canNavigate || !pendingRef.current) return;

    const data = pendingRef.current;
    pendingRef.current = null;
    console.log('[notif] Proses tap yang tertahan');
    setTimeout(() => handleTapRef.current(data), 300);
  }, [canNavigate]);

  return null;
}

// ============================================================
// Behavior Tracker
// ============================================================
function BehaviorTrackerBootstrap() {
  const pathname = usePathname();
  const lastTokenRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getToken();
      if (cancelled) return;

      if (!token) {
        if (lastTokenRef.current) {
          console.log('[tracker] logout, hentikan tracker');
          cleanupRef.current?.();
          cleanupRef.current = undefined;
          lastTokenRef.current = null;
        }
        return;
      }

      if (token === lastTokenRef.current) return;
      lastTokenRef.current = token;

      console.log(
        '[tracker] login terdeteksi: mulai tracker & register push'
      );

      cleanupRef.current?.();
      cleanupRef.current = setupBehaviorTracker();

      try {
        await registerForPushNotifications();
      } catch (err: any) {
        console.warn('[tracker] register push gagal:', err?.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => () => cleanupRef.current?.(), []);

  return null;
}

// ============================================================
// Root Layout
// ============================================================
export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  const [showSplash, setShowSplash] = useState(true);
  const [minTimeDone, setMinTimeDone] = useState(false);
  const nativeHiddenRef = useRef(false);

  const hideNativeSplash = () => {
    if (nativeHiddenRef.current) return;
    nativeHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => { });
  };

  useEffect(() => {
    const t = setTimeout(() => setMinTimeDone(true), SPLASH_MIN_DURATION);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(hideNativeSplash, 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setupNotifications();
  }, []);

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

  const splashReady = !isLoading && minTimeDone;

  return (
    <View style={{ flex: 1 }}>
      {!isLoading && (
        <OrderProvider>
          <OnboardingContext.Provider
            value={{ markOnboardingComplete, hasSeenOnboarding }}
          >
            <NotificationHandler />
            <BehaviorTrackerBootstrap />

            <Stack screenOptions={{ headerShown: false }}>
              {/* ============================================================ */}
              {/* ONBOARDING */}
              {/* ============================================================ */}
              <Stack.Protected guard={!hasSeenOnboarding}>
                <Stack.Screen name="onboarding" />
              </Stack.Protected>

              {/* ============================================================ */}
              {/* MAIN APP */}
              {/* ============================================================ */}
              <Stack.Protected guard={hasSeenOnboarding}>
                {/* Auth */}
                <Stack.Screen name="(auth)" />

                {/* Tabs */}
                <Stack.Screen name="(tabs)" />

                {/* Services (ojek, food, send) */}
                <Stack.Screen name="services" />

                {/* WarFood */}
                <Stack.Screen
                  name="resto/[id]"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="resto-terdekat"
                  options={{ headerShown: false }}
                />

                <Stack.Screen
                  name="checkout"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="mencari-driver"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="tracking/[orderId]"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="rating/[orderId]"
                  options={{ headerShown: false }}
                />

                {/* Alamat */}
                <Stack.Screen
                  name="pick-address"
                  options={{ headerShown: false }}
                />

                {/* Promo & ongkir */}
                <Stack.Screen
                  name="ongkir-murah"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="promo"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="keranjang" options={{ headerShown: false }} />

                {/* Chat */}
                <Stack.Screen name="chat/[roomId]" />

                {/* Alamat tersimpan */}
                <Stack.Screen name="saved-addresses" />
                <Stack.Screen name="save-address/[kind]" />


              </Stack.Protected>
            </Stack>

            <NetworkGuard />
          </OnboardingContext.Provider>
        </OrderProvider>
      )}

      {showSplash && (
        <CustomSplash
          ready={splashReady}
          onImageReady={hideNativeSplash}
          onFinish={() => setShowSplash(false)}
        />
      )}
    </View>
  );
}