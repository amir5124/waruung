import AppAlert from '@/components/AppAlert';
import { colors } from '@/constants/ojek-theme';
import { useOrder } from '@/contexts/OrderContext';
import { useAppAlert } from '@/hooks/use-app-alert';
import { useUserLocation } from '@/hooks/use-user-location';
import { api, OrderResponse } from '@/lib/api';
import { orderStatusToDriverStatus, toUIDriver } from '@/lib/driver-adapter';
import { reverseGeocode } from '@/services/google-maps';
import type {
    ContactInfo,
    DriverInfo,
    DriverStatus,
    GoSendCourierOption,
    GoSendStep,
    OrderPayload,
    PackageInfo,
    PlaceLoc,
    ProtectionType,
} from '@/types/gosend';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Text, View } from 'react-native';
import ContactFormStep from './ContactFormStep';
import DeliveryDetailStep from './DeliveryDetailStep';
import type { GoSendOrder } from './DriverFoundStep';
import DriverFoundStep from './DriverFoundStep';
import HomeStep from './HomeStep';
import OnTripStep from './OnTripStep';
import PackageOptionsStep from './PackageOptionsStep';
import PackageSizeStep from './PackageSizeStep';
import PickOnMapStep from './PickOnMapStep';
import SearchAddressStep, { type SearchField } from './SearchAddressStep';
import SearchingDriverStep from './SearchingDriverStep';
import TripSummaryStep from './TripSummaryStep';

type Step = GoSendStep | 'on-trip' | 'summary';

type Props = {
    onExit: () => void;
    onOrder: (payload: OrderPayload) => void;
};

const EMPTY_PACKAGE: PackageInfo = {
    type: null,
    size: null,
    weight: null,
    protection: 'silver',
    receiveCode: false,
};

// TODO: ganti dengan data user asli dari auth/context
const MY_CONTACT: ContactInfo = { name: 'Nasrul', phone: '82323907426' };
const RECENT_ADDRESSES: PlaceLoc[] = [];
const POLL_INTERVAL = 3000;
const FALLBACK_COORDS = { latitude: -7.0185, longitude: 109.7778 };

// Auto-retry lokasi saat status 'error' (selama itu user melihat shimmer)
const MAX_LOCATION_RETRIES = 3;
const LOCATION_RETRY_DELAY = 2000;

export default function GoSendFlow({ onExit, onOrder }: Props) {
    const location = useUserLocation();
    const { alertState, showAlert, hideAlert } = useAppAlert();

    // ============================================================
    // Guard global dari context (bukan ref per-mount)
    // ============================================================
    const {
        activeOrderId,
        setActiveOrder,
        bootingOrderId,
        setBootingOrderId,
        bootedOrderId,
        setBootedOrderId,
    } = useOrder();

    // ---- Data lokasi & step ----
    const [origin, setOrigin] = useState<PlaceLoc | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState(false);
    const [locationRetry, setLocationRetry] = useState(0);
    const originEdited = useRef(false);

    const [step, setStep] = useState<Step>('home');
    const [destination, setDestination] = useState<PlaceLoc | null>(null);
    const [sender, setSender] = useState<ContactInfo | null>(null);
    const [receiver, setReceiver] = useState<ContactInfo | null>(null);
    const [packageInfo, setPackageInfo] = useState<PackageInfo>(EMPTY_PACKAGE);

    // ⬇️ BARU: field mana yang sedang di-edit di SearchAddressStep / PickOnMapStep
    const [focusField, setFocusField] = useState<SearchField>('destination');

    // ---- Order & driver ----
    const [orderId, setOrderId] = useState<number | null>(null);
    const [driver, setDriver] = useState<DriverInfo | null>(null);
    const [driverStatus, setDriverStatus] = useState<DriverStatus>('searching');
    const [orderPayload, setOrderPayload] = useState<GoSendOrder | null>(null);
    const [selectedOption, setSelectedOption] =
        useState<GoSendCourierOption | null>(null);

    // securityCode dari backend, bukan random
    const [securityCode, setSecurityCode] = useState<string | null>(null);

    // ---- Booting dari notifikasi ----
    const [bootingFromNotif, setBootingFromNotif] = useState(false);

    // ---- Refs ----
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stepRef = useRef<Step>('home');
    stepRef.current = step;

    // ============================================================
    // GPS -> reverse geocode (asal otomatis)
    // ============================================================
    useEffect(() => {
        if (bootingFromNotif) return;
        if (orderId) return;
        if (location.status !== 'granted' || !location.coords) return;
        if (originEdited.current) return;

        const coords = location.coords;

        let alive = true;
        setGeocoding(true);
        setGeocodeError(false);

        reverseGeocode(coords)
            .then(({ name, address }) => {
                if (!alive || originEdited.current) return;
                setOrigin({ name, address, coords, isCurrent: true });
            })
            .catch(() => {
                if (alive) setGeocodeError(true);
            })
            .finally(() => {
                if (alive) setGeocoding(false);
            });

        return () => {
            alive = false;
        };
    }, [location.status, location.coords, bootingFromNotif, orderId]);

    // ============================================================
    // Auto-retry lokasi saat status 'error' (maks MAX_LOCATION_RETRIES)
    // ============================================================
    useEffect(() => {
        if (origin) {
            if (locationRetry !== 0) setLocationRetry(0);
            return;
        }
        if (location.status !== 'error') return;
        if (locationRetry >= MAX_LOCATION_RETRIES) return;

        const t = setTimeout(() => {
            setLocationRetry((n) => n + 1);
            location.refresh();
        }, LOCATION_RETRY_DELAY);

        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [origin, location.status, locationRetry]);

    // ============================================================
    // BOOT dari notifikasi — pakai guard dari context
    // ============================================================
    useEffect(() => {
        if (!activeOrderId) return;
        if (bootedOrderId === activeOrderId) return;
        if (bootingOrderId === activeOrderId) return;
        if (bootingOrderId !== null) return;

        const boot = async () => {
            setBootingOrderId(activeOrderId);
            setBootingFromNotif(true);
            console.log(
                '[GOSENDFLOW] Boot dari notif, order id:',
                activeOrderId
            );

            try {
                const order: OrderResponse = await api.getOrder(activeOrderId);
                console.log(
                    '[GOSENDFLOW] Order dari notif:',
                    order.status,
                    order.type
                );

                const pickupCoords = order.pickup_coords ?? FALLBACK_COORDS;
                const dropoffCoords = order.dropoff_coords ?? FALLBACK_COORDS;

                // mapping packageInfo dari backend (bukan EMPTY_PACKAGE)
                const bootPackageInfo: PackageInfo = {
                    type: order.package_type ?? null,
                    size: (order.package_size as any) ?? null,
                    weight: order.package_weight ?? null,
                    protection:
                        (order.package_protection as any) ?? 'silver',
                    receiveCode: !!order.send_code,
                };

                // mapping sender/receiver dari backend
                const bootSender: ContactInfo | null = order.sender_phone
                    ? {
                        name: order.sender_name ?? '',
                        phone: order.sender_phone,
                        landmark: order.sender_landmark ?? undefined,
                    }
                    : null;

                const bootReceiver: ContactInfo | null = order.receiver_name
                    ? {
                        name: order.receiver_name,
                        phone: order.receiver_phone ?? '',
                        landmark: order.receiver_landmark ?? undefined,
                    }
                    : null;

                const payload: GoSendOrder = {
                    origin: {
                        name: order.pickup_name ?? '',
                        address: order.pickup_address ?? '',
                        coords: pickupCoords,
                    },
                    destination: {
                        name: order.dropoff_name ?? '',
                        address: order.dropoff_address ?? '',
                        coords: dropoffCoords,
                    },
                    option: {
                        id: order.tariff_code ?? '',
                        name: order.option_name ?? '',
                        eta: '',
                        price: order.total_fare ?? 0,
                    },
                    packageInfo: bootPackageInfo,
                    sender: bootSender,
                    receiver: bootReceiver,
                };

                setOrderPayload(payload);
                setOrderId(activeOrderId);
                setOrigin(payload.origin);
                setDestination(payload.destination);
                setPackageInfo(bootPackageInfo);
                setSender(bootSender);
                setReceiver(bootReceiver);
                originEdited.current = true;

                // securityCode dari backend
                setSecurityCode(order.send_code ?? null);

                // set selectedOption biar summary ada price
                setSelectedOption({
                    id: order.tariff_code ?? '',
                    name: order.option_name ?? '',
                    eta: '',
                    price: order.total_fare ?? 0,
                });

                if (order.driver) {
                    setDriver(toUIDriver(order.driver));
                    setDriverStatus(
                        orderStatusToDriverStatus(order.status)
                    );
                }

                // Peta step
                switch (order.status) {
                    case 'pending':
                        setStep('searching-driver');
                        startPolling(activeOrderId);
                        break;
                    case 'accepted':
                    case 'arrived': // arrived = driver di pickup, TETAP di driver-found
                        setStep('driver-found');
                        startPolling(activeOrderId);
                        break;
                    case 'in_progress': // hanya in_progress yang pindah ke on-trip
                        setStep('on-trip');
                        startPolling(activeOrderId);
                        break;
                    case 'completed':
                        setStep('summary');
                        break;
                    case 'cancelled':
                        setStep('home');
                        break;
                    default:
                        setStep('home');
                }

                setBootedOrderId(activeOrderId);
                console.log(
                    '[GOSENDFLOW] Boot selesai, status:',
                    order.status
                );
            } catch (err: any) {
                console.error(
                    '[GOSENDFLOW] Gagal boot dari notif:',
                    err.message
                );
                showAlert(
                    'Gagal Buka Order',
                    err.message || 'Coba buka manual.'
                );
            } finally {
                setBootingFromNotif(false);
                setBootingOrderId(null);
            }
        };

        boot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeOrderId, bootedOrderId, bootingOrderId]);

    // ---- Clear activeOrderId setelah boot selesai ----
    useEffect(() => {
        if (bootingFromNotif) return;
        if (!activeOrderId) return;
        const t = setTimeout(() => setActiveOrder(null), 800);
        return () => clearTimeout(t);
    }, [bootingFromNotif, activeOrderId, setActiveOrder]);

    // ---- Reset bootedOrderId setelah 30 detik ----
    useEffect(() => {
        if (!bootedOrderId) return;
        const t = setTimeout(() => setBootedOrderId(null), 30000);
        return () => clearTimeout(t);
    }, [bootedOrderId, setBootedOrderId]);

    // ============================================================
    // Polling terpusat
    // ============================================================
    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const startPolling = (id: number) => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const order = await api.getOrder(id);
                console.log('[GOSENDFLOW] Polling:', order.status, {
                    driver_name: order.driver?.full_name,
                });

                // ---- Driver accepted / arrived / in_progress ----
                if (
                    order.driver &&
                    (order.status === 'accepted' ||
                        order.status === 'arrived' ||
                        order.status === 'in_progress')
                ) {
                    setDriver(toUIDriver(order.driver));
                    setDriverStatus(
                        orderStatusToDriverStatus(order.status)
                    );

                    if (stepRef.current === 'searching-driver') {
                        setStep('driver-found');
                    }
                }

                // ---- in_progress -> on-trip ----
                if (
                    order.status === 'in_progress' &&
                    stepRef.current === 'driver-found'
                ) {
                    setStep('on-trip');
                }

                // ---- completed ----
                if (
                    order.status === 'completed' &&
                    stepRef.current === 'on-trip'
                ) {
                    stopPolling();
                    setStep('summary');
                }

                // ---- cancelled ----
                if (order.status === 'cancelled') {
                    stopPolling();
                    showAlert(
                        'Pesanan dibatalkan',
                        order.cancellation_reason ??
                        'Tidak ada driver yang menerima.'
                    );
                    setOrderId(null);
                    setDriver(null);
                    setStep('delivery-detail');
                }
            } catch (err: any) {
                console.warn('[GOSENDFLOW] Polling error:', err.message);
            }
        }, POLL_INTERVAL);
    };

    useEffect(() => () => stopPolling(), []);

    // ============================================================
    // BackHandler Android
    // ============================================================
    useEffect(() => {
        const back: Record<Step, Step | null> = {
            home: null,
            'search-destination': 'home',
            'pick-map': 'search-destination',
            'delivery-detail': 'home',
            'pickup-form': 'delivery-detail',
            'dropoff-form': 'pickup-form',
            'package-options': 'dropoff-form',
            'package-size': 'delivery-detail',
            'searching-driver': 'delivery-detail',
            'driver-found': null,
            'on-trip': null,
            summary: null,
        };
        const sub = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                if (step === 'driver-found') {
                    confirmCancel();
                    return true;
                }
                if (step === 'on-trip' || step === 'summary') return true;
                const prev = back[step];
                if (prev) setStep(prev);
                else onExit();
                return true;
            }
        );
        return () => sub.remove();
    }, [step, onExit]);

    // ============================================================
    // Handlers
    // ============================================================
    const handleSwap = () => {
        if (!destination || !origin) return;
        setOrigin(destination);
        setDestination(origin);
    };

    const handlePackageContinue = (
        type: string,
        protection: ProtectionType
    ) => {
        setPackageInfo((p) => ({ ...p, type, protection }));
        setStep('delivery-detail');
    };

    const confirmCancel = () => {
        showAlert(
            'Batalkan pesanan?',
            'Driver sudah dalam perjalanan ke lokasi jemputmu.',
            [
                { text: 'Tidak', style: 'cancel' },
                {
                    text: 'Ya, batalkan',
                    style: 'destructive',
                    onPress: async () => {
                        if (orderId) {
                            try {
                                await api.updateOrderStatus(
                                    orderId,
                                    'cancelled',
                                    'Dibatalkan oleh customer'
                                );
                            } catch (err: any) {
                                console.warn(
                                    '[GOSENDFLOW] Gagal cancel:',
                                    err.message
                                );
                            }
                        }
                        stopPolling();
                        setDriver(null);
                        setDriverStatus('searching');
                        setOrderId(null);
                        setStep('delivery-detail');
                    },
                },
            ]
        );
    };

    const openChat = async () => {
        if (!orderId) {
            showAlert('Gagal Buka Chat', 'Order belum siap');
            return;
        }
        try {
            const room = await api.chat.openRoom(orderId);
            router.push(
                `/chat/${room.id}?peerName=${encodeURIComponent(
                    driver?.name ?? 'Driver'
                )}` as any
            );
        } catch (err: any) {
            showAlert('Gagal Buka Chat', err.message || 'Coba lagi.');
        }
    };

    /**
     * Booking: kirim order ke backend, simpan orderId, mulai polling.
     */
    const handleBook = async (option: GoSendCourierOption) => {
        if (!destination || !origin) return;

        const payload: GoSendOrder = {
            origin,
            destination,
            option,
            packageInfo,
            sender,
            receiver,
        };

        setSelectedOption(option);
        setOrderPayload(payload);
        setStep('searching-driver');
        setDriverStatus('searching');
        onOrder(payload);

        try {
            const order: OrderResponse = await api.createOrder({
                type: 'send',
                pickup_name: origin.name,
                pickup_address: origin.address,
                pickup_lat: origin.coords.latitude,
                pickup_lng: origin.coords.longitude,
                dropoff_name: destination.name,
                dropoff_address: destination.address,
                dropoff_lat: destination.coords.latitude,
                dropoff_lng: destination.coords.longitude,
                distance_km: 3, // TODO: pakai getRoute()
                duration_min: 10,
                payment_method: 'cash',
                tariff_code: option.id,
                option_name: option.name,
                receiver_name: receiver?.name,
                receiver_phone: receiver?.phone,
                sender_name: sender?.name,
                sender_phone: sender?.phone,
                sender_landmark: sender?.landmark ?? undefined,
                receiver_landmark: receiver?.landmark ?? undefined,

                // kirim info paket ke backend
                package_type: packageInfo.type ?? undefined,
                package_size: packageInfo.size ?? undefined,
                package_weight: packageInfo.weight ?? undefined,
                package_protection: packageInfo.protection ?? undefined,
            });

            console.log('[GOSENDFLOW] Order created:', {
                id: order.id,
                tariff_code: order.tariff_code,
                send_code: order.send_code,
                delivery_fee: order.delivery_fee,
                package_type: order.package_type,
                package_size: order.package_size,
            });

            setOrderId(order.id);

            // securityCode dari backend
            setSecurityCode(order.send_code ?? null);

            startPolling(order.id);

            // Kalau backend sudah langsung assign driver
            if (order.driver) {
                setDriver(toUIDriver(order.driver));
                setDriverStatus(
                    orderStatusToDriverStatus(order.status)
                );
                setStep('driver-found');
            }
        } catch (err: any) {
            showAlert(
                'Gagal membuat pesanan',
                err.message || 'Coba lagi.'
            );
            setStep('delivery-detail');
        }
    };

    /**
     * Selesai lihat ringkasan (rating / skip) -> reset & kembali ke home.
     */
    const finishDelivery = () => {
        stopPolling();
        setOrderPayload(null);
        setOrderId(null);
        setDriver(null);
        setDriverStatus('searching');
        setDestination(null);
        setSender(null);
        setReceiver(null);
        setPackageInfo(EMPTY_PACKAGE);
        setSelectedOption(null);
        setSecurityCode(null);
        setStep('home');
    };

    // ============================================================
    // Loading saat boot dari notif
    // ============================================================
    if (bootingFromNotif) {
        return (
            <View style={s.bootCenter}>
                <ActivityIndicator size="large" color={colors.primary} />

            </View>
        );
    }

    // ============================================================
    // Origin belum siap
    // ============================================================
    if (!origin) {
        // 1) Gagal reverse geocode -> kasih tombol coba lagi
        if (location.status === 'granted' && geocodeError && !geocoding) {
            return (
                <View style={s.center}>
                    <Text style={s.hint}>
                        Gagal mendapatkan alamat lokasimu.
                    </Text>
                    <Text
                        style={s.action}
                        onPress={() => {
                            setGeocodeError(false);
                            location.refresh();
                        }}
                    >
                        Coba lagi
                    </Text>
                </View>
            );
        }

        // 2) Masalah izin / GPS -> user harus bertindak, pesan tetap ditampilkan
        const PERMISSION_MESSAGES: Record<string, string> = {
            denied: 'Izinkan akses lokasi supaya kami bisa menentukan titik pengambilan paketmu.',
            blocked:
                'Akses lokasi dimatikan. Aktifkan lewat pengaturan aplikasi.',
            'services-off':
                'GPS di HP kamu mati. Nyalakan dulu, lalu coba lagi.',
        };

        const permissionMessage = PERMISSION_MESSAGES[location.status];

        if (permissionMessage) {
            return (
                <View style={s.center}>
                    <Text style={s.hint}>{permissionMessage}</Text>
                    <Text
                        style={s.action}
                        onPress={
                            location.status === 'blocked'
                                ? location.openSettings
                                : location.refresh
                        }
                    >
                        {location.status === 'blocked'
                            ? 'Buka pengaturan'
                            : 'Coba lagi'}
                    </Text>
                </View>
            );
        }

        // 3) Error lokasi & auto-retry sudah habis -> baru tampilkan pesan
        if (
            location.status === 'error' &&
            locationRetry >= MAX_LOCATION_RETRIES
        ) {
            return (
                <View style={s.center}>
                    <Text style={s.hint}>
                        Belum bisa mendapatkan lokasimu.
                    </Text>
                    <Text
                        style={s.action}
                        onPress={() => {
                            setLocationRetry(0);
                            location.refresh();
                        }}
                    >
                        Coba lagi
                    </Text>
                </View>
            );
        }

        // 4) Semua status lain (loading / error sedang retry / geocoding) -> shimmer
        return (
            <HomeStep
                origin={null}
                destination={null}
                onBack={onExit}
                onPressDestination={() => { }}
                onSwap={() => { }}
                onEditOrigin={() => { }}
            />
        );
    }

    // ============================================================
    // Render step
    // ============================================================
    let content: React.ReactNode = null;

    switch (step) {
        case 'home':
            content = (
                <HomeStep
                    origin={origin}
                    destination={destination}
                    onBack={onExit}
                    onPressDestination={() => {
                        setFocusField('destination');
                        setStep('search-destination');
                    }}
                    onSwap={handleSwap}
                    onEditOrigin={() => {
                        setFocusField('origin');
                        setStep('search-destination');
                    }}
                />
            );
            break;

        case 'search-destination':
            content = (
                <SearchAddressStep
                    origin={origin}
                    destination={destination}
                    onBack={() =>
                        setStep(destination ? 'delivery-detail' : 'home')
                    }
                    onSwap={handleSwap}
                    onPickOnMap={(field) => {
                        // ⬇️ Tentukan field mana yang akan diedit
                        setFocusField(field);
                        setStep('pick-map');
                    }}
                    recentAddresses={RECENT_ADDRESSES}
                    onSelectOrigin={(place) => {
                        // ⬇️ Edit origin
                        originEdited.current = true;
                        setOrigin(place);
                    }}
                    onSelectDestination={(place) => {
                        setDestination(place);
                        setStep('delivery-detail');
                    }}
                />
            );
            break;

        case 'delivery-detail':
            if (!destination) break;
            content = (
                <DeliveryDetailStep
                    origin={origin}
                    destination={destination}
                    sender={sender}
                    receiver={receiver}
                    packageInfo={packageInfo}
                    onBack={() => setStep('home')}
                    onPressPickupCard={() => setStep('pickup-form')}
                    onPressDropoffCard={() => setStep('dropoff-form')}
                    onPressAddDetail={() => setStep('pickup-form')}
                    onChangePackageType={(type) =>
                        setPackageInfo((p) => ({ ...p, type }))
                    }
                    onPressPackageSize={() => setStep('package-size')}
                    onToggleReceiveCode={(value) =>
                        setPackageInfo((p) => ({
                            ...p,
                            receiveCode: value,
                        }))
                    }
                    onBook={handleBook}
                />
            );
            break;

        case 'pickup-form':
            content = (
                <ContactFormStep
                    mode="pickup"
                    place={origin}
                    initialContact={sender}
                    myContact={MY_CONTACT}
                    onBack={() => setStep('delivery-detail')}
                    onEditAddress={() => {
                        setFocusField('origin');
                        setStep('search-destination');
                    }}
                    onSubmit={(contact) => {
                        setSender(contact);
                        setStep('dropoff-form');
                    }}
                />
            );
            break;

        case 'dropoff-form':
            if (!destination) break;
            content = (
                <ContactFormStep
                    mode="dropoff"
                    place={destination}
                    initialContact={receiver}
                    myContact={MY_CONTACT}
                    onBack={() => setStep('pickup-form')}
                    onEditAddress={() => {
                        setFocusField('destination');
                        setStep('search-destination');
                    }}
                    onSubmit={(contact) => {
                        setReceiver(contact);
                        setStep('package-options');
                    }}
                />
            );
            break;

        case 'package-options':
            content = (
                <PackageOptionsStep
                    initialType={packageInfo.type}
                    onBack={() => setStep('dropoff-form')}
                    onContinue={handlePackageContinue}
                />
            );
            break;

        case 'package-size':
            content = (
                <PackageSizeStep
                    onBack={() => setStep('delivery-detail')}
                    onSave={(size, weight) => {
                        setPackageInfo((p) => ({ ...p, size, weight }));
                        setStep('delivery-detail');
                    }}
                />
            );
            break;

        case 'searching-driver':
            if (!destination) break;
            content = (
                <SearchingDriverStep
                    origin={origin}
                    onBack={() => {
                        stopPolling();
                        setOrderId(null);
                        setStep('delivery-detail');
                    }}
                    onCancelConfirmed={async () => {
                        if (orderId) {
                            try {
                                await api.updateOrderStatus(
                                    orderId,
                                    'cancelled',
                                    'user_cancel'
                                );
                            } catch (e) {
                                console.warn(
                                    '[GOSENDFLOW] Cancel gagal:',
                                    e
                                );
                            }
                        }
                        stopPolling();
                        setOrderId(null);
                        setStep('delivery-detail');
                    }}
                    onDriverFound={() => {
                        // no-op: pindah step ditentukan polling
                    }}
                />
            );
            break;

        case 'driver-found':
            if (!driver || !orderPayload) break;
            content = (
                <DriverFoundStep
                    order={orderPayload}
                    driver={driver}
                    status={driverStatus}
                    securityCode={
                        packageInfo.receiveCode ? securityCode : null
                    }
                    onBack={confirmCancel}
                    onCancel={confirmCancel}
                    onCall={() =>
                        console.log('[GOSENDFLOW] Call driver')
                    }
                    onChat={openChat}
                    onArrived={() => {
                        // JANGAN pindah step.
                        // Driver "sampai" hanya status tampilan; pindah ke on-trip
                        // tetap menunggu polling deteksi 'in_progress'.
                        console.log(
                            '[GOSENDFLOW] Driver tiba di pickup (nunggu driver ambil paket)'
                        );
                    }}
                />
            );
            break;

        case 'on-trip':
            if (!driver || !destination) break;
            content = (
                <OnTripStep
                    origin={origin}
                    destination={destination}
                    driver={driver}
                    securityCode={securityCode ?? undefined}
                    receiveCode={packageInfo.receiveCode}
                    onBack={() => { }}
                    onArrived={() => {
                        // JANGAN pindah step.
                        // Pindah ke summary hanya saat polling dapat status 'completed'.
                        console.log(
                            '[GOSENDFLOW] OnTrip simulasi selesai (nunggu backend)'
                        );
                    }}
                    onCall={() =>
                        console.log('[GOSENDFLOW] Call driver')
                    }
                    onChat={openChat}
                />
            );
            break;

        case 'summary':
            if (!driver || !destination) break;
            content = (
                <TripSummaryStep
                    origin={origin}
                    destination={destination}
                    driver={driver}
                    packageInfo={packageInfo}
                    price={selectedOption?.price}
                    onSubmit={async (rating, message, tags) => {
                        if (orderId) {
                            try {
                                await api.submitRating({
                                    orderId,
                                    rating,
                                    comment: message,
                                    tags,
                                });
                            } catch (err: any) {
                                console.warn(
                                    '[GOSENDFLOW] Gagal simpan rating:',
                                    err.message
                                );
                            }
                        }
                        finishDelivery();
                    }}
                    onSkip={finishDelivery}
                />
            );
            break;

        case 'pick-map':
            content = (
                <PickOnMapStep
                    // ⬇️ Tentukan koordinat awal berdasarkan field yang sedang di-edit
                    initialCoords={
                        focusField === 'origin'
                            ? origin.coords
                            : destination?.coords ?? origin.coords
                    }
                    onBack={() => setStep('search-destination')}
                    onConfirm={(place) => {
                        // ⬇️ Update field yang sesuai
                        if (focusField === 'origin') {
                            originEdited.current = true;
                            setOrigin(place);
                            // Kalau destination sudah ada, langsung ke detail
                            // Kalau belum, balik ke search untuk pilih destination
                            setStep(
                                destination
                                    ? 'delivery-detail'
                                    : 'search-destination'
                            );
                        } else {
                            setDestination(place);
                            setStep('delivery-detail');
                        }
                    }}
                />
            );
            break;

        default:
            content = null;
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View key={step} style={{ flex: 1 }}>
                {content}
            </View>

            <AppAlert
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={hideAlert}
            />
        </View>
    );
}

const s = {
    center: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        paddingHorizontal: 32,
        gap: 16,
        backgroundColor: '#fff',
    },
    hint: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center' as const,
        lineHeight: 20,
    },
    action: {
        fontSize: 14,
        fontWeight: '700' as const,
        color: colors.primary,
    },
    bootCenter: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        gap: 12,
    },
    bootText: {
        color: colors.textMuted,
        fontSize: 13,
    },
};