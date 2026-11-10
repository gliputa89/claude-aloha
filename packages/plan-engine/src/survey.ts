// Odpowiedzi z ankiety (wiersze z bazy) → wejście silnika planu.
// Jedno miejsce dla Edge Function generate-plan i testera w panelu – tester liczy dokładnie tak jak produkcja.

import type { Level, RaceDistanceM } from './goal.ts';
import { isTrainingLevel } from './levels.ts';
import type { PlanGoal, PlanInput } from './plan.ts';

export type SurveyProfile = {
  level: Level | null;
  has_contraindications: boolean | null;
  recent_result_distance_m?: number | null;
  recent_result_time_s?: number | null;
  /** Poziom zapisany w profilu (1–5); brak → silnik wylicza go z ankiety. */
  training_level?: number | null;
};

export type SurveyGoal = {
  type: 'general' | 'race';
  general_focus: 'start_running' | 'improve_fitness' | 'run_regularly' | null;
  distance_m: number | null;
  race_date: string | null;
  plan_starts_on: string | null;
};

export type SurveyAvailability = {
  preferred_days: number[] | null;
  sessions_per_week: number;
  max_minutes_weekday: number | null;
  max_minutes_weekend: number | null;
};

export function planGoalFromSurvey(goal: SurveyGoal): PlanGoal {
  return goal.type === 'race' && goal.distance_m && goal.race_date
    ? { type: 'race', distanceM: goal.distance_m as RaceDistanceM, raceDate: goal.race_date }
    : { type: 'general', focus: goal.general_focus ?? 'run_regularly' };
}

/** Plan nie zaczyna się w przeszłości (np. gdy generujemy go ponownie kilka dni po ankiecie). */
export function planStartDate(goal: Pick<SurveyGoal, 'plan_starts_on'>, today: string) {
  return goal.plan_starts_on && goal.plan_starts_on > today ? goal.plan_starts_on : today;
}

export function planInputFromSurvey(
  survey: { profile: SurveyProfile & { level: Level }; goal: SurveyGoal; availability: SurveyAvailability },
  startDate: string,
): PlanInput {
  const { profile, goal, availability } = survey;
  return {
    startDate,
    level: profile.level,
    goal: planGoalFromSurvey(goal),
    preferredDays: availability.preferred_days ?? [],
    sessionsPerWeek: availability.sessions_per_week,
    maxMinutesWeekday: availability.max_minutes_weekday,
    maxMinutesWeekend: availability.max_minutes_weekend,
    hasContraindications: !!profile.has_contraindications,
    trainingLevel: isTrainingLevel(profile.training_level) ? profile.training_level : null,
    recentResult: profile.recent_result_distance_m
      ? { distanceM: profile.recent_result_distance_m, timeS: profile.recent_result_time_s ?? null }
      : null,
  };
}
