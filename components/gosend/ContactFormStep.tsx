import { colors } from '@/constants/ojek-theme';
import type { ContactInfo, PlaceLoc } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_PROVIDER } from '../ojek/parts';

type Mode = 'pickup' | 'dropoff';

type Props = {
    mode: Mode;
    place: PlaceLoc;
    initialContact?: ContactInfo | null;
    myContact?: ContactInfo | null;
    onBack: () => void;
    onEditAddress: () => void;
    onSubmit: (contact: ContactInfo, saveAddress: boolean) => void;
};

export default function ContactFormStep({
    mode, place, initialContact, myContact, onBack, onEditAddress, onSubmit,
}: Props) {
    const insets = useSafeAreaInsets();
    const [name, setName] = useState(initialContact?.name ?? '');
    const [phone, setPhone] = useState(initialContact?.phone ?? '');
    const [saveAddress, setSaveAddress] = useState(false);

    const isPickup = mode === 'pickup';
    const title = isPickup ? 'Detail pengambilan paket' : 'Lokasi pengiriman';
    const fieldLabel = isPickup ? 'Nama pengirim' : 'Nama penerima';
    const canSubmit = name.trim().length > 0 && phone.trim().length > 0;

    const handleUseMine = () => {
        if (myContact) {
            setName(myContact.name);
            setPhone(myContact.phone);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
            <View style={s.header}>
                <Pressable onPress={onBack} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={s.title}>{title}</Text>
            </View>

            <View style={{ padding: 16, flex: 1 }}>
                <View style={s.mapWrap}>
                    <MapView
                        style={{ flex: 1 }}
                        provider={MAP_PROVIDER}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        rotateEnabled={false}
                        pitchEnabled={false}
                        toolbarEnabled={false}
                        initialRegion={{ ...place.coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                    >
                        <Marker coordinate={place.coords} />
                    </MapView>
                    <View style={s.tapPill}>
                        <View style={[s.tapIcon, { backgroundColor: isPickup ? colors.primary : colors.secondary }]}>
                            <Ionicons name={isPickup ? 'arrow-up' : 'arrow-down'} size={12} color="#fff" />
                        </View>
                        <Text style={s.tapPillText}>Tap petanya</Text>
                    </View>
                </View>

                <View style={s.addressCard}>
                    <View style={s.rowBetween}>
                        <Text style={s.placeName}>{place.name}</Text>
                        <Pressable onPress={onEditAddress} style={s.editPill}>
                            <Text style={s.editText}>Edit</Text>
                        </Pressable>
                    </View>
                    <Text style={s.placeAddress}>{place.address}</Text>

                    <View style={s.landmarkInput}>
                        <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
                        <TextInput
                            style={{ flex: 1, fontSize: 13, color: colors.text }}
                            placeholder="Ada patokan terdekat? (opsional)"
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>
                </View>

                <View style={s.rowBetween}>
                    <Text style={s.sectionLabel}>{isPickup ? 'Detail pengirim' : 'Detail penerima'}</Text>
                    {myContact && (
                        <Pressable onPress={handleUseMine} style={s.editPill}>
                            <Text style={s.editText}>Pakai detail saya</Text>
                        </Pressable>
                    )}
                </View>

                <View style={s.field}>
                    <Text style={s.fieldLabel}>{fieldLabel} *</Text>
                    <View style={s.fieldRow}>
                        <TextInput
                            style={s.fieldInput}
                            placeholder={`Masukkan ${fieldLabel.toLowerCase()}...`}
                            placeholderTextColor={colors.textMuted}
                            value={name}
                            onChangeText={setName}
                        />
                        <View style={s.avatarIcon}>
                            <Ionicons name="person" size={14} color="#fff" />
                        </View>
                    </View>
                </View>

                <View style={s.field}>
                    <Text style={s.fieldLabel}>Nomor telepon *</Text>
                    <View style={s.phoneRow}>
                        <View style={s.countryCode}>
                            <Text>🇮🇩</Text>
                            <Text style={s.countryCodeText}>+62</Text>
                        </View>
                        <TextInput
                            style={s.phoneInput}
                            placeholder="Masukkan nomor telepon"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad"
                            value={phone}
                            onChangeText={setPhone}
                        />
                    </View>
                </View>

                <Pressable style={s.rowBetween} onPress={() => setSaveAddress((v) => !v)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name={saveAddress ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.text} />
                        <Text style={s.sectionLabel}>Simpan alamat?</Text>
                    </View>
                    <View style={s.editPill}>
                        <Text style={s.editText}>Simpan</Text>
                    </View>
                </Pressable>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
                <Pressable
                    disabled={!canSubmit}
                    onPress={() => onSubmit({ name: name.trim(), phone: phone.trim() }, saveAddress)}
                    style={[s.submitBtn, { opacity: canSubmit ? 1 : 0.5 }]}
                >
                    <Text style={s.submitText}>{isPickup ? 'Simpan' : 'Lanjut'}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12 },
    title: { fontSize: 17, fontWeight: '800', color: colors.text },
    mapWrap: { height: 150, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
    tapPill: {
        position: 'absolute', top: 12, alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
    },
    tapIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    tapPillText: { fontSize: 13, fontWeight: '700', color: colors.text },
    addressCard: { marginBottom: 20 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    placeName: { fontSize: 16, fontWeight: '800', color: colors.text },
    placeAddress: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 12 },
    editPill: { backgroundColor: '#E9F9EF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
    editText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
    landmarkInput: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.field, borderRadius: 20, paddingHorizontal: 14, height: 42 },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    field: { marginBottom: 16 },
    fieldLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
    fieldRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 8 },
    fieldInput: { flex: 1, fontSize: 15, color: colors.text },
    avatarIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 8 },
    countryCode: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    countryCodeText: { fontSize: 15, color: colors.text },
    phoneInput: { flex: 1, fontSize: 15, color: colors.text },
    submitBtn: { height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});