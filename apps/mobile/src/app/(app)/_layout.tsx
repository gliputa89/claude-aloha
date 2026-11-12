import { Stack } from 'expo-router';

import { GoalsProvider } from '@/features/goals/goals-provider';
import { PlanProvider } from '@/features/plan/plan-provider';
import { WeatherProvider } from '@/features/weather/weather-provider';
import { useColors } from '@/hooks/use-colors';

/**
 * Część aplikacji po zalogowaniu: zakładki, a nad nimi arkusze (np. szczegóły treningu).
 * Plan (i pogoda do treningów) wczytywane raz i wspólne dla zakładek i arkuszy.
 */
export default function AppLayout() {
  const c = useColors();
  return (
    <PlanProvider>
      <GoalsProvider>
        <WeatherProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
            <Stack.Screen name="(tabs)" />
            {/* Natywny arkusz iOS na prawie cały ekran – zamykany też przeciągnięciem w dół. */}
            <Stack.Screen name="workout/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="weather-location" options={{ presentation: 'modal' }} />
            {/* Rozmowa z trenerem – także nad arkuszem treningu (pytania przed i po). */}
            <Stack.Screen name="coach" options={{ presentation: 'modal' }} />
            {/* Zakładka „Cele”: nowy cel oraz wynik i „co dalej” po zakończonym celu. */}
            <Stack.Screen name="goal-new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="goal-finish" options={{ presentation: 'modal' }} />
          </Stack>
        </WeatherProvider>
      </GoalsProvider>
    </PlanProvider>
  );
}
