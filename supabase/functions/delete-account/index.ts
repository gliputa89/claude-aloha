// Edge Function: usunięcie konta i wszystkich powiązanych danych – jedna droga dla aplikacji i panelu admina.
//
//   aplikacja (token użytkownika): POST { appleAuthorizationCode?: string }
//   panel admina (klucz service_role): POST { userId, adminId }
//   → { deleted: true, counts, apple, strava }
//
// Aplikacja usuwa wyłącznie własne konto (użytkownik z tokenu). Obie drogi robią to samo, w tej kolejności:
//   1. odmowa dla konta z rolą admina (najpierw odebrać rolę w ops.admins),
//   2. Strava – cofnięcie dostępu aplikacji po stronie Stravy (jak przy rozłączeniu w Profilu),
//   3. Apple  – unieważnienie tokenu Apple (wymóg App Store): zapisanym refresh tokenem z logowania, a w aplikacji
//               w razie potrzeby świeżym kodem z ponownej autoryzacji (_shared/apple.ts; wymaga sekretów APPLE_*),
//   4. RPC delete_own_account / admin_delete_user – wspólna logika usuwania w jednej transakcji; zostaje tylko
//      zapis o usunięciu (e-mail i data) w ops.account_deletions, a przy panelu też wpis w admin_audit_log.
// Kroki 2–3 nie blokują usunięcia, gdy się nie udadzą – ich wynik wraca w odpowiedzi i trafia do logów.

import { createClient, type User } from 'jsr:@supabase/supabase-js@2';

import { appleSubject, revokeAppleAccess, type AppleRevokeResult } from '../_shared/apple.ts';
import { isServiceKey } from '../_shared/auth.ts';
import { accessToken, STRAVA, stravaClient } from '../_shared/strava.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const body = await req.json().catch(() => null);

  // ── Kto usuwa i czyje konto ──
  let user: User;
  let adminId: string | null = null;
  if (await isServiceKey(token)) {
    if (typeof body?.userId !== 'string' || !UUID.test(body.userId)) return json({ error: 'invalid_user' }, 400);
    if (typeof body?.adminId !== 'string' || !UUID.test(body.adminId)) return json({ error: 'invalid_admin' }, 400);
    if (body.userId === body.adminId) return json({ error: 'self' }, 403);
    const found = await db.auth.admin.getUserById(body.userId);
    if (found.error || !found.data.user) return json({ error: 'not_found' }, 404);
    user = found.data.user;
    adminId = body.adminId;
  } else {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return json({ error: 'unauthorized' }, 401);
    user = data.user;
  }

  // ── 1. Konto admina usuwa się dopiero po odebraniu roli ──
  const admin = await db.rpc('is_admin_user', { p_user_id: user.id });
  if (admin.error) {
    console.error('is_admin_user failed', admin.error.code, admin.error.message);
    return json({ error: 'load_failed' }, 500);
  }
  if (admin.data === true) return json({ error: 'admin_account' }, 403);

  // ── 2. Strava: cofnięcie dostępu (połączenie i biegi usunie kaskada) ──
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

  // ── 3. Apple: unieważnienie tokenu ──
  let apple: AppleRevokeResult | 'none' = 'none';
  const sub = appleSubject(user);
  if (sub) {
    const stored = await db.from('apple_tokens').select('refresh_token').eq('user_id', user.id).maybeSingle();
    if (stored.error) console.warn('apple token load failed', stored.error.code, stored.error.message);
    apple = await revokeAppleAccess({
      storedRefreshToken: stored.data?.refresh_token ?? null,
      // Świeży kod przysyła tylko aplikacja (ponowna autoryzacja w arkuszu Apple).
      authorizationCode: !adminId && typeof body?.appleAuthorizationCode === 'string' ? body.appleAuthorizationCode : null,
      expectedSub: sub,
    });
    if (apple !== 'revoked') console.warn('apple token not revoked on delete', user.id, apple);
  }

  // ── 4. Konto i dane ──
  const { data: counts, error } = adminId
    ? await db.rpc('admin_delete_user', { p_admin_id: adminId, p_user_id: user.id })
    : await db.rpc('delete_own_account', { p_user_id: user.id });
  if (error) {
    console.error('delete account failed', user.id, error.code, error.message);
    return json({ error: 'delete_failed', message: error.message }, 500);
  }
  return json({ deleted: true, counts, apple, strava });
});
