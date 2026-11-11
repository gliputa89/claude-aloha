// Edge Function: pierwsze 2 tygodnie planu po ankiecie (docs/PROJECT.md 3, 4.3 i 5 – wariant B).
//
//   1. szkic silnika reguł (aktywne parametry z ops.engine_configs albo wbudowane),
//   2. Claude dopasowuje szkic listą operacji (aktywny prompt z ops.ai_prompts albo wbudowany),
//   3. silnik waliduje operacje; odrzucone → jedno ponowienie z wynikiem walidacji,
//   4. błąd API / brak klucza → sam szkic silnika (tryb awaryjny).
// Każda próba trafia do ops.ai_calls (koszt, tokeny, model, wersje) i ops.ai_call_payloads (treść, 30 dni).
//
// Wywołanie z aplikacji: supabase.functions.invoke('generate-plan') – z tokenem zalogowanego użytkownika.
// Reguły i runner: packages/plan-engine (kopiowane do _shared/plan-engine przez scripts/sync-plan-engine.sh).

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { claudeCaller, claudeKey } from '../_shared/claude.ts';
import {
  aiAthleteFromSurvey,
  engineFromRow,
  generateInitialPlan,
  planInputFromSurvey,
  planStartDate,
  hasModule,
  planWeeksWithAi,
  promptFromRow,
  surveyTrainingLevel,
  TRAINING_LEVEL_INFO,
  type AiCallPayload,
  type AiCallRecord,
} from '../_shared/plan-engine/index.ts';

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

  const [profileRes, goalRes, availabilityRes, promptRes, configRes] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'level, locale, has_contraindications, timezone, onboarding_completed_at, recent_result_distance_m, recent_result_time_s, current_runs_per_week, weekly_km, subscription_status',
      )
      .eq('id', user.id)
      .maybeSingle(),
    admin
      .from('goals')
      .select('id, type, general_focus, distance_m, race_date, target_time_s, plan_starts_on')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    admin
      .from('availability')
      .select('preferred_days, sessions_per_week, max_minutes_weekday, max_minutes_weekend')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin.rpc('get_ai_prompt', { p_function: 'plan-weeks' }),
    admin.rpc('get_engine_config'),
  ]);

  const profile = profileRes.data;
  const goal = goalRes.data;
  const availability = availabilityRes.data;
  if (!profile?.onboarding_completed_at || !profile.level || !goal || !availability) {
    return json({ error: 'onboarding_incomplete' }, 409);
  }
  if (promptRes.error) console.error('get_ai_prompt failed', promptRes.error.message);
  if (configRes.error) console.error('get_engine_config failed', configRes.error.message);

  const prompt = promptFromRow('plan-weeks', promptRes.data);
  const engine = engineFromRow(configRes.data);

  // Plan nie zaczyna się w przeszłości (np. gdy generujemy go ponownie kilka dni później).
  const today = todayIn(profile.timezone ?? 'Europe/Warsaw');
  const survey = { profile: { ...profile, level: profile.level }, goal, availability };
  const baseInput = planInputFromSurvey(survey, planStartDate(goal, today));

  // Nowy plan po ankiecie: poziom startowy z ankiety (zapisany w profilu – dalej zmienia go cotygodniowy przegląd).
  const surveyLevel = surveyTrainingLevel(baseInput);
  const { error: levelError } = await admin.rpc('set_training_level', {
    p_user_id: user.id,
    p_level: surveyLevel,
    p_source: 'survey',
    p_reason_code: 'initial',
    p_reason: `Poziom z ankiety: ${surveyLevel} (${TRAINING_LEVEL_INFO[surveyLevel].label}).`,
    p_stats: { surveyLevel },
    p_survey_level: surveyLevel,
    p_on: today,
  });
  if (levelError) console.error('set_training_level failed', levelError.code, levelError.message);
  const input = { ...baseInput, trainingLevel: surveyLevel, params: engine.params };
  const draft = generateInitialPlan(input);

  const apiKey = claudeKey();
  // Bez modułu „Plan dopasowany przez AI” zostaje szkic z reguł.
  const outcome = apiKey && hasModule(profileRes.data?.subscription_status, 'plan_ai')
    ? await planWeeksWithAi({
        input: { ...input, startDate: draft.startsOn },
        draft: draft.weeks,
        previousWeek: null,
        athlete: aiAthleteFromSurvey(survey),
        today,
        prompt,
        engine,
        call: claudeCaller(apiKey),
        log: async (call: AiCallRecord, payload: AiCallPayload) => {
          const { data, error } = await admin.rpc('log_ai_call', { p_call: call, p_payload: payload });
          if (error) console.error('log_ai_call failed', error.code, error.message);
          return (data as number | null) ?? null;
        },
        meta: { userId: user.id, source: 'app', isTest: user.user_metadata?.test_account === true },
      })
    : null;
  if (!apiKey) console.warn('ANTHROPIC_API_KEY not set – plan from rules only');

  const weeks = (outcome?.weeks ?? draft.weeks).map((w) => ({
    ...w,
    source: outcome?.source ?? 'rules',
    aiCallId: outcome?.source === 'ai' ? outcome.finalCallId : null,
    engineConfigVersion: engine.version,
  }));
  const plan = { ...draft, weeks };

  const { data: planId, error: saveError } = await admin.rpc('save_generated_plan', {
    p_user_id: user.id,
    p_goal_id: goal.id,
    p_plan: plan,
  });
  if (saveError) {
    console.error('save_generated_plan failed', saveError.code, saveError.message);
    return json({ error: 'save_failed' }, 500);
  }

  // Rady trenera od AI (te same wywołanie co plan). Błąd nie psuje planu – aplikacja ma rady z bazy.
  if (outcome && Object.keys(outcome.tips).length > 0) {
    const { error: tipsError } = await admin.rpc('set_session_coach_tips', { p_user_id: user.id, p_tips: outcome.tips });
    if (tipsError) console.error('set_session_coach_tips failed', tipsError.code, tipsError.message);
  }

  return json({
    planId,
    startsOn: plan.startsOn,
    endsOn: plan.endsOn,
    sessions: plan.weeks.reduce((n, w) => n + w.sessions.length, 0),
    source: outcome?.source ?? 'rules',
    // Uzasadnienie zmian w szkicu (dla panelu i logów) oraz powitanie od trenera – to ono idzie na ekran po ułożeniu planu.
    summary: outcome?.summary ?? null,
    welcome: outcome?.welcome ?? null,
  });
});
