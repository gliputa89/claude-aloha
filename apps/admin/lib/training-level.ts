import 'server-only';

import {
  addDaysIso,
  isTrainingLevel,
  levelReviewInputFromRows,
  planInputFromSurvey,
  reviewTrainingLevel,
  surveyTrainingLevel,
  type EngineParams,
  type LevelReview,
  type NextWeekRows,
  type TrainingLevel,
} from '@aloha/plan-engine';

import type { TesterUser } from '@/lib/plan-tester';
import { todayIn } from '@/lib/plan-tester';
import { createServiceClient } from '@/lib/supabase/server';

// Poziom zaawansowania w testerze: zapisany poziom, historia zmian, podgląd cotygodniowego przeglądu.
// Gdy migracja 20261109170000_training_level nie jest wgrana w tej bazie – `available: false` (tester działa dalej).

export type LevelChangeRow = {
  id: number;
  from_level: number | null;
  to_level: number;
  source: 'survey' | 'review' | 'admin';
  reason_code: string;
  reason: string;
  created_at: string;
};

export type TrainingLevelData =
  | { available: false; error: string }
  | {
      available: true;
      level: TrainingLevel | null;
      since: string | null;
      surveyBefore: TrainingLevel | null;
      changes: LevelChangeRow[];
      /** weeks.id → baza objętości tygodnia. */
      weekBases: Record<string, number>;
      /** Dni z bólem / czerwoną flagą w check-inach (28 dni) – tylko flagi, bez treści check-inu. */
      painDays: string[];
    };

export async function loadTrainingLevel(user: TesterUser): Promise<TrainingLevelData> {
  const db = createServiceClient();
  const today = todayIn(user.profile?.timezone ?? 'Europe/Warsaw');
  const weekIds = user.plan?.weeks.map((w) => w.id) ?? [];
  const [profileRes, changesRes, weeksRes, checkInsRes] = await Promise.all([
    db.from('profiles').select('training_level, training_level_since, training_level_survey').eq('id', user.id).maybeSingle(),
    db
      .from('training_level_changes')
      .select('id, from_level, to_level, source, reason_code, reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    weekIds.length ? db.from('weeks').select('id, base_easy_min').in('id', weekIds) : Promise.resolve({ data: [], error: null }),
    db.from('check_ins').select('day, ai_pain, ai_red_flag').eq('user_id', user.id).gte('day', addDaysIso(today, -28)),
  ]);
  const error = profileRes.error ?? changesRes.error ?? weeksRes.error ?? checkInsRes.error;
  if (error) return { available: false, error: error.message };

  const p = profileRes.data;
  return {
    available: true,
    level: isTrainingLevel(p?.training_level) ? p.training_level : null,
    since: (p?.training_level_since as string | null) ?? null,
    surveyBefore: isTrainingLevel(p?.training_level_survey) ? p.training_level_survey : null,
    changes: (changesRes.data ?? []) as LevelChangeRow[],
    weekBases: Object.fromEntries(
      ((weeksRes.data ?? []) as { id: string; base_easy_min: number | string | null }[])
        .filter((w) => w.base_easy_min !== null)
        .map((w) => [w.id, Number(w.base_easy_min)]),
    ),
    painDays: ((checkInsRes.data ?? []) as { day: string; ai_pain: boolean | null; ai_red_flag: boolean | null }[])
      .filter((c) => c.ai_pain || c.ai_red_flag)
      .map((c) => c.day),
  };
}

/** Wiersze dla `planNextWeek` (jak w Edge Function generate-next-week). Brak ankiety / planu → null. */
export function nextWeekRows(user: TesterUser, data: Extract<TrainingLevelData, { available: true }>, params: EngineParams): NextWeekRows | null {
  const { profile, goal, availability, plan } = user;
  if (!profile?.onboarding_completed_at || !profile.level || !goal || !availability || !plan) return null;
  return {
    profile: {
      ...profile,
      level: profile.level,
      training_level: data.level,
      training_level_since: data.since,
      training_level_survey: data.surveyBefore,
    },
    goal,
    availability,
    plan: {
      starts_on: plan.starts_on,
      weeks: plan.weeks.map((w) => ({ ...w, base_easy_min: data.weekBases[w.id] ?? null })),
    },
    checkIns: data.painDays.map((day) => ({ day, ai_pain: true, ai_red_flag: false })),
    params,
    today: todayIn(profile.timezone),
    force: true,
  };
}

/** Poziom z ankiety teraz (bez zapisanego poziomu). */
export function surveyLevelOf(user: TesterUser): TrainingLevel | null {
  const { profile, goal, availability } = user;
  if (!profile?.level || !goal || !availability) return null;
  return surveyTrainingLevel(planInputFromSurvey({ profile: { ...profile, level: profile.level }, goal, availability }, '2000-01-01'));
}

/** Podgląd przeglądu poziomu na dziś – nic nie zapisuje. */
export function previewReview(user: TesterUser, data: Extract<TrainingLevelData, { available: true }>, params: EngineParams): LevelReview | null {
  const surveyLevel = surveyLevelOf(user);
  if (!surveyLevel || !user.plan || !user.profile) return null;
  return reviewTrainingLevel(
    levelReviewInputFromRows({
      current: data.level ?? surveyLevel,
      since: data.since ?? user.plan.starts_on,
      today: todayIn(user.profile.timezone),
      surveyLevel,
      surveyLevelBefore: data.surveyBefore,
      weeks: user.plan.weeks,
      checkIns: data.painDays.map((day) => ({ day, ai_pain: true, ai_red_flag: false })),
      params,
    }),
  );
}
