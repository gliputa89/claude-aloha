// Edge Function: podpowiedź do ankiety startowej z biegów w Stravie (onboarding, krok „Jak teraz biegasz?”).
//
//   POST { today: 'YYYY-MM-DD' } z tokenem użytkownika → { connected, proposal } albo { connected, error }
//
// Dla użytkownika z połączoną Stravą pobiera aktywności z ostatnich 8 tygodni i liczy z nich propozycję odpowiedzi:
// poziom, liczbę biegów w tygodniu, ostatni wynik, dni i czas na trening
// (reguły: packages/plan-engine/src/strava/history.ts). Biegacz widzi ją w ankiecie i może wszystko zmienić.
//
// Niczego nie zapisujemy: plan jeszcze nie istnieje, więc nie ma do czego przypisać biegów, a zapis w
// strava_activities zaczyna się dopiero od startu planu (strava-sync). Tętna nie czytamy – w tym kroku ankiety
// nie ma jeszcze zgody 'health_data'.
// Sekrety: STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { userModules } from '../_shared/modules.ts';
import { addDaysIso, daysBetween, STRAVA_HISTORY_DAYS, surveyFromStravaHistory } from '../_shared/plan-engine/index.ts';
import { accessToken, fetchActivities, RateLimited, stravaClient, Unauthorized, type StravaTokenRow } from '../_shared/strava.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  const userId = auth.user.id;

  // „Dziś” podaje aplikacja (strefa czasowa telefonu) – przyjmujemy tylko dzień sąsiadujący z datą serwera.
  const body = await req.json().catch(() => null);
  const today = typeof body?.today === 'string' && ISO_DATE.test(body.today) ? (body.today as string) : null;
  if (!today || Math.abs(daysBetween(new Date().toISOString().slice(0, 10), today)) > 1) return json({ error: 'invalid_day' }, 400);

  try {
    if (!(await userModules(db, userId)).has('strava')) return json({ connected: false });
    const connRes = await db
      .from('strava_connections')
      .select('user_id, athlete_id, refresh_token, access_token, access_token_expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (connRes.error) throw new Error(connRes.error.message);
    const conn = connRes.data as (StravaTokenRow & { athlete_id: number }) | null;
    if (!conn) return json({ connected: false });
    const client = stravaClient();
    if (!client) return json({ connected: true, error: 'not_configured' });

    // Dzień zapasu na różnicę stref; reguły same odcinają to, co wypada poza okno w czasie lokalnym biegacza.
    const afterEpochS = Math.floor(Date.parse(`${addDaysIso(today, -STRAVA_HISTORY_DAYS)}T00:00:00Z`) / 1000);
    let activities: Awaited<ReturnType<typeof fetchActivities>>['activities'];
    try {
      ({ activities } = await fetchActivities(await accessToken(db, conn, client), afterEpochS));
    } catch (e) {
      if (e instanceof Unauthorized) {
        await db.from('strava_connections').update({ last_error: 'reauthorize' }).eq('user_id', userId);
        return json({ connected: true, error: 'reauthorize' });
      }
      if (e instanceof RateLimited) return json({ connected: true, error: 'rate_limited' });
      console.error('strava history fetch failed', userId, e instanceof Error ? e.message : e);
      return json({ connected: true, error: 'strava_unavailable' });
    }

    const proposal = surveyFromStravaHistory(
      activities
        .filter((a) => a.athlete?.id === undefined || a.athlete.id === Number(conn.athlete_id))
        .map((a) => ({
          id: a.id,
          sportType: a.sport_type ?? a.type ?? '',
          localDate: a.start_date_local.slice(0, 10),
          startedAt: a.start_date,
          distanceM: Math.round(a.distance ?? 0),
          movingTimeS: Math.round(a.moving_time ?? 0),
          elapsedTimeS: Math.round(a.elapsed_time ?? a.moving_time ?? 0),
          race: a.workout_type === 1,
        })),
      today,
    );
    return json({ connected: true, proposal });
  } catch (e) {
    console.error('strava-history failed', userId, e);
    return json({ error: 'history_failed' }, 500);
  }
});
