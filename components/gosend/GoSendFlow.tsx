import AppAlert from '@/components/AppAlert';
import { colors } from '@/constants/ojek-theme';
import { useOrder } from '@/contexts/OrderContext';
import { useAppAlert } from '@/hooks/use-app-alert';
import { useUserLocation } from '@/hooks/use-user-location';
import { api, OrderResponse } from '@/lib/api';
import { orderStatusToDriverStatus, toUIDriver } from '@/lib/driver-adapter';
import { getRoute, reverseGeocode } from '@/services/google-maps';
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

type Step = GoSendStep;

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

const MAX_LOCATION_RETRIES = 3;
const LOCATION_RETRY_DELAY = 2000;

export default function GoSendFlow({ onExit, onOrder }: Props) {
    const location = useUserLocation();
    const { alertState, showAlert, hideAlert } = useAppAlert();

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
    const [focusField, setFocusField] = useState<SearchField>('destination');

    // ---- Order & driver ----
    const [orderId, setOrderId] = useState<number | null>(null);
    const [driver, setDriver] = useState<DriverInfo | null>(null);
    const [driverStatus, setDriverStatus] = useState<DriverStatus>('searching');
    const [orderPayload, setOrderPayload] = useState<GoSendOrder | null>(null);
    const [selectedOption, setSelectedOption] =
        useState<GoSendCourierOption | null>(null);
    const [securityCode, setSecurityCode] = useState<string | null>(null);

    const [bootingFromNotif, setBootingFromNotif] = useState(false);

    // ---- Refs ----
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollTokenRef = useRef(0); // ✅ FIX: cegah hasil request lama menimpa state
    const inFlightRef = useRef(false); // ✅ FIX: cegah polling tumpang tindih
    const stepRef = useRef<Step>('home');
    stepRef.current = step;
    // ✅ FIX: ref agar fungsi batal tidak memakai closure lama
    const orderIdRef = useRef<number | null>(null);
    orderIdRef.current = orderId;
    // ✅ FIX: user batal saat createOrder masih berjalan
    const cancelPendingRef = useRef(false);
    const bookingRef = useRef(false);

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
    // Auto-retry lokasi saat status 'error'
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
    // Polling terpusat
    // ============================================================
    const stopPolling = () => {
        pollTokenRef.current += 1;
        inFlightRef.current = false;
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    /**
     * ✅ FIX: perbarui driver tanpa membuat objek baru tiap tick.
     * Kalau driver sama, hanya koordinat yang diganti (dan hanya bila berubah),
     * supaya marker di OnTripStep bergerak halus dan tidak re-render sia-sia.
     */
    const applyDriver = (apiDriver: NonNullable<OrderResponse['driver']>) => {
        const next = toUIDriver(apiDriver);
        setDriver((prev) => {
            if (!prev || prev.id !== next.id) return next;
            const c = next.coords;
            if (
                !c ||
                (prev.coords?.latitude === c.latitude &&
                    prev.coords?.longitude === c.longitude)
            ) {
                return prev;
            }
            return { ...prev, coords: c };
        });
    };

    const startPolling = (id: number) => {
        stopPolling();
        const token = pollTokenRef.current;

        pollRef.current = setInterval(async () => {
            if (inFlightRef.current) return;
            inFlightRef.current = true;

            try {
                const order = await api.getOrder(id);
                if (token !== pollTokenRef.current) return;

                const cur = stepRef.current;

                // Perbarui driver untuk semua status yang punya driver
                if (
                    order.driver &&
                    (order.status === 'accepted' ||
                        order.status === 'arrived' ||
                        order.status === 'in_progress' ||
                        order.status === 'completed')
                ) {
                    applyDriver(order.driver);
                    setDriverStatus(orderStatusToDriverStatus(order.status));
                }

                switch (order.status) {
                    case 'accepted':
                    case 'arrived':
                        if (cur === 'searching-driver') setStep('driver-found');
                        break;

                    case 'in_progress':
                        if (
                            cur === 'searching-driver' ||
                            cur === 'driver-found'
                        ) {
                            setStep('on-trip');
                        }
                        break;

                    case 'completed':
                        if (
                            cur === 'searching-driver' ||
                            cur === 'driver-found' ||
                            cur === 'on-trip'
                        ) {
                            stopPolling();
                            setStep('summary');
                        }
                        break;

                    case 'cancelled':
                        stopPolling();
                        showAlert(
                            'Pesanan dibatalkan',
                            order.cancellation_reason ??
                            'Tidak ada driver yang menerima.'
                        );
                        setOrderId(null);
                        setDriver(null);
                        setDriverStatus('searching');
                        setStep('delivery-detail');
                        break;
                }
            } catch (err: any) {
                console.warn('[GOSENDFLOW] Polling error:', err.message);
            } finally {
                if (token === pollTokenRef.current) inFlightRef.current = false;
            }
        }, POLL_INTERVAL);
    };

    useEffect(() => () => stopPolling(), []);

    // ============================================================
    // BOOT dari notifikasi
    // ============================================================
    useEffect(() => {
        if (!activeOrderId) return;
        if (bootedOrderId === activeOrderId) return;
        if (bootingOrderId === activeOrderId) return;
        if (bootingOrderId !== null) return;

        const bootId = activeOrderId;

        const boot = async () => {
            setBootingOrderId(bootId);
            setBootingFromNotif(true);
            console.log('[GOSENDFLOW] Boot dari notif, order id:', bootId);

            try {
                const order: OrderResponse = await api.getOrder(bootId);
                console.log(
                    '[GOSENDFLOW] Order dari notif:',
                    order.status,
                    order.type
                );

                const pickupCoords = order.pickup_coords ?? FALLBACK_COORDS;
                const dropoffCoords = order.dropoff_coords ?? FALLBACK_COORDS;

                const bootPackageInfo: PackageInfo = {
                    type: order.package_type ?? null,
                    size: (order.package_size as any) ?? null,
                    weight: order.package_weight ?? null,
                    protection: (order.package_protection as any) ?? 'silver',
                    receiveCode: !!order.send_code,
                };

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

                const bootOption: GoSendCourierOption = {
                    id: order.tariff_code ?? '',
                    name: order.option_name ?? '',
                    eta: '',
                    price: order.total_fare ?? 0,
                };

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
                    option: bootOption,
                    packageInfo: bootPackageInfo,
                    sender: bootSender,
                    receiver: bootReceiver,
                };

                // ✅ FIX: order selesai/batal tidak perlu memuat state penuh
                if (order.status === 'cancelled') {
                    setStep('home');
                    setBootedOrderId(bootId);
                    return;
                }

                setOrderPayload(payload);
                setOrderId(bootId);
                setOrigin(payload.origin);
                setDestination(payload.destination);
                setPackageInfo(bootPackageInfo);
                setSender(bootSender);
                setReceiver(bootReceiver);
                setSelectedOption(bootOption);
                setSecurityCode(order.send_code ?? null);
                originEdited.current = true;

                if (order.driver) {
                    setDriver(toUIDriver(order.driver));
                    setDriverStatus(orderStatusToDriverStatus(order.status));
                }

                switch (order.status) {
                    case 'pending':
                        setStep('searching-driver');
                        startPolling(bootId);
                        break;
                    case 'accepted':
                    case 'arrived':
                        setStep('driver-found');
                        startPolling(bootId);
                        break;
                    case 'in_progress':
                        setStep('on-trip');
                        startPolling(bootId);
                        break;
                    case 'completed':
                        setStep('summary');
                        break;
                    default:
                        setStep('home');
                }

                setBootedOrderId(bootId);
                console.log('[GOSENDFLOW] Boot selesai, status:', order.status);
            } catch (err: any) {
                console.error('[GOSENDFLOW] Gagal boot dari notif:', err.message);
                showAlert('Gagal Buka Order', err.message || 'Coba buka manual.');
                // ✅ FIX: tandai sudah dicoba & hentikan trigger agar tidak looping
                setBootedOrderId(bootId);
                setActiveOrder(null);
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
    // ✅ FIX: pengaman, data step belum lengkap → jangan layar putih
    // ============================================================
    useEffect(() => {
        if (bootingFromNotif || !origin) return;

        const missing =
            (['delivery-detail', 'dropoff-form', 'searching-driver', 'on-trip', 'summary'].includes(step) &&
                !destination) ||
            (step === 'driver-found' && (!driver || !orderPayload)) ||
            ((step === 'on-trip' || step === 'summary') && !driver);

        if (missing) {
            console.warn('[GOSENDFLOW] Data step', step, 'belum lengkap → home');
            stopPolling();
            setStep('home');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, origin, destination, driver, orderPayload, bootingFromNotif]);

    // ============================================================
    // Pembatalan
    // ============================================================
    const resetOrderState = () => {
        setDriver(null);
        setDriverStatus('searching');
        setOrderId(null);
        setStep('delivery-detail');
    };

    /** Batalkan order di server (aman dipanggil walau orderId belum ada) */
    const cancelOrderOnServer = async (reason: string) => {
        const id = orderIdRef.current;
        if (!id) {
            // createOrder masih berjalan: batalkan begitu order terbentuk
            if (bookingRef.current) cancelPendingRef.current = true;
            return;
        }
        try {
            await api.updateOrderStatus(id, 'cancelled', reason);
        } catch (err: any) {
            console.warn('[GOSENDFLOW] Gagal cancel:', err.message);
        }
    };

    // Dipakai tombol "Batalkan pengiriman" di SearchingDriverStep (sudah ada konfirmasi sendiri)
    const doCancelSearching = async () => {
        stopPolling();
        await cancelOrderOnServer('user_cancel');
        resetOrderState();
    };

    // ✅ FIX: tombol back / hardware back saat mencari driver → konfirmasi + batalkan di server
    const askCancelSearching = () => {
        showAlert(
            'Batalkan pencarian?',
            'Pesananmu akan dibatalkan dan kamu kembali ke detail pengiriman.',
            [
                { text: 'Tidak', style: 'cancel' },
                {
                    text: 'Ya, batalkan',
                    style: 'destructive',
                    onPress: doCancelSearching,
                },
            ]
        );
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
                        stopPolling();
                        await cancelOrderOnServer('Dibatalkan oleh customer');
                        resetOrderState();
                    },
                },
            ]
        );
    };

    // ✅ FIX: simpan versi terbaru di ref agar back handler tidak basi
    const confirmCancelRef = useRef(confirmCancel);
    confirmCancelRef.current = confirmCancel;
    const askCancelSearchingRef = useRef(askCancelSearching);
    askCancelSearchingRef.current = askCancelSearching;

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
            'searching-driver': null, // ditangani khusus di bawah
            'driver-found': null,
            'on-trip': null,
            summary: null,
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step === 'searching-driver') {
                askCancelSearchingRef.current();
                return true;
            }
            if (step === 'driver-found') {
                confirmCancelRef.current();
                return true;
            }
            if (step === 'on-trip' || step === 'summary') return true;
            const prev = back[step];
            if (prev) setStep(prev);
            else onExit();
            return true;
        });
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

    const handlePackageContinue = (type: string, protection: ProtectionType) => {
        setPackageInfo((p) => ({ ...p, type, protection }));
        setStep('delivery-detail');
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
     * Booking: hitung jarak asli, kirim order, simpan orderId, mulai polling.
     */
    const handleBook = async (option: GoSendCourierOption) => {
        if (!destination || !origin) return;
        if (bookingRef.current) return; // ✅ FIX: cegah tap ganda

        bookingRef.current = true;
        cancelPendingRef.current = false;

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
            // ✅ FIX: jarak & durasi dari rute asli (sebelumnya hardcode 3 km)
            let distanceKm = 3;
            let durationMin = 10;
            try {
                const r = await getRoute(origin.coords, destination.coords);
                if (r?.distanceMeters > 0) {
                    distanceKm = r.distanceMeters / 1000;
                    durationMin = Math.max(1, Math.ceil(r.durationSec / 60));
                }
            } catch (err: any) {
                console.warn('[GOSENDFLOW] getRoute gagal, pakai default:', err?.message);
            }

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
                distance_km: distanceKm,
                duration_min: durationMin,
                payment_method: 'cash',
                tariff_code: option.id,
                option_name: option.name,
                receiver_name: receiver?.name,
                receiver_phone: receiver?.phone,
                sender_name: sender?.name,
                sender_phone: sender?.phone,
                sender_landmark: sender?.landmark ?? undefined,
                receiver_landmark: receiver?.landmark ?? undefined,
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
            });

            // ✅ FIX: user sudah batal selagi order dibuat → batalkan di server
            if (cancelPendingRef.current) {
                cancelPendingRef.current = false;
                try {
                    await api.updateOrderStatus(order.id, 'cancelled', 'user_cancel');
                } catch (err: any) {
                    console.warn('[GOSENDFLOW] Gagal cancel order baru:', err.message);
                }
                return;
            }

            setOrderId(order.id);
            setSecurityCode(order.send_code ?? null);
            startPolling(order.id);

            if (order.driver) {
                setDriver(toUIDriver(order.driver));
                setDriverStatus(orderStatusToDriverStatus(order.status));
                setStep('driver-found');
            }
        } catch (err: any) {
            showAlert('Gagal membuat pesanan', err.message || 'Coba lagi.');
            setStep('delivery-detail');
        } finally {
            bookingRef.current = false;
        }
    };

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
        if (location.status === 'granted' && geocodeError && !geocoding) {
            return (
                <View style={s.center}>
                    <Text style={s.hint}>Gagal mendapatkan alamat lokasimu.</Text>
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

        const PERMISSION_MESSAGES: Record<string, string> = {
            denied:
                'Izinkan akses lokasi supaya kami bisa menentukan titik pengambilan paketmu.',
            blocked: 'Akses lokasi dimatikan. Aktifkan lewat pengaturan aplikasi.',
            'services-off': 'GPS di HP kamu mati. Nyalakan dulu, lalu coba lagi.',
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
                        {location.status === 'blocked' ? 'Buka pengaturan' : 'Coba lagi'}
                    </Text>
                </View>
            );
        }

        if (location.status === 'error' && locationRetry >= MAX_LOCATION_RETRIES) {
            return (
                <View style={s.center}>
                    <Text style={s.hint}>Belum bisa mendapatkan lokasimu.</Text>
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
                    onBack={() => setStep(destination ? 'delivery-detail' : 'home')}
                    onSwap={handleSwap}
                    onPickOnMap={(field) => {
                        setFocusField(field);
                        setStep('pick-map');
                    }}
                    recentAddresses={RECENT_ADDRESSES}
                    onSelectOrigin={(place) => {
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
                        setPackageInfo((p) => ({ ...p, receiveCode: value }))
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
                    // ✅ FIX: back membatalkan order di server (dengan konfirmasi)
                    onBack={askCancelSearching}
                    onCancelConfirmed={doCancelSearching}
                    onDriverFound={() => {
                        // no-op: pindah step ditentukan polling
                    }}
                    // ✅ FIX: matikan timer simulasi, pakai polling backend
                    searchDelayMs={999_999}
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
                    securityCode={packageInfo.receiveCode ? securityCode : null}
                    onBack={confirmCancel}
                    onCancel={confirmCancel}
                    onCall={() => console.log('[GOSENDFLOW] Call driver')}
                    onChat={openChat}
                    onArrived={() => {
                        // Jangan pindah step; pindah ke on-trip menunggu polling 'in_progress'
                        console.log('[GOSENDFLOW] Driver tiba di pickup');
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
                    driver={driver} // driver.coords realtime dari polling
                    status={driverStatus} // ✅ FIX: diteruskan ke OnTripStep
                    securityCode={securityCode ?? undefined}
                    receiveCode={packageInfo.receiveCode}
                    packageInfo={packageInfo}
                    price={selectedOption?.price}
                    optionName={selectedOption?.name}
                    onBack={() => { }}
                    onArrived={() => {
                        // Pindah ke summary dilakukan polling saat 'completed'
                        console.log('[GOSENDFLOW] Order selesai (status completed)');
                    }}
                    onCall={() => console.log('[GOSENDFLOW] Call driver')}
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
                    initialCoords={
                        focusField === 'origin'
                            ? origin.coords
                            : destination?.coords ?? origin.coords
                    }
                    onBack={() => setStep('search-destination')}
                    onConfirm={(place) => {
                        if (focusField === 'origin') {
                            originEdited.current = true;
                            setOrigin(place);
                            setStep(destination ? 'delivery-detail' : 'search-destination');
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
};