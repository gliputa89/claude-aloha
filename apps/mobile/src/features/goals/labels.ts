import type { Locale, TranslationKey, Translator } from '@aloha/i18n';
import { consistencyWeeks, type GoalRow, type GoalSpec } from '@aloha/plan-engine';

import { formatDuration, fromIsoDate } from '@/features/onboarding/time';

/** Cel do opisu: wiersz z bazy albo specyfikacja (propozycja, formularz) – wspólne pola. */
export type GoalLike = {
  kind: GoalRow['kind'];
  name: string | null;
  distanceM: number | null;
  date: string | null;
  targetTimeS: number | null;
  targetMinutes: number | null;
  sessionsPerWeek: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  volumeKm: number | null;
};

export function goalLikeOfRow(g: GoalRow): GoalLike {
  return {
    kind: g.kind,
    name: g.race_name,
    distanceM: g.distance_m,
    date: g.kind === 'race' ? g.race_date : g.due_on,
    targetTimeS: g.target_time_s,
    targetMinutes: g.target_minutes,
    sessionsPerWeek: g.sessions_per_week,
    periodStart: g.period_start,
    periodEnd: g.period_end,
    volumeKm: g.volume_km,
  };
}

export function goalLikeOfSpec(s: GoalSpec): GoalLike {
  return {
    kind: s.kind,
    name: s.name ?? null,
    distanceM: s.distanceM ?? null,
    date: s.date ?? null,
    targetTimeS: s.targetTimeS ?? null,
    targetMinutes: s.targetMinutes ?? null,
    sessionsPerWeek: s.sessionsPerWeek ?? null,
    periodStart: s.periodStart ?? null,
    periodEnd: s.periodEnd ?? null,
    volumeKm: s.volumeKm ?? null,
  };
}

/** Polska odmiana: 1 trening, 2–4 treningi, 5+ treningów (12–14 – „treningów”). Po angielsku Few = Many. */
export function pluralKey(n: number): 'One' | 'Few' | 'Many' {
  if (n === 1) return 'One';
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 'Few' : 'Many';
}

/** Dystans: „5 km”, „Półmaraton”; spoza listy zawodów – kilometry. */
export function distanceLabel(t: Translator, distanceM: number) {
  const key = `onboarding.distance.d${distanceM}` as TranslationKey;
  const text = t(key);
  return text === key ? `${Math.round(distanceM / 100) / 10} km` : text;
}

export function formatDate(locale: Locale, iso: string, withYear = false) {
  return fromIsoDate(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** Krótko: „10 sty”. */
export function formatShortDate(locale: Locale, iso: string) {
  return fromIsoDate(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short' });
}

/** Liczba tygodni celu „regularnie” – ta sama, co kreski postępu w zakładce Cele. */
export const weeksIn = (start: string, end: string) => consistencyWeeks(start, end).length;

/** Nazwa celu, np. „Półmaraton Wiosenny”, „10 km poniżej 47:00”, „5 km bez zatrzymania”. */
export function goalTitle(t: Translator, locale: Locale, g: GoalLike): string {
  switch (g.kind) {
    case 'race':
      return g.name ?? (g.distanceM ? distanceLabel(t, g.distanceM) : t('goalNew.kindRace'));
    case 'performance':
      return t('goals.titlePerformance', {
        distance: g.distanceM ? distanceLabel(t, g.distanceM) : '',
        time: g.targetTimeS ? formatDuration(g.targetTimeS) : '…',
      });
    case 'continuous':
      return g.distanceM
        ? t('goals.titleContinuousDistance', { distance: distanceLabel(t, g.distanceM) })
        : t('goals.titleContinuousMinutes', { minutes: g.targetMinutes ?? 30 });
    case 'consistency': {
      const n = g.sessionsPerWeek ?? 3;
      return t(`goals.titleConsistency${pluralKey(n)}` as TranslationKey, { n });
    }
    case 'volume':
      return t('goals.titleVolume', { km: g.volumeKm ?? 0, date: g.periodEnd ? formatDate(locale, g.periodEnd) : '' });
  }
}

const daysTo = (today: string, iso: string) => Math.round((fromIsoDate(iso).getTime() - fromIsoDate(today).getTime()) / 86_400_000);

/** „za 12 dni” / „jutro” / „dziś”. */
export function inDays(t: Translator, days: number) {
  return days <= 0 ? t('goals.today') : days === 1 ? t('goals.tomorrow') : t('goals.inDays', { n: days });
}

/** Jedno zdanie wyjaśnienia celu (propozycje w ankiecie, ekran „Co dalej?”). */
export function goalDescription(t: Translator, locale: Locale, g: GoalLike, today: string): string {
  switch (g.kind) {
    case 'race':
      return g.date && g.distanceM
        ? t('goals.describeRace', { distance: distanceLabel(t, g.distanceM), date: formatDate(locale, g.date), days: Math.max(0, daysTo(today, g.date)) })
        : '';
    case 'performance':
      return g.date ? t('goals.describePerformanceTrial', { date: formatDate(locale, g.date) }) : t('goals.describePerformance');
    case 'continuous':
      return g.targetMinutes ? t('goals.describeContinuous') : t('goals.describeContinuousDistance');
    case 'consistency':
      return g.periodStart && g.periodEnd
        ? t('goals.describeConsistencyWeeks', { weeks: weeksIn(g.periodStart, g.periodEnd) })
        : t('goals.describeConsistency');
    case 'volume':
      return t('goals.describeVolume');
  }
}
