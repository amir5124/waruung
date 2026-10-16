import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';

type Props = {
    /** URL foto. Kalau null/kosong → fallback ke inisial */
    uri?: string | null;
    /** Nama lengkap untuk generate inisial */
    name?: string | null;
    /** Ukuran diameter avatar (default 38) */
    size?: number;
    /** Warna background inisial (default biru) */
    backgroundColor?: string;
    /** Warna teks inisial (default putih) */
    textColor?: string;
    /** Border putih di sekeliling avatar (opsional) */
    border?: boolean;
    /** Style tambahan */
    style?: ViewStyle;
};

/**
 * Ambil inisial dari nama — maksimal 2 huruf.
 * Contoh:
 *   "Budi Santoso"    → "BS"
 *   "Budi"            → "BU"
 *   ""                → "?"
 */
function getInitials(name?: string | null): string {
    if (!name) return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        // 1 kata → 2 huruf pertama
        return parts[0].slice(0, 2).toUpperCase();
    }
    // 2 kata atau lebih → huruf pertama kata pertama + kata terakhir
    return (
        parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

export default function Avatar({
    uri,
    name,
    size = 38,
    backgroundColor = '#1AA260',
    textColor = '#fff',
    border = false,
    style,
}: Props) {
    const radius = size / 2;
    const hasPhoto = !!uri && uri.trim().length > 0;

    const containerStyle: ViewStyle = {
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: hasPhoto ? '#E5E7EB' : backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...(border
            ? {
                borderWidth: 2,
                borderColor: '#fff',
            }
            : {}),
        ...style,
    };

    if (hasPhoto) {
        return (
            <View style={containerStyle}>
                <Image
                    source={{ uri: uri! }}
                    style={{ width: size, height: size }}
                    resizeMode="cover"
                />
            </View>
        );
    }

    // Fallback: inisial
    const initials = getInitials(name);
    const fontSize = Math.round(size * 0.4);

    return (
        <View style={containerStyle}>
            <Text
                style={{
                    color: textColor,
                    fontWeight: '800',
                    fontSize,
                    letterSpacing: 0.5,
                }}
            >
                {initials}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({});