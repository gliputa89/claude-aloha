import type { Locale } from '@aloha/i18n';
import type { Units } from '@aloha/plan-engine';

import { prefetchDayNote } from '@/features/coach/day-note';
import { todayIso } from '@/features/onboarding/time';
import { fetchActivePlan } from '@/features/plan/api';
import { todaySessions } from '@/features/today/today-sessions';
import { prefetchWeather } from '@/features/weather/weather-provider';
import { writeCache } from '@/lib/data-cache';

type PrefetchOptions = {
  userId: string;
  locale: Locale;
  units: Units;
  /** Moduły pakietu – pobieramy tylko to, co „Dzisiaj” faktycznie pokaże. */
  modules: { weather: boolean; coach: boolean };
};

/**
 * Wszystko do pierwszego widoku „Dzisiaj” pobrane z wyprzedzeniem (np. gdy biegacz czyta podsumowanie
 * ułożonego planu) i zapisane na telefonie: plan, pogoda do najbliższych treningów, notka na dzień bez biegu.
 * Nigdy nie odrzuca – czego się nie uda pobrać, ekran wczyta sam.
 */
export async function prefetchToday({ userId, locale, units, modules }: PrefetchOptions): Promise<void> {
  const plan = await fetchActivePlan().catch(() => null);
  if (!plan) return;
  writeCache('plan', userId, plan);
  const today = todayIso();
  const { todayRuns, shown } = todaySessions(plan, today);
  await Promise.all([
    modules.weather && shown.length > 0 ? prefetchWeather(userId, locale, units, plan) : null,
    modules.coach && todayRuns.length === 0 ? prefetchDayNote(today, locale, userId).catch(() => null) : null,
  ]);
}
