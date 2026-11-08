import './supabase-storage';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** false, gdy w .env.local brakuje adresu lub klucza – ekrany pokazują wtedy czytelny błąd zamiast wywracać aplikację. */
export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

export const supabase = createClient(
  isSupabaseConfigured ? url : 'http://127.0.0.1:54321',
  isSupabaseConfigured ? anonKey : 'not-configured',
  {
    auth: {
      storage: typeof localStorage === 'undefined' ? undefined : localStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Linki z e-maili (potwierdzenie, reset hasła) obsługuje trasa auth/callback, nie adres strony.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

// Odświeżanie tokenu tylko, gdy aplikacja jest na pierwszym planie (zalecenie Supabase dla RN).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
