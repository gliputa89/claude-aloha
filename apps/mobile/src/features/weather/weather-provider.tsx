import type { Locale } from '@aloha/i18n';
import type { Units } from '@aloha/plan-engine';
import { createContext, use, useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import type { ActivePlan } from '@/features/plan/api';
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
import { readCache, writeCache } from '@/lib/data-cache';
import { useUnits } from '@/lib/locale-preference';
import { isWeatherHidden, useWeatherVisible } from '@/lib/weather-preference';
import { useAuth } from '@/providers/auth-provider';

/** Pogodę starszą niż tyle odświeżamy (po powrocie do aplikacji i co jakiś czas, gdy jest otwarta). */
const STALE_MS = 30 * 60 * 1000;
/** Co ile sprawdzamy, czy otwarta aplikacja nie ma już nieświeżej pogody. */
const CHECK_EVERY_MS = 5 * 60 * 1000;

/** Ostatnia prognoza zapamiętana na telefonie – „Dzisiaj” pokazuje ją od razu, bez czekania na sieć. */
type WeatherCache = {
  at: number;
  locale: Locale;
  units: Units;
  /** Plan, do którego treningów jest prognoza (inny plan / nowy tydzień = inne treningi). */
  planKey: string;
  /** Miejsce domyślne, dla którego jest prognoza (karta pokazuje jego nazwę). */
  place: WeatherPlace | null;
  list: SessionForecast[];
};

/** Klucz planu dla pogody: inny plan albo dopisany tydzień wymaga nowej prognozy. */
export const weatherPlanKey = (plan: ActivePlan) => `${plan.id}:${plan.weeks.length}`;

function cachedWeather(userId: string | null, locale: Locale, units: Units): WeatherCache | null {
  const cached = readCache<WeatherCache>('weather', userId);
  // Inny język albo jednostki – tekst porady trenera by się nie zgadzał.
  return cached && cached.locale === locale && cached.units === units ? cached : null;
}

/**
 * Pobiera pogodę do treningów planu z wyprzedzeniem (np. zaraz po ułożeniu planu, zanim biegacz otworzy
 * „Dzisiaj”) i zapisuje ją na telefonie. O zgodę nie pyta – bez niej i bez wpisanego miejsca nic nie robi.
 */
export async function prefetchWeather(userId: string, locale: Locale, units: Units, plan: ActivePlan) {
  if (isWeatherHidden()) return;
  try {
    const places = getSessionPlaces();
    const saved = getSavedPlace();
    const access = await getLocationAccess().catch((): LocationAccess => 'denied');
    if (!saved && access !== 'granted' && Object.keys(places).length === 0) return;
    const where = saved ?? (access === 'granted' ? await devicePlace().catch(() => null) : null);
    if (!where && Object.keys(places).length === 0) return;
    const list = await fetchSessionWeather(locale, units, where, places);
    writeCache<WeatherCache>('weather', userId, { at: Date.now(), locale, units, planKey: weatherPlanKey(plan), place: where, list });
  } catch {
    // Pogoda to dodatek – „Dzisiaj” wczyta ją samo.
  }
}

type WeatherContextValue = {
  /** Zgoda na lokalizację telefonu; `null` – jeszcze nie wiemy (pierwsze sprawdzenie). */
  access: LocationAccess | null;
  /** Miejsce domyślne (okolica z telefonu albo wpisane); `null` – nie znamy go. */
  place: WeatherPlace | null;
  /** Miejsca wybrane dla pojedynczych treningów (id treningu → miejsce). */
  sessionPlaces: SessionPlaces;
  /** Pogoda wg id treningu; pusta, gdy brak miejsca, sieci albo prognozy. */
  bySession: ReadonlyMap<string, SessionForecast>;
  /** Pierwsze wczytanie po starcie już się skończyło (z pogodą albo bez) – do tego czasu karty mają stan ładowania. */
  settled: boolean;
  /** Pyta o lokalizację telefonu i od razu wczytuje pogodę. Zwraca odpowiedź – przy odmowie pytamy o miejscowość. */
  enable: () => Promise<LocationAccess>;
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
  settled: false,
  enable: async (): Promise<LocationAccess> => 'denied',
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
  // Porada od trenera pisze o °F i mph albo °C i km/h – po zmianie jednostek wczytujemy od nowa.
  const units = useUnits();
  const userId = useAuth().session?.user.id ?? null;
  const { state } = usePlan();
  // Prognoza zapamiętana na telefonie: karty pogody od razu, bez szkieletu ładowania.
  // Tylko prognoza do tego samego planu – inaczej karty nowych treningów udawałyby, że pogody nie ma.
  const [initial] = useState(() => {
    const cached = cachedWeather(userId, locale, units);
    return cached && state.kind === 'ready' && cached.planKey === weatherPlanKey(state.plan) ? cached : null;
  });
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [place, setPlace] = useState<WeatherPlace | null>(() => getSavedPlace() ?? initial?.place ?? null);
  const [sessionPlaces, setSessionPlaces] = useState<SessionPlaces>(getSessionPlaces);
  const [bySession, setBySession] = useState<ReadonlyMap<string, SessionForecast>>(() =>
    initial ? new Map(initial.list.map((f) => [f.sessionId, f])) : EMPTY,
  );
  const [settled, setSettled] = useState(!!initial);
  const loadedAt = useRef(initial?.at ?? 0);
  const lastAccess = useRef<LocationAccess | null>(null);
  /** Numer ostatniego wczytania – wynik starszego (np. sprzed zmiany miejsca) jest pomijany. */
  const run = useRef(0);

  const plan = state.kind === 'ready' ? state.plan : null;
  const planKey = plan ? weatherPlanKey(plan) : null;
  // Do zapisu prognozy na telefonie: do którego planu należy (wczytanie biegnie poza renderem).
  const planKeyRef = useRef(planKey);
  useEffect(() => {
    planKeyRef.current = planKey;
  }, [planKey]);

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
        writeCache('weather', userId, null);
        return;
      }
      const list = await fetchSessionWeather(locale, units, where, places);
      if (id !== run.current) return;
      loadedAt.current = Date.now();
      setBySession(new Map(list.map((f) => [f.sessionId, f])));
      if (planKeyRef.current) {
        writeCache<WeatherCache>('weather', userId, {
          at: loadedAt.current,
          locale,
          units,
          planKey: planKeyRef.current,
          place: where,
          list,
        });
      }
    } catch {
      // Pogoda to dodatek – zostaje to, co było.
    } finally {
      // Wynik starszego wczytania pomijamy – stan zamknie to nowsze.
      if (id === run.current) setSettled(true);
    }
  }, [locale, units, userId]);

  // Plan gotowy (albo zmieniony) → sprzątamy miejsca treningów spoza planu, sprawdzamy zgodę i wczytujemy pogodę.
  // Samo sprawdzenie zgody o nic nie pyta.
  // Pogoda ukryta w Profilu: niczego nie pobieramy (ani lokalizacji, ani prognozy) i czyścimy to, co było.
  const visible = useWeatherVisible();
  useEffect(() => {
    if (!plan) return;
    if (!visible) {
      // Unieważnia wczytanie w toku; to, co już jest w stanie, i tak nie trafia do ekranów (patrz wartość kontekstu).
      run.current++;
      return;
    }
    let active = true;
    const places = pruneSessionPlaces(new Set(allSessions(plan).map((s) => s.id)));
    getLocationAccess()
      .catch((): LocationAccess => 'denied')
      .then((a) => {
        if (!active) return;
        lastAccess.current = a;
        setAccess(a);
        if (!(a === 'granted' || getSavedPlace() || Object.keys(places).length > 0)) {
          setSettled(true);
          return;
        }
        // Świeża prognoza do tego samego planu już jest (z pamięci telefonu albo pobrana po ułożeniu planu).
        const cached = cachedWeather(userId, locale, units);
        const fresh = cached && cached.planKey === planKey && Date.now() - cached.at < STALE_MS;
        if (fresh) {
          setPlace(getSavedPlace() ?? cached.place);
          setBySession(new Map(cached.list.map((f) => [f.sessionId, f])));
          loadedAt.current = cached.at;
          setSettled(true);
        } else {
          load();
        }
      });
    return () => {
      active = false;
    };
    // `plan` zmienia tożsamość przy każdym odświeżeniu – reagujemy tylko na inny plan / nowy tydzień.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, load, visible]);

  // Powrót do aplikacji: zgoda mogła się zmienić w Ustawieniach, a prognoza zestarzeć.
  useEffect(() => {
    if (!planKey || !visible) return;
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
    // Aplikacja otwarta dłużej: co jakiś czas sprawdzamy, czy prognoza się nie zestarzała.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && Date.now() - loadedAt.current > STALE_MS) load();
    }, CHECK_EVERY_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [planKey, load, visible]);

  const enable = useCallback(async () => {
    try {
      const a = await requestLocationAccess();
      lastAccess.current = a;
      setAccess(a);
      if (a === 'granted') await load();
      return a;
    } catch {
      setAccess('denied');
      return 'denied' as const;
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
    <WeatherContext
      value={{
        access,
        place,
        sessionPlaces,
        // Ukryta pogoda = brak prognoz dla ekranów i nic do „wczytywania”.
        bySession: visible ? bySession : EMPTY,
        settled: visible ? settled : true,
        enable,
        refresh,
        setCustomPlace,
        switchToDeviceLocation,
      }}>
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
