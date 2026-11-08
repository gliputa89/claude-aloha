import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** false, dopóki nie odczytamy zapisanej sesji (splash zostaje). */
  ready: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, ready: false });

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false });

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => active && setState({ session: data.session, ready: true }))
      .catch(() => active && setState({ session: null, ready: true }));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, ready: true });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth() {
  return use(AuthContext);
}
