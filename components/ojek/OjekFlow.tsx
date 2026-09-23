import { SavedKind, useSavedAddresses } from '@/hooks/use-saved-addresses';
import { useUserLocation } from '@/hooks/use-user-location';
import { reverseGeocode, shortName } from '@/services/google-maps';
import type { OrderPayload, PlaceLoc, ServiceType } from '@/types/ojek';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import TripSummaryStep from '../ojek/TripSummaryStep';
import DriverFoundStep, { Driver, makeDummyDriver } from './DriverFoundStep';
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
    serviceType: ServiceType; // 'motor' | 'mobil' -> dipakai ojek-motor.tsx & ojek-mobil.tsx
    userName?: string;
    onExit: () => void;
    /** opsional: dipanggil saat pesanan dibuat (mis. kirim ke backend) */
    onOrder?: (payload: OrderPayload) => void;
};

const DEFAULT_LABEL: Record<SavedKind, string> = { home: 'Rumah', office: 'Kantor' };
const FALLBACK_COORDS = { latitude: -6.2, longitude: 106.63 };

export default function OjekFlow({ serviceType, userName, onExit, onOrder }: Props) {
    const user = useUserLocation();
    const { saved, save } = useSavedAddresses();
    const [step, setStep] = useState<Step>('home');
    const [origin, setOrigin] = useState<PlaceLoc | null>(null);
    const [destination, setDestination] = useState<PlaceLoc | null>(null);
    const [orderPayload, setOrderPayload] = useState<OrderPayload | null>(null);
    const [driver, setDriver] = useState<Driver | null>(null);
    const [focusField, setFocusField] = useState<SearchField>('destination');
    const [saveKind, setSaveKind] = useState<SavedKind>('home');
    const originEdited = useRef(false);

    // asal otomatis = lokasi pengguna sekarang (selama belum diedit manual)
    useEffect(() => {
        const c = user.coords;
        if (!c || originEdited.current) return;
        setOrigin((prev) => ({ name: prev?.name ?? '', address: prev?.address ?? '', coords: c, isCurrent: true }));
        let alive = true;
        reverseGeocode(c).then((r) => {
            if (alive && !originEdited.current) setOrigin({ name: r.name, address: r.address, coords: c, isCurrent: true });
        });
        return () => {
            alive = false;
        };
    }, [user.coords]);

    // batalkan pesanan (dipakai saat driver sudah ditemukan)
    const confirmCancel = () => {
        Alert.alert('Batalkan pesanan?', 'Driver sudah dalam perjalanan ke lokasi jemputmu.', [
            { text: 'Tidak', style: 'cancel' },
            {
                text: 'Ya, batalkan',
                style: 'destructive',
                onPress: () => {
                    setDriver(null);
                    setStep('order');
                },
            },
        ]);
    };

    // tombol back Android
    useEffect(() => {
        const back: Record<Step, Step | null> = {
            home: null,
            search: 'home',
            pickup: 'search',
            pickDestination: 'search',
            order: 'pickup',
            searching: 'order',
            driverFound: null, // ditangani khusus: konfirmasi pembatalan
            onTrip: null, // tidak bisa mundur saat perjalanan berlangsung
            summary: null,
            saveAddress: 'home',
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (step === 'driverFound') {
                confirmCancel();
                return true;
            }
            if (step === 'onTrip' || step === 'summary') {
                return true; // abaikan back selama perjalanan / ringkasan
            }
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

    // selesai lihat ringkasan (baik kirim rating maupun lewati) -> kembali ke home, reset pesanan
    const finishTrip = () => {
        setOrderPayload(null);
        setDriver(null);
        setDestination(null);
        setStep('home');
    };

    const openSave = (kind: SavedKind) => {
        setSaveKind(kind);
        setStep('saveAddress');
    };

    const handleOrder = (p: OrderPayload) => {
        setOrderPayload(p);
        setStep('searching');
        onOrder?.(p);
    };

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
                    setDestination(place); // alamat tersimpan langsung jadi tujuan
                    setStep('pickup');
                }}
                onEditSaved={(kind: SavedKind) => openSave(kind)}
            />
        );
    }

    if (step === 'saveAddress') {
        const existing = saved[saveKind];
        const initial: PlaceLoc = existing
            ? { coords: existing.coords, address: existing.address, name: shortName(existing.address) }
            : {
                coords: origin?.coords ?? user.coords ?? FALLBACK_COORDS,
                address: origin?.address ?? '',
                name: origin?.name ?? '',
            };
        content = (
            <SaveAddressStep
                key={`save-${saveKind}`}
                kind={saveKind}
                initial={initial}
                initialLabel={existing?.name ?? DEFAULT_LABEL[saveKind]}
                userCoords={user.coords}
                onBack={() => setStep('home')}
                onSave={async (place: PlaceLoc) => {
                    await save(saveKind, place);
                    setStep('home');
                }}
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
                    setStep('pickup'); // konfirmasi titik jemput
                }}
                onPickOnMap={(f: SearchField) => setStep(f === 'destination' ? 'pickDestination' : 'pickup')}
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
        const initial: PlaceLoc = origin ?? { name: '', address: '', coords: fallback };
        content = (
            <MapPickStep
                key="pickup"
                mode="pickup"
                initial={initial}
                userLocation={user.coords ? { coords: user.coords, accuracy: user.accuracy } : null}
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
                onBack={() => setStep('order')}
                searchDelayMs={5000}
                onDriverFound={() => {
                    setDriver(makeDummyDriver(orderPayload.service, orderPayload.origin.coords));
                    setStep('driverFound');
                }}
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
                onArrived={() => setStep('onTrip')}
                onChat={() => Alert.alert('Chat', 'Fitur chat belum tersedia.')}
            />
        );
    }

    if (step === 'onTrip' && orderPayload && driver) {
        content = (
            <OnTripStep
                payload={orderPayload}
                driver={driver}
                onBack={() => { }} // dikunci selama perjalanan
                onArrived={() => setStep('summary')}
                onChat={() => Alert.alert('Chat', 'Fitur chat belum tersedia.')}
            />
        );
    }

    if (step === 'summary' && orderPayload && driver) {
        content = (
            <TripSummaryStep
                payload={orderPayload}
                driver={driver}
                onSubmit={(rating, message, tags) => {
                    // TODO: kirim rating+pesan+tags ke backend saat sudah siap
                    console.log('rating', rating, 'message', message, 'tags', tags);
                    finishTrip();
                }}
                onSkip={finishTrip}
            />
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <Animated.View key={step} entering={FadeIn.duration(180)} style={{ flex: 1 }}>
                {content}
            </Animated.View>
        </View>
    );
}