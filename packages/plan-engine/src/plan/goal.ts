// Walidacja celu z ankiety startowej (docs/PROJECT.md 4.2): gdy cel jest nierealny,
// aplikacja łagodnie to mówi i proponuje realny cel pośredni. Reguły deterministyczne, bez AI.
// Realny czas liczy plan/forecast.ts (tabele Danielsa + objętość + malejąca poprawa); w aplikacji prognozę
// w tych widełkach doprecyzowuje model (ai/race-forecast.ts).

import { forecastRace } from './forecast.ts';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export const RACE_DISTANCES_M = [5000, 10000, 21097, 42195] as const;
export type RaceDistanceM = (typeof RACE_DISTANCES_M)[number];

export type RaceGoal = {
  distanceM: RaceDistanceM;
  /** Data zawodów, `YYYY-MM-DD`. */
  raceDate: string;
  targetTimeS?: number | null;
};

export type RecentResult = { distanceM: number; timeS: number };

export type GoalAssessment =
  | { status: 'ok'; weeks: number }
  | {
      status: 'too_soon';
      weeks: number;
      minWeeks: number;
      suggestion: { kind: 'shorter_distance'; distanceM: RaceDistanceM } | { kind: 'later_date'; raceDate: string };
    }
  | {
      status: 'target_too_fast';
      weeks: number;
      predictedTimeS: number;
      suggestion: { kind: 'target_time'; targetTimeS: number };
    };

/** Minimalna liczba tygodni przygotowań do dystansu, zależnie od obecnego poziomu. */
export const MIN_PREP_WEEKS: Record<Level, Record<RaceDistanceM, number>> = {
  beginner: { 5000: 8, 10000: 12, 21097: 20, 42195: 30 },
  intermediate: { 5000: 4, 10000: 6, 21097: 12, 42195: 18 },
  advanced: { 5000: 3, 10000: 4, 21097: 8, 42195: 12 },
};

/** Obecna liczba biegów w tygodniu, gdy ankieta jej nie podała – do szacunku objętości. */
const DEFAULT_RUNS_PER_WEEK: Record<Level, number> = { beginner: 1, intermediate: 2, advanced: 4 };
/** Wykładnik Riegela – szybkie przeliczenie wyniku na 10 km (strefy tempa, poziom). Prognozy startu liczy forecast.ts. */
const RIEGEL = 1.06;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function toIsoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Pełne tygodnie od `today` do `raceDate` (oba `YYYY-MM-DD`). */
export function weeksUntil(raceDate: string, today: string) {
  return Math.max(0, Math.floor((parseDate(raceDate) - parseDate(today)) / (7 * DAY_MS)));
}

/** Przewidywany czas na dystansie `distanceM` na podstawie ostatniego wyniku (wzór Riegela). */
export function predictTimeS(recent: RecentResult, distanceM: number) {
  return recent.timeS * (distanceM / recent.distanceM) ** RIEGEL;
}

export function assessRaceGoal(input: {
  goal: RaceGoal;
  level: Level;
  recent?: RecentResult | null;
  /** Dzisiejsza data, `YYYY-MM-DD`. */
  today: string;
  /** Obecny kilometraż tygodniowy (np. ze Stravy) – od niego zależy, ile szybkości przeniesie się na długi dystans. */
  weeklyKm?: number | null;
  runsPerWeek?: number | null;
  /** Ile minut w tygodniu biegacz ma na treningi. */
  weeklyMinutesCap?: number | null;
}): GoalAssessment {
  const { goal, level, recent, today } = input;
  const weeks = weeksUntil(goal.raceDate, today);
  const minWeeks = MIN_PREP_WEEKS[level][goal.distanceM];

  if (weeks < minWeeks) {
    const shorter = RACE_DISTANCES_M.filter((d) => d < goal.distanceM && MIN_PREP_WEEKS[level][d] <= weeks);
    const distanceM = shorter.at(-1);
    return {
      status: 'too_soon',
      weeks,
      minWeeks,
      suggestion:
        distanceM !== undefined
          ? { kind: 'shorter_distance', distanceM }
          : { kind: 'later_date', raceDate: toIsoDate(parseDate(today) + minWeeks * 7 * DAY_MS) },
    };
  }

  if (goal.targetTimeS && recent && recent.distanceM > 0 && recent.timeS > 0) {
    const forecast = forecastRace({
      distanceM: goal.distanceM,
      weeks,
      level,
      recent,
      weeklyKm: input.weeklyKm ?? null,
      runsPerWeek: input.runsPerWeek ?? DEFAULT_RUNS_PER_WEEK[level],
      weeklyMinutesCap: input.weeklyMinutesCap ?? null,
    });
    if (forecast && goal.targetTimeS < forecast.raceDayS) {
      return {
        status: 'target_too_fast',
        weeks,
        predictedTimeS: forecast.todayS,
        // Zaokrąglone w górę do pełnej minuty – łatwiej zapamiętać i nie obiecuje za dużo.
        suggestion: { kind: 'target_time', targetTimeS: Math.ceil(forecast.raceDayS / 60) * 60 },
      };
    }
  }

  return { status: 'ok', weeks };
}

/** Domyślna liczba treningów wg poziomu (gdy użytkownik jeszcze nie wybrał). */
export function defaultSessionsPerWeek(level: Level) {
  return level === 'beginner' ? 3 : level === 'intermediate' ? 3 : 4;
}
