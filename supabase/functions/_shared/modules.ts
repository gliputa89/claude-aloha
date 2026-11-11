// Bramki modułów w Edge Functions: które moduły ma włączone użytkownik (pakiet = profiles.subscription_status).
// Lista modułów i pakietów: packages/plan-engine/src/core/modules.ts. W MVP każdy pakiet ma wszystko,
// więc bramki niczego nie blokują – ale stoją w każdej funkcji, żeby zmiana oferty była zmianą jednej listy.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { modulesFor, type ModuleId } from './plan-engine/index.ts';

/** Moduły użytkownika. Błąd odczytu profilu = pakiet darmowy (bezpieczny, nigdy nie daje więcej, niż trzeba). */
export async function userModules(db: SupabaseClient, userId: string): Promise<Set<ModuleId>> {
  const { data, error } = await db.from('profiles').select('subscription_status').eq('id', userId).maybeSingle();
  if (error) console.error('modules: profile load failed', error.code, error.message);
  return new Set(modulesFor(data?.subscription_status ?? 'free'));
}
