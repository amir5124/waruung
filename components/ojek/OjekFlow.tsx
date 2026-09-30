import AppAlert from '@/components/AppAlert';
import { useOrder } from '@/contexts/OrderContext';
import { useAppAlert } from '@/hooks/use-app-alert';
import { SavedKind, useSavedAddresses } from '@/hooks/use-saved-addresses';
import { useUserLocation } from '@/hooks/use-user-location';
import { api, OrderResponse } from '@/lib/api';
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

const DEFAULT_LABEL: Record<SavedKind, string> = {
    home: 'Rumah',
    office: 'Kantor',
};
const FALLBACK_COORDS = { latitude: -6.2, longitude: 106.63 };
const POLL_INTERVAL = 3000;

export default function OjekFlow({
    serviceType,
    userName,
    onExit,
    onOrder,
}: Props) {
    const user = useUserLocation();
    const { saved, save, remove } = useSavedAddresses();
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

    const [step, setStep] = useState<Step>('home');
    const [origin, setOrigin] = useState<PlaceLoc | null>(null);
    const [destination, setDestination] = useState<PlaceLoc | null>(null);
    const [orderPayload, setOrderPayload] = useState<OrderPayload | null>(null);
    const [orderId, setOrderId] = useState<number | null>(null);
    const [driver, setDriver] = useState<Driver | null>(null);
    const [focusField, setFocusField] = useState<SearchField>('destination');
    const [saveKind, setSaveKind] = useState<SavedKind>('home');
    const [saveMode, setSaveMode] = useState<'create' | 'edit'>('create');
    const [bootingFromNotif, setBootingFromNotif] = useState(false);
    const originEdited = useRef(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stepRef = useRef<Step>('home');
    stepRef.current = step;

    // ============================================================
    // Asal otomatis = lokasi pengguna (HANYA kalau tidak boot dari notif)
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
    // BOOT dari notifikasi — pakai guard dari context
    // ============================================================
    useEffect(() => {
        if (!activeOrderId) return;

        // Sudah pernah boot order ini → skip
        if (bootedOrderId === activeOrderId) {
            console.log(
                '[OJEKFLOW] Skip boot — sudah boot order:',
                activeOrderId
            );
            return;
        }

        // Sedang boot order ini (dari mount ke-2) → skip
        if (bootingOrderId === activeOrderId) {
            console.log(
                '[OJEKFLOW] Skip boot — boot sedang jalan untuk order ini'
            );
            return;
        }

        // Sedang boot order lain → skip
        if (bootingOrderId !== null) {
            console.log('[OJEKFLOW] Skip boot — sedang boot order lain');
            return;
        }

        const boot = async () => {
            setBootingOrderId(activeOrderId);
            console.log('[OJEKFLOW] Boot dari notif, order id:', activeOrderId);
            setBootingFromNotif(true);

            try {
                const order: OrderResponse = await api.getOrder(activeOrderId);
                console.log(
                    '[OJEKFLOW] Order dari notif:',
                    order.status,
                    order.type,
                    order.tariff_code
                );

                const pickupCoords = order.pickup_coords ?? {
                    latitude: -7.0185,
                    longitude: 109.7778,
                };
                const dropoffCoords = order.dropoff_coords ?? {
                    latitude: -7.0185,
                    longitude: 109.7778,
                };

                const payload: OrderPayload = {
                    service: 'motor',
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
                };

                setOrderPayload(payload);
                setOrderId(activeOrderId);
                setOrigin(payload.origin);
                setDestination(payload.destination);

                if (order.driver) {
                    const d: Driver = {
                        id: order.driver.id,
                        name: order.driver.full_name ?? 'Driver',
                        phone: order.driver.phone ?? '',
                        photo: order.driver.avatar_url ?? undefined,
                        plate: order.driver.plate_number ?? 'B 0000 XXX',
                        vehicle: order.driver.vehicle_brand ?? 'Motor',
                        color:
                            order.driver.vehicle_type === 'mobil'
                                ? 'Mobil'
                                : 'Motor',
                        rating: order.driver.rating_avg ?? 5.0,
                        trips: order.driver.total_trips ?? 0,
                        coords: order.driver.coords ?? pickupCoords,
                        vehicleType:
                            order.driver.vehicle_type === 'mobil'
                                ? 'mobil'
                                : 'motor',
                    };
                    setDriver(d);
                }

                switch (order.status) {
                    case 'pending':
                        setStep('searching');
                        startPolling(activeOrderId);
                        break;
                    case 'accepted':
                        setStep('driverFound');
                        startPolling(activeOrderId);
                        break;
                    case 'arrived':
                    case 'in_progress':
                        setStep('onTrip');
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

                // Tandai sudah boot
                setBootedOrderId(activeOrderId);
                console.log('[OJEKFLOW] Boot selesai, status:', order.status);
            } catch (err: any) {
                console.error(
                    '[OJEKFLOW] Gagal boot dari notif:',
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

    // ============================================================
    // Clear activeOrderId setelah boot selesai
    // ============================================================
    useEffect(() => {
        if (bootingFromNotif) return;
        if (!activeOrderId) return;

        const t = setTimeout(() => {
            console.log('[OJEKFLOW] Clear activeOrderId dari context');
            setActiveOrder(null);
        }, 800);

        return () => clearTimeout(t);
    }, [bootingFromNotif, activeOrderId, setActiveOrder]);

    // ============================================================
    // Reset bootedOrderId setelah 30 detik
    // ============================================================
    useEffect(() => {
        if (!bootedOrderId) return;

        const t = setTimeout(() => {
            console.log('[OJEKFLOW] Reset bootedOrderId:', bootedOrderId);
            setBootedOrderId(null);
        }, 30000);

        return () => clearTimeout(t);
    }, [bootedOrderId, setBootedOrderId]);

    // ---- Batalkan pesanan ----
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

    // ---- Polling status order ----
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
                console.log('[OJEKFLOW] Polling:', order.status, {
                    driver_name: order.driver?.full_name,
                    driver_coords: order.driver?.coords,
                });

                if (order.status === 'accepted' && order.driver) {
                    setDriver((prev) => {
                        if (prev) return prev;
                        return {
                            id: order.driver!.id,
                            name: order.driver!.full_name ?? 'Driver',
                            phone: order.driver!.phone ?? '',
                            photo: order.driver!.avatar_url ?? undefined,
                            plate: order.driver!.plate_number ?? 'B 0000 XXX',
                            vehicle: order.driver!.vehicle_brand ?? 'Motor',
                            color:
                                order.driver!.vehicle_type === 'mobil'
                                    ? 'Mobil'
                                    : 'Motor',
                            rating: order.driver!.rating_avg ?? 5.0,
                            trips: order.driver!.total_trips ?? 0,
                            coords: order.driver!.coords ?? {
                                latitude:
                                    orderPayload?.origin.coords.latitude ??
                                    FALLBACK_COORDS.latitude,
                                longitude:
                                    orderPayload?.origin.coords.longitude ??
                                    FALLBACK_COORDS.longitude,
                            },
                            vehicleType:
                                order.driver!.vehicle_type === 'mobil'
                                    ? 'mobil'
                                    : 'motor',
                        };
                    });

                    if (stepRef.current === 'searching') {
                        setStep('driverFound');
                    }
                }

                if (
                    order.status === 'arrived' &&
                    stepRef.current === 'driverFound'
                ) {
                    setStep('onTrip');
                }

                if (order.status === 'in_progress') {
                    // tetap OnTripStep
                }

                if (
                    order.status === 'completed' &&
                    stepRef.current === 'onTrip'
                ) {
                    stopPolling();
                    setStep('summary');
                }

                if (order.status === 'cancelled') {
                    stopPolling();
                    showAlert(
                        'Pesanan dibatalkan',
                        order.cancellation_reason ??
                        'Tidak ada driver yang menerima.'
                    );
                    setOrderId(null);
                    setStep('order');
                }
            } catch (err: any) {
                console.warn('Polling error:', err.message);
            }
        }, POLL_INTERVAL);
    };

    useEffect(() => () => stopPolling(), []);

    // ---- Tombol back Android ----
    useEffect(() => {
        const back: Record<Step, Step | null> = {
            home: null,
            search: 'home',
            pickup: 'search',
            pickDestination: 'search',
            order: 'pickup',
            searching: 'order',
            driverFound: null,
            onTrip: null,
            summary: null,
            saveAddress: 'home',
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step === 'driverFound') {
                confirmCancel();
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

    const openSearch = (f: SearchField) => {
        setFocusField(f);
        setStep('search');
    };

    const finishTrip = () => {
        stopPolling();
        setOrderPayload(null);
        setOrderId(null);
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
            console.log('[OJEKFLOW] Buka chat untuk order:', orderId);
            const room = await api.chat.openRoom(orderId);
            console.log('[OJEKFLOW] Room:', room);
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

    const handleOrder = async (p: OrderPayload) => {
        setOrderPayload(p);
        setStep('searching');
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
                payment_method: 'cash',
                tariff_code: p.optionId,
                option_name: p.optionName,
            });

            console.log('[OJEKFLOW] Order created:', {
                id: order.id,
                tariff_code: order.tariff_code,
                delivery_fee: order.delivery_fee,
            });

            setOrderId(order.id);
            startPolling(order.id);
        } catch (err: any) {
            showAlert('Gagal membuat pesanan', err.message || 'Coba lagi.');
            setStep('order');
        }
    };

    // ============================================================
    // Loading saat boot dari notif
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

    let content: React.ReactNode = null;

    if (step === 'home') {
        content = (
            <HomeStep
                serviceType={serviceType}
                userName={userName}
                location={user}
                savedHome={saved.home}
                savedOffice={saved.office}
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
                    setStep(f === 'destination' ? 'pickDestination' : 'pickup')
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
                onBack={() => {
                    stopPolling();
                    setOrderId(null);
                    setStep('order');
                }}
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
                onBack={confirmCancel}
                onCancel={confirmCancel}
                onArrived={() => {
                    // tidak dipakai — step berpindah dari polling backend
                }}
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
                onArrived={() => {
                    // tidak dipakai — step berpindah dari polling backend
                }}
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
                    console.log('[OJEKFLOW] Submit rating:', {
                        rating,
                        message,
                        tags,
                    });

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