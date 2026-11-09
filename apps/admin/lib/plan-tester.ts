import 'server-only';

import {
  addDaysIso,
  generateInitialPlan,
  isoWeekday,
  type EngineParams,
  generatePlanWeek,
  planInputFromSurvey,
  planStartDate,
  type Level,
  type PlannedWeek,
  type SessionStructure,
  type SessionType,
  type SurveyAvailability,
  type SurveyGoal,
  type TrainingLevel,
} from '@aloha/plan-engine';

import { createServiceClient } from '@/lib/supabase/server';

// Warstwa danych testera planów. Wszystko przez service_role – wołać tylko po requireAdmin().
// Dane zdrowotne: pokazujemy wyłącznie flagę przeciwwskazań z ankiety (wejście silnika), bez check-inów i notatek.

export type TesterUserRow = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  onboardingCompletedAt: string | null;
  level: Level | null;
  weeks: number;
  isTest: boolean;
};

export type TesterSession = {
  id: string;
  scheduled_on: string;
  type: SessionType | 'rest';
  duration_min: number | null;
  distance_m: number | null;
  intensity: 'easy' | 'moderate' | 'hard' | null;
  structure: SessionStructure | Record<string, never>;
  status: 'planned' | 'done' | 'partial' | 'missed';
};

export type TesterWeek = {
  id: string;
  week_index: number;
  starts_on: string;
  focus: string | null;
  created_at: string;
  source: 'rules' | 'ai';
  ai_call_id: number | null;
  engine_config_version: number | null;
  sessions: TesterSession[];
};

export type TesterPlan = {
  id: string;
  starts_on: string;
  ends_on: string | null;
  engine_version: string | null;
  created_at: string;
  weeks: TesterWeek[];
};

export type TesterProfile = {
  display_name: string | null;
  locale: string;
  timezone: string;
  level: Level | null;
  recent_result_distance_m: number | null;
  recent_result_time_s: number | null;
  current_runs_per_week: number | null;
  weekly_km: number | null;
  has_contraindications: boolean | null;
  onboarding_completed_at: string | null;
};

export type TesterGoal = SurveyGoal & { id: string; target_time_s: number | null; created_at: string };

export type TesterUser = {
  id: string;
  email: string | null;
  createdAt: string;
  isTest: boolean;
  profile: TesterProfile | null;
  goal: TesterGoal | null;
  availability: SurveyAvailability | null;
  plan: TesterPlan | null;
};

const MAX_USERS = 1000;

export async function listTesterUsers(): Promise<TesterUserRow[]> {
  const db = createServiceClient();
  const [usersRes, profilesRes, weeksRes] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: MAX_USERS }),
    db.from('profiles').select('id, display_name, level, onboarding_completed_at'),
    db.from('weeks').select('user_id, plans!inner(status)').eq('plans.status', 'active'),
  ]);
  if (usersRes.error) throw usersRes.error;
  if (profilesRes.error) throw profilesRes.error;
  if (weeksRes.error) throw weeksRes.error;

  const profiles = new Map(profilesRes.data.map((p) => [p.id as string, p]));
  const weekCount = new Map<string, number>();
  for (const w of weeksRes.data) weekCount.set(w.user_id as string, (weekCount.get(w.user_id as string) ?? 0) + 1);

  return usersRes.data.users
    .map((u) => {
      const p = profiles.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        displayName: (p?.display_name as string | null) ?? null,
        createdAt: u.created_at,
        onboardingCompletedAt: (p?.onboarding_completed_at as string | null) ?? null,
        level: (p?.level as Level | null) ?? null,
        weeks: weekCount.get(u.id) ?? 0,
        isTest: u.user_metadata?.test_account === true,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadTesterUser(userId: string): Promise<TesterUser | null> {
  const db = createServiceClient();
  const [userRes, profileRes, goalRes, availabilityRes, planRes] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db
      .from('profiles')
      .select(
        'display_name, locale, timezone, level, recent_result_distance_m, recent_result_time_s, current_runs_per_week, weekly_km, has_contraindications, onboarding_completed_at',
      )
      .eq('id', userId)
      .maybeSingle(),
    db
      .from('goals')
      .select('id, type, general_focus, distance_m, race_date, target_time_s, plan_starts_on, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    db
      .from('availability')
      .select('preferred_days, sessions_per_week, max_minutes_weekday, max_minutes_weekend')
      .eq('user_id', userId)
      .maybeSingle(),
    db
      .from('plans')
      .select(
        'id, starts_on, ends_on, engine_version, created_at, weeks(id, week_index, starts_on, focus, created_at, source, ai_call_id, engine_config_version, sessions(id, scheduled_on, type, duration_min, distance_m, intensity, structure, status))',
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);
  if (userRes.error || !userRes.data.user) return null;
  for (const r of [profileRes, goalRes, availabilityRes, planRes]) if (r.error) throw r.error;

  const rawPlan = planRes.data as (Omit<TesterPlan, 'weeks'> & { weeks: TesterWeek[] }) | null;
  const plan: TesterPlan | null = rawPlan
    ? {
        ...rawPlan,
        weeks: [...rawPlan.weeks]
          .sort((a, b) => a.week_index - b.week_index)
          .map((w) => ({ ...w, sessions: [...w.sessions].sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on)) })),
      }
    : null;

  return {
    id: userId,
    email: userRes.data.user.email ?? null,
    createdAt: userRes.data.user.created_at,
    isTest: userRes.data.user.user_metadata?.test_account === true,
    profile: profileRes.data as TesterProfile | null,
    goal: goalRes.data as TesterGoal | null,
    availability: availabilityRes.data as SurveyAvailability | null,
    plan,
  };
}

/** Dzisiejsza data w strefie użytkownika, `YYYY-MM-DD` (jak w Edge Function generate-plan). */
export function todayIn(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export type WeekBuild =
  | { ok: true; planStartsOn: string; week: PlannedWeek }
  | { ok: false; reason: 'onboarding_incomplete' };

/**
 * Tydzień `weekIndex` z silnika reguł dla tego użytkownika.
 * Z aktywnym planem liczymy od `plans.starts_on` (numeracja zgodna z istniejącymi tygodniami),
 * bez planu – od daty startu z ankiety, jak przy pierwszym generowaniu.
 */
export function buildWeek(user: TesterUser, weekIndex: number, params?: Partial<EngineParams>, trainingLevel?: TrainingLevel | null): WeekBuild {
  const { profile, goal, availability } = user;
  if (!profile?.onboarding_completed_at || !profile.level || !goal || !availability) {
    return { ok: false, reason: 'onboarding_incomplete' };
  }
  const survey = { profile: { ...profile, level: profile.level }, goal, availability };
  // Bez planu: start jak w produkcji – pusty niepełny tydzień 0 przesuwa plan na poniedziałek.
  const planStartsOn =
    user.plan?.starts_on ??
    generateInitialPlan({ ...planInputFromSurvey(survey, planStartDate(goal, todayIn(profile.timezone))), weeks: 1, params }).startsOn;
  const input = { ...planInputFromSurvey(survey, planStartsOn), params, trainingLevel: trainingLevel ?? null };
  return { ok: true, planStartsOn, week: generatePlanWeek(input, weekIndex) };
}

/** Tydzień z bazy → tydzień silnika (do walidacji przyrostu i odstępów przy kolejnym tygodniu). */
export function plannedWeekFromRow(w: TesterWeek): PlannedWeek {
  return {
    weekIndex: w.week_index,
    startsOn: w.starts_on,
    endsOn: addDaysIso(w.starts_on, 7 - isoWeekday(w.starts_on)),
    focus: (w.focus ?? 'build') as PlannedWeek['focus'],
    sessions: w.sessions
      .filter((s): s is TesterSession & { type: SessionType } => s.type !== 'rest')
      .map((s) => ({
        scheduledOn: s.scheduled_on,
        type: s.type,
        durationMin: s.duration_min,
        distanceM: s.distance_m,
        intensity: s.intensity ?? 'easy',
        structure: s.structure as SessionStructure,
      })),
  };
}
