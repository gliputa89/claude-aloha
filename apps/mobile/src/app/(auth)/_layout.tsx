import { Stack } from 'expo-router';

import { fontFamily } from '@/components/ui/text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

export const unstable_settings = {
  anchor: 'welcome',
};

export default function AuthLayout() {
  const c = useColors();
  const t = useT();
  // Na turkusie ekranu startowego tekst ma kolor textOnBrand (jasny w trybie jasnym, ciemny w ciemnym).
  const welcomeStatusBar = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
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
      <Stack.Screen name="welcome" options={{ headerShown: false, statusBarStyle: welcomeStatusBar }} />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
