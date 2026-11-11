'use server';

import {
  promptFromRow,
  RACE_DISTANCES_M,
  raceForecastWithAi,
  type AiPromptRow,
  type Level,
  type RaceDistanceM,
  type RaceForecastContext,
  type RaceForecastResult,
} from '@aloha/plan-engine';

import { claudeCaller, hasClaudeKey } from '@/lib/ai/claude';
import { aiLogger } from '@/lib/ai/runtime';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

/** Dane biegacza z formularza symulatora – te same pola, które aplikacja wysyła z podsumowania ankiety. */
export type ForecastSimInput = {
  recentDistanceM: number;
  recentTimeS: number;
  resultSource: RaceForecastContext['resultSource'];
  resultDaysAgo: number | null;
  level: Level;
  weeklyKm: number | null;
  longestRunKm: number | null;
  runsPerWeek: number;
  weeks: number;
  sessionsPerWeek: number;
  maxMinutesWeekday: number;
  maxMinutesWeekend: number;
  locale: 'pl' | 'en';
};

export type ForecastSimRow = {
  distanceM: RaceDistanceM;
  forecast: RaceForecastResult | null;
  status: string;
  callId: number | null;
};

export type ForecastSimResult = { ok: true; rows: ForecastSimRow[]; model: string } | { ok: false; message: string };

const inRange = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Kontekst prognozy dla jednego dystansu – tak samo składa go Edge Function race-forecast. */
function contextFor(input: ForecastSimInput, distanceM: RaceDistanceM): RaceForecastContext {
  return {
    locale: input.locale,
    distanceM,
    weeks: input.weeks,
    level: input.level,
    recent: { distanceM: input.recentDistanceM, timeS: input.recentTimeS },
    resultSource: input.resultSource,
    resultDaysAgo: input.resultDaysAgo,
    weeklyKm: input.weeklyKm,
    longestRunKm: input.longestRunKm,
    runsPerWeek: input.runsPerWeek,
    sessionsPerWeek: input.sessionsPerWeek,
    weeklyMinutesCap: Math.max(0, input.sessionsPerWeek - 1) * input.maxMinutesWeekday + input.maxMinutesWeekend,
    targetTimeS: null,
  };
}

/**
 * Puszcza dane biegacza przez prawdziwy prompt prognozy (funkcja AI 'race-forecast', aktywna wersja) dla 5 km, 10 km,
 * półmaratonu i maratonu – cztery płatne wywołania naraz. Nic nie zapisuje użytkownikom; zostaje log wywołań AI
 * (źródło: tester). Liczby z samych reguł symulator liczy w przeglądarce, bez tej akcji.
 */
export async function runForecastSimulation(input: ForecastSimInput): Promise<ForecastSimResult> {
  await requireAdmin();
  if (!hasClaudeKey()) return { ok: false, message: 'Brak ANTHROPIC_API_KEY w środowisku panelu (Vercel / apps/admin/.env.local).' };
  const valid =
    inRange(input.recentDistanceM, 1000, 100_000) &&
    inRange(input.recentTimeS, 120, 12 * 3600) &&
    inRange(input.weeks, 0, 104) &&
    inRange(input.runsPerWeek, 0, 14) &&
    inRange(input.sessionsPerWeek, 1, 7) &&
    inRange(input.maxMinutesWeekday, 10, 300) &&
    inRange(input.maxMinutesWeekend, 10, 400) &&
    (input.weeklyKm === null || inRange(input.weeklyKm, 0, 400)) &&
    (input.longestRunKm === null || inRange(input.longestRunKm, 0, 200)) &&
    (input.resultDaysAgo === null || inRange(input.resultDaysAgo, 0, 3650));
  if (!valid) return { ok: false, message: 'Popraw dane – któraś wartość jest poza zakresem.' };

  const db = createServiceClient();
  const promptRes = await db.rpc('get_ai_prompt', { p_function: 'race-forecast', p_id: null });
  if (promptRes.error) console.warn('get_ai_prompt failed – prompt wbudowany', promptRes.error.message);
  const prompt = promptFromRow('race-forecast', promptRes.error ? null : (promptRes.data as AiPromptRow | null));
  const call = claudeCaller();
  const log = aiLogger(db);

  const rows = await Promise.all(
    RACE_DISTANCES_M.map(async (distanceM): Promise<ForecastSimRow> => {
      const outcome = await raceForecastWithAi({
        context: contextFor(input, distanceM),
        prompt,
        call,
        log,
        meta: { userId: null, isTest: true, source: 'tester' },
      });
      return { distanceM, forecast: outcome.forecast, status: outcome.status, callId: outcome.callId };
    }),
  );
  return { ok: true, rows, model: prompt.model };
}
