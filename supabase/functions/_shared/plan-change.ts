// Wspólne dla czatu z trenerem i check-inu: wczytanie planu biegacza, sprawdzenie propozycji zmiany regułami silnika
// i wykonanie jej na treningu w bazie. Propozycja ma zawsze kształt ChatChange (packages/plan-engine/src/chat/chat.ts).

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import {
  chatChangeWrite,
  checkChatChange,
  checkpointsFromGoals,
  GOAL_COLUMNS,
  engineFromRow,
  planInputFromSurvey,
  plannedWeekFromRow,
  type ChatChange,
} from './plan-engine/index.ts';

export function todayIn(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export type SessionRow = {
  id: string;
  scheduled_on: string;
  type: string;
  duration_min: number | null;
  distance_m: number | null;
  intensity: string | null;
  structure: unknown;
  status: string;
  actual_distance_m: number | null;
  actual_duration_s: number | null;
};
export type WeekRow = { id: string; week_index: number; starts_on: string; focus: string | null; base_easy_min: number | null; sessions: SessionRow[] };

/** Plan, ankieta i parametry silnika – wszystko, czego trzeba do kontekstu rozmowy i do sprawdzenia zmiany. */
export async function loadPlan(db: SupabaseClient, userId: string) {
  const [profile, goals, availability, plan, config] = await Promise.all([
    db
      .from('profiles')
      .select('level, locale, timezone, has_contraindications, recent_result_distance_m, recent_result_time_s, training_level')
      .eq('id', userId)
      .maybeSingle(),
    db.from('goals').select(`type, general_focus, ${GOAL_COLUMNS}`).eq('user_id', userId).eq('status', 'active'),
    db.from('availability').select('preferred_days, sessions_per_week, max_minutes_weekday, max_minutes_weekend').eq('user_id', userId).maybeSingle(),
    db
      .from('plans')
      .select(
        'id, starts_on, weeks(id, week_index, starts_on, focus, base_easy_min, sessions(id, scheduled_on, type, duration_min, distance_m, intensity, structure, status, actual_distance_m, actual_duration_s))',
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    db.rpc('get_engine_config'),
  ]);
  for (const r of [profile, goals, availability, plan]) if (r.error) throw new Error(r.error.message);
  // Prowadzący układa plan; starty kontrolne i sprawdziany z celów obok są w tygodniach tak jak w generate-plan.
  const goal = { data: (goals.data ?? []).find((g) => g.role === 'primary') ?? null };
  const checkpoints = checkpointsFromGoals(goals.data ?? []);
  const weeks = ((plan.data?.weeks ?? []) as WeekRow[]).sort((a, b) => a.week_index - b.week_index);
  const today = todayIn((profile.data?.timezone as string | undefined) ?? 'Europe/Warsaw');
  const input =
    profile.data?.level && goal.data && availability.data && plan.data
      ? {
          ...planInputFromSurvey(
            { profile: { ...profile.data, level: profile.data.level }, goal: goal.data, availability: availability.data, checkpoints },
            plan.data.starts_on,
          ),
          params: engineFromRow(config.data).params,
        }
      : null;
  return { profile: profile.data, goal: goal.data, weeks, today, input };
}

export type Loaded = Awaited<ReturnType<typeof loadPlan>>;

/** Czy zmianę da się teraz wykonać na planie z bazy; przy `ok` – tydzień po zmianie. */
export function checkChange(change: ChatChange, loaded: Loaded) {
  if (!loaded.input) return { ok: false as const, reason: 'brak planu' };
  const sessions = loaded.weeks.flatMap((w) => w.sessions).filter((s) => s.type !== 'rest');
  return checkChatChange(change, {
    input: loaded.input,
    weeks: loaded.weeks.map((w) => plannedWeekFromRow(w)),
    statuses: new Map(sessions.map((s) => [s.scheduled_on, s.status])),
    today: loaded.today,
  });
}

/**
 * Wykonuje zaakceptowaną zmianę na treningu. `expired` – plan zmienił się od czasu propozycji albo trening jest już
 * zrobiony, więc niczego nie ruszamy.
 */
export async function applyPlanChange(db: SupabaseClient, loaded: Loaded, change: ChatChange): Promise<'accepted' | 'expired'> {
  const checked = checkChange(change, loaded);
  const write = checked.ok ? chatChangeWrite(change, checked.weeks) : null;
  const row = loaded.weeks.flatMap((w) => w.sessions).find((s) => s.scheduled_on === change.date && s.type !== 'rest');
  if (!checked.ok || !write || !row) return 'expired';
  const applied =
    write.kind === 'delete'
      ? await db.from('sessions').delete().eq('id', row.id).eq('status', 'planned')
      : await db
          .from('sessions')
          .update({
            scheduled_on: write.session.scheduledOn,
            type: write.session.type,
            duration_min: write.session.durationMin,
            distance_m: write.session.distanceM,
            intensity: write.session.intensity,
            structure: write.session.structure,
          })
          .eq('id', row.id)
          .eq('status', 'planned');
  if (applied.error) throw new Error(applied.error.message);
  return 'accepted';
}
