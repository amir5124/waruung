import { colors } from '@/constants/ojek-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { reverseGeocode } from '@/services/google-maps';
import type {
    ContactInfo,
    DriverInfo,
    GoSendStep,
    OrderPayload,
    PackageInfo,
    PlaceLoc,
    ProtectionType,
} from '@/types/gosend';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import OnTripStep from '../gosend/OnTripStep';
import TripSummaryStep from '../gosend/TripSummaryStep';
import ContactFormStep from './ContactFormStep';
import DeliveryDetailStep from './DeliveryDetailStep';
import DriverFoundStep from './DriverFoundStep';
import HomeStep from './HomeStep';
import PackageOptionsStep from './PackageOptionsStep';
import PackageSizeStep from './PackageSizeStep';
import PickOnMapStep from './PickOnMapStep';
import SearchAddressStep from './SearchAddressStep';
import SearchingDriverStep from './SearchingDriverStep';

// GoSendStep (dari '@/types/gosend') belum punya 'on-trip' & 'summary'.
// Diperluas secara lokal di sini supaya tidak perlu mengubah file tipe bersama.
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

export default function GoSendFlow({ onExit, onOrder }: Props) {
    const location = useUserLocation(); // { status, coords, accuracy, refresh, openSettings }

    const [origin, setOrigin] = useState<PlaceLoc | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState(false);

    const [step, setStep] = useState<Step>('home');
    const [destination, setDestination] = useState<PlaceLoc | null>(null);
    const [sender, setSender] = useState<ContactInfo | null>(null);
    const [receiver, setReceiver] = useState<ContactInfo | null>(null);
    const [packageInfo, setPackageInfo] = useState<PackageInfo>(EMPTY_PACKAGE);
    const [driver, setDriver] = useState<DriverInfo | null>(null);
    // opsi pengiriman yang dipilih saat booking (dipakai untuk menampilkan harga di ringkasan)
    const [selectedOption, setSelectedOption] = useState<any>(null);

    const generateDummyDriver = (near: PlaceLoc): DriverInfo => ({
        id: 'driver-001',
        name: 'Budi Santoso',
        rating: 4.9,
        vehiclePlate: 'H 1234 ABC',
        vehicleModel: 'Honda Beat',
        phone: '6281234567890',
        coords: {
            latitude: near.coords.latitude + 0.008,
            longitude: near.coords.longitude + 0.006,
        },
        etaMinutes: 6,
    });

    const [securityCode] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));

    // Begitu koordinat GPS siap, reverse geocode jadi PlaceLoc (nama + alamat)
    useEffect(() => {
        if (location.status !== 'granted' || !location.coords || origin) return;

        let alive = true;
        setGeocoding(true);
        setGeocodeError(false);

        reverseGeocode(location.coords)
            .then(({ name, address }) => {
                if (!alive) return;
                setOrigin({ name, address, coords: location.coords! });
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
    }, [location.status, location.coords, origin]);

    const handleSwap = () => {
        if (!destination || !origin) return;
        setOrigin(destination);
        setDestination(origin);
    };

    const handlePackageContinue = (type: string, protection: ProtectionType) => {
        setPackageInfo((p) => ({ ...p, type, protection }));
        setStep('delivery-detail');
    };

    // selesai lihat ringkasan (baik kirim rating maupun lewati) -> kembali ke home, siap kirim paket baru
    const finishDelivery = () => {
        setDestination(null);
        setSender(null);
        setReceiver(null);
        setPackageInfo(EMPTY_PACKAGE);
        setDriver(null);
        setSelectedOption(null);
        setStep('home');
    };

    // ---- selagi origin belum siap: loading / error / minta izin ----
    if (!origin) {
        if (location.status === 'loading' || geocoding) {
            return (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            );
        }

        if (location.status === 'granted' && geocodeError) {
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

        const MESSAGES: Record<string, string> = {
            denied: 'Izinkan akses lokasi supaya kami bisa menentukan titik pengambilan paketmu.',
            blocked: 'Akses lokasi dimatikan. Aktifkan lewat pengaturan aplikasi.',
            'services-off': 'GPS di HP kamu mati. Nyalakan dulu, lalu coba lagi.',
            error: 'Belum bisa mendapatkan lokasimu.',
        };

        return (
            <View style={s.center}>
                <Text style={s.hint}>{MESSAGES[location.status] ?? MESSAGES.error}</Text>
                <Text
                    style={s.action}
                    onPress={location.status === 'blocked' ? location.openSettings : location.refresh}
                >
                    {location.status === 'blocked' ? 'Buka pengaturan' : 'Coba lagi'}
                </Text>
            </View>
        );
    }

    switch (step) {
        case 'home':
            return (
                <HomeStep
                    origin={origin}
                    destination={destination}
                    onBack={onExit}
                    onPressDestination={() => setStep('search-destination')}
                    onSwap={handleSwap}
                    onEditOrigin={() => setStep('search-destination')}
                />
            );

        case 'search-destination':
            return (
                <SearchAddressStep
                    origin={origin}
                    onBack={() => setStep(destination ? 'delivery-detail' : 'home')}
                    onSwap={handleSwap}
                    onPickOnMap={() => setStep('pick-map')}
                    recentAddresses={RECENT_ADDRESSES}
                    onSelectDestination={(place) => {
                        setDestination(place);
                        setStep('delivery-detail');
                    }}
                />
            );

        case 'delivery-detail':
            if (!destination) return null;
            return (
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
                    onChangePackageType={(type) => setPackageInfo((p) => ({ ...p, type }))}
                    onPressPackageSize={() => setStep('package-size')}
                    onToggleReceiveCode={(value) => setPackageInfo((p) => ({ ...p, receiveCode: value }))} // ⬅️ tambahkan ini
                    onBook={(option) => {
                        setStep('searching-driver');
                        onOrder({ origin, destination, sender, receiver, packageInfo, option });
                    }}
                />
            );

        case 'pickup-form':
            return (
                <ContactFormStep
                    mode="pickup"
                    place={origin}
                    initialContact={sender}
                    myContact={MY_CONTACT}
                    onBack={() => setStep('delivery-detail')}
                    onEditAddress={() => setStep('search-destination')}
                    onSubmit={(contact) => {
                        setSender(contact);
                        setStep('dropoff-form');
                    }}
                />
            );

        case 'dropoff-form':
            if (!destination) return null;
            return (
                <ContactFormStep
                    mode="dropoff"
                    place={destination}
                    initialContact={receiver}
                    myContact={MY_CONTACT}
                    onBack={() => setStep('pickup-form')}
                    onEditAddress={() => setStep('search-destination')}
                    onSubmit={(contact) => {
                        setReceiver(contact);
                        setStep('package-options');
                    }}
                />
            );

        case 'package-options':
            return (
                <PackageOptionsStep
                    initialType={packageInfo.type}
                    onBack={() => setStep('dropoff-form')}
                    onContinue={handlePackageContinue}
                />
            );

        case 'package-size':
            return (
                <PackageSizeStep
                    onBack={() => setStep('delivery-detail')}
                    onSave={(size, weight) => {
                        setPackageInfo((p) => ({ ...p, size, weight }));
                        setStep('delivery-detail');
                    }}
                />
            );

        case 'searching-driver':
            if (!destination) return null;
            return (
                <SearchingDriverStep
                    origin={origin}
                    onBack={() => setStep('delivery-detail')}
                    onCancelConfirmed={async () => {
                        setStep('delivery-detail');
                    }}
                    onDriverFound={() => {
                        setDriver(generateDummyDriver(origin));
                        setStep('driver-found');
                    }}
                />
            );

        case 'driver-found':
            if (!driver) return null;
            return (
                <DriverFoundStep
                    origin={origin}
                    driver={driver}
                    securityCode={securityCode}
                    onBack={() => setStep('delivery-detail')}
                    onCall={() => console.log('Menelepon driver')}
                    onChat={() => console.log('Buka chat dengan driver')}
                    onArrived={() => setStep('on-trip')}
                />
            );

        case 'on-trip':
            if (!driver || !destination) return null;
            return (
                <OnTripStep
                    origin={origin}
                    destination={destination}
                    driver={driver}
                    securityCode={securityCode}
                    onBack={() => { }} // dikunci selama perjalanan
                    onArrived={() => setStep('summary')}
                    onCall={() => console.log('Menelepon driver')}
                    onChat={() => console.log('Buka chat dengan driver')}
                />
            );

        case 'summary':
            if (!driver || !destination) return null;
            return (
                <TripSummaryStep
                    origin={origin}
                    destination={destination}
                    driver={driver}
                    packageInfo={packageInfo}
                    price={selectedOption?.price}
                    onSubmit={(rating, message, tags) => {
                        // TODO: kirim rating+pesan+tags ke backend saat sudah siap
                        console.log('rating', rating, 'message', message, 'tags', tags);
                        finishDelivery();
                    }}
                    onSkip={finishDelivery}
                />
            );

        // ⬇️ TAMBAHKAN INI
        case 'pick-map':
            return (
                <PickOnMapStep
                    initialCoords={destination?.coords ?? origin.coords}
                    onBack={() => setStep('search-destination')}
                    onConfirm={(place) => {
                        setDestination(place);
                        setStep('delivery-detail');
                    }}
                />
            );

        default:
            return null;
    }
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
};