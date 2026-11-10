import { Stack } from 'expo-router';

import { PlanProvider } from '@/features/plan/plan-provider';
import { useColors } from '@/hooks/use-colors';

/**
 * Część aplikacji po zalogowaniu: zakładki, a nad nimi arkusze (np. szczegóły treningu).
 * Plan wczytywany raz i wspólny dla zakładek i arkuszy.
 */
export default function AppLayout() {
  const c = useColors();
  return (
    <PlanProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="(tabs)" />
        {/* Natywny arkusz iOS na prawie cały ekran – zamykany też przeciągnięciem w dół. */}
        <Stack.Screen name="workout/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </PlanProvider>
  );
}
