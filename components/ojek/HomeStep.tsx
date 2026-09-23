import { colors } from '@/constants/ojek-theme';
import type { SavedKind } from '@/hooks/use-saved-addresses';
import type { UserLocationState } from '@/hooks/use-user-location';
import type { PlaceLoc, ServiceType } from '@/types/ojek';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationPreview } from './LocationPreview';
import { CircleButton, PinDot } from './parts';

type Props = {
    serviceType: ServiceType;
    userName?: string;
    location: UserLocationState;
    savedHome?: PlaceLoc | null;
    savedOffice?: PlaceLoc | null;
    onBack: () => void;
    onPressSearch: () => void;
    /** tap chip: kalau sudah tersimpan -> pakai sebagai tujuan, kalau belum -> buka halaman simpan */
    onPressSaved: (kind: SavedKind) => void;
    /** ikon pensil pada chip yang sudah tersimpan */
    onEditSaved: (kind: SavedKind) => void;
};

const SERVICE_ICONS: Record<ServiceType, any> = {
    motor: require('@/assets/images/motor.png'),
    mobil: require('@/assets/images/mobil.png'),
};

const SERVICE_BG: Record<ServiceType, any> = {
    motor: require('@/assets/images/bg-ojek.png'),
    mobil: require('@/assets/images/bg-mobil.png'),
};

const COPY: Record<ServiceType, { title: string; promoTitle: string; promoSub: string }> = {
    motor: { title: 'Ojek Motor', promoTitle: 'Beli paket hemat sekarang!', promoSub: 'Ongkos lebih murah tiap hari' },
    mobil: { title: 'Ojek Mobil', promoTitle: 'Bawa keluarga, lebih hemat!', promoSub: 'Muat sampai 6 penumpang' },
};

function SavedChip({
    kind, place, onPress, onEdit,
}: {
    kind: SavedKind; place?: PlaceLoc | null; onPress: () => void; onEdit: () => void;
}) {
    const icon = kind === 'home' ? 'home' : 'briefcase';
    const empty = kind === 'home' ? 'Simpan Rumah' : 'Simpan Kantor';
    return (
        <Pressable style={s.pill} onPress={onPress}>
            <Ionicons name={icon} size={18} color={place ? colors.primary : colors.text} />
            <Text style={s.pillText} numberOfLines={1}>{place ? place.name : empty}</Text>
            {place && (
                <Pressable onPress={onEdit} hitSlop={10}>
                    <Ionicons name="create-outline" size={18} color={colors.textMuted} />
                </Pressable>
            )}
        </Pressable>
    );
}

export default function HomeStep({
    serviceType, userName, location, savedHome, savedOffice, onBack, onPressSearch, onPressSaved, onEditSaved,
}: Props) {
    const insets = useSafeAreaInsets();
    const copy = COPY[serviceType];

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScrollView
                bounces={false}
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.homeBg }}
            >
                <ImageBackground
                    source={SERVICE_BG[serviceType]}
                    resizeMode="cover"
                    style={{ height: 180 + insets.top, justifyContent: 'flex-end' }}
                >
                    <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.greetWrap}>
                        <Text style={s.greet}>{userName ? `Siap berangkat hari ini, ${userName}?` : 'Siap berangkat hari ini?'}</Text>
                        <Text style={s.greetSub}>Semoga harimu lancar. Yuk, {copy.title.toLowerCase()}!</Text>
                    </Animated.View>
                </ImageBackground>

                <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.promo}>
                    <View style={s.promoIcon}>
                        <Image
                            source={SERVICE_ICONS[serviceType]}
                            style={s.promoIconImage}
                            resizeMode="contain"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.promoTitle}>{copy.promoTitle}</Text>
                        <Text style={s.promoSub}>{copy.promoSub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                </Animated.View>

                <Animated.View
                    entering={FadeInDown.delay(300).duration(450)}
                    style={[s.sheet, { paddingBottom: insets.bottom + 96 }]}
                >
                    <LocationPreview location={location} />

                    <Pressable onPress={onPressSearch} style={s.search}>
                        <PinDot type="destination" size={26} />
                        <Text style={s.searchText}>Cari lokasi tujuan</Text>
                        <Ionicons name="search" size={22} color={colors.textMuted} />
                    </Pressable>

                    <View style={s.saved}>
                        <MaterialCommunityIcons name="bookmark-plus" size={40} color={colors.primary} />
                        <Text style={s.savedTitle}>Simpan alamat, pesan lebih cepat</Text>
                        <Text style={s.savedSub}>Ada alamat yang sering dipakai? Simpan dulu, biar nggak repot ketik alamat lagi.</Text>
                        <View style={s.pills}>
                            <SavedChip kind="home" place={savedHome} onPress={() => onPressSaved('home')} onEdit={() => onEditSaved('home')} />
                            <SavedChip kind="office" place={savedOffice} onPress={() => onPressSaved('office')} onEdit={() => onEditSaved('office')} />
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>

            {/* tombol back tetap di tempatnya saat halaman di-scroll */}
            <View style={{ position: 'absolute', top: insets.top + 12, left: 16 }}>
                <CircleButton icon="arrow-back" onPress={onBack} />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    greetWrap: { paddingHorizontal: 24, },
    greet: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', textShadowColor: '#0006', textShadowRadius: 4, },
    greetSub: { color: '#fff', fontSize: 14, textAlign: 'center', textShadowColor: '#0006', textShadowRadius: 4 },
    promo: {
        marginHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 14,
        marginTop: 20,
        paddingBottom: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    promoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    promoTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
    promoSub: { color: '#fff', fontSize: 13, marginTop: 1 },
    sheet: {
        height: 440,
        marginHorizontal: 16,
        marginTop: -22,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16,
        gap: 16,
    },
    search: {
        height: 45,
        borderRadius: 27,
        backgroundColor: colors.field,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchText: { flex: 1, color: colors.textMuted, fontSize: 16 },
    saved: { alignItems: 'center', paddingTop: 8 },
    savedTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 8 },
    savedSub: { textAlign: 'center', color: colors.textMuted, marginTop: 4, lineHeight: 20 },
    pills: { flexDirection: 'row', gap: 10, marginTop: 36, alignSelf: 'stretch' },
    pill: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 10,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.border,
    },
    pillText: { fontWeight: '700', color: colors.text, fontSize: 14, flexShrink: 1 },
    promoIconImage: {
        width: 35,
        height: 35,
    },
});