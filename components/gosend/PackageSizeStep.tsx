import { colors } from '@/constants/ojek-theme';
import type { PackageSize } from '@/types/gosend';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SIZES: { key: PackageSize; label: string; max: string }[] = [
    { key: 'kecil', label: 'Kecil', max: 'Maks. 5 kg' },
    { key: 'sedang', label: 'Sedang', max: 'Maks. 20 kg' },
    { key: 'besar', label: 'Besar', max: 'Maks. 10...' },
];

const WEIGHTS = ['1 - 5 kg', 'Custom'];

type Props = {
    onBack: () => void;
    onSave: (size: PackageSize, weight: string) => void;
};

export default function PackageSizeStep({ onBack, onSave }: Props) {
    const insets = useSafeAreaInsets();
    const [size, setSize] = useState<PackageSize>('kecil');
    const [weight, setWeight] = useState(WEIGHTS[0]);

    return (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
            <View style={s.header}>
                <Pressable onPress={onBack} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={s.title}>Ukuran & berat paket</Text>
            </View>

            <View style={{ padding: 16, flex: 1 }}>
                <Text style={s.sectionTitle}>Pilih ukuran & berat yang sesuai *</Text>
                <Text style={s.desc}>
                    Buat hindari pembatalan booking atau penolakan klaim asuransi, pastiin paketmu sesuai sama <Text style={s.link}>S&K</Text>.
                </Text>

                <Image
                    source={require('@/assets/images/ukur.png')}
                    style={s.guideImage}
                    resizeMode="cover"
                />

                <View style={s.infoBox}>
                    <Ionicons name="cube-outline" size={18} color={colors.text} />
                    <Text style={s.infoText}>
                        Barang yang sering dikirim: <Text style={{ fontWeight: '700' }}>dokumen, makanan, baju, obat-obatan, dan kunci.</Text>
                    </Text>
                </View>

                <View style={s.sizeRow}>
                    {SIZES.map((sizeOpt) => (
                        <Pressable
                            key={sizeOpt.key}
                            onPress={() => setSize(sizeOpt.key)}
                            style={[s.sizeCard, size === sizeOpt.key && s.sizeCardActive]}
                        >
                            <Text style={[s.sizeLabel, size === sizeOpt.key && { color: colors.primary }]}>{sizeOpt.label}</Text>
                            <Text style={s.sizeMax}>{sizeOpt.max}</Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={[s.sectionTitle, { marginTop: 20 }]}>Berapa berat paketmu? *</Text>
                <View style={s.weightRow}>
                    {WEIGHTS.map((w) => (
                        <Pressable
                            key={w}
                            onPress={() => setWeight(w)}
                            style={[s.weightPill, weight === w && s.weightPillActive]}
                        >
                            <Text style={[s.weightText, weight === w && { color: colors.primary }]}>{w}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
                <Pressable style={s.submitBtn} onPress={() => onSave(size, weight)}>
                    <Text style={s.submitText}>Simpan</Text>
                </Pressable>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    title: { fontSize: 17, fontWeight: '800', color: colors.text },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 6 },
    desc: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 14 },
    link: { color: colors.primary, fontWeight: '700' },
    guideImage: { width: '100%', height: 180, marginBottom: 14, },
    infoBox: { flexDirection: 'row', gap: 10, backgroundColor: '#EAF6FF', borderRadius: 12, padding: 12, marginBottom: 16 },
    infoText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
    sizeRow: { flexDirection: 'row', gap: 10 },
    sizeCard: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    sizeCardActive: { borderColor: colors.primary, backgroundColor: '#E9F9EF' },
    sizeLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
    sizeMax: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    weightRow: { flexDirection: 'row', gap: 10 },
    weightPill: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
    weightPillActive: { borderColor: colors.primary, backgroundColor: '#E9F9EF' },
    weightText: { fontSize: 13, fontWeight: '700', color: colors.text },
    submitBtn: { height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});