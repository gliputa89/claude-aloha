// Edge Function: generuje pierwsze 2 tygodnie planu po ankiecie (docs/PROJECT.md 3 i 4.3).
//
// Wywołanie z aplikacji: supabase.functions.invoke('generate-plan') – z tokenem zalogowanego użytkownika.
// Reguły: packages/plan-engine (kopiowane do _shared/plan-engine przez scripts/sync-plan-engine.sh).
// Zapis: public.save_generated_plan (jedna transakcja, tylko service_role).
//
// Później: tu wejdzie personalizacja przez Claude API, walidowana tym samym silnikiem reguł.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { generateInitialPlan, type PlanGoal, type PlanInput } from '../_shared/plan-engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Dzisiejsza data w strefie użytkownika, `YYYY-MM-DD`. */
function todayIn(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'unauthorized' }, 401);

  const [profileRes, goalRes, availabilityRes] = await Promise.all([
    admin
      .from('profiles')
      .select('level, has_contraindications, timezone, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle(),
    admin
      .from('goals')
      .select('id, type, general_focus, distance_m, race_date, plan_starts_on')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    admin
      .from('availability')
      .select('preferred_days, sessions_per_week, max_minutes_weekday, max_minutes_weekend')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const goal = goalRes.data;
  const availability = availabilityRes.data;
  if (!profile?.onboarding_completed_at || !profile.level || !goal || !availability) {
    return json({ error: 'onboarding_incomplete' }, 409);
  }

  const planGoal: PlanGoal =
    goal.type === 'race' && goal.distance_m && goal.race_date
      ? { type: 'race', distanceM: goal.distance_m, raceDate: goal.race_date }
      : { type: 'general', focus: goal.general_focus ?? 'run_regularly' };

  // Plan nie zaczyna się w przeszłości (np. gdy generujemy go ponownie kilka dni później).
  const today = todayIn(profile.timezone ?? 'Europe/Warsaw');
  const startDate = goal.plan_starts_on && goal.plan_starts_on > today ? goal.plan_starts_on : today;

  const input: PlanInput = {
    startDate,
    level: profile.level,
    goal: planGoal,
    preferredDays: availability.preferred_days ?? [],
    sessionsPerWeek: availability.sessions_per_week,
    maxMinutesWeekday: availability.max_minutes_weekday,
    maxMinutesWeekend: availability.max_minutes_weekend,
    hasContraindications: !!profile.has_contraindications,
  };

  const plan = generateInitialPlan(input);

  const { data: planId, error: saveError } = await admin.rpc('save_generated_plan', {
    p_user_id: user.id,
    p_goal_id: goal.id,
    p_plan: plan,
  });
  if (saveError) {
    console.error('save_generated_plan failed', saveError.code, saveError.message);
    return json({ error: 'save_failed' }, 500);
  }

  return json({
    planId,
    startsOn: plan.startsOn,
    endsOn: plan.endsOn,
    sessions: plan.weeks.reduce((n, w) => n + w.sessions.length, 0),
  });
});
