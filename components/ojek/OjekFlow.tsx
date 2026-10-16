// components/ojek/OjekFlow.tsx
import AppAlert from '@/components/AppAlert';
import { useOrder } from '@/contexts/OrderContext';
import { useAppAlert } from '@/hooks/use-app-alert';
import { SavedKind, useSavedAddresses } from '@/hooks/use-saved-addresses';
import { useUserLocation } from '@/hooks/use-user-location';
import { api, OrderResponse, type PublicAsset } from '@/lib/api';
import { reverseGeocode, shortName } from '@/services/google-maps';
import type { OrderPayload, PlaceLoc, ServiceType } from '@/types/ojek';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import TripSummaryStep from '../ojek/TripSummaryStep';
import DriverFoundStep, { Driver } from './DriverFoundStep';
import HomeStep from './HomeStep';
import MapPickStep from './MapPickStep';
import OnTripStep from './OnTripStep';
import OrderStep from './OrderStep';
import SaveAddressStep from './SaveAddressStep';
import SearchStep, { SearchField } from './SearchStep';
import SearchingDriverStep from './SearchingDriverStep';

// ============================================================
// TYPES
// ============================================================
type Step =
    | 'home'
    | 'search'
    | 'pickup'
    | 'pickDestination'
    | 'order'
    | 'searching'
    | 'driverFound'
    | 'onTrip'
    | 'summary'
    | 'saveAddress';

type Props = {
    serviceType: ServiceType;
    userName?: string;
    onExit: () => void;
    onOrder?: (payload: OrderPayload) => void;
};

type LatLng = { latitude: number; longitude: number };
type ApiDriver = NonNullable<OrderResponse['driver']>;

// ============================================================
// CONSTANTS
// ============================================================
const DEFAULT_LABEL: Record<SavedKind, string> = {
    home: 'Rumah',
    office: 'Kantor',
};
const FALLBACK_COORDS = { latitude: -6.2, longitude: 106.63 };
const POLL_INTERVAL = 3000;

/** Ubah data driver dari API menjadi objek Driver untuk UI */
function buildDriver(d: ApiDriver, fallback: LatLng): Driver {
    return {
        id: d.id,
        name: d.full_name ?? 'Driver',
        phone: d.phone ?? '',
        photo: d.avatar_url ?? undefined,
        plate: d.plate_number ?? 'B 0000 XXX',
        vehicle: d.vehicle_brand ?? 'Motor',
        color: d.vehicle_type === 'mobil' ? 'Mobil' : 'Motor',
        rating: d.rating_avg ?? 5.0,
        trips: d.total_trips ?? 0,
        coords: d.coords ?? fallback,
        vehicleType: d.vehicle_type === 'mobil' ? 'mobil' : 'motor',
    };
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function OjekFlow({
    serviceType,
    userName,
    onExit,
    onOrder,
}: Props) {
    const user = useUserLocation();
    const { saved, save, remove } = useSavedAddresses();
    const { alertState, showAlert, hideAlert } = useAppAlert();

    const {
        activeOrderId,
        setActiveOrder,
        bootingOrderId,
        setBootingOrderId,
        bootedOrderId,
        setBootedOrderId,
        bootingFromPayment,
        setBootingFromPayment,
    } = useOrder();

    // ============================================================
    // STATE
    // ============================================================
    const [step, setStep] = useState<Step>('home');
    const [origin, setOrigin] = useState<PlaceLoc | null>(null);
    const [destination, setDestination] = useState<PlaceLoc | null>(null);
    const [orderPayload, setOrderPayload] = useState<OrderPayload | null>(null);
    const [orderId, setOrderId] = useState<number | null>(null);
    const [orderStatus, setOrderStatus] = useState<string>('pending');
    const [driver, setDriver] = useState<Driver | null>(null);
    const [focusField, setFocusField] = useState<SearchField>('destination');
    const [saveKind, setSaveKind] = useState<SavedKind>('home');
    const [saveMode, setSaveMode] = useState<'create' | 'edit'>('create');
    const [bootingFromNotif, setBootingFromNotif] = useState(false);

    // ✅ BACKGROUND ASSETS dari backend (fetch SEKALI di parent)
    const [bgAssets, setBgAssets] = useState<PublicAsset[]>([]);

    // ============================================================
    // REFS
    // ============================================================
    const originEdited = useRef(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollTokenRef = useRef(0);
    const lastStatusRef = useRef<string | null>(null);
    const inFlightRef = useRef(false);

    const stepRef = useRef<Step>('home');
    stepRef.current = step;
    const orderPayloadRef = useRef<OrderPayload | null>(null);
    orderPayloadRef.current = orderPayload;
    const orderIdRef = useRef<number | null>(null);
    orderIdRef.current = orderId;

    // ============================================================
    // ✅ FETCH BG ASSETS — sekali di parent
    // Data ini dipakai HomeStep untuk background motor/mobil
    // ============================================================
    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                console.log('[OjekFlow] 🟡 fetch bg assets (parent)');

                const res = await api.public.assets({
                    category: 'other',
                    limit: 50,
                });

                console.log(
                    '[OjekFlow] 🟢 bg assets:',
                    res.items.length,
                    res.items.map((a) => a.key)
                );

                if (!alive) return;
                setBgAssets(res.items ?? []);
            } catch (e: any) {
                console.warn(
                    '[OjekFlow] 🔴 fetch bg gagal:',
                    e?.message
                );
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    // ============================================================
    // ASAL OTOMATIS = LOKASI PENGGUNA
    // ============================================================
    useEffect(() => {
        if (bootingFromNotif) return;
        if (orderId) return;

        const c = user.coords;
        if (!c || originEdited.current) return;

        setOrigin((prev) => ({
            name: prev?.name ?? '',
            address: prev?.address ?? '',
            coords: c,
            isCurrent: true,
        }));

        let alive = true;
        reverseGeocode(c).then((r) => {
            if (alive && !originEdited.current)
                setOrigin({
                    name: r.name,
                    address: r.address,
                    coords: c,
                    isCurrent: true,
                });
        });
        return () => {
            alive = false;
        };
    }, [user.coords, bootingFromNotif, orderId]);

    // ============================================================
    // BOOT: hanya dari activeOrderId (notif / payment paid)
    // ============================================================
    useEffect(() => {
        const bootOrderId = activeOrderId;
        if (!bootOrderId) return;

        if (bootedOrderId === bootOrderId) return;
        if (bootingOrderId === bootOrderId) return;
        if (bootingOrderId !== null) return;

        const boot = async () => {
            setBootingOrderId(bootOrderId);
            console.log(
                '[OJEKFLOW] Boot, order id:',
                bootOrderId,
                'from payment?',
                bootingFromPayment
            );
            setBootingFromNotif(true);

            try {
                const order: OrderResponse = await api.getOrder(bootOrderId);
                console.log(
                    '[OJEKFLOW] Order:',
                    order.status,
                    order.payment_method,
                    order.payment_status
                );

                const pickupCoords = order.pickup_coords ?? FALLBACK_COORDS;
                const dropoffCoords = order.dropoff_coords ?? FALLBACK_COORDS;

                const payload: OrderPayload = {
                    service: serviceType,
                    optionId: order.tariff_code ?? '',
                    optionName: order.option_name ?? '',
                    price: order.total_fare ?? 0,
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
                    distanceMeters: (order.distance_km ?? 0) * 1000,
                    durationSec: (order.duration_min ?? 0) * 60,
                    payment_method: (order.payment_method as any) ?? 'cash',
                    bank_code: undefined,
                };

                setOrderPayload(payload);
                setOrderId(bootOrderId);
                setOrderStatus(order.status);
                setOrigin(payload.origin);
                setDestination(payload.destination);

                if (order.driver) {
                    setDriver(buildDriver(order.driver, pickupCoords));
                }

                // CASE 1: QRIS/VA masih pending → redirect ke /payment
                const needsPayment =
                    (order.payment_method === 'qris' ||
                        order.payment_method === 'bank_transfer') &&
                    order.payment_status === 'pending';

                if (needsPayment) {
                    console.log(
                        '[OJEKFLOW] Payment masih pending → redirect /payment'
                    );
                    setStep('order');
                    router.push({
                        pathname: '/payment/[orderId]',
                        params: { orderId: String(bootOrderId) },
                    } as any);

                    setBootedOrderId(bootOrderId);
                    setBootingFromNotif(false);
                    setBootingOrderId(null);
                    setBootingFromPayment(false);
                    return;
                }

                // CASE 2: Payment paid/cash/wallet + status pending → searching
                const canSearch =
                    order.status === 'pending' &&
                    (order.payment_status === 'paid' ||
                        order.payment_method === 'cash' ||
                        order.payment_method === 'wallet');

                if (canSearch) {
                    console.log('[OJEKFLOW] Payment paid/cash → step searching');
                    setStep('searching');
                    startPolling(bootOrderId);

                    setBootingFromPayment(false);
                    setBootedOrderId(bootOrderId);
                    setBootingFromNotif(false);
                    setBootingOrderId(null);
                    return;
                }

                // CASE 3: Status lain
                switch (order.status) {
                    case 'accepted':
                    case 'arrived':
                        setStep('driverFound');
                        startPolling(bootOrderId);
                        break;
                    case 'in_progress':
                        setStep('onTrip');
                        startPolling(bootOrderId);
                        break;
                    case 'completed':
                        setStep('summary');
                        break;
                    case 'cancelled':
                    default:
                        setOrderId(null);
                        setOrderPayload(null);
                        setDriver(null);
                        setStep('home');
                        break;
                }

                setBootingFromPayment(false);
                setBootedOrderId(bootOrderId);
                setBootingFromNotif(false);
                setBootingOrderId(null);
            } catch (err: any) {
                console.error('[OJEKFLOW] Gagal boot:', err.message);
                showAlert(
                    'Gagal Buka Order',
                    err.message || 'Coba buka manual.'
                );

                setBootedOrderId(bootOrderId);
                setActiveOrder(null);

                setBootingFromNotif(false);
                setBootingOrderId(null);
                setBootingFromPayment(false);
            }
        };

        boot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeOrderId, bootedOrderId, bootingOrderId, bootingFromPayment]);

    // ============================================================
    // CLEAR activeOrderId setelah boot
    // ============================================================
    useEffect(() => {
        if (bootingFromNotif) return;
        if (!activeOrderId) return;

        const t = setTimeout(() => {
            setActiveOrder(null);
        }, 800);

        return () => clearTimeout(t);
    }, [bootingFromNotif, activeOrderId, setActiveOrder]);

    // ============================================================
    // RESET bootedOrderId setelah 30 detik
    // ============================================================
    useEffect(() => {
        if (!bootedOrderId) return;
        const t = setTimeout(() => {
            setBootedOrderId(null);
        }, 30000);
        return () => clearTimeout(t);
    }, [bootedOrderId, setBootedOrderId]);

    // ============================================================
    // PENGAMAN: kalau data step belum lengkap → kembali ke home
    // ============================================================
    useEffect(() => {
        if (bootingFromNotif) return;

        const missing =
            (step === 'order' && !(origin && destination)) ||
            (['searching', 'driverFound', 'onTrip', 'summary'].includes(step) &&
                !orderPayload) ||
            (['driverFound', 'onTrip', 'summary'].includes(step) && !driver);

        if (missing) {
            console.warn('[OJEKFLOW] Data step', step, 'belum lengkap → home');
            stopPolling();
            setStep('home');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, origin, destination, orderPayload, driver, bootingFromNotif]);

    // ============================================================
    // POLLING
    // ============================================================
    const stopPolling = () => {
        pollTokenRef.current += 1;
        inFlightRef.current = false;
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const startPolling = (id: number) => {
        stopPolling();
        lastStatusRef.current = null;
        const token = pollTokenRef.current;

        pollRef.current = setInterval(async () => {
            if (inFlightRef.current) return;
            inFlightRef.current = true;

            try {
                const order = await api.getOrder(id);
                if (token !== pollTokenRef.current) return;

                if (order.status !== lastStatusRef.current) {
                    lastStatusRef.current = order.status;
                    console.log('[OJEKFLOW] Status order:', order.status);
                }

                setOrderStatus(order.status);

                if (order.driver) {
                    const d = order.driver;
                    const fallback =
                        orderPayloadRef.current?.origin.coords ?? FALLBACK_COORDS;

                    setDriver((prev) => {
                        if (!prev || prev.id !== d.id) {
                            return buildDriver(d, fallback);
                        }
                        const c = d.coords;
                        if (!c) return prev;
                        if (
                            prev.coords.latitude === c.latitude &&
                            prev.coords.longitude === c.longitude
                        ) {
                            return prev;
                        }
                        return { ...prev, coords: c };
                    });
                }

                const cur = stepRef.current;

                switch (order.status) {
                    case 'accepted':
                    case 'arrived':
                        if (cur === 'searching') setStep('driverFound');
                        break;

                    case 'in_progress':
                        if (cur === 'searching' || cur === 'driverFound') {
                            setStep('onTrip');
                        }
                        break;

                    case 'completed':
                        if (
                            cur === 'searching' ||
                            cur === 'driverFound' ||
                            cur === 'onTrip'
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
                        setStep('order');
                        break;
                }
            } catch (err: any) {
                console.warn('Polling error:', err.message);
            } finally {
                if (token === pollTokenRef.current) inFlightRef.current = false;
            }
        }, POLL_INTERVAL);
    };

    useEffect(() => () => stopPolling(), []);

    // ============================================================
    // BATALKAN order saat masih mencari driver
    // ============================================================
    const doCancelSearching = async () => {
        const id = orderIdRef.current;
        stopPolling();
        if (id) {
            try {
                await api.updateOrderStatus(
                    id,
                    'cancelled',
                    'Dibatalkan oleh customer'
                );
            } catch (err: any) {
                console.warn('Gagal batalkan order:', err.message);
            }
        }
        setOrderId(null);
        setDriver(null);
        setStep('order');
    };

    const cancelSearching = () => {
        showAlert(
            'Batalkan pencarian?',
            'Pesananmu akan dibatalkan dan kamu kembali ke halaman pesan.',
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

    // ---- Batalkan (driver sudah dalam perjalanan) ----
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
                        const id = orderIdRef.current;
                        if (id) {
                            try {
                                await api.updateOrderStatus(
                                    id,
                                    'cancelled',
                                    'Dibatalkan oleh customer'
                                );
                            } catch (err: any) {
                                console.warn(
                                    'Gagal batalkan order:',
                                    err.message
                                );
                            }
                        }
                        stopPolling();
                        setDriver(null);
                        setOrderId(null);
                        setStep('order');
                    },
                },
            ]
        );
    };

    const confirmCancelRef = useRef(confirmCancel);
    confirmCancelRef.current = confirmCancel;
    const cancelSearchingRef = useRef(cancelSearching);
    cancelSearchingRef.current = cancelSearching;

    // ============================================================
    // BACK HANDLER
    // ============================================================
    useEffect(() => {
        const back: Record<Step, Step | null> = {
            home: null,
            search: 'home',
            pickup: 'search',
            pickDestination: 'search',
            order: 'pickup',
            searching: null,
            driverFound: null,
            onTrip: null,
            summary: null,
            saveAddress: 'home',
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step === 'searching') {
                cancelSearchingRef.current();
                return true;
            }
            if (step === 'driverFound') {
                confirmCancelRef.current();
                return true;
            }
            if (step === 'onTrip' || step === 'summary') return true;
            const prev = back[step];
            if (prev) setStep(prev);
            else onExit();
            return true;
        });
        return () => sub.remove();
    }, [step, onExit]);

    // ============================================================
    // HANDLER
    // ============================================================
    const openSearch = (f: SearchField) => {
        setFocusField(f);
        setStep('search');
    };

    const finishTrip = () => {
        stopPolling();
        setOrderPayload(null);
        setOrderId(null);
        setOrderStatus('pending');
        setDriver(null);
        setDestination(null);
        setStep('home');
    };

    const openSave = (kind: SavedKind) => {
        setSaveKind(kind);
        setSaveMode('create');
        setStep('saveAddress');
    };

    const openEdit = (kind: SavedKind) => {
        setSaveKind(kind);
        setSaveMode('edit');
        setStep('saveAddress');
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
            console.warn('[OJEKFLOW] Gagal buka chat:', err.message);
            showAlert('Gagal Buka Chat', err.message || 'Coba lagi.');
        }
    };

    // ============================================================
    // HANDLE ORDER
    // ============================================================
    const handleOrder = async (p: OrderPayload) => {
        setOrderPayload(p);
        setOrderStatus('pending');
        onOrder?.(p);

        try {
            const order: OrderResponse = await api.createOrder({
                type: 'ride',
                pickup_name: p.origin.name,
                pickup_address: p.origin.address,
                pickup_lat: p.origin.coords.latitude,
                pickup_lng: p.origin.coords.longitude,
                dropoff_name: p.destination.name,
                dropoff_address: p.destination.address,
                dropoff_lat: p.destination.coords.latitude,
                dropoff_lng: p.destination.coords.longitude,
                distance_km: p.distanceMeters / 1000,
                duration_min: Math.ceil(p.durationSec / 60),
                payment_method: p.payment_method ?? 'cash',
                bank_code: p.bank_code,
                tariff_code: p.optionId,
                option_name: p.optionName,
            });

            console.log('[OJEKFLOW] Order created:', {
                id: order.id,
                payment_method: order.payment_method,
                payment_status: order.payment_status,
            });

            setOrderId(order.id);

            const needsPayment =
                (p.payment_method === 'qris' ||
                    p.payment_method === 'bank_transfer') &&
                order.payment_status === 'pending';

            if (needsPayment) {
                console.log(
                    '[OJEKFLOW] Payment pending → redirect ke /payment'
                );
                setStep('order');

                router.push({
                    pathname: '/payment/[orderId]',
                    params: { orderId: String(order.id) },
                } as any);
                return;
            }

            console.log(
                '[OJEKFLOW] Payment paid/cash → start searching driver'
            );
            setStep('searching');
            startPolling(order.id);
        } catch (err: any) {
            showAlert('Gagal membuat pesanan', err.message || 'Coba lagi.');
            setStep('order');
        }
    };

    // ============================================================
    // LOADING SAAT BOOT
    // ============================================================
    if (bootingFromNotif) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                }}
            >
                <ActivityIndicator size="large" color="#40a3ea" />
            </View>
        );
    }

    // ============================================================
    // RENDER STEP
    // ============================================================
    let content: React.ReactNode = null;

    if (step === 'home') {
        content = (
            <HomeStep
                serviceType={serviceType}
                userName={userName}
                location={user}
                savedHome={saved.home}
                savedOffice={saved.office}
                bgAssets={bgAssets}                // ✅ PASS KE HOMESTEP
                onBack={onExit}
                onPressSearch={() => openSearch('destination')}
                onPressSaved={(kind: SavedKind) => {
                    const place = saved[kind];
                    if (!place) {
                        openSave(kind);
                        return;
                    }
                    setDestination(place);
                    setStep('pickup');
                }}
                onEditSaved={(kind: SavedKind) => openEdit(kind)}
            />
        );
    }

    if (step === 'saveAddress') {
        const existing = saved[saveKind];
        const initial: PlaceLoc = existing
            ? {
                coords: existing.coords,
                address: existing.address,
                name: shortName(existing.address),
            }
            : {
                coords: origin?.coords ?? user.coords ?? FALLBACK_COORDS,
                address: origin?.address ?? '',
                name: origin?.name ?? '',
            };

        content = (
            <SaveAddressStep
                key={`save-${saveKind}-${saveMode}`}
                kind={saveKind}
                mode={saveMode}
                initial={initial}
                initialLabel={existing?.name ?? DEFAULT_LABEL[saveKind]}
                userCoords={user.coords}
                onBack={() => setStep('home')}
                onSave={async (place: PlaceLoc) => {
                    await save(saveKind, place);
                    setStep('home');
                }}
                onDelete={
                    saveMode === 'edit'
                        ? async () => {
                            await remove(saveKind);
                            setStep('home');
                        }
                        : undefined
                }
            />
        );
    }

    if (step === 'search') {
        content = (
            <SearchStep
                origin={origin}
                destination={destination}
                userCoords={user.coords}
                initialFocus={focusField}
                onClose={() => setStep('home')}
                onSelectOrigin={(p: PlaceLoc) => {
                    originEdited.current = true;
                    setOrigin(p);
                    if (destination) setStep('pickup');
                }}
                onSelectDestination={(p: PlaceLoc) => {
                    setDestination(p);
                    setStep('pickup');
                }}
                onPickOnMap={(f: SearchField) =>
                    setStep(
                        f === 'destination' ? 'pickDestination' : 'pickup'
                    )
                }
            />
        );
    }

    if (step === 'pickDestination') {
        const initial: PlaceLoc = destination ?? {
            name: '',
            address: '',
            coords: origin?.coords ?? user.coords ?? FALLBACK_COORDS,
        };
        content = (
            <MapPickStep
                key="pick-dest"
                mode="destination"
                initial={initial}
                onBack={() => setStep('search')}
                onEdit={() => setStep('search')}
                onConfirm={(p: PlaceLoc) => {
                    setDestination(p);
                    setStep('pickup');
                }}
            />
        );
    }

    if (step === 'pickup') {
        const fallback = destination?.coords ?? user.coords ?? FALLBACK_COORDS;
        const initial: PlaceLoc = origin ?? {
            name: '',
            address: '',
            coords: fallback,
        };
        content = (
            <MapPickStep
                key="pickup"
                mode="pickup"
                initial={initial}
                userLocation={
                    user.coords
                        ? { coords: user.coords, accuracy: user.accuracy }
                        : null
                }
                onBack={() => setStep('search')}
                onEdit={() => openSearch('origin')}
                onConfirm={(p: PlaceLoc) => {
                    originEdited.current = true;
                    setOrigin(p);
                    if (destination) setStep('order');
                    else openSearch('destination');
                }}
            />
        );
    }

    if (step === 'order' && origin && destination) {
        content = (
            <OrderStep
                serviceType={serviceType}
                origin={origin}
                destination={destination}
                onBack={() => setStep('pickup')}
                onOrder={handleOrder}
                onEdit={() => openSearch('destination')}
            />
        );
    }

    if (step === 'searching' && orderPayload) {
        content = (
            <SearchingDriverStep
                payload={orderPayload}
                onBack={cancelSearching}
                searchDelayMs={999_999}
                onDriverFound={() => { }}
            />
        );
    }

    if (step === 'driverFound' && orderPayload && driver) {
        content = (
            <DriverFoundStep
                payload={orderPayload}
                driver={driver}
                status={orderStatus}
                onBack={confirmCancel}
                onCancel={confirmCancel}
                onChat={openChat}
            />
        );
    }

    if (step === 'onTrip' && orderPayload && driver) {
        content = (
            <OnTripStep
                payload={orderPayload}
                driver={driver}
                onBack={() => { }}
                onChat={openChat}
            />
        );
    }

    if (step === 'summary' && orderPayload && driver) {
        content = (
            <TripSummaryStep
                payload={orderPayload}
                driver={driver}
                onSubmit={async (rating, message, tags) => {
                    if (orderId) {
                        try {
                            const res = await api.submitRating({
                                orderId,
                                rating,
                                comment: message,
                                tags,
                            });
                            console.log('[OJEKFLOW] Rating tersimpan:', res);
                        } catch (err: any) {
                            console.warn(
                                '[OJEKFLOW] Gagal simpan rating:',
                                err.message
                            );
                        }
                    }
                    finishTrip();
                }}
                onSkip={finishTrip}
            />
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <Animated.View
                key={step}
                entering={FadeIn.duration(180)}
                style={{ flex: 1 }}
            >
                {content}
            </Animated.View>

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