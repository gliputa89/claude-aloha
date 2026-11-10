// Edge Function: „Połącz przez Stravę” (OAuth) dla aplikacji i panelu admina + rozłączenie konta.
//
//   POST { action: 'start', returnTo }      → { url } – adres ekranu zgody Stravy. Użytkownika bierzemy z tokenu;
//                                             panel (klucz service_role) podaje też userId.
//   GET  ?code=…&scope=…&state=…            → powrót ze Stravy: wymiana kodu na tokeny, zapis połączenia
//                                             i przekierowanie na `returnTo` z ?strava=connected albo ?strava=<błąd>.
//   POST { action: 'disconnect' }           → cofa dostęp w Stravie, usuwa połączenie i pobrane biegi.
//
// Powrót ze Stravy przychodzi z przeglądarki bez tokenu Supabase, dlatego funkcja ma verify_jwt = false
// (supabase/config.toml) i sama sprawdza: POST – token użytkownika albo klucz service_role, GET – podpisany `state`.
// W ustawieniach aplikacji Stravy „Authorization Callback Domain” = host projektu Supabase (<ref>.supabase.co).
// Sekrety: STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { isServiceKey } from '../_shared/auth.ts';
import { exchangeCode, RateLimited, saveConnection, STRAVA, stravaClient, Unauthorized } from '../_shared/strava.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Zakres: biegi, także te ustawione w Stravie jako prywatne („Tylko ja”) – inaczej nie odhaczą treningu. */
const SCOPE = 'activity:read_all';
const STATE_TTL_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type State = { u: string; r: string; e: number };

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmacKey() {
  // Klucz podpisu wyprowadzony z klucza service_role – znany tylko funkcjom tego projektu.
  const secret = new TextEncoder().encode(`strava-oauth-state:${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`);
  return await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signState(state: State) {
  const payload = new TextEncoder().encode(JSON.stringify(state));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), payload));
  return `${b64url(payload)}.${b64url(signature)}`;
}

async function readState(text: string | null): Promise<State | null> {
  try {
    const [payload, signature] = (text ?? '').split('.');
    if (!payload || !signature) return null;
    const bytes = fromB64url(payload);
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(), fromB64url(signature), bytes))) return null;
    const state = JSON.parse(new TextDecoder().decode(bytes)) as State;
    return UUID.test(state.u) && typeof state.r === 'string' && state.e > Date.now() ? state : null;
  } catch {
    return null;
  }
}

const callbackUrl = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/strava-oauth`;

function back(returnTo: string, result: string) {
  const url = new URL(returnTo);
  url.searchParams.set('strava', result);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ── Powrót ze Stravy ──
  if (req.method === 'GET') {
    const query = new URL(req.url).searchParams;
    const state = await readState(query.get('state'));
    if (!state) return new Response('Link wygasł – wróć do Aloha i połącz Stravę jeszcze raz.', { status: 400 });
    // Użytkownik kliknął „Anuluj” na ekranie zgody.
    if (query.get('error') || !query.get('code')) return back(state.r, 'cancelled');
    // Odznaczony dostęp do aktywności = połączenie, które nic nie pobierze – nie zapisujemy go.
    const granted = (query.get('scope') ?? '').split(',');
    if (!granted.some((s) => s === 'activity:read' || s === 'activity:read_all')) return back(state.r, 'no_activity_scope');

    const client = stravaClient();
    if (!client) return back(state.r, 'not_configured');
    try {
      const { tokens, athlete } = await exchangeCode(client, query.get('code')!);
      if (!athlete) return back(state.r, 'failed');
      return back(state.r, (await saveConnection(db, state.u, tokens, athlete, granted.join(','))) === 'ok' ? 'connected' : 'failed');
    } catch (e) {
      if (e instanceof RateLimited) return back(state.r, 'rate_limited');
      if (!(e instanceof Unauthorized)) console.error('strava oauth exchange failed', state.u, e instanceof Error ? e.message : e);
      return back(state.r, 'failed');
    }
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);

  // Panel admina (klucz service_role) wskazuje użytkownika; aplikacja działa tylko na własnym koncie.
  const admin = await isServiceKey(token);
  let userId: string;
  if (admin) {
    if (typeof body?.userId !== 'string' || !UUID.test(body.userId)) return json({ error: 'invalid_user' }, 400);
    userId = body.userId;
  } else {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return json({ error: 'unauthorized' }, 401);
    userId = data.user.id;
  }

  if (body?.action === 'start') {
    const client = stravaClient();
    if (!client) return json({ error: 'not_configured' }, 503);
    // Dokąd wrócić: aplikacja – tylko własny schemat; panel – adres panelu (wywołanie już jest zaufane).
    const returnTo = typeof body.returnTo === 'string' ? body.returnTo : '';
    const allowed = admin ? /^https?:\/\//.test(returnTo) : returnTo.startsWith('aloha://');
    if (!allowed || !URL.canParse(returnTo)) return json({ error: 'invalid_return' }, 400);

    const url = new URL(`${STRAVA}/oauth/authorize`);
    url.searchParams.set('client_id', client.id);
    url.searchParams.set('redirect_uri', callbackUrl());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('approval_prompt', 'auto');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', await signState({ u: userId, r: returnTo, e: Date.now() + STATE_TTL_MS }));
    return json({ url: url.toString() });
  }

  if (body?.action === 'disconnect') {
    const conn = await db.from('strava_connections').select('access_token').eq('user_id', userId).maybeSingle();
    if (conn.error) return json({ error: 'load_failed' }, 500);
    if (conn.data?.access_token) {
      // Cofnięcie dostępu po stronie Stravy – jak się nie uda (np. token wygasł), i tak usuwamy dane u nas.
      await fetch(`${STRAVA}/oauth/deauthorize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.data.access_token}` },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
    }
    const activities = await db.from('strava_activities').delete().eq('user_id', userId);
    const removed = activities.error ? activities : await db.from('strava_connections').delete().eq('user_id', userId);
    if (removed.error) return json({ error: 'delete_failed' }, 500);
    return json({ disconnected: true });
  }

  return json({ error: 'unknown_action' }, 400);
});
