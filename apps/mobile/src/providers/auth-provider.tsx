import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { syncAccountPreferences } from '@/lib/auth';
import { useLanguage, useUnits } from '@/lib/locale-preference';
import { supabase } from '@/lib/supabase';

export type Profile = {
  display_name: string | null;
  onboarding_completed_at: string | null;
  /** Pakiet (free / trial / paid) – z niego wynikają włączone moduły. */
  subscription_status: string | null;
  /** Język i jednostki, w których serwer pisze teksty – mają być takie jak w aplikacji. */
  locale: string | null;
  units: string | null;
};

type AuthState = {
  session: Session | null;
  /** Profil zalogowanego użytkownika (null bez sesji albo gdy nie udało się go pobrać). */
  profile: Profile | null;
  /** false, dopóki nie odczytamy sesji i (przy sesji) profilu – splash zostaje. */
  ready: boolean;
  /** Ponowne pobranie profilu, np. po ukończeniu ankiety. */
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  ready: false,
  refreshProfile: async () => {},
});

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, onboarding_completed_at, subscription_status, locale, units')
    .eq('id', userId)
    .maybeSingle();
  return data ?? null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => active && setSession(data.session))
      .finally(() => active && setSessionReady(true));

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchProfile(userId)
      .catch(() => null)
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setProfileFor(userId);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Język i jednostki wybrane na telefonie trafiają na konto – serwer pisze w nich teksty trenera.
  // Porównujemy z tym, co faktycznie jest w bazie (profil wczytywany przy starcie i po ankiecie), więc
  // rozjazd naprawia się sam – także po nieudanym zapisie albo zmianie na innym urządzeniu.
  const language = useLanguage();
  const units = useUnits();
  const loadedProfile = userId && profileFor === userId ? profile : null;
  const outOfSync = !!loadedProfile && (loadedProfile.locale !== language || loadedProfile.units !== units);
  useEffect(() => {
    if (!userId || !outOfSync) return;
    let active = true;
    syncAccountPreferences(userId, language, units).then((ok) => {
      if (ok && active) setProfile((p) => (p ? { ...p, locale: language, units } : p));
    });
    return () => {
      active = false;
    };
  }, [userId, outOfSync, language, units]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfile(await fetchProfile(userId));
    setProfileFor(userId);
  }, [userId]);

  const state: AuthState = {
    session,
    profile: userId && profileFor === userId ? profile : null,
    ready: sessionReady && (!userId || profileFor === userId),
    refreshProfile,
  };

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth() {
  return use(AuthContext);
}

/**
 * Czy zalogowany użytkownik ukończył ankietę startową.
 * Brak profilu (np. błąd sieci – każde konto ma profil z triggera) traktujemy jak „ukończona”,
 * żeby nie wpychać w ankietę kogoś, kto ją już przeszedł.
 */
export function useOnboarded() {
  const { profile } = useAuth();
  return profile === null ? true : !!profile.onboarding_completed_at;
}
