import SaveAddressStep from '@/components/ojek/SaveAddressStep';
import { SavedKind, useSavedAddresses } from '@/hooks/use-saved-addresses';
import { shortName } from '@/services/google-maps';
import type { PlaceLoc } from '@/types/ojek';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

const FALLBACK: PlaceLoc = {
    name: '',
    address: '',
    coords: { latitude: -6.2, longitude: 106.63 },
};

const DEFAULT_LABEL: Record<SavedKind, string> = {
    home: 'Rumah',
    office: 'Kantor',

};

export default function SaveAddressScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        kind?: string;
        mode?: string;
    }>();

    const kind = (params.kind ?? 'home') as SavedKind;
    const mode = (params.mode === 'edit' ? 'edit' : 'create') as
        | 'create'
        | 'edit';

    const { saved, save, remove } = useSavedAddresses();

    const existing = saved[kind];

    const initial: PlaceLoc = existing
        ? {
            coords: existing.coords,
            address: existing.address,
            name: shortName(existing.address),
        }
        : FALLBACK;

    const initialLabel = existing?.name ?? DEFAULT_LABEL[kind];

    return (
        <SaveAddressStep
            kind={kind}
            mode={mode}
            initial={initial}
            initialLabel={initialLabel}
            onBack={() => router.back()}
            onSave={async (place: PlaceLoc) => {
                await save(kind, place);
                router.back();
            }}
            onDelete={
                mode === 'edit'
                    ? async () => {
                        await remove(kind);
                        router.back();
                    }
                    : undefined
            }
        />
    );
}