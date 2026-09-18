import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { DB_NAME, migrate } from '../src/db/client';
import { useTheme } from '../src/theme';

export default function RootLayout() {
  const p = useTheme();
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.header },
          headerTintColor: p.onRed,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: p.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="record/edit" options={{ title: 'Record', presentation: 'modal' }} />
        <Stack.Screen name="record/scan" options={{ title: 'Scan screenshot', presentation: 'modal' }} />
        <Stack.Screen name="account/[id]" options={{ title: 'Account' }} />
        <Stack.Screen name="account/edit" options={{ title: 'Account', presentation: 'modal' }} />
        <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="budgets" options={{ title: 'Budgets' }} />
        <Stack.Screen name="scan-rules" options={{ title: 'Learned scan rules' }} />
      </Stack>
    </SQLiteProvider>
  );
}
