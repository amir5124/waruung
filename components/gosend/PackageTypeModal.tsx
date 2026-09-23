import { colors } from '@/constants/ojek-theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const PACKAGE_TYPES = [
    { key: 'Makanan', icon: 'restaurant-outline' as const },
    { key: 'Baju', icon: 'shirt-outline' as const },
    { key: 'Dokumen', icon: 'document-text-outline' as const },
    { key: 'Obat-obatan', icon: 'medkit-outline' as const },
    { key: 'Buku', icon: 'book-outline' as const },
    { key: 'Lainnya', icon: 'ellipsis-horizontal-circle-outline' as const },
];

type Props = {
    visible: boolean;
    currentType: string | null;
    onClose: () => void;
    onSave: (type: string) => void;
};

export default function PackageTypeModal({ visible, currentType, onClose, onSave }: Props) {
    const [selected, setSelected] = useState(currentType);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={s.backdrop} onPress={onClose} />
            <View style={s.sheet}>
                <View style={s.rowBetween}>
                    <Text style={s.title}>Paketnya berupa apa?</Text>
                    <Pressable onPress={onClose} style={s.closeBtn}>
                        <Ionicons name="close" size={20} color={colors.text} />
                    </Pressable>
                </View>

                <View style={s.grid}>
                    {PACKAGE_TYPES.map((t) => (
                        <Pressable
                            key={t.key}
                            onPress={() => setSelected(t.key)}
                            style={[s.pill, selected === t.key && s.pillActive]}
                        >
                            <Ionicons name={t.icon} size={16} color={selected === t.key ? colors.primary : colors.text} />
                            <Text style={[s.pillText, selected === t.key && { color: colors.primary }]}>{t.key}</Text>
                        </Pressable>
                    ))}
                </View>

                <Pressable
                    disabled={!selected}
                    onPress={() => selected && onSave(selected)}
                    style={[s.submitBtn, { opacity: selected ? 1 : 0.5 }]}
                >
                    <Text style={s.submitText}>Simpan</Text>
                </Pressable>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: 20, paddingBottom: 32,
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: colors.border, borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 10,
    },
    pillActive: { borderColor: colors.primary, backgroundColor: '#E9F9EF' },
    pillText: { fontSize: 13, fontWeight: '600', color: colors.text },
    submitBtn: { height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});