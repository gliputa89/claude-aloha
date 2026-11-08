import { Stack } from 'expo-router';

import { fontFamily } from '@/components/ui/text';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

export const unstable_settings = {
  anchor: 'welcome',
};

export default function AuthLayout() {
  const c = useColors();
  const t = useT();
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
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
