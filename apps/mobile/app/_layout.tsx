import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider } from '../components/GameProvider';
import { theme } from '../constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.text,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: theme.colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Eurobasqet' }} />
          <Stack.Screen name="roster" options={{ title: 'Roster' }} />
          <Stack.Screen name="standings" options={{ title: 'Standings' }} />
          <Stack.Screen name="schedule" options={{ title: 'Schedule' }} />
          <Stack.Screen name="player/[id]" options={{ title: 'Player' }} />
        </Stack>
      </GameProvider>
    </SafeAreaProvider>
  );
}
