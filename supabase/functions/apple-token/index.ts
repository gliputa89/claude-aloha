// Edge Function: zapis refresh tokenu Sign in with Apple po zalogowaniu przez Apple w aplikacji.
//
//   POST { authorizationCode } → { stored: true } | { stored: false, reason }
//
// Aplikacja przesyła kod z natywnego arkusza Apple (logowanie idzie osobno, identityToken → Supabase).
// Wymieniamy go na refresh token i zapisujemy w public.apple_tokens (tylko serwer), żeby przy usunięciu konta –
// z aplikacji albo z panelu admina – funkcja delete-account mogła unieważnić dostęp w Apple (wymóg App Store).
// Kod musi należeć do tego samego Apple ID co konto (porównanie `sub`). Błąd nie wpływa na logowanie.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { appleSubject, exchangeAppleCode } from '../_shared/apple.ts';

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
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  const code = typeof body?.authorizationCode === 'string' ? body.authorizationCode : '';
  if (!code) return json({ error: 'invalid_code' }, 400);

  const sub = appleSubject(data.user);
  if (!sub) return json({ stored: false, reason: 'no_apple_identity' });
  const exchanged = await exchangeAppleCode(code, sub);
  if (!exchanged.ok) return json({ stored: false, reason: exchanged.reason });
  if (!exchanged.refreshToken) return json({ stored: false, reason: 'no_refresh_token' });

  const saved = await db
    .from('apple_tokens')
    .upsert({ user_id: data.user.id, refresh_token: exchanged.refreshToken, updated_at: new Date().toISOString() });
  if (saved.error) {
    console.error('apple token save failed', saved.error.code, saved.error.message);
    return json({ stored: false, reason: 'save_failed' }, 500);
  }
  return json({ stored: true });
});
