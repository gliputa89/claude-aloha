'use server';

import { aiAthleteFromSurvey, ENGINE_VERSION, isTrainingLevel, planNextWeek, planWeeksWithAi } from '@aloha/plan-engine';
import { refresh } from 'next/cache';

import type { ActionResult } from '@/app/(panel)/tester/actions';
import { claudeCaller, hasClaudeKey } from '@/lib/ai/claude';
import { aiLogger, loadAiRuntime } from '@/lib/ai/runtime';
import { requireAdmin } from '@/lib/auth';
import { loadTesterUser, todayIn } from '@/lib/plan-tester';
import { createServiceClient } from '@/lib/supabase/server';
import { loadTrainingLevel, nextWeekRows, surveyLevelOf } from '@/lib/training-level';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_MIGRATION = 'W tej bazie nie ma migracji 20261109170000_training_level – wgraj ją, żeby zapisywać poziom.';

/** Ręczna zmiana poziomu zaawansowania (z wpisem w historii i logu admina). */
export async function setTrainingLevel(userId: string, level: number, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  if (!isTrainingLevel(level)) return { ok: false, message: 'Poziom musi być od 1 do 5.' };
  const user = await loadTesterUser(userId);
  if (!user) return { ok: false, message: 'Nie ma takiego użytkownika.' };

  const { data, error } = await createServiceClient().rpc('admin_set_training_level', {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_level: level,
    p_reason: reason.slice(0, 400),
    p_survey_level: surveyLevelOf(user),
    p_on: todayIn(user.profile?.timezone ?? 'Europe/Warsaw'),
  });
  if (error) return { ok: false, message: error.code === 'PGRST202' ? NO_MIGRATION : `Zapis nie powiódł się: ${error.message}` };
  refresh();
  return { ok: true, message: data ? `Poziom ustawiony na ${level}.` : `Poziom już był ${level}.` };
}

/**
 * Jak cotygodniowy cron (Edge Function generate-next-week), tylko od razu: przegląd poziomu, kolejny tydzień
 * szkicem silnika, dopasowanie przez Claude z walidacją silnika, zapis poziomu i tygodnia (z radami trenera).
 * Gdy model zawiedzie, zapisuje się szkic silnika – dokładnie jak w aplikacji.
 */
export async function generateNextWeekWithReview(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const user = await loadTesterUser(userId);
  if (!user) return { ok: false, message: 'Nie ma takiego użytkownika.' };
  if (!user.plan?.weeks.length) return { ok: false, message: 'Brak tygodni w planie – najpierw wygeneruj plan.' };

  const data = await loadTrainingLevel(user);
  if (!data.available) return { ok: false, message: NO_MIGRATION };
  const db = createServiceClient();
  const { engine, prompt } = await loadAiRuntime(db);
  const rows = nextWeekRows(user, data, engine.params);
  if (!rows) return { ok: false, message: 'Użytkownik nie skończył ankiety.' };
  const next = planNextWeek(rows);
  if (!next.ok) {
    return { ok: false, message: next.reason === 'after_race' ? 'Zawody już były – plan się skończył.' : 'Nie da się wygenerować kolejnego tygodnia.' };
  }

  const { review } = next;
  const levelRes = await db.rpc('set_training_level', {
    p_user_id: userId,
    p_level: review.level,
    p_source: next.levelStored ? 'review' : 'survey',
    p_reason_code: next.levelStored ? review.code : 'initial',
    p_reason: review.reason,
    p_stats: review.stats,
    p_survey_level: next.surveyLevel,
    p_on: next.week.startsOn,
  });
  if (levelRes.error) return { ok: false, message: `Zapis poziomu nie powiódł się: ${levelRes.error.message}` };

  // Ta sama droga co w aplikacji: szkic z przeglądu → Claude → walidacja silnika. Bez klucza zostaje sam szkic.
  const ai = hasClaudeKey()
    ? await planWeeksWithAi({
        input: next.input,
        draft: [next.week],
        previousWeek: next.previousWeek,
        athlete: aiAthleteFromSurvey({ profile: rows.profile, goal: rows.goal, availability: rows.availability }),
        today: rows.today,
        prompt,
        engine,
        call: claudeCaller(),
        log: aiLogger(db),
        meta: { userId, source: 'tester', isTest: user.isTest },
      })
    : null;
  const week = ai?.weeks[0] ?? next.week;
  const fromAi = ai?.source === 'ai';

  const { error } = await db.rpc('admin_save_plan_week', {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_goal_id: user.goal?.id ?? null,
    p_plan_starts_on: user.plan.starts_on,
    p_engine_version: ENGINE_VERSION,
    p_week: {
      ...week,
      source: fromAi ? 'ai' : 'rules',
      aiCallId: fromAi ? ai.finalCallId : null,
      engineConfigVersion: engine.version,
    },
  });
  if (error) return { ok: false, message: `Zapis tygodnia nie powiódł się: ${error.message}` };

  if (fromAi && Object.keys(ai.tips).length > 0) {
    const { error: tipsError } = await db.rpc('set_session_coach_tips', { p_user_id: userId, p_tips: ai.tips });
    if (tipsError) console.error('set_session_coach_tips failed', tipsError.code, tipsError.message);
  }

  refresh();
  const change = review.change === 'none' ? `poziom bez zmian (${review.level})` : `poziom ${next.previousLevel} → ${review.level}`;
  const how = !ai
    ? 'bez AI (brak klucza) – sam silnik'
    : fromAi
      ? `AI · wywołanie #${ai.finalCallId}`
      : `sam silnik (${ai.attempts.at(-1)?.error ?? 'model nie poprawił szkicu'})`;
  return { ok: true, message: `Tydzień ${week.weekIndex + 1} dodany · ${change} · ${how}.` };
}
