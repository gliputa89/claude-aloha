// Sign in with Apple po stronie serwera: unieważnienie tokenu przy usunięciu konta (wymóg App Store, 5.1.1(v)).
//
// Aplikacja loguje przez natywny arkusz Apple. Po zalogowaniu przesyła `authorizationCode` do funkcji apple-token,
// która wymienia go na refresh token i zapisuje w public.apple_tokens (tylko serwer). Przy usunięciu konta
// (z aplikacji albo z panelu) funkcja delete-account unieważnia ten token (POST /auth/revoke) – Apple usuwa wtedy
// powiązanie aplikacji z Apple ID. Konto bez zapisanego tokenu (np. sprzed tej zmiany) aplikacja potwierdza
// ponownie w arkuszu Apple i przesyła świeży kod.
//
// Sekrety funkcji (Apple Developer → Keys, klucz z włączonym „Sign in with Apple”):
//   APPLE_TEAM_ID      – Team ID,
//   APPLE_KEY_ID       – Key ID klucza,
//   APPLE_PRIVATE_KEY  – treść pliku .p8 (PEM, z nagłówkami; znaki nowej linii mogą być jako \n),
//   APPLE_CLIENT_ID    – opcjonalnie, domyślnie bundle ID aplikacji (app.alohatraining).

const APPLE = 'https://appleid.apple.com';
const DEFAULT_CLIENT_ID = 'app.alohatraining';

type AppleConfig = { teamId: string; keyId: string; privateKey: string; clientId: string };

function appleConfig(): AppleConfig | null {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey, clientId: Deno.env.get('APPLE_CLIENT_ID') || DEFAULT_CLIENT_ID };
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const textB64url = (text: string) => b64url(new TextEncoder().encode(text));

/** `client_secret` dla Apple: JWT ES256 podpisany kluczem .p8, ważny 5 minut. */
async function clientSecret(config: AppleConfig) {
  const pem = config.privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = textB64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const payload = textB64url(
    JSON.stringify({ iss: config.teamId, iat: now, exp: now + 300, aud: APPLE, sub: config.clientId }),
  );
  const input = new TextEncoder().encode(`${header}.${payload}`);
  // WebCrypto zwraca podpis ECDSA jako r||s (64 bajty) – dokładnie taki format jak w JWS ES256.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, input));
  return `${header}.${payload}.${b64url(signature)}`;
}

function jwtSubject(token: string | undefined): string | null {
  try {
    const payload = token?.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).sub ?? null;
  } catch {
    return null;
  }
}

async function post(path: string, form: Record<string, string>) {
  return await fetch(`${APPLE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
}

/** Identyfikator Apple (sub) z tożsamości konta Supabase – do porównania z tokenem od Apple. */
export function appleSubject(user: { identities?: { provider: string; id?: string; identity_data?: Record<string, unknown> }[] }) {
  const identity = user.identities?.find((i) => i.provider === 'apple');
  if (!identity) return null;
  return (identity.identity_data?.sub as string | undefined) ?? identity.id ?? null;
}

export type AppleExchange =
  | { ok: true; refreshToken: string | null; accessToken: string | null }
  | { ok: false; reason: 'not_configured' | 'mismatch' | 'failed' };

/**
 * Wymienia `authorizationCode` z natywnego arkusza Apple na tokeny. `expectedSub` pilnuje, żeby kod
 * z innego Apple ID nie trafił do tego konta. Nigdy nie rzuca.
 */
export async function exchangeAppleCode(authorizationCode: string, expectedSub: string | null): Promise<AppleExchange> {
  const config = appleConfig();
  if (!config) return { ok: false, reason: 'not_configured' };
  try {
    const res = await post('/auth/token', {
      client_id: config.clientId,
      client_secret: await clientSecret(config),
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
    if (!res.ok) {
      console.warn('apple token exchange failed', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return { ok: false, reason: 'failed' };
    }
    const tokens = (await res.json()) as { refresh_token?: string; access_token?: string; id_token?: string };
    if (!expectedSub || jwtSubject(tokens.id_token) !== expectedSub) return { ok: false, reason: 'mismatch' };
    return { ok: true, refreshToken: tokens.refresh_token ?? null, accessToken: tokens.access_token ?? null };
  } catch (e) {
    console.warn('apple token exchange error', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'failed' };
  }
}

async function revokeToken(config: AppleConfig, token: string, hint: 'refresh_token' | 'access_token') {
  try {
    const res = await post('/auth/revoke', {
      client_id: config.clientId,
      client_secret: await clientSecret(config),
      token,
      token_type_hint: hint,
    });
    await res.body?.cancel();
    if (!res.ok) console.warn('apple revoke failed', res.status);
    return res.ok;
  } catch (e) {
    console.warn('apple revoke error', e instanceof Error ? e.message : e);
    return false;
  }
}

export type AppleRevokeResult = 'revoked' | 'not_configured' | 'no_token' | 'mismatch' | 'failed';

/**
 * Unieważnia dostęp aplikacji do Apple ID: zapisanym refresh tokenem (z logowania) albo – gdy go nie ma
 * lub nie zadziałał – świeżym kodem z ponownej autoryzacji w aplikacji. Nigdy nie rzuca – wynik do logu.
 */
export async function revokeAppleAccess(opts: {
  storedRefreshToken: string | null;
  authorizationCode: string | null;
  expectedSub: string | null;
}): Promise<AppleRevokeResult> {
  const config = appleConfig();
  if (!config) return 'not_configured';
  if (opts.storedRefreshToken && (await revokeToken(config, opts.storedRefreshToken, 'refresh_token'))) return 'revoked';
  if (!opts.authorizationCode) return opts.storedRefreshToken ? 'failed' : 'no_token';

  const exchanged = await exchangeAppleCode(opts.authorizationCode, opts.expectedSub);
  if (!exchanged.ok) return exchanged.reason;
  const token = exchanged.refreshToken ?? exchanged.accessToken;
  if (!token) return 'failed';
  return (await revokeToken(config, token, exchanged.refreshToken ? 'refresh_token' : 'access_token')) ? 'revoked' : 'failed';
}
