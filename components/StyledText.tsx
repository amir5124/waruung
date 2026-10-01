import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

type Props = { label: string; icon: any; route: string };

export default function ServiceMenuItem({ label, icon, route }: Props) {
  const router = useRouter();
  return (
    <Pressable style={styles.card} onPress={() => router.push(route as any)}>
      <Image source={icon} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    alignItems: 'center',
    paddingVertical: 14,
    shadowColor: '#2F86EB',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  icon: { width: 56, height: 56, resizeMode: 'contain', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '700', color: '#1B1B1B' },
});