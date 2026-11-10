import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { serviceRoleKey, supabaseAnonKey, supabaseUrl } from '@/lib/env';

/** Klient z sesją zalogowanego admina (cookies) – tylko do logowania i sprawdzenia uprawnień. */
export async function createSessionClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Wywołane z Server Component – sesję odświeża proxy.ts.
        }
      },
    },
  });
}

/**
 * Klient service_role – omija RLS. Używać WYŁĄCZNIE po `requireAdmin()`, tylko na serwerze.
 * Nigdy nie przekazywać wyników 1:1 do klienta bez wybrania pól.
 */
export function createServiceClient() {
  return createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
