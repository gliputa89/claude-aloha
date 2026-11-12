// Edge Function: „Usuń konto” w Profilu – użytkownik usuwa własne konto i wszystkie powiązane dane.
//
//   POST { appleAuthorizationCode?: string } → { deleted: true, apple, strava }
//
// Konto bierzemy wyłącznie z tokenu (tylko własne). Przed usunięciem, bez blokowania usunięcia, gdy się nie uda:
//   • Strava – cofamy dostęp aplikacji po stronie Stravy (jak przy rozłączeniu w Profilu),
//   • Apple  – konto z logowaniem Apple: unieważniamy token Apple (wymóg App Store) kodem z ponownej
//              autoryzacji w aplikacji (_shared/apple.ts; wymaga sekretów APPLE_*).
// Potem RPC delete_own_account (ta sama logika co usunięcie z panelu admina, jedna transakcja) – zostaje tylko
// zapis o usunięciu (e-mail i data) w ops.account_deletions.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { revokeAppleAccess, type AppleRevokeResult } from '../_shared/apple.ts';
import { accessToken, STRAVA, stravaClient } from '../_shared/strava.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

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
  const user = auth.user;
  const body = await req.json().catch(() => null);

  // Konto admina usuwa się z panelu – sprawdzamy, zanim cokolwiek cofniemy w Stravie czy Apple.
  // (schemat ops nie jest wystawiony w API – public.is_admin() sprawdza konto z tokenu użytkownika).
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = await asUser.rpc('is_admin');
  if (admin.error) return json({ error: 'load_failed' }, 500);
  if (admin.data === true) return json({ error: 'admin_account' }, 403);

  // ── Strava: cofnięcie dostępu (połączenie i biegi usunie kaskada) ──
  let strava: 'deauthorized' | 'none' | 'failed' = 'none';
  const conn = await db
    .from('strava_connections')
    .select('user_id, refresh_token, access_token, access_token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (conn.data) {
    strava = 'failed';
    try {
      const client = stravaClient();
      const access = client ? await accessToken(db, conn.data, client) : conn.data.access_token;
      if (access) {
        const res = await fetch(`${STRAVA}/oauth/deauthorize`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${access}` },
          signal: AbortSignal.timeout(8000),
        });
        await res.body?.cancel();
        if (res.ok) strava = 'deauthorized';
      }
    } catch (e) {
      console.warn('strava deauthorize on delete failed', e instanceof Error ? e.message : e);
    }
  }

  // ── Apple: unieważnienie tokenu ──
  let apple: AppleRevokeResult | 'none' = 'none';
  const appleIdentity = user.identities?.find((i) => i.provider === 'apple');
  if (appleIdentity) {
    const code = typeof body?.appleAuthorizationCode === 'string' ? body.appleAuthorizationCode : null;
    const sub = (appleIdentity.identity_data?.sub as string | undefined) ?? appleIdentity.id ?? null;
    apple = await revokeAppleAccess(code, sub);
    if (apple !== 'revoked') console.warn('apple token not revoked on delete', user.id, apple);
  }

  // ── Konto i dane ──
  const { error } = await db.rpc('delete_own_account', { p_user_id: user.id });
  if (error) {
    console.error('delete_own_account failed', user.id, error.code, error.message);
    return json({ error: error.message === 'admin_account' ? 'admin_account' : 'delete_failed' }, 500);
  }
  return json({ deleted: true, apple, strava });
});
