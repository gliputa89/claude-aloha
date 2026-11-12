import './supabase-storage';

import { useSyncExternalStore } from 'react';

const KEY = 'aloha.weather.hidden';

function read() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let hidden = read();
const listeners = new Set<() => void>();

/** Czy biegacz ukrył pogodę (Profil → Pogoda). Wybór zostaje na telefonie, jak motyw. */
export const isWeatherHidden = () => hidden;

export function setWeatherHidden(next: boolean) {
  hidden = next;
  try {
    if (typeof localStorage !== 'undefined') {
      if (next) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    }
  } catch {
    // Brak zapisu nie blokuje zmiany – wybór obowiązuje do zamknięcia aplikacji.
  }
  for (const listener of listeners) listener();
}

/** `true`, gdy pogoda ma być pokazywana; ekrany reagują od razu na zmianę w Profilu. */
export function useWeatherVisible() {
  return !useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isWeatherHidden,
  );
}
