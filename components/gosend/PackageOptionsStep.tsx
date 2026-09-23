import { colors } from '@/constants/ojek-theme';
import type { ProtectionType } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PACKAGE_TYPES = [
    { key: 'Makanan', icon: 'restaurant-outline' as const },
    { key: 'Baju', icon: 'shirt-outline' as const },
    { key: 'Dokumen', icon: 'document-text-outline' as const },
    { key: 'Obat-obatan', icon: 'medkit-outline' as const },
    { key: 'Buku', icon: 'book-outline' as const },
    { key: 'Lainnya', icon: 'ellipsis-horizontal-circle-outline' as const },
];

type Props = {
    initialType?: string | null;
    onBack: () => void;
    onContinue: (type: string, protection: ProtectionType) => void;
};

export default function PackageOptionsStep({ initialType, onBack, onContinue }: Props) {
    const insets = useSafeAreaInsets();
    const [type, setType] = useState<string | null>(initialType ?? null);
    const [protection, setProtection] = useState<ProtectionType>('silver');

    return (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
            <View style={s.header}>
                <Pressable onPress={onBack} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={s.title}>Lokasi pengiriman</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text style={s.sectionTitle}>Paketnya berupa apa?</Text>
                <View style={s.typeGrid}>
                    {PACKAGE_TYPES.map((t) => (
                        <Pressable
                            key={t.key}
                            onPress={() => setType(t.key)}
                            style={[s.typePill, type === t.key && s.typePillActive]}
                        >
                            <Ionicons name={t.icon} size={16} color={type === t.key ? colors.primary : colors.text} />
                            <Text style={[s.typeText, type === t.key && { color: colors.primary }]}>{t.key}</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={[s.sectionTitle, { marginTop: 24 }]}>Perlindungan barang rusak atau hilang</Text>
                <Text style={s.desc}>
                    Jaminan s.d. 5jt ditambahkan ke pengiriman ini. Berlaku untuk semua pengiriman, batalin kapan aja.
                </Text>
                <Text style={s.link}>Cari tahu</Text>

                <View style={s.protectionRow}>
                    <Pressable
                        onPress={() => setProtection('silver')}
                        style={[s.protCard, protection === 'silver' && s.protCardActive]}
                    >
                        <View style={s.protHeader}>
                            <Text style={{ fontSize: 20 }}>🛡️</Text>
                            {protection === 'silver' && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                        </View>
                        <Text style={s.protTitle}>Perlindungan Silver</Text>
                        <Text style={s.protPrice}>Rp1.000</Text>
                        <Text style={s.protDesc}>Perlindungan s.d.</Text>
                        <Text style={s.protValue}>Rp5 jt</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setProtection('gold')}
                        style={[s.protCard, protection === 'gold' && s.protCardActive]}
                    >
                        <View style={s.goldBadge}><Text style={s.goldBadgeText}>Banyak dipilih</Text></View>
                        <View style={s.protHeader}>
                            <Text style={{ fontSize: 20 }}>🏅</Text>
                            <View style={[s.radio, protection === 'gold' && s.radioActive]} />
                        </View>
                        <Text style={s.protTitle}>Perlindungan Gold</Text>
                        <Text style={s.protPrice}>Rp2.000</Text>
                        <Text style={s.protDesc}>Perlindungan s.d.</Text>
                        <Text style={s.protValue}>Rp10 jt</Text>
                    </Pressable>
                </View>
            </ScrollView>

            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
                <Pressable
                    disabled={!type}
                    onPress={() => type && onContinue(type, protection)}
                    style={[s.submitBtn, { opacity: type ? 1 : 0.5 }]}
                >
                    <Text style={s.submitText}>Lanjut</Text>
                </Pressable>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    title: { fontSize: 17, fontWeight: '800', color: colors.text },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typePill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: colors.border, borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 10,
    },
    typePillActive: { borderColor: colors.primary, backgroundColor: '#E9F9EF' },
    typeText: { fontSize: 13, fontWeight: '600', color: colors.text },
    desc: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: 4 },
    link: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 4, marginBottom: 12 },
    protectionRow: { flexDirection: 'row', gap: 12 },
    protCard: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 14 },
    protCardActive: { borderColor: colors.primary, backgroundColor: '#EAF6FF' },
    protHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    protTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 8 },
    protPrice: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    protDesc: { fontSize: 12, color: colors.textMuted, marginTop: 10 },
    protValue: { fontSize: 14, fontWeight: '800', color: colors.primary },
    goldBadge: { position: 'absolute', top: -10, right: 10, backgroundColor: '#E8433D', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    goldBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
    radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    submitBtn: { height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});