import './supabase-storage';

import { Appearance } from 'react-native';

/** `system` – jak w telefonie; `light` / `dark` – wymuszone w aplikacji. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

const KEY = 'aloha.theme';

export function getThemePreference(): ThemePreference {
  try {
    const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
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
    if (typeof localStorage !== 'undefined') {
      if (preference === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, preference);
    }
  } catch {
    // Brak zapisu nie blokuje zmiany – wybór obowiązuje do zamknięcia aplikacji.
  }
  apply(preference);
}

// Zapisany wybór obowiązuje od pierwszej klatki – moduł importuje root `_layout.tsx`.
apply(getThemePreference());
