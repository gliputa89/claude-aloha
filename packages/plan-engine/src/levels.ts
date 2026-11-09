// Poziom zaawansowania (1–5) – od niego zależą objętość i przyrost planu (parametry per poziom w params.ts).
//
// Liczony z ankiety: deklaracja „jak biegasz” (nie / okazjonalnie / regularnie) + ostatni wynik
// przeliczony na 10 km (Riegel). Bez wyniku – tylko z deklaracji. Progi są logiką w kodzie.

import { predictTimeS, type Level } from './goal.ts';

export const TRAINING_LEVELS = [1, 2, 3, 4, 5] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

/** Progi czasu na 10 km (po przeliczeniu ostatniego wyniku). */
export const LEVEL_10K_FAST_S = 55 * 60;
export const LEVEL_10K_ELITE_S = 45 * 60;

export const TRAINING_LEVEL_INFO: Record<TrainingLevel, { label: string; criterion: string }> = {
  1: { label: 'Start', criterion: '„nie biegam”' },
  2: { label: 'Początkujący', criterion: 'okazjonalnie; bez wyniku lub 10 km > 55 min' },
  3: { label: 'Średni', criterion: 'okazjonalnie i 10 km ≤ 55 min albo regularnie i 10 km > 55 min' },
  4: { label: 'Zaawansowany', criterion: 'regularnie; bez wyniku lub 10 km 45–55 min' },
  5: { label: 'Wyczynowy', criterion: 'regularnie i 10 km < 45 min' },
};

type RecentInput = { distanceM: number; timeS: number | null } | null | undefined;

/** Ostatni wynik przeliczony na 10 km (s) albo `null`, gdy brak wyniku lub jest niepełny. */
export function equivalent10kS(recent: RecentInput): number | null {
  if (!recent || !recent.timeS || recent.timeS <= 0 || recent.distanceM <= 0) return null;
  return predictTimeS({ distanceM: recent.distanceM, timeS: recent.timeS }, 10000);
}

export const isTrainingLevel = (n: unknown): n is TrainingLevel => (TRAINING_LEVELS as readonly unknown[]).includes(n);

/**
 * Poziom, którym liczy silnik: zapisany w profilu (`trainingLevel`, zmieniany co tydzień przez przegląd poziomu
 * – level-review.ts) albo – gdy go jeszcze nie ma – wyliczony z ankiety.
 */
export function trainingLevelOf(input: { level: Level; recentResult?: RecentInput; trainingLevel?: TrainingLevel | null }): TrainingLevel {
  return input.trainingLevel ?? surveyTrainingLevel(input);
}

/** Poziom zaawansowania z ankiety. Wynik może podnieść lub obniżyć poziom o jeden względem deklaracji, nigdy dla „nie biegam”. */
export function surveyTrainingLevel(input: { level: Level; recentResult?: RecentInput }): TrainingLevel {
  if (input.level === 'beginner') return 1;
  const t = equivalent10kS(input.recentResult);
  if (input.level === 'intermediate') return t !== null && t <= LEVEL_10K_FAST_S ? 3 : 2;
  if (t === null) return 4;
  return t < LEVEL_10K_ELITE_S ? 5 : t <= LEVEL_10K_FAST_S ? 4 : 3;
}
