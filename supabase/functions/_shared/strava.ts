// Wspólne dla strava-sync i strava-oauth: klucze aplikacji Stravy, wymiana tokenów i zapis połączenia.
// Sekrety: STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET (supabase secrets set …).

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const STRAVA = 'https://www.strava.com';

export type StravaClient = { id: string; secret: string };

export const stravaClient = (): StravaClient | null => {
  const id = Deno.env.get('STRAVA_CLIENT_ID') ?? '';
  const secret = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';
  return id && secret ? { id, secret } : null;
};

/** Strava odrzuciła token albo kod – trzeba połączyć konto od nowa. */
export class Unauthorized extends Error {
  constructor(readonly stage: 'token' | 'activities') {
    super(`strava rejected ${stage}`);
  }
}
export class RateLimited extends Error {}
/** Aplikacja Stravy ma już komplet połączonych sportowców (nowe aplikacje: jeden) – Strava nie wydaje tokenów. */
export class AthleteLimit extends Error {}

export type StravaTokens = { access_token: string; refresh_token: string; access_token_expires_at: string };
export type StravaAthlete = { id?: number; firstname?: string; lastname?: string };

async function tokenRequest(client: StravaClient, grant: Record<string, string>) {
  const res = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: client.id, client_secret: client.secret, ...grant }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Treść błędu Stravy (bez tokenów) – po niej widać, czy to limit sportowców, zły kod, czy złe klucze.
    const text = (await res.text().catch(() => '')).slice(0, 300);
    if (res.status === 403 || /limit of connected athletes/i.test(text)) throw new AthleteLimit(text);
    if (res.status === 429) throw new RateLimited();
    if (res.status === 400 || res.status === 401) {
      console.warn('strava token rejected', res.status, text);
      throw new Unauthorized('token');
    }
    throw new Error(`token ${res.status} ${text}`);
  }
  const body = (await res.json()) as { access_token: string; refresh_token: string; expires_at: number; athlete?: StravaAthlete };
  const tokens: StravaTokens = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    access_token_expires_at: new Date(body.expires_at * 1000).toISOString(),
  };
  return { tokens, athlete: body.athlete ?? null };
}

export const refreshTokens = async (client: StravaClient, refreshToken: string) =>
  (await tokenRequest(client, { grant_type: 'refresh_token', refresh_token: refreshToken })).tokens;

/** Kod z powrotu z ekranu zgody Stravy → tokeny i dane sportowca. */
export const exchangeCode = (client: StravaClient, code: string) =>
  tokenRequest(client, { grant_type: 'authorization_code', code });

/**
 * Zapisuje połączenie użytkownika. Konto Stravy należy do jednego użytkownika naraz: jeśli było podpięte
 * do kogoś innego, tamto połączenie (i pobrane u niego biegi) znika – ostatnie połączenie wygrywa.
 */
export async function saveConnection(
  db: SupabaseClient,
  userId: string,
  tokens: StravaTokens,
  athlete: StravaAthlete,
  scope: string | null,
): Promise<'ok' | 'save_failed'> {
  if (typeof athlete.id !== 'number') return 'save_failed';

  const others = await db.from('strava_connections').select('user_id').eq('athlete_id', athlete.id).neq('user_id', userId);
  for (const row of others.data ?? []) {
    await db.from('strava_activities').delete().eq('user_id', row.user_id);
    await db.from('strava_connections').delete().eq('user_id', row.user_id);
  }
  // Inne konto Stravy niż poprzednio → biegi poprzedniego konta nie należą już do tego połączenia.
  const previous = await db.from('strava_connections').select('athlete_id').eq('user_id', userId).maybeSingle();
  if (previous.data && Number(previous.data.athlete_id) !== athlete.id) {
    await db.from('strava_activities').delete().eq('user_id', userId);
  }

  const { error } = await db.from('strava_connections').upsert(
    {
      user_id: userId,
      athlete_id: athlete.id,
      athlete_name: [athlete.firstname, athlete.lastname].filter(Boolean).join(' ').slice(0, 120) || null,
      ...tokens,
      scope,
      last_synced_at: null,
      last_error: null,
    },
    { onConflict: 'user_id' },
  );
  if (!error) return 'ok';
  console.error('strava_connections upsert failed', error.code, error.message);
  return 'save_failed';
}
