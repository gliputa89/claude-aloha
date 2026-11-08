import { Stack } from 'expo-router';

import { fontFamily } from '@/components/ui/text';
import { OnboardingDraftProvider } from '@/features/onboarding/draft';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

export const unstable_settings = {
  anchor: 'goal',
};

/** Ankieta startowa (docs/PROJECT.md 4.2): 5 kroków, odpowiedzi w pamięci, zapis na końcu. */
export default function OnboardingLayout() {
  const c = useColors();
  const t = useT();
  return (
    <OnboardingDraftProvider>
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
        <Stack.Screen name="goal" options={{ headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="level" />
        <Stack.Screen name="availability" />
        <Stack.Screen name="health" />
        <Stack.Screen name="summary" />
      </Stack>
    </OnboardingDraftProvider>
  );
}
