// Edge Function: realny czas na zawody (podsumowanie ankiety startowej przy celu „zawody”).
//
//   POST z tokenem użytkownika:
//     { distanceM, raceDate, planStart, level, recent: { distanceM, timeS, source?, date? },
//       weeklyKm?, longestRunKm?, runsPerWeek, sessionsPerWeek, maxMinutesWeekday?, maxMinutesWeekend?,
//       targetTimeS?, today }
//   → { forecast: { source, vdot, danielsS, todayS, raceDayS, confidence, note, volume } } albo { forecast: null }
//
// Reguły (packages/plan-engine/src/plan/forecast.ts) liczą stan z tabel Danielsa, karę za objętość i realną
// poprawę – to widełki. W nich prognozę ustala Claude Opus (funkcja AI 'race-forecast', prompt edytowany w panelu):
// waży źródło wyniku, skok dystansu i to, czy objętość zdąży urosnąć. Bez klucza ANTHROPIC_API_KEY, bez modułu
// „plan z AI” albo przy błędzie modelu wraca prognoza z samych reguł.
// Ankieta nie jest jeszcze zapisana, więc dane przychodzą w żądaniu; niczego nie zapisujemy poza logiem wywołania AI.
// Do modelu nie trafiają dane osobowe – tylko liczby treningowe.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { claudeCaller, claudeKey } from '../_shared/claude.ts';
import { userModules } from '../_shared/modules.ts';
import {
  daysBetween,
  parseUnits,
  promptFromRow,
  RACE_DISTANCES_M,
  raceForecastFromRules,
  raceForecastWithAi,
  weeksUntil,
  type AiCallPayload,
  type AiCallRecord,
  type Level,
  type RaceDistanceM,
  type RaceForecastContext,
} from '../_shared/plan-engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced'];
const SOURCES = ['race', 'effort', 'run', 'manual'] as const;

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const isoDate = (v: unknown): string | null => (typeof v === 'string' && ISO_DATE.test(v) ? v : null);

/** Żądanie → kontekst prognozy; `null`, gdy brakuje czegoś, bez czego nie da się liczyć. */
function contextFrom(body: Record<string, unknown>, locale: string, serverToday: string): RaceForecastContext | null {
  const today = isoDate(body.today);
  if (!today || Math.abs(daysBetween(serverToday, today)) > 1) return null;
  const distanceM = RACE_DISTANCES_M.find((d) => d === body.distanceM) as RaceDistanceM | undefined;
  const raceDate = isoDate(body.raceDate);
  const level = LEVELS.find((l) => l === body.level);
  const recent = (body.recent ?? {}) as Record<string, unknown>;
  const recentDistanceM = num(recent.distanceM, 1000, 100_000);
  const recentTimeS = num(recent.timeS, 120, 12 * 3600);
  const runsPerWeek = num(body.runsPerWeek, 0, 14);
  const sessionsPerWeek = num(body.sessionsPerWeek, 1, 7);
  if (!distanceM || !raceDate || !level || recentDistanceM === null || recentTimeS === null || runsPerWeek === null || sessionsPerWeek === null) {
    return null;
  }
  // Tygodnie liczymy od startu planu (jak ocena celu w ankiecie), nie wcześniej niż od dziś.
  const planStart = isoDate(body.planStart);
  const from = planStart && planStart > today ? planStart : today;
  const weekday = num(body.maxMinutesWeekday, 10, 300);
  const weekend = num(body.maxMinutesWeekend, 10, 400);
  // Czas na treningi w tygodniu: jeden trening w weekend, reszta w dni powszednie.
  const weeklyMinutesCap = weekday !== null && weekend !== null ? Math.max(0, sessionsPerWeek - 1) * weekday + weekend : null;
  const resultDate = isoDate(recent.date);
  return {
    locale,
    distanceM,
    weeks: weeksUntil(raceDate, from),
    level,
    recent: { distanceM: recentDistanceM, timeS: recentTimeS },
    resultSource: SOURCES.find((s) => s === recent.source) ?? 'manual',
    resultDaysAgo: resultDate && resultDate <= today ? daysBetween(resultDate, today) : null,
    weeklyKm: num(body.weeklyKm, 0, 400),
    longestRunKm: num(body.longestRunKm, 0, 200),
    runsPerWeek,
    sessionsPerWeek,
    weeklyMinutesCap,
    targetTimeS: num(body.targetTimeS, 600, 12 * 3600),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'invalid_request' }, 400);

  try {
    const [profile, promptRes, modules] = await Promise.all([
      db.from('profiles').select('locale, units').eq('id', userId).maybeSingle(),
      db.rpc('get_ai_prompt', { p_function: 'race-forecast' }),
      userModules(db, userId),
    ]);
    if (promptRes.error) console.error('get_ai_prompt failed', promptRes.error.message);
    const locale = (profile.data?.locale as string | undefined) ?? 'pl';
    const found = contextFrom(body as Record<string, unknown>, locale, new Date().toISOString().slice(0, 10));
    if (!found) return json({ error: 'invalid_request' }, 400);
    // Jednostki z żądania (wybór na telefonie, jeszcze przed zapisem na koncie), inaczej z profilu.
    const context = { ...found, units: parseUnits((body as { units?: unknown }).units ?? profile.data?.units) };

    const apiKey = claudeKey();
    if (!apiKey || !modules.has('plan_ai')) return json({ forecast: raceForecastFromRules(context) });

    const outcome = await raceForecastWithAi({
      context,
      prompt: promptFromRow('race-forecast', promptRes.data),
      call: claudeCaller(apiKey),
      log: async (call: AiCallRecord, payload: AiCallPayload) => {
        const { data, error } = await db.rpc('log_ai_call', { p_call: call, p_payload: payload });
        if (error) console.error('log_ai_call failed', error.code, error.message);
        return (data as number | null) ?? null;
      },
      meta: { userId, isTest: auth.user.user_metadata?.test_account === true },
    });
    return json({ forecast: outcome.forecast });
  } catch (e) {
    console.error('race-forecast failed', userId, e);
    return json({ error: 'forecast_failed' }, 500);
  }
});
