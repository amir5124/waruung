import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

const COLORS = {
    primary: '#40a3ea',
    danger: '#e5484d',
    textDark: '#1f2933',
    textMuted: '#8a94a6',
    border: '#e5e9f0',
};

export interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface AppAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttons?: AlertButton[];
    onClose: () => void;
}

export default function AppAlert({
    visible,
    title,
    message,
    buttons,
    onClose,
}: AppAlertProps) {
    // Default: satu tombol "Mengerti"
    const btns: AlertButton[] = buttons?.length
        ? buttons
        : [{ text: 'Mengerti', style: 'default' }];

    const handlePress = (btn: AlertButton) => {
        onClose();
        // Delay kecil supaya modal sempat tertutup dulu
        setTimeout(() => btn.onPress?.(), 150);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={{ flex: 1 }} />
                </TouchableWithoutFeedback>

                <View style={styles.sheet}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#1c1c1c" />
                    </TouchableOpacity>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.description}>{message}</Text>

                    {btns.map((b, i) => {
                        const isPrimary = b.style === 'default' || !b.style;
                        const isDestructive = b.style === 'destructive';
                        const isCancel = b.style === 'cancel';

                        const borderColor = isDestructive
                            ? COLORS.danger
                            : isCancel
                                ? COLORS.border
                                : COLORS.primary;

                        const textColor = isDestructive
                            ? COLORS.danger
                            : isCancel
                                ? '#333'
                                : COLORS.primary;

                        return (
                            <TouchableOpacity
                                key={i}
                                onPress={() => handlePress(b)}
                                style={[
                                    styles.button,
                                    {
                                        borderColor,
                                        marginTop: i > 0 ? 10 : 0,
                                    },
                                    isPrimary && {
                                        backgroundColor: COLORS.primary,
                                        borderColor: COLORS.primary,
                                    },
                                    isDestructive && {
                                        backgroundColor: COLORS.danger,
                                        borderColor: COLORS.danger,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.buttonText,
                                        { color: textColor },
                                        (isPrimary || isDestructive) && { color: '#fff' },
                                    ]}
                                >
                                    {b.text}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 50,
        width: '100%',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        right: 24,
        top: -64,
        backgroundColor: '#fff',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textDark,
        marginBottom: 10,
    },
    description: {
        fontSize: 15,
        color: '#555555',
        lineHeight: 22,
        marginBottom: 32,
    },
    button: {
        width: '100%',
        borderRadius: 100,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    buttonText: {
        fontWeight: '700',
        fontSize: 16,
    },
});