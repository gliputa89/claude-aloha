import { raceForecastFromRules, weeksUntil, type ForecastInput, type RaceForecastResult } from '@aloha/plan-engine';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { LEVEL_TO_DB, recentTimeS, weeklyKmOf, type OnboardingDraft } from './draft';
import { todayIso } from './time';

/** Dłużej nie czekamy na prognozę od modelu – ankieta ma się skończyć w minutę, nie w trzy. */
const FORECAST_TIMEOUT_MS = 25_000;

type ForecastRequest = { key: string; body: Record<string, unknown>; rules: ForecastInput };

/**
 * Dane do prognozy z odpowiedzi w ankiecie; `null`, gdy cel to nie zawody albo brakuje ostatniego wyniku.
 * Kilometraż i najdłuższy bieg znamy tylko wtedy, gdy biegacz połączył Stravę.
 */
function requestFrom(draft: OnboardingDraft): ForecastRequest | null {
  const recent = recentTimeS(draft);
  if (draft.goal !== 'race' || !draft.raceDate || !draft.level || !recent) return null;
  const today = todayIso();
  const from = draft.planStartDate > today ? draft.planStartDate : today;
  const strava = draft.strava;
  // Wynik podpowiedziany ze Stravy i niezmieniony przez biegacza – wiemy, skąd pochodzi i z którego dnia.
  const fromStrava =
    strava?.recentResult && strava.recentResult.distanceM === draft.recentDistanceM && strava.recentResult.timeS === recent
      ? strava.recentResult
      : null;
  // Kilometraż z kroku „Jak teraz biegasz?” – wpisany ręcznie albo podpowiedziany ze Stravy.
  const weeklyKm = weeklyKmOf(draft) ?? null;
  const longestRunKm = strava && strava.level !== 'beginner' ? Math.round(strava.longestRunM / 1000) : null;
  const runsPerWeek = draft.level === 'none' ? 0 : draft.runsPerWeek;
  const body = {
    today,
    distanceM: draft.raceDistanceM,
    raceDate: draft.raceDate,
    planStart: draft.planStartDate,
    level: LEVEL_TO_DB[draft.level],
    recent: {
      distanceM: draft.recentDistanceM,
      timeS: recent,
      source: fromStrava?.source ?? 'manual',
      date: fromStrava?.date ?? null,
    },
    weeklyKm,
    longestRunKm,
    runsPerWeek,
    sessionsPerWeek: draft.sessionsPerWeek,
    maxMinutesWeekday: draft.maxWeekday,
    maxMinutesWeekend: draft.maxWeekend,
    // Bez wpisanego celu: prognoza ma być ta sama, czegokolwiek biegacz sobie życzy – i nie liczyć się od nowa po jego zmianie.
  };
  return {
    key: JSON.stringify(body),
    body,
    rules: {
      distanceM: draft.raceDistanceM,
      weeks: weeksUntil(draft.raceDate, from),
      level: LEVEL_TO_DB[draft.level],
      recent: { distanceM: draft.recentDistanceM, timeS: recent },
      weeklyKm,
      longestRunKm,
      runsPerWeek,
      weeklyMinutesCap: Math.max(0, draft.sessionsPerWeek - 1) * draft.maxWeekday + draft.maxWeekend,
    },
  };
}

/** Prognozy z tej sesji aplikacji – powrót na podsumowanie z tymi samymi odpowiedziami nie pyta modelu drugi raz. */
const cache = new Map<string, RaceForecastResult | null>();

async function fetchForecast(request: ForecastRequest): Promise<RaceForecastResult | null> {
  const rules = () => raceForecastFromRules(request.rules);
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FORECAST_TIMEOUT_MS));
    const call = supabase.functions
      .invoke<{ forecast?: RaceForecastResult | null }>('race-forecast', { method: 'POST', body: request.body })
      .then(({ data, error }) => (error || !data?.forecast ? null : data.forecast));
    // Brak odpowiedzi, błąd albo przekroczony czas → te same reguły policzone na telefonie.
    return (await Promise.race([call, timeout])) ?? rules();
  } catch {
    return rules();
  }
}

export type RaceForecastState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; forecast: RaceForecastResult };

/**
 * Realny czas na zawody do podsumowania ankiety: liczy go model w widełkach z reguł (Edge Function race-forecast),
 * a gdy nie odpowie – same reguły. `none` – cel bez zawodów, bez wyniku albo wynik, z którego nic nie da się policzyć.
 */
export function useRaceForecast(draft: OnboardingDraft): RaceForecastState {
  const request = requestFrom(draft);
  const key = request?.key ?? null;
  const [loaded, setLoaded] = useState<{ key: string; forecast: RaceForecastResult | null } | null>(null);

  useEffect(() => {
    if (!request || cache.has(request.key)) return;
    let active = true;
    fetchForecast(request).then((forecast) => {
      cache.set(request.key, forecast);
      if (active) setLoaded({ key: request.key, forecast });
    });
    return () => {
      active = false;
    };
    // `request` to nowy obiekt przy każdym renderze – wystarczy jego klucz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return { status: 'none' };
  const forecast = cache.has(key) ? cache.get(key) : loaded?.key === key ? loaded.forecast : undefined;
  if (forecast === undefined) return { status: 'loading' };
  return forecast ? { status: 'ready', forecast } : { status: 'none' };
}
