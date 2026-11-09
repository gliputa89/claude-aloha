// Edge Function: cotygodniowe generowanie kolejnego tygodnia planu + przegląd poziomu zaawansowania.
//
// Dla każdego użytkownika z aktywnym planem, któremu ostatni tydzień kończy się w ciągu 2 dni:
//   1. przegląd poziomu (packages/plan-engine/level-review.ts) z realizacji treningów i check-inów,
//      zapis w profiles.training_level + historia w training_level_changes (gdy się zmienił),
//   2. kolejny tydzień z silnika reguł od bazy objętości poprzedniego tygodnia (bez skoku przy zmianie poziomu),
//   3. Claude dopasowuje szkic (jak w generate-plan), silnik waliduje; błąd → sam szkic,
//   4. zapis tygodnia (save_next_plan_week – idempotentnie, drugi raz nic nie dopisze).
//
// Wywołania:
//   * cron (pg_cron + pg_net, codziennie) – nagłówek Authorization: Bearer <SERVICE_ROLE_KEY> → wszyscy, którym wypada termin,
//   * aplikacja – token zalogowanego użytkownika → tylko on (np. po otwarciu aplikacji, gdy brak tygodnia na jutro).
// Logika: packages/plan-engine (kopiowane do _shared/plan-engine przez scripts/sync-plan-engine.sh).

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { claudeCaller, claudeKey } from '../_shared/claude.ts';
import {
  addDaysIso,
  aiAthleteFromSurvey,
  engineFromRow,
  NEXT_WEEK_LEAD_DAYS,
  planNextWeek,
  planWeeksWithAi,
  promptFromRow,
  ENGINE_VERSION,
  type AiCallPayload,
  type AiCallRecord,
  type AiEngineConfig,
  type AiPromptConfig,
} from '../_shared/plan-engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function todayIn(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

type Outcome = { userId: string; status: 'created' | 'exists' | 'skipped' | 'error'; detail?: string; level?: number; levelChange?: string };

async function processUser(
  db: SupabaseClient,
  userId: string,
  ctx: { engine: AiEngineConfig; prompt: AiPromptConfig; apiKey: string | null; isTest: (id: string) => Promise<boolean> },
): Promise<Outcome> {
  const [profileRes, goalRes, availabilityRes, planRes] = await Promise.all([
    db
      .from('profiles')
      .select(
        'level, locale, timezone, has_contraindications, onboarding_completed_at, recent_result_distance_m, recent_result_time_s, current_runs_per_week, weekly_km, training_level, training_level_since, training_level_survey',
      )
      .eq('id', userId)
      .maybeSingle(),
    db
      .from('goals')
      .select('id, type, general_focus, distance_m, race_date, target_time_s, plan_starts_on')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    db.from('availability').select('preferred_days, sessions_per_week, max_minutes_weekday, max_minutes_weekend').eq('user_id', userId).maybeSingle(),
    db
      .from('plans')
      .select('id, starts_on, weeks(week_index, starts_on, focus, base_easy_min, sessions(scheduled_on, type, duration_min, distance_m, intensity, structure, status))')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);
  for (const r of [profileRes, goalRes, availabilityRes, planRes]) if (r.error) return { userId, status: 'error', detail: r.error.message };
  const profile = profileRes.data;
  const goal = goalRes.data;
  const availability = availabilityRes.data;
  const plan = planRes.data;
  if (!profile?.onboarding_completed_at || !profile.level || !goal || !availability) return { userId, status: 'skipped', detail: 'onboarding_incomplete' };
  if (!plan) return { userId, status: 'skipped', detail: 'no_active_plan' };

  const today = todayIn(profile.timezone ?? 'Europe/Warsaw');
  // Check-iny: tylko flagi bólu / czerwonej flagi z 28 dni (dane zdrowotne – nic więcej nie czytamy).
  const checkInsRes = await db
    .from('check_ins')
    .select('day, ai_pain, ai_red_flag')
    .eq('user_id', userId)
    .gte('day', addDaysIso(today, -28));
  if (checkInsRes.error) return { userId, status: 'error', detail: checkInsRes.error.message };

  const next = planNextWeek({
    profile: { ...profile, level: profile.level },
    goal,
    availability,
    plan,
    checkIns: checkInsRes.data ?? [],
    params: ctx.engine.params,
    today,
  });
  if (!next.ok) return { userId, status: 'skipped', detail: next.reason };

  const { review } = next;
  const { error: levelError } = await db.rpc('set_training_level', {
    p_user_id: userId,
    p_level: review.level,
    p_source: next.levelStored ? 'review' : 'survey',
    p_reason_code: next.levelStored ? review.code : 'initial',
    p_reason: review.reason,
    p_stats: review.stats,
    p_survey_level: next.surveyLevel,
    p_on: next.week.startsOn,
  });
  if (levelError) return { userId, status: 'error', detail: `set_training_level: ${levelError.message}` };

  const survey = { profile: { ...profile, level: profile.level }, goal, availability };
  const outcome = ctx.apiKey
    ? await planWeeksWithAi({
        input: next.input,
        draft: [next.week],
        previousWeek: next.previousWeek,
        athlete: aiAthleteFromSurvey(survey),
        today,
        prompt: ctx.prompt,
        engine: ctx.engine,
        call: claudeCaller(ctx.apiKey),
        log: async (call: AiCallRecord, payload: AiCallPayload) => {
          const { data, error } = await db.rpc('log_ai_call', { p_call: call, p_payload: payload });
          if (error) console.error('log_ai_call failed', error.code, error.message);
          return (data as number | null) ?? null;
        },
        meta: { userId, source: 'app', isTest: await ctx.isTest(userId) },
      })
    : null;

  const week = outcome?.weeks?.[0] ?? next.week;
  const { data: weekId, error: saveError } = await db.rpc('save_next_plan_week', {
    p_user_id: userId,
    p_plan_id: plan.id,
    p_week: {
      ...week,
      source: outcome?.source ?? 'rules',
      aiCallId: outcome?.source === 'ai' ? outcome.finalCallId : null,
      engineConfigVersion: ctx.engine.version,
    },
  });
  if (saveError) return { userId, status: 'error', detail: `save_next_plan_week: ${saveError.message}` };
  return { userId, status: weekId ? 'created' : 'exists', level: review.level, levelChange: review.change };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Cron (klucz service_role) → wszyscy z terminem; inaczej tylko zalogowany użytkownik.
  let userIds: string[];
  if (token === serviceKey) {
    const horizon = addDaysIso(new Date().toISOString().slice(0, 10), NEXT_WEEK_LEAD_DAYS + 1);
    const { data, error } = await db.from('plans').select('user_id').eq('status', 'active').lte('ends_on', horizon);
    if (error) return json({ error: 'load_failed', detail: error.message }, 500);
    userIds = (data ?? []).map((r) => r.user_id as string);
  } else {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return json({ error: 'unauthorized' }, 401);
    userIds = [data.user.id];
  }

  const [promptRes, configRes] = await Promise.all([db.rpc('get_ai_prompt', { p_function: 'plan-weeks' }), db.rpc('get_engine_config')]);
  if (promptRes.error) console.error('get_ai_prompt failed', promptRes.error.message);
  if (configRes.error) console.error('get_engine_config failed', configRes.error.message);
  const apiKey = claudeKey();
  if (!apiKey) console.warn('ANTHROPIC_API_KEY not set – weeks from rules only');
  const ctx = {
    engine: engineFromRow(configRes.data),
    prompt: promptFromRow('plan-weeks', promptRes.data),
    apiKey,
    isTest: async (id: string) => (await db.auth.admin.getUserById(id)).data.user?.user_metadata?.test_account === true,
  };

  const results: Outcome[] = [];
  for (const id of userIds) {
    try {
      results.push(await processUser(db, id, ctx));
    } catch (e) {
      console.error('generate-next-week failed', id, e);
      results.push({ userId: id, status: 'error', detail: e instanceof Error ? e.message : String(e) });
    }
  }
  const count = (s: Outcome['status']) => results.filter((r) => r.status === s).length;
  return json({
    engineVersion: ENGINE_VERSION,
    users: results.length,
    created: count('created'),
    skipped: count('skipped'),
    errors: count('error'),
    // Dla pojedynczego użytkownika – pełny wynik; dla crona tylko błędy (bez identyfikatorów w logach aplikacji).
    results: token === serviceKey ? results.filter((r) => r.status === 'error') : results,
  });
});
