// Rozpoznanie wywołania z kluczem administracyjnym projektu (cron, panel admina).
//
// Klucz w środowisku funkcji (SUPABASE_SERVICE_ROLE_KEY) to stary klucz JWT. Panel może mieć nowy klucz
// tajny (sb_secret_…), więc samo porównanie tekstu nie wystarcza: nieznany klucz sprawdzamy w Supabase Auth –
// lista użytkowników odpowiada tylko na klucz administracyjny tego projektu.

function looksLikeServiceKey(token: string) {
  if (token.startsWith('sb_secret_')) return true;
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

export async function isServiceKey(token: string): Promise<boolean> {
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true;
  // Token zwykłego użytkownika odpada tutaj, bez zapytania na zewnątrz.
  if (!looksLikeServiceKey(token)) return false;
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}
