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

import { bucketsFromStream, isStravaRun, isStravaWalk } from '../_shared/plan-engine/index.ts';
import { applyMatches, applyReviews, loadPlan, LOOKBACK_DAYS, writeNotes } from '../_shared/activities.ts';
import { isServiceKey } from '../_shared/auth.ts';
import { userModules } from '../_shared/modules.ts';
import {
  accessToken,
  fetchActivities,
  RateLimited,
  refreshTokens,
  saveConnection,
  STRAVA,
  stravaClient,
  Unauthorized,
  type StravaAthlete,
  type StravaTokenRow,
  type StravaTokens,
} from '../_shared/strava.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MIN_INTERVAL_MS = 10 * 60 * 1000;
/** Ręczne pobranie z Profilu: krótkie okno i rzadko – limity Stravy są wspólne dla wszystkich użytkowników. */
const MANUAL_INTERVAL_MS = 3 * 60 * 60 * 1000;
const MANUAL_LOOKBACK_DAYS = 3;
/** Przebieg tempa to osobne zapytanie na bieg – przy jednej synchronizacji pobieramy najwyżej tyle. */
const MAX_PACE_FETCHES = 5;

type Connection = StravaTokenRow & {
  athlete_id: number;
  athlete_name: string | null;
  last_synced_at: string | null;
  last_manual_sync_at: string | null;
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

/**
 * Przebieg tempa dla biegów przypisanych do treningów, które jeszcze go nie mają. Błąd jednego biegu nie
 * zatrzymuje reszty; po odmowie z limitu (429) przestajemy pytać do następnej synchronizacji.
 */
async function fetchPaces(db: SupabaseClient, userId: string, token: string, sinceIso: string, withHr: boolean) {
  const pending = await db
    .from('strava_activities')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'strava')
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
    let gone = db.from('strava_activities').delete().eq('user_id', userId).eq('source', 'strava').gte('started_at', afterIso);
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
