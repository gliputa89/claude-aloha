// Edge Function: biegi z Apple Zdrowie (HealthKit) odhaczają treningi z planu.
//
// HealthKit jest tylko na telefonie, więc biegi czyta aplikacja i wysyła je tutaj:
//   { since: ISO, workouts: [{ id, activity, start, end, localDate, durationS, distanceM, elevationM,
//                              plannedSessionId, avgHr, maxHr, time[], distance[], heartrate[] }] }
// Funkcja:
//   1. zapisuje biegi w public.strava_activities z source = 'apple_health' (external_id = UUID z HealthKit),
//   2. bieg rozpoczęty z treningu Aloha na Apple Watch (plannedSessionId) od razu przypisuje do tego treningu,
//   3. biegi z okna `since`, których telefon już nie przysłał (usunięte w Apple Zdrowie), usuwa,
//   4. dalej jak strava-sync: dopasowanie, ocena, notka trenera (_shared/activities.ts).
// Ten sam bieg w Stravie i w Apple Zdrowie liczy się raz – zostaje Strava (plan-engine/strava/duplicates.ts).
// Tętno zapisujemy tylko przy zgodzie 'health_data'. Wymaga wiersza w public.health_connections (biegacz włączył
// Apple Zdrowie w Profilu) i modułu 'health'.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { bucketsFromStream } from '../_shared/plan-engine/index.ts';
import { applyMatches, applyReviews, loadPlan, LOOKBACK_DAYS, writeNotes } from '../_shared/activities.ts';
import { userModules } from '../_shared/modules.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MAX_WORKOUTS = 200;
const MAX_POINTS = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Outcome = {
  connected: boolean;
  updated: number;
  imported?: number;
  matched?: number;
  suggested?: number;
  error?: 'save_failed' | 'bad_request';
};

type Workout = {
  id: string;
  activity: 'run' | 'walk';
  start: string;
  end: string;
  localDate: string;
  durationS: number;
  distanceM: number;
  elevationM: number | null;
  plannedSessionId: string | null;
  avgHr: number | null;
  maxHr: number | null;
  time: number[];
  distance: number[];
  heartrate: number[] | null;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const numbers = (v: unknown) =>
  Array.isArray(v) && v.length <= MAX_POINTS && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? (v as number[]) : null;

/** Sprawdza jeden bieg z telefonu; null – pomijamy (zły kształt albo nie bieg / marsz). */
function parseWorkout(raw: unknown): Workout | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  const start = typeof w.start === 'string' ? Date.parse(w.start) : NaN;
  const end = typeof w.end === 'string' ? Date.parse(w.end) : NaN;
  const durationS = num(w.durationS);
  const distanceM = num(w.distanceM);
  if (typeof w.id !== 'string' || !UUID.test(w.id)) return null;
  if (w.activity !== 'run' && w.activity !== 'walk') return null;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 24 * 3600 * 1000) return null;
  if (typeof w.localDate !== 'string' || !DATE.test(w.localDate)) return null;
  if (durationS === null || durationS < 0 || distanceM === null || distanceM < 0) return null;
  const planned = typeof w.plannedSessionId === 'string' && UUID.test(w.plannedSessionId) ? w.plannedSessionId.toLowerCase() : null;
  return {
    id: w.id.toUpperCase(),
    activity: w.activity,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    localDate: w.localDate,
    durationS,
    distanceM,
    elevationM: num(w.elevationM),
    plannedSessionId: planned,
    avgHr: num(w.avgHr),
    maxHr: num(w.maxHr),
    time: numbers(w.time) ?? [],
    distance: numbers(w.distance) ?? [],
    heartrate: numbers(w.heartrate),
  };
}

async function syncUser(db: SupabaseClient, userId: string, body: { since?: unknown; workouts?: unknown }): Promise<Outcome> {
  const modules = await userModules(db, userId);
  if (!modules.has('health')) return { connected: false, updated: 0 };
  const conn = await db.from('health_connections').select('user_id').eq('user_id', userId).maybeSingle();
  if (conn.error) throw new Error(conn.error.message);
  if (!conn.data) return { connected: false, updated: 0 };

  if (!Array.isArray(body.workouts) || body.workouts.length > MAX_WORKOUTS) return { connected: true, updated: 0, error: 'bad_request' };
  const workouts = body.workouts.map(parseWorkout).filter((w): w is Workout => w !== null);

  const { sessions, windowStart } = await loadPlan(db, userId);
  const earliest = windowStart(LOOKBACK_DAYS);
  const sinceMs = typeof body.since === 'string' ? Date.parse(body.since) : NaN;
  const since = Number.isFinite(sinceMs) && new Date(sinceMs).toISOString() > earliest ? new Date(sinceMs).toISOString() : earliest;
  const inWindow = workouts.filter((w) => w.start >= since);

  // Tętno to dane o zdrowiu – tylko przy aktywnej zgodzie; bez niej zostaje samo tempo.
  const consent = await db.rpc('has_consent', { uid: userId, consent_kind: 'health_data' });
  if (consent.error) console.error('has_consent failed', consent.error.message);
  const withHr = consent.data === true;
  const bpm = (value: number | null) => (withHr && value && value >= 30 && value <= 240 ? Math.round(value) : null);

  const planned = new Set(sessions.map((s) => s.id));
  const now = new Date().toISOString();
  const row = (w: Workout) => ({
    user_id: userId,
    source: 'apple_health',
    external_id: w.id,
    sport_type: w.activity === 'run' ? 'Run' : 'Walk',
    name: null,
    started_at: w.start,
    local_date: w.localDate,
    distance_m: Math.round(w.distanceM),
    moving_time_s: Math.round(w.durationS),
    elapsed_time_s: Math.round((Date.parse(w.end) - Date.parse(w.start)) / 1000),
    elevation_gain_m: w.elevationM === null ? null : Math.round(w.elevationM),
    avg_hr: bpm(w.avgHr),
    max_hr: bpm(w.maxHr),
    pace_buckets: bucketsFromStream(w.time, w.distance, undefined, withHr ? (w.heartrate ?? undefined) : undefined),
    pace_fetched_at: now,
  });
  // Bieg z treningu Aloha na zegarku: przypisanie jak po odpowiedzi „tak, to był ten trening”.
  const linked = inWindow.filter((w) => w.plannedSessionId && planned.has(w.plannedSessionId));
  const plain = inWindow.filter((w) => !linked.includes(w));
  const upserts = [
    plain.length > 0 ? db.from('strava_activities').upsert(plain.map(row), { onConflict: 'user_id,source,external_id' }) : null,
    linked.length > 0
      ? db.from('strava_activities').upsert(
          linked.map((w) => ({ ...row(w), session_id: w.plannedSessionId, suggested_session_id: null, match_confirmed: true })),
          { onConflict: 'user_id,source,external_id' },
        )
      : null,
  ];
  for (const res of await Promise.all(upserts)) {
    if (res?.error) {
      console.error('health activities upsert failed', res.error.code, res.error.message);
      return { connected: true, updated: 0, error: 'save_failed' };
    }
  }

  // Czego telefon już nie przysłał z tego okna (usunięte w Apple Zdrowie albo cofnięty dostęp), nie trzymamy.
  let gone = db.from('strava_activities').delete().eq('user_id', userId).eq('source', 'apple_health').gte('started_at', since);
  if (inWindow.length > 0) gone = gone.not('external_id', 'in', `(${inWindow.map((w) => `"${w.id}"`).join(',')})`);
  const removed = await gone;
  if (removed.error) console.error('health activities cleanup failed', removed.error.code, removed.error.message);

  const { updated, matched, suggested } = await applyMatches(db, userId, sessions, earliest);
  if (modules.has('review')) {
    await applyReviews(db, userId, sessions, earliest);
    if (modules.has('coach')) {
      await writeNotes(db, userId, sessions).catch((e) => console.error('notes failed', userId, e instanceof Error ? e.message : e));
    }
  }

  const stamp = await db.from('health_connections').update({ last_synced_at: now, last_error: null }).eq('user_id', userId);
  if (stamp.error) console.error('health_connections update failed', stamp.error.code, stamp.error.message);
  return { connected: true, updated, imported: inWindow.length, matched, suggested };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'bad_request' }, 400);
  try {
    return json(await syncUser(db, auth.user.id, body));
  } catch (e) {
    console.error('health-sync failed', auth.user.id, e);
    return json({ error: 'sync_failed' }, 500);
  }
});
