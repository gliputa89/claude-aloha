// Wspólna część synchronizacji biegów (Strava i Apple Zdrowie): biegi zapisane w public.strava_activities
// (kolumna `source`) dopasowujemy do treningów z planu, liczymy ocenę i dopisujemy notkę trenera AI.
// Używają: strava-sync (biegi ze Stravy) i health-sync (biegi z Apple Zdrowie wysłane przez aplikację).

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import {
  addDaysIso,
  describeSteps,
  duplicateActivityIds,
  isoWeekday,
  matchStravaActivities,
  noteActual,
  parseUnits,
  promptFromRow,
  reviewWorkout,
  stepsOf,
  workoutNoteKey,
  workoutNoteWithAi,
  type ActivitySource,
  type AiCallPayload,
  type AiCallRecord,
  type PaceBuckets,
  type ReviewFact,
  type StravaActivityInput,
  type StravaMatchSession,
  type WorkoutReview,
} from './plan-engine/index.ts';
import { claudeCaller, claudeKey } from './claude.ts';

/** Okno biegów: od dnia przed startem planu, najwyżej tyle dni wstecz. */
export const LOOKBACK_DAYS = 30;
/** Tętno wchodzi do oceny dopiero, gdy tyle zapisanych biegów ma pomiar (inaczej „najwyższe tętno” to przypadek). */
const MIN_HR_ACTIVITIES = 3;
/** Ocena tętna względem maksimum – do włączenia, gdy biegacz poda albo potwierdzi swoje tętno maksymalne. */
const HR_MAX_RULES = false;
/** Notka trenera: tylko do świeżych treningów i najwyżej tyle na synchronizację (każda to wywołanie modelu). */
const NOTE_MAX_AGE_DAYS = 10;
const MAX_NOTES_PER_SYNC = 2;

export type SessionRow = StravaMatchSession & { actual_distance_m: number | null; actual_duration_s: number | null; structure: unknown };

type StoredActivity = {
  id: number;
  source: ActivitySource;
  sport_type: string;
  local_date: string;
  started_at: string;
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s: number;
  session_id: string | null;
  suggested_session_id: string | null;
  match_confirmed: boolean;
  match_declined: boolean;
};

/** Treningi aktywnego planu (z tygodniem) i początek okna aktywności: dzień przed startem planu, najwyżej 30 dni wstecz. */
export async function loadPlan(db: SupabaseClient, userId: string) {
  const planRes = await db
    .from('plans')
    .select('starts_on, weeks(id, sessions(id, scheduled_on, type, duration_min, distance_m, status, actual_distance_m, actual_duration_s, structure))')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (planRes.error) throw new Error(planRes.error.message);
  const sessions = ((planRes.data?.weeks ?? []) as { id: string; sessions: SessionRow[] }[]).flatMap((w) =>
    w.sessions.map((s) => ({ ...s, week: w.id })),
  );
  const today = new Date().toISOString().slice(0, 10);
  const planStart = planRes.data?.starts_on ? addDaysIso(planRes.data.starts_on as string, -1) : null;
  const windowStart = (lookbackDays: number) => {
    const earliest = addDaysIso(today, -lookbackDays);
    return `${planStart && planStart > earliest ? planStart : earliest}T00:00:00Z`;
  };
  return { sessions, windowStart };
}

/**
 * Dopasowuje zapisane biegi do treningów i zapisuje wynik: pary, propozycje („to był ten trening?”) i realizację
 * treningów. Liczy z bazy, nie z odpowiedzi Stravy – dzięki temu działa też po samej odpowiedzi biegacza.
 */
export async function applyMatches(db: SupabaseClient, userId: string, sessions: SessionRow[], sinceIso: string) {
  const stored = await db
    .from('strava_activities')
    .select('id, source, sport_type, local_date, started_at, distance_m, moving_time_s, elapsed_time_s, session_id, suggested_session_id, match_confirmed, match_declined')
    .eq('user_id', userId)
    .gte('started_at', sinceIso);
  if (stored.error) throw new Error(stored.error.message);
  const all = (stored.data ?? []) as StoredActivity[];
  // Ten sam bieg z Apple Zdrowie i ze Stravy liczymy raz (zostaje Strava); kopia traci przypisanie do treningu.
  const twins = duplicateActivityIds(
    all.map((r) => ({ id: Number(r.id), source: r.source, startedAt: r.started_at, elapsedTimeS: r.elapsed_time_s })),
  );
  for (const r of all.filter((r) => twins.has(Number(r.id)) && (r.session_id || r.suggested_session_id))) {
    const { error } = await db.from('strava_activities').update({ session_id: null, suggested_session_id: null }).eq('id', r.id);
    if (error) console.error('duplicate unlink failed', r.id, error.code, error.message);
  }
  const rows = all.filter((r) => !twins.has(Number(r.id)));
  const inputs: StravaActivityInput[] = rows.map((r) => ({
    id: Number(r.id),
    sportType: r.sport_type,
    localDate: r.local_date,
    startedAt: r.started_at,
    distanceM: r.distance_m,
    movingTimeS: r.moving_time_s,
    elapsedTimeS: r.elapsed_time_s,
  }));
  const { links, suggestions, completions } = matchStravaActivities(sessions, inputs, {
    confirmed: new Map(rows.filter((r) => r.match_confirmed && r.session_id).map((r) => [Number(r.id), r.session_id!])),
    declined: new Set(rows.filter((r) => r.match_declined).map((r) => Number(r.id))),
  });

  for (const r of rows) {
    const id = Number(r.id);
    const sessionId = links.get(id) ?? null;
    const suggestedId = suggestions.get(id) ?? null;
    if (sessionId === r.session_id && suggestedId === r.suggested_session_id) continue;
    const { error } = await db.from('strava_activities').update({ session_id: sessionId, suggested_session_id: suggestedId }).eq('id', id);
    if (error) console.error('strava_activities link failed', id, error.code, error.message);
  }

  let updated = 0;
  const byId = new Map(sessions.map((s) => [s.id, s]));
  for (const c of completions) {
    const s = byId.get(c.sessionId);
    if (!s || (s.status === c.status && s.actual_distance_m === c.actualDistanceM && s.actual_duration_s === c.actualDurationS)) {
      continue;
    }
    const { error } = await db
      .from('sessions')
      .update({
        status: c.status,
        actual_distance_m: c.actualDistanceM,
        actual_duration_s: c.actualDurationS,
        completed_at: c.completedAt,
      })
      .eq('id', c.sessionId);
    if (error) {
      console.error('session update failed', c.sessionId, error.code, error.message);
      continue;
    }
    // Ocena (applyReviews) liczy już z nowej realizacji.
    Object.assign(s, { status: c.status, actual_distance_m: c.actualDistanceM, actual_duration_s: c.actualDurationS });
    updated++;
  }
  return { updated, matched: [...links.values()].filter(Boolean).length, suggested: suggestions.size };
}

/** Liczy oceny zrobionych treningów z przypisanymi biegami i zapisuje te, które się zmieniły. */
export async function applyReviews(db: SupabaseClient, userId: string, sessions: SessionRow[], sinceIso: string) {
  const [activities, existing, hrRows] = await Promise.all([
    db
      .from('strava_activities')
      .select('session_id, started_at, elevation_gain_m, pace_buckets')
      .eq('user_id', userId)
      .not('session_id', 'is', null)
      .gte('started_at', sinceIso)
      .order('started_at'),
    db.from('session_reviews').select('session_id, verdict, volume, intensity, facts, engine_version').eq('user_id', userId),
    db.from('strava_activities').select('max_hr').eq('user_id', userId).not('max_hr', 'is', null),
  ]);
  // Punkt odniesienia dla tętna: najwyższe zarejestrowane w zapisanych biegach – dopiero od kilku biegów z pomiarem.
  // Na razie wyłączone (HR_MAX_RULES): z kilku biegów nie wiadomo, jakie jest prawdziwe tętno maksymalne, więc
  // ocena „spokojnie / za mocno” względem niego byłaby zgadywaniem. Dryf tętna nie potrzebuje maksimum i działa.
  const peaks = (hrRows.data ?? []).map((r) => Number(r.max_hr));
  const hrMax = HR_MAX_RULES && peaks.length >= MIN_HR_ACTIVITIES ? Math.max(...peaks) : null;
  if (activities.error || existing.error) {
    return console.error('review load failed', activities.error?.message ?? existing.error?.message);
  }
  const bySession = new Map<string, { elevation_gain_m: number | null; pace_buckets: PaceBuckets | null }[]>();
  for (const a of activities.data ?? []) {
    const list = bySession.get(a.session_id as string);
    if (list) list.push(a);
    else bySession.set(a.session_id as string, [a]);
  }
  const saved = new Map((existing.data ?? []).map((r) => [r.session_id as string, r]));

  for (const s of sessions) {
    const runs = bySession.get(s.id);
    if (!runs || (s.status !== 'done' && s.status !== 'partial')) continue;
    // Kilka aktywności jednego treningu: przebieg sklejamy tylko wtedy, gdy każda go ma.
    const complete = runs.every((r) => r.pace_buckets && r.pace_buckets.bucketS === runs[0]!.pace_buckets?.bucketS);
    const allHr = complete && runs.every((r) => r.pace_buckets!.hr?.length === r.pace_buckets!.m.length);
    const buckets: PaceBuckets | null = complete
      ? {
          bucketS: runs[0]!.pace_buckets!.bucketS,
          m: runs.flatMap((r) => r.pace_buckets!.m),
          ...(allHr ? { hr: runs.flatMap((r) => r.pace_buckets!.hr!) } : {}),
        }
      : null;
    const review = reviewWorkout({
      type: s.type,
      durationMin: s.duration_min,
      distanceM: s.distance_m,
      steps: stepsOf(s),
      actualDistanceM: s.actual_distance_m,
      actualDurationS: s.actual_duration_s,
      buckets,
      elevationGainM: runs.reduce((n, r) => n + (r.elevation_gain_m ?? 0), 0),
      hrMax,
    });
    const row = {
      session_id: s.id,
      verdict: review.verdict,
      volume: review.volume,
      intensity: review.intensity,
      facts: review.facts,
      engine_version: review.version,
    };
    if (JSON.stringify(saved.get(s.id) ?? null) === JSON.stringify(row)) continue;
    const { error } = await db.from('session_reviews').upsert({ ...row, user_id: userId }, { onConflict: 'session_id' });
    if (error) console.error('review save failed', s.id, error.code, error.message);
  }
}

/**
 * Notka trenera AI do ocen, które jej nie mają, zmieniły się od jej napisania albo mają notkę w innym języku
 * (biegacz zmienił język w aplikacji). Model dostaje ocenę z reguł
 * i kontekst (poprzednie notki, poprzedni trening tego typu, regularność) – bez danych osobowych.
 */
export async function writeNotes(db: SupabaseClient, userId: string, sessions: SessionRow[]) {
  const apiKey = claudeKey();
  if (!apiKey) return;
  const [reviewsRes, profile] = await Promise.all([
    db
      .from('session_reviews')
      .select('session_id, verdict, volume, intensity, facts, engine_version, note, note_key, note_locale, updated_at')
      .eq('user_id', userId),
    db.from('profiles').select('locale, units').eq('id', userId).maybeSingle(),
  ]);
  if (reviewsRes.error) return console.error('notes load failed', reviewsRes.error.code, reviewsRes.error.message);
  const locale = (profile.data?.locale as string | undefined) ?? 'pl';
  type Row = {
    session_id: string;
    verdict: WorkoutReview['verdict'];
    volume: WorkoutReview['volume'];
    intensity: WorkoutReview['intensity'];
    facts: ReviewFact[];
    engine_version: number;
    note: string | null;
    note_key: string | null;
    note_locale: string | null;
    updated_at: string;
  };
  const rows = new Map((reviewsRes.data as Row[]).map((r) => [r.session_id, r]));
  const reviewOf = (r: Row): WorkoutReview => ({
    version: r.engine_version,
    verdict: r.verdict,
    volume: r.volume,
    intensity: r.intensity,
    facts: r.facts,
  });

  const today = new Date().toISOString().slice(0, 10);
  const oldest = addDaysIso(today, -NOTE_MAX_AGE_DAYS);
  const training = sessions.filter((s) => s.type !== 'rest').sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));
  const pending = training
    .filter((s) => {
      const r = rows.get(s.id);
      return (
        r &&
        s.scheduled_on >= oldest &&
        (!r.note || r.note_key !== workoutNoteKey(reviewOf(r)) || (r.note_locale !== null && r.note_locale !== locale))
      );
    })
    .reverse()
    .slice(0, MAX_NOTES_PER_SYNC);
  if (pending.length === 0) return;

  const [account, promptRes, runs] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db.rpc('get_ai_prompt', { p_function: 'workout-review' }),
    db.from('strava_activities').select('session_id, local_date').eq('user_id', userId).in('session_id', pending.map((s) => s.id)).order('started_at'),
  ]);
  if (promptRes.error) console.error('get_ai_prompt failed', promptRes.error.message);
  const prompt = promptFromRow('workout-review', promptRes.data);
  const units = parseUnits(profile.data?.units);
  const ranOn = new Map((runs.data ?? []).map((r) => [r.session_id as string, r.local_date as string]));
  const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const twoWeeks = training.filter((s) => s.scheduled_on <= today && s.scheduled_on > addDaysIso(today, -14));
  // Poprzednie notki (żeby się nie powtarzać) tylko w bieżącym języku.
  let previousNotes = [...rows.values()]
    .filter((r) => r.note && (r.note_locale === null || r.note_locale === locale))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3)
    .map((r) => r.note!);

  for (const s of pending) {
    const row = rows.get(s.id)!;
    const review = reviewOf(row);
    const previous = training.filter((o) => o.type === s.type && o.scheduled_on < s.scheduled_on && rows.has(o.id)).at(-1);
    const next = training.find((o) => o.scheduled_on > today && o.status === 'planned');
    const outcome = await workoutNoteWithAi({
      context: {
        locale,
        units,
        workout: {
          type: s.type,
          weekday: isoWeekday(s.scheduled_on),
          plannedMin: s.duration_min,
          plannedDistanceM: s.distance_m,
          steps: describeSteps(stepsOf(s)),
          shiftedDays: ranOn.has(s.id) ? daysBetween(s.scheduled_on, ranOn.get(s.id)!) : 0,
          doneDaysAgo: Math.max(0, daysBetween(ranOn.get(s.id) ?? s.scheduled_on, today)),
        },
        actual: noteActual(s.actual_distance_m, s.actual_duration_s, units),
        review,
        previousSameType: previous
          ? { date: previous.scheduled_on, verdict: rows.get(previous.id)!.verdict, facts: rows.get(previous.id)!.facts }
          : null,
        recent: { planned: twoWeeks.length, done: twoWeeks.filter((o) => o.status === 'done' || o.status === 'partial').length },
        next: next ? { type: next.type, inDays: daysBetween(today, next.scheduled_on) } : null,
        previousNotes,
      },
      prompt,
      call: claudeCaller(apiKey),
      log: async (call: AiCallRecord, payload: AiCallPayload) => {
        const { data, error } = await db.rpc('log_ai_call', { p_call: call, p_payload: payload });
        if (error) console.error('log_ai_call failed', error.code, error.message);
        return (data as number | null) ?? null;
      },
      meta: { userId, isTest: account.data.user?.user_metadata?.test_account === true },
    });
    if (!outcome.note) continue;
    const { error } = await db.from('session_reviews').update({ note: outcome.note, note_key: workoutNoteKey(review), note_locale: locale }).eq('session_id', s.id);
    if (error) console.error('note save failed', s.id, error.code, error.message);
    else previousNotes = [outcome.note, ...previousNotes].slice(0, 3);
  }
}
