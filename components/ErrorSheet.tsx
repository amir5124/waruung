import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const COLORS = {
    primary: '#40a3ea',
    secondary: '#e68515',
    bg: '#ffffff',
    border: '#e5e9f0',
    textDark: '#1f2933',
    textMuted: '#8a94a6',
    danger: '#e53935',
    success: '#16a34a',
};

interface ErrorSheetProps {
    visible: boolean;
    title?: string;
    message: string;
    onClose: () => void;
    onPrimary?: () => void;
    primaryLabel?: string;
    secondaryLabel?: string;
    variant?: 'error' | 'success';
}

export default function ErrorSheet({
    visible,
    title,
    message,
    onClose,
    onPrimary,
    primaryLabel,
    secondaryLabel = 'Tutup',
    variant = 'error',
}: ErrorSheetProps) {
    const isError = variant === 'error';
    const accent = isError ? COLORS.danger : COLORS.success;
    const iconName = isError ? 'alert-circle' : 'checkmark-circle';
    const defaultTitle = isError ? 'Gagal Daftar' : 'Berhasil';
    const defaultPrimary = isError ? 'Coba Lagi' : 'Lanjut';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => { }}>
                    {/* Ikon besar */}
                    <View style={[styles.iconWrap, { backgroundColor: accent + '15' }]}>
                        <Ionicons name={iconName as any} size={40} color={accent} />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>{title ?? defaultTitle}</Text>

                    {/* Pesan */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Tombol primer */}
                    {onPrimary && (
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: accent }]}
                            activeOpacity={0.85}
                            onPress={onPrimary}
                        >
                            <Text style={styles.primaryBtnText}>
                                {primaryLabel ?? defaultPrimary}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Tombol sekunder */}
                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        activeOpacity={0.85}
                        onPress={onClose}
                    >
                        <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: COLORS.bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 36,
        alignItems: 'center',
    },
    iconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textDark,
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    primaryBtn: {
        width: '100%',
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryBtn: {
        width: '100%',
        borderRadius: 30,
        paddingVertical: 13,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.success,
        backgroundColor: COLORS.bg,
    },
    secondaryBtnText: {
        color: COLORS.success,
        fontSize: 15,
        fontWeight: '700',
    },
});