import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useTheme } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  const p = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: p.header },
        headerTintColor: p.onRed,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: p.red,
        tabBarInactiveTintColor: p.sub,
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border },
        sceneStyle: { backgroundColor: p.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trans.', headerShown: false, tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', headerShown: false, tabBarIcon: icon('pie-chart-outline') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal') }} />
    </Tabs>
  );
}
