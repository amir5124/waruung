// components/MerchantImage.tsx
// Gambar toko yang TIDAK terpotong: seluruh gambar ditampilkan utuh (contain)
// di atas latar abu muda. Ada ikon cadangan kalau gambar kosong / gagal dimuat.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
    uri?: string | null;
    style?: StyleProp<ViewStyle>; // atur width, height, borderRadius di sini
    iconSize?: number;
    fit?: 'contain' | 'cover'; // default contain; pakai 'cover' untuk foto makanan
};

export default function MerchantImage({ uri, style, iconSize = 26, fit = 'contain' }: Props) {
    const [failed, setFailed] = useState(false);

    if (!uri || failed) {
        return (
            <View style={[{ backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' }, style]}>
                <Ionicons name="restaurant" size={iconSize} color="#B0B5BD" />
            </View>
        );
    }

    return (
        <View style={[{ backgroundColor: '#F1F2F4', overflow: 'hidden' }, style]}>
            <Image
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode={fit}
                onError={() => setFailed(true)}
            />
        </View>
    );
}