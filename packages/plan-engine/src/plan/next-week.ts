// Cotygodniowe generowanie: przegląd poziomu + kolejny tydzień aktywnego planu – z wierszy bazy.
// Czyste obliczenie (bez zapisu): Edge Function generate-next-week i tester w panelu zapisują wynik same.

import { addDaysIso } from '../core/dates.ts';
import type { Level } from './goal.ts';
import { reviewTrainingLevel, levelReviewInputFromRows, type LevelReview } from './level-review.ts';
import { isTrainingLevel, surveyTrainingLevel, type TrainingLevel } from './levels.ts';
import type { EngineParams } from './params.ts';
import { generateNextWeek, type Checkpoint, type PlanInput, type PlannedWeek } from './plan.ts';
import { plannedWeekFromRow, type WeekRow } from './rows.ts';
import { planInputFromSurvey, type SurveyAvailability, type SurveyGoal, type SurveyProfile } from './survey.ts';

/** Ile dni przed końcem ostatniego tygodnia generujemy kolejny. */
export const NEXT_WEEK_LEAD_DAYS = 2;

export type NextWeekRows = {
  profile: SurveyProfile & {
    level: Level;
    training_level?: number | null;
    training_level_since?: string | null;
    training_level_survey?: number | null;
  };
  goal: SurveyGoal;
  availability: SurveyAvailability;
  /** Starty kontrolne i sprawdziany z celów obok (patrz `checkpointsFromGoals`). */
  checkpoints?: Checkpoint[];
  plan: { starts_on: string; weeks: (WeekRow & { sessions: (WeekRow['sessions'][number] & { status: string })[] })[] };
  checkIns: { day: string; ai_pain: boolean | null; ai_red_flag: boolean | null }[];
  params: EngineParams;
  /** Dziś w strefie użytkownika, `YYYY-MM-DD`. */
  today: string;
  /** Pomiń sprawdzenie terminu (tester w panelu). */
  force?: boolean;
};

export type NextWeekPlan =
  | { ok: false; reason: 'no_weeks' | 'not_due' | 'after_race'; nextStartsOn: string | null }
  | {
      ok: true;
      /** Poziom z ankiety teraz (zapisywany jako odczyt do następnego przeglądu). */
      surveyLevel: TrainingLevel;
      /** Poziom przed przeglądem i czy był już zapisany w profilu. */
      previousLevel: TrainingLevel;
      levelStored: boolean;
      review: LevelReview;
      input: PlanInput;
      previousWeek: PlannedWeek;
      week: PlannedWeek;
    };

export function planNextWeek(rows: NextWeekRows): NextWeekPlan {
  const last = [...rows.plan.weeks].sort((a, b) => a.week_index - b.week_index).at(-1);
  if (!last) return { ok: false, reason: 'no_weeks', nextStartsOn: null };
  const previousWeek = plannedWeekFromRow(last);
  const nextStartsOn = addDaysIso(previousWeek.endsOn, 1);
  if (!rows.force && previousWeek.endsOn > addDaysIso(rows.today, NEXT_WEEK_LEAD_DAYS)) {
    return { ok: false, reason: 'not_due', nextStartsOn };
  }
  if (rows.goal.type === 'race' && rows.goal.race_date && rows.goal.race_date < nextStartsOn) {
    return { ok: false, reason: 'after_race', nextStartsOn };
  }

  const surveyInput = planInputFromSurvey(
    { profile: rows.profile, goal: rows.goal, availability: rows.availability, checkpoints: rows.checkpoints },
    rows.plan.starts_on,
  );
  const surveyLevel = surveyTrainingLevel(surveyInput);
  const levelStored = isTrainingLevel(rows.profile.training_level);
  const previousLevel = levelStored ? (rows.profile.training_level as TrainingLevel) : surveyLevel;

  const review = reviewTrainingLevel(
    levelReviewInputFromRows({
      current: previousLevel,
      since: rows.profile.training_level_since ?? rows.plan.starts_on,
      today: rows.today,
      surveyLevel,
      surveyLevelBefore: isTrainingLevel(rows.profile.training_level_survey) ? rows.profile.training_level_survey : null,
      weeks: rows.plan.weeks,
      checkIns: rows.checkIns,
      params: rows.params,
    }),
  );

  const input: PlanInput = { ...surveyInput, trainingLevel: review.level, params: rows.params };
  const week = generateNextWeek(input, previousWeek, review.change);
  return { ok: true, surveyLevel, previousLevel, levelStored, review, input, previousWeek, week };
}
