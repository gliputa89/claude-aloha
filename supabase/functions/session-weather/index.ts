// Edge Function: pogoda do najbliższych treningów (zakładka „Dzisiaj” i szczegóły treningu).
//
// Aplikacja podaje przybliżoną lokalizację (zaokrąglamy do 0,1° ≈ 10 km) i język. Funkcja:
//   1. bierze treningi aktywnego planu na 7 dni (bez odpoczynku, tylko zaplanowane),
//   2. pobiera prognozę godzinową i jakość powietrza (Open-Meteo),
//   3. reguły (packages/plan-engine/weather.ts) wybierają najlepsze okno i ostrzeżenia,
//   4. Claude ('weather-advice') pisze 1–2 zdania do treningu – tylko gdy wynik reguł się zmienił,
//   5. zapisuje wynik w public.session_weather i zwraca go aplikacji.
// Świeży zapis (to samo miejsce, < 3 h; dzisiejszy trening < 1 h) wraca od razu, bez zapytań na zewnątrz.
// Błąd prognozy → 502 (aplikacja po prostu nie pokaże pogody). Błąd AI → wynik bez porady (tekst ze słownika).
//
// Źródło pogody: Open-Meteo. Darmowe API jest tylko do użytku niekomercyjnego – przed płatnym wydaniem
// ustaw sekret OPEN_METEO_API_KEY (plan komercyjny), funkcja przełączy się wtedy na adresy dla klientów.
// Logika: packages/plan-engine (kopiowane do _shared/plan-engine przez scripts/sync-plan-engine.sh).

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { claudeCaller, claudeKey } from '../_shared/claude.ts';
import {
  addDaysIso,
  assessSession,
  hoursFromOpenMeteo,
  promptFromRow,
  weatherAdviceWithAi,
  weatherKey,
  type AiCallPayload,
  type AiCallRecord,
  type HourForecast,
  type OpenMeteoHourly,
  type SessionWeather,
} from '../_shared/plan-engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const FORECAST_DAYS = 7;
const FRESH_MS = 3 * 60 * 60 * 1000;
const FRESH_TODAY_MS = 60 * 60 * 1000;
/** Częściej niż co tyle nie pytamy o prognozę, cokolwiek przyśle aplikacja. */
const MIN_INTERVAL_MS = 10 * 60 * 1000;

type SessionRow = {
  id: string;
  scheduled_on: string;
  type: string;
  duration_min: number | null;
  intensity: string | null;
  status: string;
};

type WeatherRow = {
  session_id: string;
  forecast: SessionWeather;
  forecast_key: string;
  advice: string | null;
  advice_locale: string | null;
  advice_key: string | null;
  lat_grid: number;
  lon_grid: number;
  fetched_at: string;
};

function localNow(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return { today: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
  } catch {
    const iso = new Date().toISOString();
    return { today: iso.slice(0, 10), hour: Number(iso.slice(11, 13)) };
  }
}

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return await res.json();
}

/** Prognoza godzinowa + PM2.5 dla punktu. Brak jakości powietrza nie jest błędem. */
async function fetchForecast(lat: number, lon: number): Promise<{ hours: HourForecast[]; timezone: string }> {
  const key = Deno.env.get('OPEN_METEO_API_KEY');
  const host = (name: string) => (key ? `https://customer-${name}.open-meteo.com` : `https://${name}.open-meteo.com`);
  const common = `latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=${FORECAST_DAYS}${key ? `&apikey=${key}` : ''}`;
  const hourly =
    'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,is_day';
  const [forecast, air] = await Promise.all([
    fetchJson(`${host('api')}/v1/forecast?${common}&hourly=${hourly}`),
    fetchJson(`${host('air-quality-api')}/v1/air-quality?${common}&hourly=pm2_5`).catch((e) => {
      console.warn('air quality unavailable', e instanceof Error ? e.message : e);
      return null;
    }),
  ]);
  if (!forecast?.hourly?.time) throw new Error('forecast: empty response');
  return {
    hours: hoursFromOpenMeteo(forecast.hourly as OpenMeteoHourly, air?.hourly ?? null),
    timezone: typeof forecast.timezone === 'string' ? forecast.timezone : 'UTC',
  };
}

const toResponse = (rows: { session_id: string; forecast: SessionWeather; advice: string | null; advice_locale: string | null }[], locale: string) =>
  rows
    .map((r) => ({ sessionId: r.session_id, ...r.forecast, advice: r.advice_locale === locale ? r.advice : null }))
    .sort((a, b) => a.date.localeCompare(b.date));

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

  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lon = Number(body?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: 'invalid_location' }, 400);
  // Zaokrąglenie do 0,1° – dokładniejsza pozycja nie wychodzi poza to miejsce (ani do bazy, ani do dostawcy pogody).
  const latGrid = Math.round(lat * 10) / 10;
  const lonGrid = Math.round(lon * 10) / 10;
  const locale = body?.locale === 'en' ? 'en' : 'pl';

  const [profileRes, planRes] = await Promise.all([
    db.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
    db
      .from('plans')
      .select('id, weeks(sessions(id, scheduled_on, type, duration_min, intensity, status))')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);
  if (planRes.error) return json({ error: 'load_failed', detail: planRes.error.message }, 500);
  const allSessions = ((planRes.data?.weeks ?? []) as { sessions: SessionRow[] }[]).flatMap((w) => w.sessions);

  // Wstępny wybór wg strefy z profilu (o dobę szerzej) – właściwe „dziś” znamy dopiero ze strefy miejsca prognozy.
  const profileNow = localNow(profileRes.data?.timezone ?? 'Europe/Warsaw');
  const upcoming = allSessions.filter(
    (s) =>
      s.type !== 'rest' &&
      s.status === 'planned' &&
      s.scheduled_on >= addDaysIso(profileNow.today, -1) &&
      s.scheduled_on <= addDaysIso(profileNow.today, FORECAST_DAYS),
  );
  if (upcoming.length === 0) return json({ sessions: [], cached: true });

  const cachedRes = await db
    .from('session_weather')
    .select('session_id, forecast, forecast_key, advice, advice_locale, advice_key, lat_grid, lon_grid, fetched_at')
    .in('session_id', upcoming.map((s) => s.id));
  if (cachedRes.error) return json({ error: 'load_failed', detail: cachedRes.error.message }, 500);
  const cached = new Map((cachedRes.data as WeatherRow[]).map((r) => [r.session_id, r]));

  const nowMs = Date.now();
  const age = (r: WeatherRow) => nowMs - Date.parse(r.fetched_at);
  const rows = [...cached.values()];
  const sameGrid = (r: WeatherRow) => Number(r.lat_grid) === latGrid && Number(r.lon_grid) === lonGrid;
  const throttled = rows.some((r) => age(r) < MIN_INTERVAL_MS);
  const fresh =
    rows.length > 0 &&
    upcoming
      .filter((s) => s.scheduled_on >= profileNow.today && s.scheduled_on < addDaysIso(profileNow.today, FORECAST_DAYS))
      .every((s) => {
        const r = cached.get(s.id);
        if (!r || !sameGrid(r) || r.forecast.date !== s.scheduled_on) return false;
        return age(r) < (s.scheduled_on === profileNow.today ? FRESH_TODAY_MS : FRESH_MS);
      });
  if (throttled || fresh) {
    const current = rows.filter((r) => r.forecast.date >= profileNow.today);
    return json({ sessions: toResponse(current, locale), cached: true });
  }

  let forecast: Awaited<ReturnType<typeof fetchForecast>>;
  try {
    forecast = await fetchForecast(latGrid, lonGrid);
  } catch (e) {
    console.error('forecast failed', e instanceof Error ? e.message : e);
    return json({ error: 'forecast_unavailable' }, 502);
  }
  const now = localNow(forecast.timezone);

  const assessed: { session: SessionRow; weather: SessionWeather; key: string }[] = [];
  const gone: string[] = [];
  for (const s of upcoming) {
    const weather =
      s.scheduled_on >= now.today
        ? assessSession({
            date: s.scheduled_on,
            durationMin: s.duration_min,
            hours: forecast.hours,
            nowHour: s.scheduled_on === now.today ? now.hour : null,
          })
        : null;
    if (weather) assessed.push({ session: s, weather, key: weatherKey(weather) });
    else if (cached.has(s.id)) gone.push(s.id);
  }

  // Porada od AI tylko tam, gdzie wynik reguł albo język się zmienił – reszta zostaje z poprzedniego razu.
  const kept = (a: (typeof assessed)[number]) => {
    const r = cached.get(a.session.id);
    return r && r.advice && r.advice_key === a.key && r.advice_locale === locale ? r.advice : null;
  };
  const needAdvice = assessed.filter((a) => !kept(a));
  let advice: Record<string, string> = {};
  const apiKey = claudeKey();
  if (needAdvice.length > 0 && apiKey) {
    const promptRes = await db.rpc('get_ai_prompt', { p_function: 'weather-advice' });
    if (promptRes.error) console.error('get_ai_prompt failed', promptRes.error.message);
    const outcome = await weatherAdviceWithAi({
      sessions: needAdvice.map((a) => ({
        type: a.session.type,
        durationMin: a.session.duration_min,
        intensity: a.session.intensity,
        weather: a.weather,
      })),
      locale,
      today: now.today,
      nowHour: now.hour,
      prompt: promptFromRow('weather-advice', promptRes.data),
      call: claudeCaller(apiKey),
      log: async (call: AiCallRecord, payload: AiCallPayload) => {
        const { data, error } = await db.rpc('log_ai_call', { p_call: call, p_payload: payload });
        if (error) console.error('log_ai_call failed', error.code, error.message);
        return (data as number | null) ?? null;
      },
      meta: { userId, isTest: auth.user.user_metadata?.test_account === true },
    });
    advice = outcome.advice;
  } else if (needAdvice.length > 0) {
    console.warn('ANTHROPIC_API_KEY not set – weather without AI advice');
  }

  const fetchedAt = new Date(nowMs).toISOString();
  const toSave = assessed.map((a) => {
    const text = kept(a) ?? advice[a.weather.date] ?? null;
    return {
      session_id: a.session.id,
      user_id: userId,
      forecast: a.weather,
      forecast_key: a.key,
      advice: text,
      advice_locale: text ? locale : null,
      advice_key: text ? a.key : null,
      lat_grid: latGrid,
      lon_grid: lonGrid,
      fetched_at: fetchedAt,
    };
  });
  if (toSave.length > 0) {
    const { error } = await db.from('session_weather').upsert(toSave, { onConflict: 'session_id' });
    // Zapis to tylko pamięć podręczna – wynik i tak wraca do aplikacji.
    if (error) console.error('session_weather upsert failed', error.code, error.message);
  }
  if (gone.length > 0) {
    const { error } = await db.from('session_weather').delete().in('session_id', gone);
    if (error) console.error('session_weather cleanup failed', error.code, error.message);
  }

  return json({ sessions: toResponse(toSave, locale), cached: false });
});
