import './supabase-storage';

import { Appearance } from 'react-native';

/** `system` – jak w telefonie; `light` / `dark` – wymuszone w aplikacji. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

const KEY = 'aloha.theme';

/** Bez wyboru w Profilu aplikacja startuje jasna – niezależnie od trybu telefonu. */
const DEFAULT_PREFERENCE: ThemePreference = 'light';

export function getThemePreference(): ThemePreference {
  try {
    const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/**
 * Nadpisuje tryb kolorów na poziomie systemu (Appearance), więc zmieniają się naraz:
 * `useColorScheme` / `useColors`, klawiatura, alerty i natywne kontrolki.
 */
function apply(preference: ThemePreference) {
  // Na webie react-native-web nie ma setColorScheme – zostaje tryb przeglądarki.
  Appearance.setColorScheme?.(preference === 'system' ? 'auto' : preference);
}

export function setThemePreference(preference: ThemePreference) {
  try {
    // Zapisujemy też „system” – brak wpisu oznacza domyślny jasny motyw.
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, preference);
  } catch {
    // Brak zapisu nie blokuje zmiany – wybór obowiązuje do zamknięcia aplikacji.
  }
  apply(preference);
}

// Zapisany wybór obowiązuje od pierwszej klatki – moduł importuje root `_layout.tsx`.
apply(getThemePreference());
