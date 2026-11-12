// Sign in with Apple po stronie serwera: unieważnienie tokenu przy usunięciu konta (wymóg App Store, 5.1.1(v)).
//
// Aplikacja loguje przez natywny arkusz Apple i nie przechowuje tokenów Apple. Przy usuwaniu konta prosi
// o ponowną autoryzację Apple i przesyła świeży `authorizationCode` – tu wymieniamy go na refresh token
// i od razu go unieważniamy (POST /auth/revoke). Apple usuwa wtedy powiązanie aplikacji z Apple ID.
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

export type AppleRevokeResult = 'revoked' | 'not_configured' | 'no_code' | 'mismatch' | 'failed';

/**
 * Unieważnia dostęp aplikacji do Apple ID. `expectedSub` – identyfikator Apple z tożsamości konta
 * (żeby kod z innego Apple ID nie unieważnił cudzego powiązania). Nigdy nie rzuca – wynik do logu.
 */
export async function revokeAppleAccess(authorizationCode: string | null, expectedSub: string | null): Promise<AppleRevokeResult> {
  if (!authorizationCode) return 'no_code';
  const config = appleConfig();
  if (!config) return 'not_configured';
  try {
    const secret = await clientSecret(config);
    const res = await post('/auth/token', {
      client_id: config.clientId,
      client_secret: secret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
    if (!res.ok) {
      console.warn('apple token exchange failed', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return 'failed';
    }
    const tokens = (await res.json()) as { refresh_token?: string; access_token?: string; id_token?: string };
    if (expectedSub && jwtSubject(tokens.id_token) !== expectedSub) return 'mismatch';

    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) return 'failed';
    const revoke = await post('/auth/revoke', {
      client_id: config.clientId,
      client_secret: secret,
      token,
      token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
    });
    await revoke.body?.cancel();
    if (!revoke.ok) {
      console.warn('apple revoke failed', revoke.status);
      return 'failed';
    }
    return 'revoked';
  } catch (e) {
    console.warn('apple revoke error', e instanceof Error ? e.message : e);
    return 'failed';
  }
}
