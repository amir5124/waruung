import { DEFAULT_FILTER, type FilterState } from '@/types/warfood';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
    visible: boolean;
    initial: FilterState;
    onClose: () => void;
    onApply: (filter: FilterState) => void;
};

function Chip({ label, active, onPress, flex }: { label: string; active: boolean; onPress: () => void; flex?: boolean }) {
    return (
        <Pressable style={[s.chip, active && s.chipActive, flex && { flex: 1 }]} onPress={onPress}>
            <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
        </Pressable>
    );
}

export default function FilterModal({ visible, initial, onClose, onApply }: Props) {
    const [filter, setFilter] = useState<FilterState>(initial);

    const toggle = (key: keyof FilterState) => setFilter((f) => ({ ...f, [key]: !f[key] }));

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={s.backdrop} onPress={onClose} />
            <View style={s.sheet}>
                <View style={s.handle} />
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <Text style={s.title}>Filter resto</Text>

                    <Text style={s.section}>Price</Text>
                    <View style={s.row}>
                        <Chip label="Menu 30rb" active={filter.priceUnder30k} onPress={() => toggle('priceUnder30k')} />
                    </View>

                    <Text style={s.section}>Pengantaran cepat</Text>
                    <View style={s.row}>
                        <Chip label="Diantar 15 min" active={filter.fastDelivery15min} onPress={() => toggle('fastDelivery15min')} />
                    </View>

                    <Text style={s.section}>Urutkan</Text>
                    <View style={s.row}>
                        <Chip label="Terdekat" active={filter.sortNearest} onPress={() => toggle('sortNearest')} />
                    </View>

                    <Text style={s.section}>Rating resto</Text>
                    <View style={s.row}>
                        <Chip label="Bintang 4.0+" active={filter.rating40} onPress={() => toggle('rating40')} flex />
                        <Chip label="Bintang 4.5+" active={filter.rating45} onPress={() => toggle('rating45')} flex />
                    </View>

                    <Text style={s.section}>Diskonan</Text>
                    <View style={s.row}>
                        <Chip label="Dibawah 5rb" active={filter.under5k} onPress={() => toggle('under5k')} />
                        <Chip label="Promo makanan" active={filter.foodPromo} onPress={() => toggle('foodPromo')} />
                    </View>
                </ScrollView>

                <View style={s.footer}>
                    <Pressable style={s.resetBtn} onPress={() => setFilter(DEFAULT_FILTER)}>
                        <Text style={s.resetText}>Hapus filter</Text>
                    </Pressable>
                    <Pressable style={s.applyBtn} onPress={() => onApply(filter)}>
                        <Text style={s.applyText}>Pasang</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%',
        backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#c9ccd1', alignSelf: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '800', color: '#1B1B1B', marginBottom: 20 },
    section: { fontSize: 14, fontWeight: '700', color: '#1B1B1B', marginBottom: 10, marginTop: 10 },
    row: { flexDirection: 'row', gap: 10, marginBottom: 4, flexWrap: 'wrap' },
    chip: { borderWidth: 1, borderColor: '#E5E8EC', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
    chipActive: { borderColor: '#1AA260', backgroundColor: '#E9F9EF' },
    chipText: { fontSize: 13, fontWeight: '600', color: '#1B1B1B', textAlign: 'center' },
    chipTextActive: { color: '#1AA260' },
    footer: { flexDirection: 'row', gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: '#E5E8EC' },
    resetBtn: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: '#E5E8EC', alignItems: 'center', justifyContent: 'center' },
    resetText: { fontSize: 15, fontWeight: '700', color: '#8A8F98' },
    applyBtn: { flex: 1, height: 52, borderRadius: 26, backgroundColor: '#1AA260', alignItems: 'center', justifyContent: 'center' },
    applyText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});