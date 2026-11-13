'use server';

import {
  describeSteps,
  isoWeekday,
  noteActual,
  paceZonesFrom,
  parseUnits,
  promptFromRow,
  reviewWorkout,
  simulateRun,
  stepsOf,
  STRAVA_RULES,
  workoutNoteKey,
  workoutNoteWithAi,
  type ActivitySource,
  type AiPromptRow,
  type WorkoutReview,
} from '@aloha/plan-engine';
import { refresh } from 'next/cache';

import type { ActionResult } from '@/app/(panel)/tester/actions';
import { claudeCaller, hasClaudeKey } from '@/lib/ai/claude';
import { aiLogger } from '@/lib/ai/runtime';
import { requireAdmin } from '@/lib/auth';
import { loadTesterUser, todayIn } from '@/lib/plan-tester';
import { RUN_VARIANT_INFO, SIM_HR, type RunVariant } from '@/lib/run-sim';
import { createServiceClient } from '@/lib/supabase/server';

// Symulacja wykonanego treningu w testerze: zamiast czekać, aż biegacz naprawdę pobiegnie, wstawiamy bieg
// w tym samym kształcie, w jakim przychodzi ze Stravy albo z Apple Zdrowie (public.strava_activities
// z przebiegiem tempa w kubełkach), a potem puszczamy to tą samą drogą co produkcja: realizacja treningu →
// ocena z reguł (review.ts) → notka trenera od AI. Wynik widzi i panel, i aplikacja biegacza.
//
// Jedyna różnica wobec produkcji: nie dopasowujemy biegu do treningu po dacie i dystansie
// (supabase/functions/_shared/activities.ts), bo trening wskazujesz wprost – reszta jest tym samym kodem.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SimulateResult = ActionResult;

export async function simulateSessionRun(
  userId: string,
  sessionId: string,
  variant: RunVariant,
  source: ActivitySource,
): Promise<SimulateResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId) || !UUID.test(sessionId)) return { ok: false, message: 'Nieprawidłowe dane.' };
  const info = RUN_VARIANT_INFO[variant];
  if (!info) return { ok: false, message: 'Nieznany wariant biegu.' };
  if (source !== 'strava' && source !== 'apple_health') return { ok: false, message: 'Nieznane źródło biegu.' };

  const user = await loadTesterUser(userId);
  if (!user) return { ok: false, message: 'Nie ma takiego użytkownika.' };
  const week = user.plan?.weeks.find((w) => w.sessions.some((s) => s.id === sessionId));
  const session = week?.sessions.find((s) => s.id === sessionId);
  if (!week || !session) return { ok: false, message: 'Ten trening nie należy do aktywnego planu.' };
  if (session.type === 'rest') return { ok: false, message: 'Dzień wolny nie ma czego symulować.' };
  if (session.type === 'race') return { ok: false, message: 'Zawodów nie symulujemy – to nie jest trening z planu.' };

  const db = createServiceClient();
  // Tętno to dane o zdrowiu – dokładamy je tylko przy zgodzie, dokładnie jak strava-sync i health-sync.
  const consent = await db.rpc('has_consent', { uid: userId, consent_kind: 'health_data' });
  if (consent.error) console.warn('has_consent failed', consent.error.message);
  const withHr = consent.data === true;

  const zones = paceZonesFrom(
    user.profile?.recent_result_distance_m
      ? { distanceM: user.profile.recent_result_distance_m, timeS: user.profile.recent_result_time_s }
      : null,
  );
  const steps = stepsOf(session, zones);
  if (steps.length === 0) return { ok: false, message: 'Ten trening nie ma odcinków – nie ma z czego zbudować biegu.' };

  const run = simulateRun(steps, {
    ...info.sim,
    ...(zones ? { zones } : {}),
    ...(withHr ? { hr: SIM_HR } : {}),
    // Ziarno z treningu – ten sam trening i wariant dają zawsze ten sam bieg.
    seed: sessionId.split('-')[0] ? parseInt(sessionId.slice(0, 6), 16) : 1,
  });

  // Bieg w kształcie, w jakim zapisuje go synchronizacja: start rano w dniu treningu, czas ruchu z symulacji.
  const startedAt = `${session.scheduled_on}T07:30:00.000Z`;
  const now = new Date().toISOString();
  const activity = {
    user_id: userId,
    source,
    external_id: `sim-${sessionId}`,
    session_id: sessionId,
    suggested_session_id: null,
    match_confirmed: true,
    match_declined: false,
    sport_type: session.type === 'walk_run' ? 'Walk' : 'Run',
    name: `[SYMULACJA] ${info.label}`,
    started_at: startedAt,
    local_date: session.scheduled_on,
    distance_m: run.actualDistanceM ?? 0,
    moving_time_s: run.actualDurationS ?? 0,
    elapsed_time_s: Math.round((run.actualDurationS ?? 0) * 1.03),
    elevation_gain_m: run.elevationGainM ?? 0,
    avg_hr: withHr ? Math.round(SIM_HR.max * SIM_HR.easy) : null,
    max_hr: withHr ? run.hrMax : null,
    pace_buckets: run.buckets,
    pace_fetched_at: now,
  };
  const saved = await db.from('strava_activities').upsert(activity, { onConflict: 'user_id,source,external_id' });
  if (saved.error) {
    console.error('simulated activity upsert failed', saved.error.code, saved.error.message);
    return { ok: false, message: `Zapis biegu nie powiódł się: ${saved.error.message}` };
  }

  // Realizacja treningu – ten sam próg co przy biegach ze Stravy.
  const ratios = [
    session.duration_min ? (run.actualDurationS ?? 0) / (session.duration_min * 60) : null,
    session.distance_m ? (run.actualDistanceM ?? 0) / session.distance_m : null,
  ].filter((r): r is number => r !== null);
  const ratio = ratios.length > 0 ? Math.max(...ratios) : 1;
  const status = ratio >= STRAVA_RULES.doneRatio ? 'done' : 'partial';
  const done = await db
    .from('sessions')
    .update({
      status,
      actual_distance_m: run.actualDistanceM,
      actual_duration_s: run.actualDurationS,
      completed_at: new Date(Date.parse(startedAt) + (run.actualDurationS ?? 0) * 1000).toISOString(),
    })
    .eq('id', sessionId);
  if (done.error) return { ok: false, message: `Zapis realizacji nie powiódł się: ${done.error.message}` };

  // Ocena z reguł – ten sam kod, który liczy ją po prawdziwym biegu.
  const review = reviewWorkout({
    type: session.type,
    durationMin: session.duration_min,
    distanceM: session.distance_m,
    steps,
    actualDistanceM: run.actualDistanceM,
    actualDurationS: run.actualDurationS,
    buckets: run.buckets,
    elevationGainM: run.elevationGainM,
    // Tętno maksymalne biegacza jest w regułach wyłączone (HR_MAX_RULES) – tu tak samo.
    hrMax: null,
  });
  const reviewRow = {
    session_id: sessionId,
    user_id: userId,
    verdict: review.verdict,
    volume: review.volume,
    intensity: review.intensity,
    facts: review.facts,
    engine_version: review.version,
    seen_at: null,
  };
  const savedReview = await db.from('session_reviews').upsert(reviewRow, { onConflict: 'session_id' });
  if (savedReview.error) return { ok: false, message: `Zapis oceny nie powiódł się: ${savedReview.error.message}` };

  const note = await writeNote(db, { userId, isTest: user.isTest, session, week, review, run, steps });

  await db.rpc('admin_log', {
    p_admin_id: admin.id,
    p_action: 'tester_simulate_run',
    p_target_type: 'user',
    p_target_id: userId,
    p_details: { session_id: sessionId, variant, source, verdict: review.verdict, status },
  });

  refresh();
  const how = note.message ? ` · ${note.message}` : '';
  return { ok: true, message: `Bieg zapisany (${info.label}) · ocena: ${VERDICT_PL[review.verdict]}${how}` };
}

const VERDICT_PL: Record<WorkoutReview['verdict'], string> = {
  spot_on: 'w punkt',
  good: 'dobra robota',
  passed_but: 'zaliczone, ale…',
  different: 'inny trening niż w planie',
};

type Db = ReturnType<typeof createServiceClient>;

/**
 * Notka trenera do świeżej oceny – ta sama funkcja i ten sam aktywny prompt, co po prawdziwym biegu
 * (supabase/functions/_shared/activities.ts → writeNotes), z kontekstem planu i poprzednimi notkami.
 */
async function writeNote(
  db: Db,
  ctx: {
    userId: string;
    isTest: boolean;
    session: { id: string; scheduled_on: string; type: string; duration_min: number | null; distance_m: number | null };
    week: { sessions: { id: string; scheduled_on: string; type: string; status: string }[] };
    review: WorkoutReview;
    run: { actualDistanceM: number | null; actualDurationS: number | null };
    steps: Parameters<typeof describeSteps>[0];
  },
): Promise<{ message: string | null }> {
  if (!hasClaudeKey()) return { message: 'bez notki trenera – brak ANTHROPIC_API_KEY w panelu' };

  const [profile, promptRes, previous] = await Promise.all([
    db.from('profiles').select('locale, units, timezone').eq('id', ctx.userId).maybeSingle(),
    db.rpc('get_ai_prompt', { p_function: 'workout-review', p_id: null }),
    db
      .from('session_reviews')
      .select('note, note_locale, updated_at')
      .eq('user_id', ctx.userId)
      .not('note', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(3),
  ]);
  if (promptRes.error) console.warn('get_ai_prompt failed – prompt wbudowany', promptRes.error.message);
  const locale = (profile.data?.locale as string | undefined) ?? 'pl';
  const prompt = promptFromRow('workout-review', promptRes.error ? null : (promptRes.data as AiPromptRow | null));
  const today = todayIn((profile.data?.timezone as string | undefined) ?? 'Europe/Warsaw');
  const done = ctx.week.sessions.filter((s) => s.type !== 'rest' && (s.status === 'done' || s.status === 'partial')).length;
  const planned = ctx.week.sessions.filter((s) => s.type !== 'rest').length;
  const next = ctx.week.sessions.find((s) => s.scheduled_on > today && s.status === 'planned' && s.type !== 'rest');

  const outcome = await workoutNoteWithAi({
    context: {
      locale,
      units: parseUnits(profile.data?.units),
      workout: {
        type: ctx.session.type,
        weekday: isoWeekday(ctx.session.scheduled_on),
        plannedMin: ctx.session.duration_min,
        plannedDistanceM: ctx.session.distance_m,
        steps: describeSteps(ctx.steps),
        shiftedDays: 0,
        doneDaysAgo: 0,
      },
      actual: noteActual(ctx.run.actualDistanceM, ctx.run.actualDurationS, parseUnits(profile.data?.units)),
      review: ctx.review,
      previousSameType: null,
      recent: { planned, done },
      next: next ? { type: next.type, inDays: 1 } : null,
      previousNotes: (previous.data ?? []).map((r) => r.note as string),
    },
    prompt,
    call: claudeCaller(),
    log: aiLogger(db),
    meta: { userId: ctx.userId, isTest: ctx.isTest, source: 'tester' },
  });
  if (!outcome.note) return { message: `notka trenera nie powstała (${outcome.status})` };

  const { error } = await db
    .from('session_reviews')
    .update({ note: outcome.note, note_key: workoutNoteKey(ctx.review), note_locale: locale })
    .eq('session_id', ctx.session.id);
  if (error) console.error('note save failed', error.code, error.message);
  return { message: `notka trenera gotowa (wywołanie #${outcome.callId})` };
}

/** Cofa symulację: usuwa wstawiony bieg i ocenę, trening wraca do „zaplanowany”. */
export async function clearSimulatedRun(userId: string, sessionId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId) || !UUID.test(sessionId)) return { ok: false, message: 'Nieprawidłowe dane.' };

  const db = createServiceClient();
  const removed = await db.from('strava_activities').delete().eq('user_id', userId).eq('external_id', `sim-${sessionId}`);
  if (removed.error) return { ok: false, message: `Usunięcie biegu nie powiodło się: ${removed.error.message}` };
  await db.from('session_reviews').delete().eq('session_id', sessionId);
  const { error } = await db
    .from('sessions')
    .update({ status: 'planned', actual_distance_m: null, actual_duration_s: null, completed_at: null })
    .eq('id', sessionId);
  if (error) return { ok: false, message: `Cofnięcie realizacji nie powiodło się: ${error.message}` };

  await db.rpc('admin_log', {
    p_admin_id: admin.id,
    p_action: 'tester_clear_simulated_run',
    p_target_type: 'user',
    p_target_id: userId,
    p_details: { session_id: sessionId },
  });
  refresh();
  return { ok: true, message: 'Symulacja cofnięta – trening znów zaplanowany.' };
}

export type { RunVariant };
