import { hasModule, type ModuleId } from '@aloha/plan-engine';

import { useAuth } from '@/providers/auth-provider';

/**
 * Czy pakiet użytkownika ma włączony moduł (pogoda, Strava, ocena treningu, notki trenera…).
 * Lista modułów i pakietów: packages/plan-engine/src/core/modules.ts. Serwer sprawdza to samo niezależnie –
 * tu chodzi tylko o to, żeby nie pokazywać elementów, które i tak nic by nie dostały.
 */
export function useModule(id: ModuleId) {
  const { profile } = useAuth();
  return hasModule(profile?.subscription_status, id);
}
