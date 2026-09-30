import { colors } from '@/constants/ojek-theme';
import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

type Props = {
    visible: boolean;
    /** Warna spinner. Default: colors.primary */
    color?: string;
};

/** Modal loading: kotak putih dengan spinner di atas overlay gelap (gaya halaman login). */
export default function LoadingModal({ visible, color = colors.primary }: Props) {
    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            statusBarTranslucent
            onRequestClose={() => { }}
        >
            <View style={s.overlay}>
                <View style={s.box}>
                    <ActivityIndicator size="large" color={color} />
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    box: {
        width: 80,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
});