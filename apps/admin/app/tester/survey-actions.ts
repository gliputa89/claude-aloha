'use server';

import {
  aiAthleteFromSurvey,
  generateInitialPlan,
  planInputFromSurvey,
  planStartDate,
  planWeeksWithAi,
  surveyTrainingLevel,
  TRAINING_LEVEL_INFO,
  type PlannedWeek,
  type PlanWeeksOutcome,
} from '@aloha/plan-engine';
import { refresh } from 'next/cache';

import { claudeCaller, hasClaudeKey } from '@/lib/ai/claude';
import { aiLogger, loadAiRuntime } from '@/lib/ai/runtime';
import { requireAdmin, type Admin } from '@/lib/auth';
import { serviceRoleKey, supabaseUrl } from '@/lib/env';
import { loadTesterUser, MAX_REGENERATE_WEEKS, todayIn } from '@/lib/plan-tester';
import { createServiceClient } from '@/lib/supabase/server';
import { presetByKey, validateSurvey, type SurveyErrors, type SurveyValues } from '@/lib/survey';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH = 20;
/** Tyle tygodni układa aplikacja po ankiecie (generate-plan). */
const INITIAL_WEEKS = 2;

export type SurveyResult = { ok: true; message: string } | { ok: false; message: string; errors?: SurveyErrors };

async function saveSurveyRow(admin: Admin, userId: string, values: SurveyValues): Promise<SurveyResult> {
  const valid = validateSurvey(values);
  if (!valid.ok) return { ok: false, message: 'Popraw zaznaczone pola.', errors: valid.errors };
  const { error } = await createServiceClient().rpc('admin_save_survey', {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_survey: valid.payload,
  });
  if (error) {
    console.error('admin_save_survey failed', error.code, error.message);
    return { ok: false, message: `Zapis nie powiódł się: ${error.message}` };
  }
  return { ok: true, message: 'Ankieta zapisana.' };
}

/**
 * Plan od nowa jak w produkcji (Edge Function generate-plan): aktywne parametry silnika, tygodnie od daty
 * startu z ankiety (domyślnie 2, w testerze do wyboru), z AI – szkic poprawiony przez Claude z walidacją; zapis
 * przez save_generated_plan (stary plan → archiwum). Bez AI – sam szkic silnika (np. przy masowym zakładaniu kont).
 *
 * Z AI i więcej niż 2 tygodniami idziemy tak jak aplikacja w czasie: pierwsze wywołanie układa 2 tygodnie po
 * ankiecie, a każdy kolejny tydzień to osobne wywołanie z poprzednim tygodniem (już po poprawkach) jako kontekstem.
 * Jedno wywołanie na cały długi plan nie zmieściłoby się w limicie tokenów i operacji.
 */
async function regeneratePlanRow(admin: Admin, userId: string, useAi = false, weekCount = INITIAL_WEEKS): Promise<SurveyResult> {
  const user = await loadTesterUser(userId);
  const { profile, goal, availability } = user ?? {};
  if (!user || !profile?.onboarding_completed_at || !profile.level || !goal || !availability) {
    return { ok: false, message: 'Brak ukończonej ankiety.' };
  }
  const today = todayIn(profile.timezone);
  const db = createServiceClient();
  const { prompt, engine } = await loadAiRuntime(db);
  const survey = { profile: { ...profile, level: profile.level }, goal, availability };
  const baseInput = planInputFromSurvey(survey, planStartDate(goal, today));
  // Jak generate-plan: nowy plan = poziom startowy z ankiety (brak migracji poziomu → tylko ostrzeżenie w logu).
  const surveyLevel = surveyTrainingLevel(baseInput);
  const levelRes = await db.rpc('set_training_level', {
    p_user_id: userId,
    p_level: surveyLevel,
    p_source: 'survey',
    p_reason_code: 'initial',
    p_reason: `Poziom z ankiety: ${surveyLevel} (${TRAINING_LEVEL_INFO[surveyLevel].label}).`,
    p_stats: { surveyLevel },
    p_survey_level: surveyLevel,
    p_on: today,
  });
  if (levelRes.error) console.warn('set_training_level failed', levelRes.error.code, levelRes.error.message);
  const input = { ...baseInput, trainingLevel: surveyLevel, params: engine.params };
  const draft = generateInitialPlan({ ...input, weeks: weekCount });
  if (useAi && !hasClaudeKey()) return { ok: false, message: 'Brak ANTHROPIC_API_KEY w środowisku panelu.' };
  // Porcje szkicu dla AI: [tydzień 1–2], [3], [4]… Każda dostaje poprzedni tydzień już po poprawkach.
  const outcomes: PlanWeeksOutcome[] = [];
  const reviewed: PlannedWeek[] = [];
  const weeks = [];
  for (let from = 0; from < draft.weeks.length; from = reviewed.length) {
    const chunk = draft.weeks.slice(from, from === 0 ? INITIAL_WEEKS : from + 1);
    const outcome = useAi
      ? await planWeeksWithAi({
          input: { ...input, startDate: draft.startsOn },
          draft: chunk,
          previousWeek: reviewed[reviewed.length - 1] ?? null,
          athlete: aiAthleteFromSurvey(survey),
          today,
          prompt,
          engine,
          call: claudeCaller(),
          log: aiLogger(db),
          meta: { userId, source: 'tester', isTest: user.isTest },
        })
      : null;
    if (outcome) outcomes.push(outcome);
    // Liczba tygodni z modelu zawsze równa się porcji; `chunk` to bezpiecznik, żeby pętla nie stanęła.
    const done = outcome && outcome.weeks.length === chunk.length ? outcome.weeks : chunk;
    reviewed.push(...done);
    weeks.push(
      ...done.map((w) => ({
        ...w,
        source: outcome?.source ?? ('rules' as const),
        aiCallId: outcome?.source === 'ai' ? outcome.finalCallId : null,
        engineConfigVersion: engine.version,
      })),
    );
  }
  const plan = { ...draft, weeks };
  const tips: Record<string, string> = Object.assign({}, ...outcomes.map((o) => o.tips));
  const costUsd = outcomes.reduce((n, o) => n + o.costUsd, 0);
  const callIds = outcomes.flatMap((o) => o.callIds);
  const statuses = [...new Set(outcomes.map((o) => o.status))].join(', ');
  const { error } = await db.rpc('save_generated_plan', { p_user_id: userId, p_goal_id: goal.id, p_plan: plan });
  if (error) {
    console.error('save_generated_plan failed', error.code, error.message);
    return { ok: false, message: `Zapis planu nie powiódł się: ${error.message}` };
  }
  if (Object.keys(tips).length > 0) {
    const { error: tipsError } = await db.rpc('set_session_coach_tips', { p_user_id: userId, p_tips: tips });
    if (tipsError) console.error('set_session_coach_tips failed', tipsError.code, tipsError.message);
  }
  await db.rpc('admin_log', {
    p_admin_id: admin.id,
    p_action: 'tester_regenerate_plan',
    p_target_type: 'user',
    p_target_id: userId,
    p_details: {
      starts_on: plan.startsOn,
      weeks: plan.weeks.length,
      engine_version: plan.engineVersion,
      engine_config_version: engine.version,
      ai: outcomes.length ? { status: statuses, calls: callIds, cost_usd: costUsd } : null,
    },
  });
  const ai = outcomes.length ? ` · AI: ${statuses}, ${callIds.length} wyw., $${costUsd.toFixed(4)}` : '';
  return { ok: true, message: `Nowy plan od ${plan.startsOn}: ${plan.weeks.length} tyg.${ai}` };
}

export async function saveSurvey(userId: string, values: SurveyValues): Promise<SurveyResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const result = await saveSurveyRow(admin, userId, values);
  if (result.ok) refresh();
  return result;
}

export async function regeneratePlan(userId: string, useAi = false, weekCount: number = INITIAL_WEEKS): Promise<SurveyResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  if (!Number.isInteger(weekCount) || weekCount < 1 || weekCount > MAX_REGENERATE_WEEKS) {
    return { ok: false, message: `Liczba tygodni musi być od 1 do ${MAX_REGENERATE_WEEKS}.` };
  }
  const result = await regeneratePlanRow(admin, userId, useAi, weekCount);
  if (result.ok) refresh();
  return result;
}

export type CreateResult = { ok: boolean; message: string; userIds: string[] };

/** Zakłada konta testowe (bez hasła, bez maili) z ankietami z gotowych profili, opcjonalnie od razu z planem. */
export async function createTestUsers(presetKeys: string[], withPlan: boolean): Promise<CreateResult> {
  const admin = await requireAdmin();
  const presets = presetKeys.slice(0, MAX_BATCH).map(presetByKey);
  if (!presets.length || presets.some((p) => !p)) return { ok: false, message: 'Nieznany profil.', userIds: [] };

  const db = createServiceClient();
  const today = todayIn('Europe/Warsaw');
  const userIds: string[] = [];
  const failures: string[] = [];

  for (const preset of presets) {
    if (!preset) continue;
    const values = preset.build(today);
    const suffix = crypto.randomUUID().slice(0, 6);
    const { data, error } = await db.auth.admin.createUser({
      email: `test+${preset.key.replace(/_/g, '-')}-${suffix}@aloha.test`,
      email_confirm: true,
      user_metadata: {
        test_account: true,
        created_by_admin: admin.id,
        display_name: values.displayName,
        locale: 'pl',
      },
    });
    if (error || !data.user) {
      failures.push(`${preset.label}: ${error?.message ?? 'brak konta'}`);
      continue;
    }
    const userId = data.user.id;
    const saved = await saveSurveyRow(admin, userId, values);
    if (!saved.ok) {
      failures.push(`${preset.label}: ${saved.message}`);
      continue;
    }
    if (withPlan) {
      const planned = await regeneratePlanRow(admin, userId);
      if (!planned.ok) failures.push(`${preset.label}: ${planned.message}`);
    }
    await db.rpc('admin_log', {
      p_admin_id: admin.id,
      p_action: 'tester_create_user',
      p_target_type: 'user',
      p_target_id: userId,
      p_details: { preset: preset.key },
    });
    userIds.push(userId);
  }

  refresh();
  const created = `Utworzono ${userIds.length} z ${presets.length}.`;
  return failures.length
    ? { ok: false, message: `${created} Błędy: ${failures.join('; ')}`, userIds }
    : { ok: true, message: created, userIds };
}

/** Odpowiedź Edge Function delete-account. */
type DeleteOutcome = {
  deleted?: boolean;
  counts?: Record<string, number>;
  apple?: 'none' | 'revoked' | 'not_configured' | 'no_token' | 'mismatch' | 'failed';
  strava?: 'none' | 'deauthorized' | 'failed';
  error?: string;
  message?: string;
};

const APPLE_NOTE: Record<string, string> = {
  revoked: 'dostęp Apple unieważniony',
  not_configured: 'tokenu Apple NIE unieważniono – funkcja nie ma sekretów APPLE_*',
  no_token: 'tokenu Apple NIE unieważniono – brak zapisanego tokenu (logowanie sprzed zapisu tokenów)',
  mismatch: 'tokenu Apple NIE unieważniono – token z innego Apple ID',
  failed: 'tokenu Apple NIE unieważniono – Apple odrzuciło żądanie (logi funkcji)',
};

const STRAVA_NOTE: Record<string, string> = {
  deauthorized: 'dostęp Stravy cofnięty',
  failed: 'dostępu Stravy NIE cofnięto (token nieaktualny – dane i tak usunięte)',
};

/**
 * Twarde usunięcie dowolnego użytkownika – tą samą drogą co „Usuń konto” w aplikacji (Edge Function delete-account):
 * cofnięcie dostępu Stravy, unieważnienie tokenu Apple, potem konto i wszystkie dane w jednej transakcji
 * (RPC admin_delete_user) z wpisem w logu panelu i zapisem o usunięciu (e-mail i data).
 * Konto prawdziwe wymaga wpisania jego e-maila (`confirm`); testowe – tylko potwierdzenia na stronie.
 */
export async function deleteUser(userId: string, confirm = ''): Promise<SurveyResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  if (userId === admin.id) return { ok: false, message: 'Nie możesz usunąć własnego konta.' };
  const db = createServiceClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return { ok: false, message: 'Nie ma takiego użytkownika.' };
  const isTest = data.user.user_metadata?.test_account === true;
  const expected = (data.user.email ?? data.user.id).trim().toLowerCase();
  if (!isTest && confirm.trim().toLowerCase() !== expected) {
    return { ok: false, message: 'Wpisz dokładnie e-mail użytkownika, żeby potwierdzić.' };
  }

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl()}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adminId: admin.id }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { ok: false, message: 'Funkcja delete-account nie odpowiedziała (sieć albo przekroczony czas).' };
  }
  if (res.status === 404 && !(await res.clone().json().catch(() => null))?.error) {
    return { ok: false, message: 'Funkcja delete-account nie jest wdrożona w tym projekcie Supabase.' };
  }
  if (res.status === 401) return { ok: false, message: 'Funkcja delete-account odrzuciła klucz service_role panelu.' };
  const outcome = (await res.json().catch(() => null)) as DeleteOutcome | null;
  if (!res.ok || !outcome?.deleted) {
    switch (outcome?.error) {
      case 'admin_account':
        return { ok: false, message: 'To konto ma rolę admina – najpierw odbierz rolę.' };
      case 'not_found':
        return { ok: false, message: 'Nie ma takiego użytkownika.' };
      case 'self':
        return { ok: false, message: 'Nie możesz usunąć własnego konta.' };
      default:
        return {
          ok: false,
          message: `Usuwanie nie powiodło się${outcome?.message ? `: ${outcome.message}` : ` (błąd ${res.status} – szczegóły w logach funkcji)`}.`,
        };
    }
  }
  refresh();
  const c = outcome.counts ?? {};
  const notes = [STRAVA_NOTE[outcome.strava ?? ''], APPLE_NOTE[outcome.apple ?? '']].filter(Boolean);
  return {
    ok: true,
    message:
      `Usunięto: konto, ${c.plans ?? 0} plan., ${c.sessions ?? 0} tren., ${c.check_ins ?? 0} check-in., ${c.ai_calls ?? 0} wyw. AI.` +
      (notes.length ? ` ${notes.join('; ')}.` : ''),
  };
}

/**
 * Reset do stanu „tuż po rejestracji”: usuwa ankietę, plan, treningi, check-iny, rozmowy z trenerem, pobrane biegi
 * i wywołania AI, ale zostawia konto, logowanie i połączenie ze Stravą (RPC admin_reset_user – jedna transakcja).
 * Po resecie aplikacja pokazuje ankietę od nowa. Konto prawdziwe wymaga wpisania jego e-maila (`confirm`).
 */
export async function resetUser(userId: string, confirm = ''): Promise<SurveyResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const db = createServiceClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return { ok: false, message: 'Nie ma takiego użytkownika.' };
  const isTest = data.user.user_metadata?.test_account === true;
  const expected = (data.user.email ?? data.user.id).trim().toLowerCase();
  if (!isTest && confirm.trim().toLowerCase() !== expected) {
    return { ok: false, message: 'Wpisz dokładnie e-mail użytkownika, żeby potwierdzić.' };
  }

  const { data: counts, error: resetError } = await db.rpc('admin_reset_user', { p_admin_id: admin.id, p_user_id: userId });
  if (resetError) {
    return {
      ok: false,
      message:
        resetError.code === 'PGRST202'
          ? 'Brak migracji 20261112120000_admin_reset_user w tej bazie.'
          : `Reset nie powiódł się: ${resetError.message}`,
    };
  }
  refresh();
  const c = (counts ?? {}) as Record<string, number | boolean>;
  return {
    ok: true,
    message:
      `Wyczyszczono: ${c.plans ?? 0} plan., ${c.sessions ?? 0} tren., ${c.check_ins ?? 0} check-in., ${c.strava_activities ?? 0} bieg. ze Stravy. ` +
      (c.strava_connected ? 'Połączenie ze Stravą zostało.' : 'Konto nie miało połączenia ze Stravą.') +
      ' W aplikacji zamknij ją i otwórz ponownie – pokaże ankietę.',
  };
}
