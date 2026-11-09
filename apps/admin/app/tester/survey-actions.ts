'use server';

import { aiAthleteFromSurvey, generateInitialPlan, planInputFromSurvey, planStartDate, planWeeksWithAi } from '@aloha/plan-engine';
import { refresh } from 'next/cache';

import { claudeCaller, hasClaudeKey } from '@/lib/ai/claude';
import { aiLogger, loadAiRuntime } from '@/lib/ai/runtime';
import { requireAdmin, type Admin } from '@/lib/auth';
import { loadTesterUser, todayIn } from '@/lib/plan-tester';
import { createServiceClient } from '@/lib/supabase/server';
import { presetByKey, validateSurvey, type SurveyErrors, type SurveyValues } from '@/lib/survey';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH = 20;

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
 * Plan od nowa jak w produkcji (Edge Function generate-plan): aktywne parametry silnika, 2 tygodnie od daty
 * startu z ankiety, z AI – szkic poprawiony przez Claude z walidacją; zapis przez save_generated_plan
 * (stary plan → archiwum). Bez AI – sam szkic silnika (np. przy masowym zakładaniu kont testowych).
 */
async function regeneratePlanRow(admin: Admin, userId: string, useAi = false): Promise<SurveyResult> {
  const user = await loadTesterUser(userId);
  const { profile, goal, availability } = user ?? {};
  if (!user || !profile?.onboarding_completed_at || !profile.level || !goal || !availability) {
    return { ok: false, message: 'Brak ukończonej ankiety.' };
  }
  const today = todayIn(profile.timezone);
  const db = createServiceClient();
  const { prompt, engine } = await loadAiRuntime(db);
  const survey = { profile: { ...profile, level: profile.level }, goal, availability };
  const input = { ...planInputFromSurvey(survey, planStartDate(goal, today)), params: engine.params };
  const draft = generateInitialPlan(input);
  if (useAi && !hasClaudeKey()) return { ok: false, message: 'Brak ANTHROPIC_API_KEY w środowisku panelu.' };
  const outcome = useAi
    ? await planWeeksWithAi({
        input: { ...input, startDate: draft.startsOn },
        draft: draft.weeks,
        previousWeek: null,
        athlete: aiAthleteFromSurvey(survey),
        today,
        prompt,
        engine,
        call: claudeCaller(),
        log: aiLogger(db),
        meta: { userId, source: 'tester', isTest: user.isTest },
      })
    : null;
  const plan = {
    ...draft,
    weeks: (outcome?.weeks ?? draft.weeks).map((w) => ({
      ...w,
      source: outcome?.source ?? 'rules',
      aiCallId: outcome?.source === 'ai' ? outcome.finalCallId : null,
      engineConfigVersion: engine.version,
    })),
  };
  const { error } = await db.rpc('save_generated_plan', { p_user_id: userId, p_goal_id: goal.id, p_plan: plan });
  if (error) {
    console.error('save_generated_plan failed', error.code, error.message);
    return { ok: false, message: `Zapis planu nie powiódł się: ${error.message}` };
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
      ai: outcome ? { status: outcome.status, calls: outcome.callIds, cost_usd: outcome.costUsd } : null,
    },
  });
  const ai = outcome ? ` · AI: ${outcome.status}, ${outcome.callIds.length} wyw., $${outcome.costUsd.toFixed(4)}` : '';
  return { ok: true, message: `Nowy plan od ${plan.startsOn}: ${plan.weeks.length} tyg.${ai}` };
}

export async function saveSurvey(userId: string, values: SurveyValues): Promise<SurveyResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const result = await saveSurveyRow(admin, userId, values);
  if (result.ok) refresh();
  return result;
}

export async function regeneratePlan(userId: string, useAi = false): Promise<SurveyResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const result = await regeneratePlanRow(admin, userId, useAi);
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
        adult_confirmed: true,
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

/** Usuwa konto testowe (wszystkie dane kaskadowo). Prawdziwych kont nie da się tak usunąć. */
export async function deleteTestUser(userId: string): Promise<SurveyResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const db = createServiceClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return { ok: false, message: 'Nie ma takiego użytkownika.' };
  if (data.user.user_metadata?.test_account !== true) {
    return { ok: false, message: 'To nie jest konto testowe – nie usuwam.' };
  }
  const { error: deleteError } = await db.auth.admin.deleteUser(userId);
  if (deleteError) return { ok: false, message: `Usuwanie nie powiodło się: ${deleteError.message}` };
  await db.rpc('admin_log', {
    p_admin_id: admin.id,
    p_action: 'tester_delete_user',
    p_target_type: 'user',
    p_target_id: userId,
    p_details: { email: data.user.email },
  });
  refresh();
  return { ok: true, message: 'Konto testowe usunięte.' };
}
