// Edge Function: pobiera biegi ze Stravy i odhacza nimi treningi z planu.
//
// Dla użytkownika z wierszem w public.strava_connections:
//   1. odświeża token dostępu (gdy wygasa) – sekrety STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET,
//   2. pobiera aktywności od początku aktywnego planu (najwyżej 30 dni wstecz),
//   3. reguły (packages/plan-engine/src/strava/strava.ts) dopasowują biegi do treningów z tego samego dnia,
//   4. zapisuje biegi w public.strava_activities, a w treningach status (zrobiony / częściowo), dystans i czas.
//   5. dla biegów przypisanych do treningów pobiera raz przebieg tempa (strumienie time + distance; tętno tylko
//      przy zgodzie 'health_data' – to dane o zdrowiu)
//      i zapisuje ocenę treningu w public.session_reviews (reguły: packages/plan-engine/src/review/review.ts),
//   6. do świeżych ocen dopisuje notkę trenera AI (funkcja 'workout-review', sekret ANTHROPIC_API_KEY) –
//      bez klucza albo przy błędzie modelu zostaje sama ocena.
// Aktywność usunięta w Stravie znika też u nas przy kolejnej synchronizacji.
//
// Wywołania:
// Bieg z innego dnia niż trening (np. środowy zrobiony w czwartek) reguły tylko proponują (suggested_session_id);
// przypisuje go odpowiedź biegacza: { answer: { activityId, accept } } – bez pytania Stravy.
//
//   * aplikacja – token zalogowanego użytkownika → tylko on; nie częściej niż co 10 min (chyba że `force`);
//     z { manual: true } („Pobierz biegi” w Profilu) – od razu, ostatnie 3 dni, najwyżej raz na 3 godziny,
//   * cron – Authorization: Bearer <SERVICE_ROLE_KEY> → wszyscy połączeni,
//   * panel admina – klucz service_role + { userId } → ten jeden użytkownik, od razu; z { refreshToken } najpierw
//     łączy konto: sprawdza token w Stravie, pobiera dane sportowca i zapisuje wiersz w strava_connections.
// Limity Stravy są wspólne dla całej aplikacji (domyślnie 100 zapytań / 15 min, 1000 / dobę).
// Logika: packages/plan-engine (kopiowane do _shared/plan-engine przez scripts/sync-plan-engine.sh).

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import {
  addDaysIso,
  bucketsFromStream,
  describeSteps,
  isoWeekday,
  isStravaRun,
  isStravaWalk,
  matchStravaActivities,
  noteActual,
  promptFromRow,
  reviewWorkout,
  stepsOf,
  workoutNoteKey,
  workoutNoteWithAi,
  type AiCallPayload,
  type AiCallRecord,
  type PaceBuckets,
  type ReviewFact,
  type WorkoutReview,
  type StravaActivityInput,
  type StravaMatchSession,
} from '../_shared/plan-engine/index.ts';
import { isServiceKey } from '../_shared/auth.ts';
import { claudeCaller, claudeKey } from '../_shared/claude.ts';
import { userModules } from '../_shared/modules.ts';
import {
  RateLimited,
  refreshTokens,
  saveConnection,
  STRAVA,
  stravaClient,
  Unauthorized,
  type StravaAthlete,
  type StravaClient,
  type StravaTokens,
} from '../_shared/strava.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MIN_INTERVAL_MS = 10 * 60 * 1000;
const LOOKBACK_DAYS = 30;
/** Ręczne pobranie z Profilu: krótkie okno i rzadko – limity Stravy są wspólne dla wszystkich użytkowników. */
const MANUAL_INTERVAL_MS = 3 * 60 * 60 * 1000;
const MANUAL_LOOKBACK_DAYS = 3;
const PER_PAGE = 100;
const MAX_PAGES = 3;
/** Przebieg tempa to osobne zapytanie na bieg – przy jednej synchronizacji pobieramy najwyżej tyle. */
const MAX_PACE_FETCHES = 5;
/** Notka trenera: tylko do świeżych treningów i najwyżej tyle na synchronizację (każda to wywołanie modelu). */
/** Tętno wchodzi do oceny dopiero, gdy tyle zapisanych biegów ma pomiar (inaczej „najwyższe tętno” to przypadek). */
const MIN_HR_ACTIVITIES = 3;
/** Ocena tętna względem maksimum – do włączenia, gdy biegacz poda albo potwierdzi swoje tętno maksymalne. */
const HR_MAX_RULES = false;
const NOTE_MAX_AGE_DAYS = 10;
const MAX_NOTES_PER_SYNC = 2;

type Connection = {
  user_id: string;
  athlete_id: number;
  athlete_name: string | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  last_synced_at: string | null;
  last_manual_sync_at: string | null;
};

type SessionRow = StravaMatchSession & { actual_distance_m: number | null; actual_duration_s: number | null; structure: unknown };

type StoredActivity = {
  id: number;
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

type StravaActivity = {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  has_heartrate?: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  athlete?: { id?: number };
};

type Outcome = {
  connected: boolean;
  /** Liczba treningów, w których coś się zmieniło – aplikacja wie, czy odświeżyć plan. */
  updated: number;
  imported?: number;
  /** Ile pobranych biegów trafiło do treningu z planu. */
  matched?: number;
  skipped?: boolean;
  athleteName?: string | null;
  lastSyncedAt?: string | null;
  /** Ręczne pobranie: od kiedy będzie można wymusić kolejne (także gdy to wywołanie zostało odrzucone limitem). */
  nextManualAt?: string;
  /** Ile biegów czeka na odpowiedź „to był ten trening?”. */
  suggested?: number;
  error?: 'reauthorize' | 'rate_limited' | 'strava_unavailable' | 'not_configured' | 'save_failed' | 'no_suggestion';
  /** Przy 'reauthorize': co Strava odrzuciła – sam token czy odczyt aktywności (zwykle brak zakresu activity:read). */
  stage?: 'token' | 'activities';
};

async function accessToken(db: SupabaseClient, conn: Connection, client: StravaClient) {
  const expires = conn.access_token_expires_at ? Date.parse(conn.access_token_expires_at) : 0;
  if (conn.access_token && expires - Date.now() > 5 * 60 * 1000) return conn.access_token;
  const tokens = await refreshTokens(client, conn.refresh_token);

  // Strava może wydać nowy refresh token – stary przestaje wtedy działać, więc zapisujemy zawsze najnowszy.
  const { error } = await db.from('strava_connections').update(tokens).eq('user_id', conn.user_id);
  if (error) console.error('strava token save failed', error.code, error.message);
  return tokens.access_token;
}

/**
 * Ręczne połączenie konta (panel admina): token musi przejść w Stravie, dopiero wtedy zapisujemy wiersz.
 * Zwraca błąd do pokazania w panelu albo null, gdy połączenie jest zapisane.
 */
async function connect(db: SupabaseClient, userId: string, refreshToken: string): Promise<Outcome | null> {
  const client = stravaClient();
  if (!client) return { connected: false, updated: 0, error: 'not_configured' };
  let tokens: StravaTokens;
  let athlete: StravaAthlete;
  try {
    tokens = await refreshTokens(client, refreshToken);
    const res = await fetch(`${STRAVA}/api/v3/athlete`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401) throw new Unauthorized('token');
    if (res.status === 429) throw new RateLimited();
    if (!res.ok) throw new Error(`athlete ${res.status}`);
    athlete = await res.json();
  } catch (e) {
    if (e instanceof Unauthorized) return { connected: false, updated: 0, error: 'reauthorize', stage: e.stage };
    if (e instanceof RateLimited) return { connected: false, updated: 0, error: 'rate_limited' };
    console.error('strava connect failed', userId, e instanceof Error ? e.message : e);
    return { connected: false, updated: 0, error: 'strava_unavailable' };
  }
  if (typeof athlete.id !== 'number') return { connected: false, updated: 0, error: 'strava_unavailable' };
  const saved = await saveConnection(db, userId, tokens, athlete, null);
  return saved === 'ok' ? null : { connected: false, updated: 0, error: 'save_failed' };
}

async function fetchActivities(token: string, afterEpochS: number) {
  const all: StravaActivity[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${STRAVA}/api/v3/athlete/activities?after=${afterEpochS}&per_page=${PER_PAGE}&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401) throw new Unauthorized('activities');
    if (res.status === 429) throw new RateLimited();
    if (!res.ok) throw new Error(`activities ${res.status}`);
    const items = (await res.json()) as StravaActivity[];
    all.push(...items);
    if (items.length < PER_PAGE) return { activities: all, complete: true };
  }
  return { activities: all, complete: false };
}

/** Treningi aktywnego planu (z tygodniem) i początek okna aktywności: dzień przed startem planu, najwyżej 30 dni wstecz. */
async function loadPlan(db: SupabaseClient, userId: string) {
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
async function applyMatches(db: SupabaseClient, userId: string, sessions: SessionRow[], sinceIso: string) {
  const stored = await db
    .from('strava_activities')
    .select('id, sport_type, local_date, started_at, distance_m, moving_time_s, elapsed_time_s, session_id, suggested_session_id, match_confirmed, match_declined')
    .eq('user_id', userId)
    .gte('started_at', sinceIso);
  if (stored.error) throw new Error(stored.error.message);
  const rows = (stored.data ?? []) as StoredActivity[];
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

/**
 * Przebieg tempa dla biegów przypisanych do treningów, które jeszcze go nie mają. Błąd jednego biegu nie
 * zatrzymuje reszty; po odmowie z limitu (429) przestajemy pytać do następnej synchronizacji.
 */
async function fetchPaces(db: SupabaseClient, userId: string, token: string, sinceIso: string, withHr: boolean) {
  const pending = await db
    .from('strava_activities')
    .select('id')
    .eq('user_id', userId)
    .not('session_id', 'is', null)
    .is('pace_fetched_at', null)
    .gte('started_at', sinceIso)
    .order('started_at', { ascending: false })
    .limit(MAX_PACE_FETCHES);
  if (pending.error) return console.error('pace pending failed', pending.error.code, pending.error.message);
  for (const row of pending.data ?? []) {
    try {
      const res = await fetch(`${STRAVA}/api/v3/activities/${row.id}/streams?keys=time,distance${withHr ? ',heartrate' : ''}&key_by_type=true`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 429 || res.status === 401) return;
      // 404 = aktywność bez zapisu trasy (np. wpisana ręcznie) – zapamiętujemy, że pytaliśmy.
      if (!res.ok && res.status !== 404) continue;
      const body = res.ok
        ? ((await res.json()) as { time?: { data?: unknown }; distance?: { data?: unknown }; heartrate?: { data?: unknown } })
        : null;
      const buckets = body ? bucketsFromStream(body.time?.data, body.distance?.data, undefined, withHr ? body.heartrate?.data : undefined) : null;
      const { error } = await db
        .from('strava_activities')
        .update({ pace_buckets: buckets, pace_fetched_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) console.error('pace save failed', row.id, error.code, error.message);
    } catch (e) {
      console.warn('pace fetch failed', row.id, e instanceof Error ? e.message : e);
    }
  }
}

/** Liczy oceny zrobionych treningów z przypisanymi biegami i zapisuje te, które się zmieniły. */
async function applyReviews(db: SupabaseClient, userId: string, sessions: SessionRow[], sinceIso: string) {
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
 * Notka trenera AI do ocen, które jej nie mają albo zmieniły się od jej napisania. Model dostaje ocenę z reguł
 * i kontekst (poprzednie notki, poprzedni trening tego typu, regularność) – bez danych osobowych.
 */
async function writeNotes(db: SupabaseClient, userId: string, sessions: SessionRow[]) {
  const apiKey = claudeKey();
  if (!apiKey) return;
  const reviewsRes = await db
    .from('session_reviews')
    .select('session_id, verdict, volume, intensity, facts, engine_version, note, note_key, updated_at')
    .eq('user_id', userId);
  if (reviewsRes.error) return console.error('notes load failed', reviewsRes.error.code, reviewsRes.error.message);
  type Row = {
    session_id: string;
    verdict: WorkoutReview['verdict'];
    volume: WorkoutReview['volume'];
    intensity: WorkoutReview['intensity'];
    facts: ReviewFact[];
    engine_version: number;
    note: string | null;
    note_key: string | null;
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
      return r && s.scheduled_on >= oldest && (!r.note || r.note_key !== workoutNoteKey(reviewOf(r)));
    })
    .reverse()
    .slice(0, MAX_NOTES_PER_SYNC);
  if (pending.length === 0) return;

  const [profile, account, promptRes, runs] = await Promise.all([
    db.from('profiles').select('locale').eq('id', userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
    db.rpc('get_ai_prompt', { p_function: 'workout-review' }),
    db.from('strava_activities').select('session_id, local_date').eq('user_id', userId).in('session_id', pending.map((s) => s.id)).order('started_at'),
  ]);
  if (promptRes.error) console.error('get_ai_prompt failed', promptRes.error.message);
  const prompt = promptFromRow('workout-review', promptRes.data);
  const ranOn = new Map((runs.data ?? []).map((r) => [r.session_id as string, r.local_date as string]));
  const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const twoWeeks = training.filter((s) => s.scheduled_on <= today && s.scheduled_on > addDaysIso(today, -14));
  let previousNotes = [...rows.values()]
    .filter((r) => r.note)
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
        locale: (profile.data?.locale as string | undefined) ?? 'pl',
        workout: {
          type: s.type,
          weekday: isoWeekday(s.scheduled_on),
          plannedMin: s.duration_min,
          plannedDistanceM: s.distance_m,
          steps: describeSteps(stepsOf(s)),
          shiftedDays: ranOn.has(s.id) ? daysBetween(s.scheduled_on, ranOn.get(s.id)!) : 0,
          doneDaysAgo: Math.max(0, daysBetween(ranOn.get(s.id) ?? s.scheduled_on, today)),
        },
        actual: noteActual(s.actual_distance_m, s.actual_duration_s),
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
    const { error } = await db.from('session_reviews').update({ note: outcome.note, note_key: workoutNoteKey(review) }).eq('session_id', s.id);
    if (error) console.error('note save failed', s.id, error.code, error.message);
    else previousNotes = [outcome.note, ...previousNotes].slice(0, 3);
  }
}

/** Odpowiedź biegacza na „to był ten trening?”: tak → bieg zostaje przy treningu z innego dnia; nie → nie pytamy więcej. */
async function answerMatch(db: SupabaseClient, userId: string, activityId: number, accept: boolean): Promise<Outcome> {
  const modules = await userModules(db, userId);
  if (!modules.has('strava')) return { connected: false, updated: 0 };
  const found = await db
    .from('strava_activities')
    .select('id, suggested_session_id')
    .eq('user_id', userId)
    .eq('id', activityId)
    .not('suggested_session_id', 'is', null)
    .maybeSingle();
  if (found.error) throw new Error(found.error.message);
  if (!found.data) return { connected: true, updated: 0, error: 'no_suggestion' };
  const change = accept
    ? { session_id: found.data.suggested_session_id, suggested_session_id: null, match_confirmed: true }
    : { suggested_session_id: null, match_declined: true };
  const { error } = await db.from('strava_activities').update(change).eq('id', activityId);
  if (error) {
    console.error('strava match answer failed', activityId, error.code, error.message);
    return { connected: true, updated: 0, error: 'save_failed' };
  }
  const { sessions, windowStart } = await loadPlan(db, userId);
  const result = await applyMatches(db, userId, sessions, windowStart(LOOKBACK_DAYS));
  // Ocena od razu z tego, co mamy; przebieg tempa dociągnie najbliższa synchronizacja.
  if (modules.has('review')) await applyReviews(db, userId, sessions, windowStart(LOOKBACK_DAYS));
  return { connected: true, ...result };
}

async function syncUser(db: SupabaseClient, userId: string, opts: { force: boolean; manual?: boolean }): Promise<Outcome> {
  const connRes = await db
    .from('strava_connections')
    .select('user_id, athlete_id, athlete_name, refresh_token, access_token, access_token_expires_at, last_synced_at, last_manual_sync_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (connRes.error) throw new Error(connRes.error.message);
  const conn = connRes.data as Connection | null;
  if (!conn) return { connected: false, updated: 0 };
  // Moduły pakietu: bez „Stravy” nic nie pobieramy; ocena i notki trenera to osobne moduły.
  const modules = await userModules(db, userId);
  if (!modules.has('strava')) return { connected: false, updated: 0 };

  const state = { connected: true, athleteName: conn.athlete_name, lastSyncedAt: conn.last_synced_at };
  if (opts.manual && conn.last_manual_sync_at) {
    const next = Date.parse(conn.last_manual_sync_at) + MANUAL_INTERVAL_MS;
    if (next > Date.now()) return { ...state, updated: 0, skipped: true, nextManualAt: new Date(next).toISOString() };
  }
  if (!opts.force && !opts.manual && conn.last_synced_at && Date.now() - Date.parse(conn.last_synced_at) < MIN_INTERVAL_MS) {
    return { ...state, updated: 0, skipped: true };
  }

  const client = stravaClient();
  if (!client) {
    console.warn('STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET not set');
    return { ...state, updated: 0, error: 'not_configured' };
  }

  // Okno: od dnia przed startem planu (różnica stref), ale nie dalej niż 30 dni wstecz (ręczne pobranie: 3 dni).
  const { sessions, windowStart } = await loadPlan(db, userId);
  const afterIso = windowStart(opts.manual ? MANUAL_LOOKBACK_DAYS : LOOKBACK_DAYS);

  let fetched: Awaited<ReturnType<typeof fetchActivities>>;
  let token: string;
  try {
    token = await accessToken(db, conn, client);
    fetched = await fetchActivities(token, Math.floor(Date.parse(afterIso) / 1000));
  } catch (e) {
    if (e instanceof Unauthorized) {
      await db.from('strava_connections').update({ last_error: 'reauthorize' }).eq('user_id', userId);
      return { ...state, updated: 0, error: 'reauthorize', stage: e.stage };
    }
    if (e instanceof RateLimited) return { ...state, updated: 0, error: 'rate_limited' };
    console.error('strava fetch failed', userId, e instanceof Error ? e.message : e);
    return { ...state, updated: 0, error: 'strava_unavailable' };
  }

  // Tętno to dane o zdrowiu – bierzemy je tylko przy aktywnej zgodzie; bez niej zostaje samo tempo.
  const consent = await db.rpc('has_consent', { uid: userId, consent_kind: 'health_data' });
  if (consent.error) console.error('has_consent failed', consent.error.message);
  const withHr = consent.data === true;
  const bpm = (value: number | undefined) => (withHr && value && value >= 30 && value <= 240 ? Math.round(value) : null);

  // Tylko biegi i marsze tego sportowca (reszta dyscyplin nas nie dotyczy i nie trafia do bazy).
  const own = fetched.activities.filter((a) => {
    const sport = a.sport_type ?? a.type ?? '';
    return (isStravaRun(sport) || isStravaWalk(sport)) && (a.athlete?.id === undefined || a.athlete.id === Number(conn.athlete_id));
  });
  if (own.length > 0) {
    const { error } = await db.from('strava_activities').upsert(
      own.map((a) => ({
        id: a.id,
        user_id: userId,
        sport_type: a.sport_type ?? a.type ?? '',
        name: a.name?.slice(0, 300) ?? null,
        started_at: a.start_date,
        local_date: a.start_date_local.slice(0, 10),
        distance_m: Math.round(a.distance ?? 0),
        moving_time_s: Math.round(a.moving_time ?? 0),
        elapsed_time_s: Math.round(a.elapsed_time ?? a.moving_time ?? 0),
        elevation_gain_m: a.total_elevation_gain === undefined ? null : Math.round(a.total_elevation_gain),
        avg_hr: bpm(a.average_heartrate),
        max_hr: bpm(a.max_heartrate),
      })),
      { onConflict: 'id' },
    );
    if (error) {
      console.error('strava_activities upsert failed', error.code, error.message);
      return { ...state, updated: 0, error: 'save_failed' };
    }
  }

  // Czego Strava już nie zwraca w tym oknie (usunięte albo zmienione na inną dyscyplinę), nie trzymamy.
  if (fetched.complete) {
    let gone = db.from('strava_activities').delete().eq('user_id', userId).gte('started_at', afterIso);
    if (own.length > 0) gone = gone.not('id', 'in', `(${own.map((a) => a.id).join(',')})`);
    const { error } = await gone;
    if (error) console.error('strava_activities cleanup failed', error.code, error.message);
  }

  // Pary i propozycje liczymy ze wszystkich zapisanych biegów planu (nie tylko z pobranego okna).
  const { updated, matched, suggested } = await applyMatches(db, userId, sessions, windowStart(LOOKBACK_DAYS));
  if (modules.has('review')) {
    await fetchPaces(db, userId, token, windowStart(LOOKBACK_DAYS), withHr);
    await applyReviews(db, userId, sessions, windowStart(LOOKBACK_DAYS));
    if (modules.has('coach')) {
      await writeNotes(db, userId, sessions).catch((e) => console.error('notes failed', userId, e instanceof Error ? e.message : e));
    }
  }

  const lastSyncedAt = new Date().toISOString();
  // Ręczne pobranie liczy się do limitu dopiero, gdy się udało – nieudana próba nie blokuje na 3 godziny.
  const stamp = { last_synced_at: lastSyncedAt, last_error: null, ...(opts.manual ? { last_manual_sync_at: lastSyncedAt } : {}) };
  const { error } = await db.from('strava_connections').update(stamp).eq('user_id', userId);
  if (error) console.error('strava_connections update failed', error.code, error.message);
  const nextManualAt = opts.manual ? { nextManualAt: new Date(Date.parse(lastSyncedAt) + MANUAL_INTERVAL_MS).toISOString() } : {};

  return { ...state, ...nextManualAt, lastSyncedAt, updated, imported: own.length, matched, suggested };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (await isServiceKey(token)) {
    // Panel admina: jeden użytkownik, od razu (opcjonalnie z nowym tokenem do zapisania).
    const body = await req.json().catch(() => null);
    if (typeof body?.userId === 'string') {
      try {
        if (typeof body.refreshToken === 'string' && body.refreshToken.trim()) {
          const failed = await connect(db, body.userId, body.refreshToken.trim());
          if (failed) return json(failed);
        }
        return json(await syncUser(db, body.userId, { force: true }));
      } catch (e) {
        console.error('strava-sync failed', body.userId, e);
        return json({ error: 'sync_failed' }, 500);
      }
    }

    // Cron → wszyscy połączeni, po kolei.
    const { data, error } = await db.from('strava_connections').select('user_id').is('last_error', null);
    if (error) return json({ error: 'load_failed', detail: error.message }, 500);
    const results: (Outcome & { userId: string })[] = [];
    for (const row of data ?? []) {
      const userId = row.user_id as string;
      try {
        const outcome = await syncUser(db, userId, { force: false });
        results.push({ userId, ...outcome });
        // Limit jest wspólny – po pierwszej odmowie nie ma sensu pytać dalej.
        if (outcome.error === 'rate_limited') break;
      } catch (e) {
        console.error('strava-sync failed', userId, e);
        results.push({ userId, connected: true, updated: 0, error: 'strava_unavailable' });
      }
    }
    return json({ users: results.length, updated: results.reduce((n, r) => n + r.updated, 0), results });
  }

  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  try {
    const answer = body?.answer;
    if (answer && typeof answer.activityId === 'number' && typeof answer.accept === 'boolean') {
      return json(await answerMatch(db, auth.user.id, answer.activityId, answer.accept));
    }
    return json(await syncUser(db, auth.user.id, { force: body?.force === true, manual: body?.manual === true }));
  } catch (e) {
    console.error('strava-sync failed', auth.user.id, e);
    return json({ error: 'sync_failed' }, 500);
  }
});
