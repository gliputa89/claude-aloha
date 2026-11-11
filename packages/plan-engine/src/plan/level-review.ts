// Cotygodniowy przegląd poziomu zaawansowania (1–5) – przy generowaniu kolejnego tygodnia.
//
// Kolejność (pierwsza pasująca reguła wygrywa, zawsze o jeden poziom):
//   1. spadek – ból / czerwona flaga w check-inie (14 dni), przerwa w treningach, mało wykonanych treningów,
//   2. nowa ankieta lub wynik – o jeden w stronę poziomu wyliczonego z ankiety,
//   3. awans – dość długo na poziomie, wysoka realizacja, bez bólu (28 dni).
// Progi: parametry z grupy „Zmiana poziomu” (kolumna obecnego poziomu). Jedno miejsce dla Edge Function i testera.

import { addDaysIso, daysBetween, isoWeekday } from '../core/dates.ts';
import { TRAINING_LEVEL_INFO, type TrainingLevel } from './levels.ts';
import { paramsForLevel, type EngineParams } from './params.ts';

/** Realizacja jednego pełnego tygodnia (pon–nd), który już się skończył. */
export type WeekCompletion = { startsOn: string; planned: number; done: number };

export type LevelReviewInput = {
  /** Obecny poziom (zapisany w profilu). */
  current: TrainingLevel;
  /** Od kiedy jest na obecnym poziomie, `YYYY-MM-DD`. */
  since: string;
  /** Dziś, `YYYY-MM-DD` (strefa użytkownika). */
  today: string;
  /** Poziom wyliczony z ankiety teraz i przy poprzednim przeglądzie (zmiana = nowa ankieta lub wynik). */
  surveyLevel: TrainingLevel;
  surveyLevelBefore: TrainingLevel | null;
  /** Zakończone pełne tygodnie planu, od najstarszego. */
  weeks: WeekCompletion[];
  /** Ostatni wykonany (lub częściowo) trening. */
  lastDoneOn: string | null;
  /** Pierwszy zaplanowany trening w planie (przerwa liczy się dopiero od niego). */
  firstPlannedOn: string | null;
  /** Dni z check-inu z bólem albo czerwoną flagą. */
  painDays: string[];
  params: EngineParams;
};

export type LevelReviewCode =
  | 'pain'
  | 'break'
  | 'low_completion'
  | 'survey_up'
  | 'survey_down'
  | 'progress'
  | 'stay';

export type LevelReview = {
  level: TrainingLevel;
  change: 'up' | 'down' | 'none';
  code: LevelReviewCode;
  /** Krótkie uzasadnienie po polsku (historia zmian, panel). */
  reason: string;
  /** Liczby, na podstawie których zdecydowano (do historii). */
  stats: {
    weeksOnLevel: number;
    donePctLast3: number | null;
    donePctLast2: (number | null)[];
    daysSinceLastDone: number | null;
    painDaysLast14: number;
    painDaysLast28: number;
    surveyLevel: TrainingLevel;
  };
};

const pct = (w: WeekCompletion) => (w.planned > 0 ? Math.round((w.done / w.planned) * 100) : null);
const step = (level: TrainingLevel, by: 1 | -1) => Math.min(5, Math.max(1, level + by)) as TrainingLevel;

export function reviewTrainingLevel(input: LevelReviewInput): LevelReview {
  const { current, today } = input;
  const p = paramsForLevel(input.params, current);
  const withPlan = input.weeks.filter((w) => w.planned > 0);
  const last3 = withPlan.slice(-3);
  const last2 = withPlan.slice(-2);
  const sum = (ws: WeekCompletion[], k: 'planned' | 'done') => ws.reduce((n, w) => n + w[k], 0);
  const painSince = (days: number) => input.painDays.filter((d) => d > addDaysIso(today, -days) && d <= today).length;
  const breakFrom = input.lastDoneOn ?? input.firstPlannedOn;

  const stats: LevelReview['stats'] = {
    weeksOnLevel: Math.floor(Math.max(0, daysBetween(input.since, today)) / 7),
    donePctLast3: last3.length === 3 && sum(last3, 'planned') > 0 ? Math.round((sum(last3, 'done') / sum(last3, 'planned')) * 100) : null,
    donePctLast2: last2.map(pct),
    daysSinceLastDone: breakFrom && breakFrom <= today ? daysBetween(breakFrom, today) : null,
    painDaysLast14: painSince(14),
    painDaysLast28: painSince(28),
    surveyLevel: input.surveyLevel,
  };
  const result = (level: TrainingLevel, code: LevelReviewCode, reason: string): LevelReview => ({
    level,
    change: level > current ? 'up' : level < current ? 'down' : 'none',
    code,
    reason,
    stats,
  });
  const to = (l: TrainingLevel) => `${l} (${TRAINING_LEVEL_INFO[l].label})`;

  // 1. Spadek – bezpieczeństwo pierwsze.
  if (current > 1) {
    if (stats.painDaysLast14 > 0) {
      return result(step(current, -1), 'pain', `Ból lub czerwona flaga w check-inie w ostatnich 14 dniach → poziom ${to(step(current, -1))}.`);
    }
    if (stats.daysSinceLastDone !== null && stats.daysSinceLastDone >= p.levelBreakDays) {
      return result(step(current, -1), 'break', `${stats.daysSinceLastDone} dni bez treningu (próg ${p.levelBreakDays}) → poziom ${to(step(current, -1))}.`);
    }
    const low = last2.length === 2 && last2.every((w) => (pct(w) ?? 100) < p.levelDownMaxDonePct);
    if (low) {
      return result(
        step(current, -1),
        'low_completion',
        `Wykonane treningi w 2 ostatnich tygodniach: ${stats.donePctLast2.join('%, ')}% (< ${p.levelDownMaxDonePct}%) → poziom ${to(step(current, -1))}.`,
      );
    }
  }

  // 2. Nowa ankieta lub wynik – o jeden w stronę poziomu z ankiety (w górę tylko bez bólu w 28 dniach).
  if (input.surveyLevelBefore !== null && input.surveyLevel !== input.surveyLevelBefore && input.surveyLevel !== current) {
    if (input.surveyLevel < current) {
      return result(step(current, -1), 'survey_down', `Nowa ankieta / wynik wskazuje poziom ${input.surveyLevel} → poziom ${to(step(current, -1))}.`);
    }
    if (stats.painDaysLast28 === 0) {
      return result(step(current, 1), 'survey_up', `Nowy wynik / ankieta wskazuje poziom ${input.surveyLevel} → poziom ${to(step(current, 1))}.`);
    }
  }

  // 3. Awans – stabilna realizacja przez kilka tygodni.
  if (
    current < 5 &&
    stats.weeksOnLevel >= p.levelUpMinWeeks &&
    stats.donePctLast3 !== null &&
    stats.donePctLast3 >= p.levelUpMinDonePct &&
    stats.painDaysLast28 === 0
  ) {
    return result(
      step(current, 1),
      'progress',
      `${stats.weeksOnLevel} tyg. na poziomie, wykonane ${stats.donePctLast3}% treningów w 3 tygodniach (próg ${p.levelUpMinDonePct}%) → poziom ${to(step(current, 1))}.`,
    );
  }

  return result(current, 'stay', `Bez zmian – poziom ${to(current)}.`);
}

/** Wiersze z bazy → wejście przeglądu (sesje aktywnego planu i check-iny z bólem). */
export function levelReviewInputFromRows(rows: {
  current: TrainingLevel;
  since: string;
  today: string;
  surveyLevel: TrainingLevel;
  surveyLevelBefore: TrainingLevel | null;
  weeks: { starts_on: string; sessions: { scheduled_on: string; type: string; status: string }[] }[];
  checkIns: { day: string; ai_pain: boolean | null; ai_red_flag: boolean | null }[];
  params: EngineParams;
}): LevelReviewInput {
  const regular = (s: { type: string }) => s.type !== 'rest' && s.type !== 'race';
  const isDone = (s: { status: string }) => s.status === 'done' || s.status === 'partial';
  const sessions = rows.weeks.flatMap((w) => w.sessions).filter(regular);
  const done = sessions.filter(isDone).map((s) => s.scheduled_on).sort();
  const planned = sessions.map((s) => s.scheduled_on).filter((d) => d <= rows.today).sort();
  return {
    current: rows.current,
    since: rows.since,
    today: rows.today,
    surveyLevel: rows.surveyLevel,
    surveyLevelBefore: rows.surveyLevelBefore,
    weeks: rows.weeks
      // Tylko pełne (od poniedziałku) i zakończone tygodnie.
      .filter((w) => isoWeekday(w.starts_on) === 1 && addDaysIso(w.starts_on, 6) < rows.today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
      .map((w) => {
        const ws = w.sessions.filter(regular);
        return { startsOn: w.starts_on, planned: ws.length, done: ws.filter(isDone).length };
      }),
    lastDoneOn: done.at(-1) ?? null,
    firstPlannedOn: planned[0] ?? null,
    painDays: rows.checkIns.filter((c) => c.ai_pain || c.ai_red_flag).map((c) => c.day),
    params: rows.params,
  };
}
