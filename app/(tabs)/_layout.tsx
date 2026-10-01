import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  order: 'document-text-outline',
  chat: 'chatbubble-ellipses-outline',
  menu: 'person-outline', // 🔧 dulunya 'menu-outline' -> icon profile/account
};

const LABELS: Record<string, string> = {
  index: 'Home',
  order: 'Order',
  chat: 'Chat',
  menu: 'Akun', // 🔧 dulunya 'Menu' -> label disesuaikan jadi Akun (opsional, sesuaikan selera)
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { bottom: 50 + insets.bottom * 0.3 }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const iconName = ICONS[route.name] ?? 'ellipse-outline';
          const label = LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              {focused ? (
                <View style={styles.activeCircle}>
                  <Ionicons name={iconName} size={24} color="#2F86EB" />
                  <Text style={styles.activeLabel}>{label}</Text>
                </View>
              ) : (
                <View style={styles.inactiveTab}>
                  <Ionicons name={iconName} size={22} color="#FFFFFF" />
                  <Text style={styles.inactiveLabel}>{label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="order" options={{ title: 'Order' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="menu" options={{ title: 'Akun' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  tabBar: {
    flexDirection: 'row',
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4FA8E8',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
    // TIDAK ada overflow: 'hidden' di sini, jadi anak bisa netes keluar
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 72,
  },
  inactiveTab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  inactiveLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeCircle: {
    width: 70,
    height: 70,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 5,
    borderColor: '#4FA8E8',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 10,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2F86EB',
  },
});