import { useEffect } from 'react';

import { useBoot } from '@/features/boot/boot-gate';
import { useDayNote } from '@/features/coach/day-note';
import { useModule } from '@/features/modules/use-module';
import { todayIso } from '@/features/onboarding/time';
import { usePlan } from '@/features/plan/plan-provider';
import { todaySessions } from '@/features/today/today-sessions';
import { useWeather } from '@/features/weather/weather-provider';

/**
 * Czy ekran „Dzisiaj” ma wszystko do pierwszego widoku: plan, biegi ze Stravy, notkę trenera na dzień bez biegu
 * i pogodę do pokazywanych treningów. Czeka tylko na to, co faktycznie się pokaże (moduły pakietu).
 */
function useTodayReady() {
  const { state, synced } = usePlan();
  const weather = useWeather();
  const today = todayIso();
  const modules = { weather: useModule('weather'), strava: useModule('strava'), coach: useModule('coach') };
  const plan = state.kind === 'ready' ? state.plan : null;
  const { todayRuns, shown } = todaySessions(plan, today);
  const note = useDayNote(today, modules.coach && !!plan && todayRuns.length === 0);

  if (state.kind === 'loading') return false;
  // Bez planu (układanie, błąd) ekran pokazuje własny stan – nie ma na co czekać.
  if (!plan) return true;
  if (modules.strava && !synced) return false;
  if (note.pending) return false;
  if (modules.weather && shown.length > 0 && !weather.settled) return false;
  return true;
}

/** Zgłasza ekranowi startowemu, że „Dzisiaj” jest w komplecie. Nic nie rysuje. */
export function TodayBoot() {
  const { markReady } = useBoot();
  const ready = useTodayReady();
  useEffect(() => {
    if (ready) markReady();
  }, [ready, markReady]);
  return null;
}
