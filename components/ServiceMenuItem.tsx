// components/ServiceMenuItem.tsx
import { router } from 'expo-router';
import {
    Image,
    ImageSourcePropType,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

// ✅ Terima string URL ATAU require() lokal
export type ServiceIconSource = ImageSourcePropType | string;

type Props = {
    label: string;
    icon: ServiceIconSource;
    route?: string;
    onPress?: () => void;
};

/** Convert string URL ke { uri } */
function toSource(item: ServiceIconSource): ImageSourcePropType {
    if (typeof item === 'string') {
        return { uri: item };
    }
    return item;
}

export default function ServiceMenuItem({
    label,
    icon,
    route,
    onPress,
}: Props) {
    const handlePress = () => {
        if (onPress) {
            onPress();
            return;
        }
        if (route) {
            router.push(route as any);
        }
    };

    return (
        <Pressable
            style={styles.card}
            onPress={handlePress}
            android_ripple={{ color: '#E5EEFB' }}
        >
            <View style={styles.iconWrap}>
                <Image
                    source={toSource(icon)}   // ✅ support string URL
                    style={styles.icon}
                />
            </View>
            <Text style={styles.label}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '23%',
        aspectRatio: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#EEF1F5',
        paddingHorizontal: 4,
    },
    iconWrap: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    icon: {
        width: 45,
        height: 45,
        resizeMode: 'contain',
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        color: '#1B1B1B',
        textAlign: 'center',
    },
});