'use server';

import {
  aiAthleteFromSurvey,
  ENGINE_VERSION,
  generatePlanWeek,
  planInputFromSurvey,
  coachTipsFor,
  type AiTip,
  planWeeksWithAi,
  type AttemptResult,
  type OperationResult,
  type PlannedWeek,
  type PlanWeeksOutcome,
} from '@aloha/plan-engine';
import { refresh } from 'next/cache';

import { generateWeek, type ActionResult } from '@/app/(panel)/tester/actions';
import { claudeCaller, hasClaudeKey } from '@/lib/ai/claude';
import { getAiCall } from '@/lib/ai/data';
import { aiLogger, loadAiRuntime } from '@/lib/ai/runtime';
import { requireAdmin } from '@/lib/auth';
import { buildWeek, loadTesterUser, plannedWeekFromRow, todayIn, type TesterUser } from '@/lib/plan-tester';
import { createServiceClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WEEK_INDEX = 104;

export type AiPreview =
  | {
      ok: true;
      weekIndex: number;
      draft: PlannedWeek;
      result: PlannedWeek;
      status: PlanWeeksOutcome['status'];
      source: PlanWeeksOutcome['source'];
      summary: string | null;
      /** Rady trenera z odpowiedzi modelu (przed przypisaniem do treningów). */
      tips: AiTip[];
      costUsd: number;
      callIds: number[];
      finalCallId: number | null;
      operations: OperationResult[];
      error: string | null;
      promptLabel: string;
      engineLabel: string;
      model: string;
    }
  | { ok: false; message: string };

const versionLabel = (v: number | null | undefined, builtin: string) => (v ? `v${v}` : builtin);

function surveyOf(user: TesterUser) {
  const { profile, goal, availability } = user;
  if (!profile?.onboarding_completed_at || !profile.level || !goal || !availability) return null;
  return { profile: { ...profile, level: profile.level }, goal, availability };
}

/**
 * Tydzień `weekIndex` przez silnik + Claude, bez zapisu – do porównania obok szkicu.
 * `promptId` / `configId` = null → aktywne wersje (jak w produkcji); inne → test szkicu wersji.
 * Każde wywołanie jest zapisane w ops.ai_calls (źródło: tester) z kosztem.
 */
export async function previewAiWeek(
  userId: string,
  weekIndex: number,
  promptId: number | null,
  configId: number | null,
): Promise<AiPreview> {
  await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  if (!Number.isInteger(weekIndex) || weekIndex < 0 || weekIndex > MAX_WEEK_INDEX) return { ok: false, message: 'Zły numer tygodnia.' };
  if (!hasClaudeKey()) return { ok: false, message: 'Brak ANTHROPIC_API_KEY w środowisku panelu (Vercel / apps/admin/.env.local).' };

  const user = await loadTesterUser(userId);
  if (!user) return { ok: false, message: 'Nie ma takiego użytkownika.' };
  const survey = surveyOf(user);
  if (!survey) return { ok: false, message: 'Użytkownik nie skończył ankiety.' };

  const db = createServiceClient();
  const { prompt, engine } = await loadAiRuntime(db, { promptId, configId });
  const built = buildWeek(user, weekIndex, engine.params);
  if (!built.ok) return { ok: false, message: 'Brak danych ankiety dla silnika.' };

  const input = { ...planInputFromSurvey(survey, built.planStartsOn), params: engine.params };
  // Poprzedni tydzień: z planu w bazie (realny stan), a gdy go nie ma – z silnika.
  const prevRow = user.plan?.weeks.find((w) => w.week_index === weekIndex - 1);
  const previousWeek = weekIndex === 0 ? null : prevRow ? plannedWeekFromRow(prevRow) : generatePlanWeek(input, weekIndex - 1);

  const outcome = await planWeeksWithAi({
    input,
    draft: [built.week],
    previousWeek,
    athlete: aiAthleteFromSurvey(survey),
    today: todayIn(survey.profile.timezone),
    prompt,
    engine,
    call: claudeCaller(),
    log: aiLogger(db),
    meta: { userId, source: 'tester', isTest: user.isTest },
  });
  const last = outcome.attempts[outcome.attempts.length - 1] as AttemptResult;
  refresh();
  return {
    ok: true,
    weekIndex,
    draft: built.week,
    result: outcome.weeks[0] ?? built.week,
    status: outcome.status,
    source: outcome.source,
    summary: outcome.summary,
    tips: last.response?.tips ?? [],
    costUsd: outcome.costUsd,
    callIds: outcome.callIds,
    finalCallId: outcome.finalCallId,
    operations: last.apply?.results ?? [],
    error: last.error,
    promptLabel: versionLabel(prompt.version, 'wbudowany'),
    engineLabel: versionLabel(engine.version, 'wbudowane'),
    model: prompt.model,
  };
}

/** Zapisuje tydzień z wywołania AI (wynik bierzemy z logu w bazie, nie od klienta). */
export async function saveAiWeek(userId: string, weekIndex: number, callId: number): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();
  if (!UUID.test(userId) || !Number.isInteger(callId)) return { ok: false, message: 'Nieprawidłowe dane.' };
  const detail = await getAiCall(admin.id, callId);
  if (!detail || detail.call.user_id !== userId) return { ok: false, message: 'Nie ma takiego wywołania dla tego użytkownika.' };
  const week = detail.payload?.result?.weeks.find((w) => w.weekIndex === weekIndex);
  if (!week) return { ok: false, message: 'Treść wywołania wygasła albo nie zawiera tego tygodnia.' };

  const user = await loadTesterUser(userId);
  if (!user) return { ok: false, message: 'Nie ma takiego użytkownika.' };
  const built = buildWeek(user, weekIndex);
  if (!built.ok) return { ok: false, message: 'Brak danych ankiety.' };

  const fromAi = detail.call.validation_status !== 'fallback';
  const { error } = await createServiceClient().rpc('admin_save_plan_week', {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_goal_id: user.goal?.id ?? null,
    p_plan_starts_on: user.plan?.starts_on ?? built.planStartsOn,
    p_engine_version: detail.call.engine_version ?? ENGINE_VERSION,
    p_week: {
      ...week,
      source: fromAi ? 'ai' : 'rules',
      aiCallId: fromAi ? callId : null,
      engineConfigVersion: detail.call.engine_config_version,
    },
  });
  if (error) return { ok: false, message: `Zapis nie powiódł się: ${error.message}` };
  // Rady trenera z tej samej odpowiedzi modelu – tylko do dni z treningiem w zapisanym tygodniu.
  const tips = fromAi ? coachTipsFor([week], detail.payload?.result?.response?.tips ?? []) : {};
  if (Object.keys(tips).length > 0) {
    const { error: tipsError } = await createServiceClient().rpc('set_session_coach_tips', { p_user_id: userId, p_tips: tips });
    if (tipsError) console.error('set_session_coach_tips failed', tipsError.code, tipsError.message);
  }
  refresh();
  return { ok: true, message: `Tydzień ${weekIndex + 1} zapisany z wywołania #${callId}.` };
}

const formatCost = (usd: number) => `$${usd.toFixed(usd < 0.01 ? 4 : 2)}`;

/** „1 zmiana”, „3 zmiany”, „7 zmian” – bez tego komunikaty czyta się jak tłumaczenie maszynowe. */
const changes = (n: number) => `${n} ${n === 1 ? 'zmiana' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'zmiany' : 'zmian'}`;

/**
 * Pełna ścieżka tygodnia, dokładnie jak u użytkownika: szkic silnika → Claude → walidacja silnika → zapis
 * razem z radami trenera. Istniejący tydzień o tym numerze jest podmieniany. Gdy model odpowie błędem,
 * zapisuje się szkic silnika – tak samo zachowuje się aplikacja.
 */
export async function generateWeekWithAi(userId: string, weekIndex: number): Promise<ActionResult> {
  // Bez klucza nie ma czym wołać modelu – wtedy zostaje sam silnik, tak jak w aplikacji przy awarii AI.
  if (!hasClaudeKey()) {
    const rules = await generateWeek(userId, weekIndex);
    return rules.ok ? { ok: true, message: `${rules.message} Bez AI – brak ANTHROPIC_API_KEY w panelu.` } : rules;
  }

  const preview = await previewAiWeek(userId, weekIndex, null, null);
  if (!preview.ok) return { ok: false, message: preview.message };
  if (preview.finalCallId === null) {
    return { ok: false, message: 'Wywołanie AI nie zapisało się w logu – tydzień nie został zapisany.' };
  }

  const saved = await saveAiWeek(userId, weekIndex, preview.finalCallId);
  if (!saved.ok) return { ok: false, message: saved.message };

  const applied = preview.operations.filter((o) => o.status === 'applied').length;
  const rejected = preview.operations.length - applied;
  const how =
    preview.source === 'ai'
      ? `AI: ${changes(applied)}${rejected ? `, ${rejected} odrzuconych przez silnik` : ''}`
      : `sam silnik (${preview.error ?? 'model nie poprawił szkicu'})`;
  return {
    ok: true,
    message: `Tydzień ${weekIndex + 1}: ${how} · ${formatCost(preview.costUsd)} · wywołanie #${preview.finalCallId}.`,
  };
}
