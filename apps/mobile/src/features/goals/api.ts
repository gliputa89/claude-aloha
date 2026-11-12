import {
  GOAL_COLUMNS,
  type GoalRow,
  type GoalSpec,
  type Level,
  type ProgressActivity,
  type ProgressContext,
  type ProgressSession,
} from '@aloha/plan-engine';

import { addDays, todayIso, toIsoDate } from '@/features/onboarding/time';
import { supabase } from '@/lib/supabase';

/** Cele z bazy: aktywne (prowadzący + obok) i zakończone (osiągnięte / ukończone), najnowsze pierwsze. */
export type GoalsData = {
  active: GoalRow[];
  finished: GoalRow[];
  /** Dane do liczenia postępu (treningi ze wszystkich planów, biegi ze Stravy, ankieta). */
  context: ProgressContext;
};

/** Ile wstecz czytamy treningi i biegi – cele rzadko trwają dłużej. */
const HISTORY_DAYS = 400;

export async function fetchGoals(): Promise<GoalsData> {
  const since = toIsoDate(addDays(new Date(), -HISTORY_DAYS));
  const [goalsRes, profileRes, availabilityRes, sessionsRes, activitiesRes] = await Promise.all([
    supabase.from('goals').select(GOAL_COLUMNS).in('status', ['active', 'achieved', 'completed']).order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('level, recent_result_distance_m, recent_result_time_s, weekly_km, current_runs_per_week')
      .maybeSingle(),
    supabase.from('availability').select('sessions_per_week, max_minutes_weekday, max_minutes_weekend').maybeSingle(),
    supabase
      .from('sessions')
      .select('scheduled_on, type, status, duration_min, structure, actual_distance_m, actual_duration_s')
      .gte('scheduled_on', since)
      .neq('type', 'rest'),
    supabase.from('strava_activities').select('local_date, distance_m, moving_time_s').gte('local_date', since),
  ]);
  if (goalsRes.error) throw goalsRes.error;
  const goals = (goalsRes.data ?? []) as GoalRow[];
  const profile = profileRes.data;
  const availability = availabilityRes.data;
  const recent =
    profile?.recent_result_distance_m && profile.recent_result_time_s
      ? { distanceM: profile.recent_result_distance_m as number, timeS: profile.recent_result_time_s as number }
      : null;
  const sessionsPerWeek = (availability?.sessions_per_week as number | undefined) ?? 3;
  const weekday = (availability?.max_minutes_weekday as number | null | undefined) ?? null;
  const weekend = (availability?.max_minutes_weekend as number | null | undefined) ?? null;
  return {
    active: goals.filter((g) => g.status === 'active'),
    finished: goals.filter((g) => g.status === 'achieved' || g.status === 'completed'),
    context: {
      today: todayIso(),
      // Błąd tabel z treningami / Stravą = postęp bez nich (cele i tak się pokażą).
      sessions: sessionsRes.error ? [] : ((sessionsRes.data ?? []) as ProgressSession[]),
      activities: activitiesRes.error ? [] : ((activitiesRes.data ?? []) as ProgressActivity[]),
      level: ((profile?.level as Level | null | undefined) ?? 'beginner'),
      recent,
      weeklyKm: (profile?.weekly_km as number | null | undefined) ?? null,
      runsPerWeek: (profile?.current_runs_per_week as number | null | undefined) ?? sessionsPerWeek,
      // Tydzień: do dwóch treningów w weekend, reszta w dni powszednie.
      weeklyMinutesCap: weekday && weekend ? Math.max(0, sessionsPerWeek - 2) * weekday + Math.min(sessionsPerWeek, 2) * weekend : null,
    },
  };
}

/** Kody błędów z RPC, które aplikacja pokazuje inaczej niż „spróbuj jeszcze raz”. */
export type GoalSaveError = 'too_many_goals' | 'failed';

const errorOf = (e: { message?: string } | null): GoalSaveError =>
  e?.message?.includes('too_many_goals') ? 'too_many_goals' : 'failed';

/** Nowy cel. `primary` – nowy cel prowadzi plan (dotychczasowy prowadzący zostaje obok). */
export async function addGoal(spec: GoalSpec, primary: boolean): Promise<{ id: string } | { error: GoalSaveError }> {
  const { data, error } = await supabase.rpc('add_goal', { p_goal: spec, p_primary: primary });
  return error ? { error: errorOf(error) } : { id: data as string };
}

export async function setPrimaryGoal(goalId: string): Promise<GoalSaveError | null> {
  const { error } = await supabase.rpc('set_primary_goal', { p_goal_id: goalId });
  return error ? errorOf(error) : null;
}

/** Koniec celu: `achieved` – osiągnięty, inaczej ukończony (np. zawody bez docelowego czasu). */
export async function finishGoal(goalId: string, achieved: boolean, resultTimeS: number | null): Promise<boolean> {
  const { error } = await supabase.rpc('finish_goal', { p_goal_id: goalId, p_achieved: achieved, p_result_time_s: resultTimeS });
  return !error;
}

/** Usuwa cel obok (prowadzącego nie da się usunąć – najpierw inny cel musi przejąć plan). */
export async function removeGoal(goalId: string): Promise<boolean> {
  const { error } = await supabase.rpc('remove_goal', { p_goal_id: goalId });
  return !error;
}

