import './supabase-storage';

import { resolveLocale, type Locale } from '@aloha/i18n';
import type { Units } from '@aloha/plan-engine';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';

/** `metric` – km, °C, km/h; `imperial` – mile, °F, mph (jak w USA). */
export type { Units };

export const LOCALES: Locale[] = ['pl', 'en'];
export const UNITS: Units[] = ['metric', 'imperial'];

/** Kraje, w których na co dzień liczy się w milach i stopniach Fahrenheita. */
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

function detectLocale(): Locale {
  return resolveLocale(getLocales()[0]?.languageCode);
}

function detectUnits(): Units {
  const system = getLocales()[0];
  if (!system) return 'metric';
  if (system.measurementSystem === 'us') return 'imperial';
  if (system.measurementSystem === 'metric' || system.measurementSystem === 'uk') return 'metric';
  if (system.temperatureUnit === 'fahrenheit') return 'imperial';
  return system.regionCode && IMPERIAL_REGIONS.has(system.regionCode.toUpperCase()) ? 'imperial' : 'metric';
}

/**
 * Wybór zapisany na telefonie, jak motyw. Przy pierwszym uruchomieniu bierzemy go z ustawień
 * telefonu i od razu zapisujemy – potem zmienia się tylko w Profilu.
 */
function createPreference<T extends string>(key: string, allowed: readonly T[], detect: () => T) {
  let value: T = (() => {
    try {
      const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
      if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
    } catch {
      // Brak odczytu – jak przy pierwszym uruchomieniu.
    }
    const detected = detect();
    persist(detected);
    return detected;
  })();
  const listeners = new Set<() => void>();

  function persist(next: T) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, next);
    } catch {
      // Brak zapisu nie blokuje zmiany – wybór obowiązuje do zamknięcia aplikacji.
    }
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const get = () => value;

  return {
    get,
    set(next: T) {
      if (next === value) return;
      value = next;
      persist(next);
      for (const listener of listeners) listener();
    },
    use: () => useSyncExternalStore(subscribe, get, get),
  };
}

const language = createPreference<Locale>('aloha.locale', LOCALES, detectLocale);
const units = createPreference<Units>('aloha.units', UNITS, detectUnits);

export const getLanguage = language.get;
export const setLanguage = language.set;
/** Język aplikacji – ekrany odświeżają się od razu po zmianie w Profilu. */
export const useLanguage = language.use;

export const getUnits = units.get;
export const setUnits = units.set;
/** Jednostki (km / mile) – ekrany odświeżają się od razu po zmianie w Profilu. */
export const useUnits = units.use;
