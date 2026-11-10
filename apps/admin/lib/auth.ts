import 'server-only';

import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { createSessionClient } from '@/lib/supabase/server';

export type Admin = { id: string; email: string | null };

/** Zalogowany admin (konto w ops.admins) albo przekierowanie na /login. Wołać na początku każdej strony i akcji panelu. */
export async function requireAdmin(): Promise<Admin> {
  // Zawsze w czasie żądania – sprawdzenie sesji używa bieżącego czasu (wygaśnięcie tokenu).
  await connection();
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect('/login');

  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || !isAdmin) redirect('/login?error=forbidden');

  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
}
