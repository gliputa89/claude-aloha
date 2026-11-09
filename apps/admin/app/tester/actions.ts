'use server';

import { ENGINE_VERSION } from '@aloha/plan-engine';
import { refresh } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { buildWeek, loadTesterUser } from '@/lib/plan-tester';
import { createServiceClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const MAX_WEEK_INDEX = 104;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Generuje tydzień `weekIndex` silnikiem reguł i zapisuje go w aktywnym planie (podmienia istniejący). */
export async function generateWeek(userId: string, weekIndex: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  if (!Number.isInteger(weekIndex) || weekIndex < 0 || weekIndex > MAX_WEEK_INDEX) {
    return { ok: false, message: `Numer tygodnia musi być od 1 do ${MAX_WEEK_INDEX + 1}.` };
  }

  const user = await loadTesterUser(userId);
  if (!user) return { ok: false, message: 'Nie ma takiego użytkownika.' };
  const built = buildWeek(user, weekIndex);
  if (!built.ok) return { ok: false, message: 'Użytkownik nie skończył ankiety – brak danych dla silnika.' };

  const db = createServiceClient();
  const { error } = await db.rpc('admin_save_plan_week', {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_goal_id: user.goal?.id ?? null,
    p_plan_starts_on: built.planStartsOn,
    p_engine_version: ENGINE_VERSION,
    p_week: built.week,
  });
  if (error) {
    console.error('admin_save_plan_week failed', error.code, error.message);
    return { ok: false, message: `Zapis nie powiódł się: ${error.message}` };
  }

  refresh();
  const n = built.week.sessions.length;
  return { ok: true, message: `Tydzień ${weekIndex + 1}: ${n} ${n === 1 ? 'trening' : n >= 2 && n <= 4 ? 'treningi' : 'treningów'}.` };
}

/** Usuwa tydzień z planu (razem z treningami). */
export async function deleteWeek(userId: string, weekId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId) || !UUID.test(weekId)) return { ok: false, message: 'Nieprawidłowe dane.' };

  const db = createServiceClient();
  const { error } = await db.rpc('admin_delete_plan_week', {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_week_id: weekId,
  });
  if (error) {
    console.error('admin_delete_plan_week failed', error.code, error.message);
    return { ok: false, message: `Usuwanie nie powiodło się: ${error.message}` };
  }

  refresh();
  return { ok: true, message: 'Tydzień usunięty.' };
}
