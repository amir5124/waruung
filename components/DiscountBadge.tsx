import { StyleSheet, Text, View } from 'react-native';

type Props = {
    label?: string;
};

export default function DiscountBadge({ label = '10% off' }: Props) {
    return (
        <View style={styles.wrapper}>
            <View style={styles.badge}>
                <Text style={styles.text}>{label}</Text>
            </View>
            <View style={styles.tail} />
        </View>
    );
}

const BADGE_COLOR = '#F2494A';

const styles = StyleSheet.create({
    wrapper: {
        alignSelf: 'flex-start',
    },
    badge: {
        backgroundColor: BADGE_COLOR,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
        borderBottomLeftRadius: 2,
    },
    text: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    tail: {
        position: 'absolute',
        left: 0,
        bottom: -7,
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderRightWidth: 9,
        borderTopWidth: 9,
        borderRightColor: 'transparent',
        borderTopColor: BADGE_COLOR,
    },
});