import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { fontFamily } from '@/components/ui/text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  return (
    <AuthProvider>
      <RootNavigator fontsReady={fontsLoaded || !!fontError} />
    </AuthProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = useColors();
  const t = useT();
  const { session, ready } = useAuth();

  useEffect(() => {
    if (fontsReady && ready) SplashScreen.hideAsync();
  }, [fontsReady, ready]);

  if (!fontsReady || !ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.action,
      background: c.background,
      card: c.background,
      text: c.text,
      border: c.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: c.text,
          headerStyle: { backgroundColor: c.background },
          headerTitle: '',
          headerBackTitle: t('common.back'),
          headerBackButtonDisplayMode: 'minimal',
          headerTitleStyle: { fontFamily: fontFamily.bold },
          contentStyle: { backgroundColor: c.background },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* Linki z e-maili – dostępne z sesją i bez niej. */}
        <Stack.Screen name="auth/callback" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="auth/reset-password" />
      </Stack>
    </ThemeProvider>
  );
}
