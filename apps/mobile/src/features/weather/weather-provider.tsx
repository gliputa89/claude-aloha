import { createContext, use, useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { allSessions, usePlan } from '@/features/plan/plan-provider';
import {
  devicePlace,
  fetchSessionWeather,
  findPlace,
  getLocationAccess,
  getSavedPlace,
  getSessionPlaces,
  pruneSessionPlaces,
  requestLocationAccess,
  savePlace,
  saveSessionPlace,
  type LocationAccess,
  type SessionForecast,
  type SessionPlaces,
  type WeatherPlace,
} from '@/features/weather/api';
import { useLocale } from '@/hooks/use-t';

/** Po powrocie do aplikacji odświeżamy pogodę, jeśli ostatnia jest starsza niż tyle. */
const STALE_MS = 30 * 60 * 1000;

type WeatherContextValue = {
  /** Zgoda na lokalizację telefonu; `null` – jeszcze nie wiemy (pierwsze sprawdzenie). */
  access: LocationAccess | null;
  /** Miejsce domyślne (okolica z telefonu albo wpisane); `null` – nie znamy go. */
  place: WeatherPlace | null;
  /** Miejsca wybrane dla pojedynczych treningów (id treningu → miejsce). */
  sessionPlaces: SessionPlaces;
  /** Pogoda wg id treningu; pusta, gdy brak miejsca, sieci albo prognozy. */
  bySession: ReadonlyMap<string, SessionForecast>;
  /** Pyta o lokalizację telefonu i od razu wczytuje pogodę. */
  enable: () => Promise<void>;
  /** Ponowne wczytanie (np. pociągnięcie w dół). */
  refresh: () => Promise<void>;
  /**
   * Ustawia miejsce wpisane ręcznie: dla jednego treningu (`sessionId`) albo domyślne.
   * `false` – nie znaleziono takiej miejscowości.
   */
  setCustomPlace: (query: string, sessionId?: string) => Promise<boolean>;
  /**
   * Wraca do lokalizacji telefonu: dla jednego treningu (usuwa jego własne miejsce) albo jako domyślnej.
   * Pyta o zgodę, jeśli trzeba. `false` – brak zgody.
   */
  switchToDeviceLocation: (sessionId?: string) => Promise<boolean>;
};

const EMPTY: ReadonlyMap<string, SessionForecast> = new Map();

const WeatherContext = createContext<WeatherContextValue>({
  access: null,
  place: null,
  sessionPlaces: {},
  bySession: EMPTY,
  enable: async () => {},
  refresh: async () => {},
  setCustomPlace: async () => false,
  switchToDeviceLocation: async () => false,
});

/**
 * Pogoda do najbliższych treningów – wspólna dla zakładki „Dzisiaj” i szczegółów treningu.
 * Miejsce domyślne: wpisane ręcznie albo okolica z lokalizacji telefonu; każdy trening może mieć własne
 * (np. wyjazd, zawody). Wybory są zapamiętane na telefonie.
 * To dodatek: każdy błąd (brak zgody, sieci, prognozy) kończy się po prostu brakiem karty pogody.
 */
export function WeatherProvider({ children }: PropsWithChildren) {
  const locale = useLocale();
  const { state } = usePlan();
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [place, setPlace] = useState<WeatherPlace | null>(getSavedPlace);
  const [sessionPlaces, setSessionPlaces] = useState<SessionPlaces>(getSessionPlaces);
  const [bySession, setBySession] = useState<ReadonlyMap<string, SessionForecast>>(EMPTY);
  const loadedAt = useRef(0);
  const lastAccess = useRef<LocationAccess | null>(null);
  /** Numer ostatniego wczytania – wynik starszego (np. sprzed zmiany miejsca) jest pomijany. */
  const run = useRef(0);

  /** Wczytuje pogodę: miejsce domyślne (zapisane albo okolica z telefonu) + miejsca pojedynczych treningów. */
  const load = useCallback(async () => {
    const id = ++run.current;
    try {
      const places = getSessionPlaces();
      // Bez zgody na lokalizację i bez wpisanego miejsca domyślnego zostają tylko treningi z własnym miejscem.
      const where = getSavedPlace() ?? (await devicePlace().catch(() => null));
      if (id !== run.current) return;
      setPlace(where);
      setSessionPlaces(places);
      if (!where && Object.keys(places).length === 0) {
        setBySession(EMPTY);
        return;
      }
      const list = await fetchSessionWeather(locale, where, places);
      if (id !== run.current) return;
      loadedAt.current = Date.now();
      setBySession(new Map(list.map((f) => [f.sessionId, f])));
    } catch {
      // Pogoda to dodatek – zostaje to, co było.
    }
  }, [locale]);

  // Plan gotowy (albo zmieniony) → sprzątamy miejsca treningów spoza planu, sprawdzamy zgodę i wczytujemy pogodę.
  // Samo sprawdzenie zgody o nic nie pyta.
  const plan = state.kind === 'ready' ? state.plan : null;
  const planKey = plan ? `${plan.id}:${plan.weeks.length}` : null;
  useEffect(() => {
    if (!plan) return;
    let active = true;
    const places = pruneSessionPlaces(new Set(allSessions(plan).map((s) => s.id)));
    getLocationAccess()
      .catch((): LocationAccess => 'denied')
      .then((a) => {
        if (!active) return;
        lastAccess.current = a;
        setAccess(a);
        if (a === 'granted' || getSavedPlace() || Object.keys(places).length > 0) load();
      });
    return () => {
      active = false;
    };
    // `plan` zmienia tożsamość przy każdym odświeżeniu – reagujemy tylko na inny plan / nowy tydzień.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, load]);

  // Powrót do aplikacji: zgoda mogła się zmienić w Ustawieniach, a prognoza zestarzeć.
  useEffect(() => {
    if (!planKey) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      getLocationAccess()
        .catch((): LocationAccess => 'denied')
        .then((a) => {
          // Zgoda cofnięta albo nadana w Ustawieniach → miejsce domyślne się zmienia, wczytujemy od nowa.
          const changed = lastAccess.current !== a;
          lastAccess.current = a;
          setAccess(a);
          if (changed || Date.now() - loadedAt.current > STALE_MS) load();
        });
    });
    return () => sub.remove();
  }, [planKey, load]);

  const enable = useCallback(async () => {
    try {
      const a = await requestLocationAccess();
      lastAccess.current = a;
      setAccess(a);
      if (a === 'granted') await load();
    } catch {
      setAccess('denied');
    }
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  const setCustomPlace = useCallback(
    async (query: string, sessionId?: string) => {
      const found = await findPlace(query);
      if (!found) return false;
      if (sessionId) saveSessionPlace(sessionId, found);
      else savePlace(found);
      await load();
      return true;
    },
    [load],
  );

  const switchToDeviceLocation = useCallback(
    async (sessionId?: string) => {
      let a: LocationAccess;
      try {
        a = await requestLocationAccess();
      } catch {
        a = 'denied';
      }
      lastAccess.current = a;
      setAccess(a);
      if (a !== 'granted') return false;
      if (sessionId) saveSessionPlace(sessionId, null);
      else savePlace(null);
      await load();
      return true;
    },
    [load],
  );

  return (
    <WeatherContext value={{ access, place, sessionPlaces, bySession, enable, refresh, setCustomPlace, switchToDeviceLocation }}>
      {children}
    </WeatherContext>
  );
}

export function useWeather() {
  return use(WeatherContext);
}

/** Miejsce prognozy dla treningu: jego własne albo domyślne. */
export function useSessionPlace(sessionId: string | undefined): WeatherPlace | null {
  const { place, sessionPlaces } = useWeather();
  return (sessionId ? sessionPlaces[sessionId] : undefined) ?? place;
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
