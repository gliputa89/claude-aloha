import { createContext, use, useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { usePlan } from '@/features/plan/plan-provider';
import {
  fetchSessionWeather,
  getLocationAccess,
  requestLocationAccess,
  type LocationAccess,
  type SessionForecast,
} from '@/features/weather/api';
import { useLocale } from '@/hooks/use-t';

/** Po powrocie do aplikacji odświeżamy pogodę, jeśli ostatnia jest starsza niż tyle. */
const STALE_MS = 30 * 60 * 1000;

type WeatherContextValue = {
  /** `null` – jeszcze nie wiemy (pierwsze sprawdzenie zgody). */
  access: LocationAccess | null;
  /** Pogoda wg id treningu; pusta, gdy brak zgody, sieci albo prognozy. */
  bySession: ReadonlyMap<string, SessionForecast>;
  /** Pyta o lokalizację i od razu wczytuje pogodę. */
  enable: () => Promise<void>;
  /** Ponowne wczytanie (np. pociągnięcie w dół). Bez zgody nic nie robi. */
  refresh: () => Promise<void>;
};

const EMPTY: ReadonlyMap<string, SessionForecast> = new Map();

const WeatherContext = createContext<WeatherContextValue>({
  access: null,
  bySession: EMPTY,
  enable: async () => {},
  refresh: async () => {},
});

/**
 * Pogoda do najbliższych treningów – wspólna dla zakładki „Dzisiaj” i szczegółów treningu.
 * To dodatek: każdy błąd (brak zgody, sieci, prognozy) kończy się po prostu brakiem karty pogody.
 */
export function WeatherProvider({ children }: PropsWithChildren) {
  const locale = useLocale();
  const { state } = usePlan();
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [bySession, setBySession] = useState<ReadonlyMap<string, SessionForecast>>(EMPTY);
  const loadedAt = useRef(0);
  const loading = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    loading.current ??= fetchSessionWeather(locale)
      .then((list) => {
        loadedAt.current = Date.now();
        setBySession(new Map(list.map((f) => [f.sessionId, f])));
      })
      .catch(() => {})
      .finally(() => {
        loading.current = null;
      });
    return loading.current;
  }, [locale]);

  // Plan gotowy (albo zmieniony) → sprawdzamy zgodę i wczytujemy pogodę. Samo sprawdzenie o nic nie pyta.
  const planKey = state.kind === 'ready' ? `${state.plan.id}:${state.plan.weeks.length}` : null;
  useEffect(() => {
    if (!planKey) return;
    let active = true;
    getLocationAccess()
      .then((a) => {
        if (!active) return;
        setAccess(a);
        if (a === 'granted') load();
      })
      .catch(() => active && setAccess('denied'));
    return () => {
      active = false;
    };
  }, [planKey, load]);

  // Powrót do aplikacji: zgoda mogła się zmienić w Ustawieniach, a prognoza zestarzeć.
  useEffect(() => {
    if (!planKey) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      getLocationAccess()
        .then((a) => {
          setAccess(a);
          if (a !== 'granted') setBySession(EMPTY);
          else if (Date.now() - loadedAt.current > STALE_MS) load();
        })
        .catch(() => {});
    });
    return () => sub.remove();
  }, [planKey, load]);

  const enable = useCallback(async () => {
    try {
      const a = await requestLocationAccess();
      setAccess(a);
      if (a === 'granted') await load();
    } catch {
      setAccess('denied');
    }
  }, [load]);

  const refresh = useCallback(async () => {
    if (access === 'granted') await load();
  }, [access, load]);

  return <WeatherContext value={{ access, bySession, enable, refresh }}>{children}</WeatherContext>;
}

export function useWeather() {
  return use(WeatherContext);
}

/**
 * Pogoda do treningu albo `null`. Dzisiejszego okna, które już minęło, nie pokazujemy
 * (serwer odświeża dzisiejszą prognozę co godzinę – tu tylko nie wprowadzamy w błąd do tego czasu).
 */
export function useSessionForecast(sessionId: string, now = new Date()): SessionForecast | null {
  const forecast = useWeather().bySession.get(sessionId) ?? null;
  if (!forecast) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (forecast.date < today) return null;
  if (forecast.date === today && Number(forecast.window.to.slice(0, 2)) <= now.getHours()) return null;
  return forecast;
}
