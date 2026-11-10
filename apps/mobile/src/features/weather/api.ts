import '@/lib/supabase-storage';

import type { Locale } from '@aloha/i18n';
import type { SessionWeather } from '@aloha/plan-engine';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';

/** Pogoda do treningu: wynik reguł (okno, ostrzeżenia) i porada od AI (null – tekst składamy ze słownika). */
export type SessionForecast = SessionWeather & { sessionId: string; advice: string | null };

export type LocationAccess = 'undetermined' | 'granted' | 'denied';

/**
 * Miejsce, dla którego sprawdzamy pogodę. Współrzędne zawsze zaokrąglone do 0,1° (ok. 10 km).
 * `custom` – wpisane ręcznie (zapamiętane na tym telefonie), inaczej z lokalizacji telefonu.
 * Jest miejsce domyślne (dla wszystkich treningów) i – opcjonalnie – osobne dla wybranego treningu.
 */
export type WeatherPlace = { lat: number; lon: number; name: string | null; custom: boolean };

const access = (p: Location.LocationPermissionResponse): LocationAccess =>
  p.granted ? 'granted' : p.canAskAgain && p.status === Location.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';

export async function getLocationAccess(): Promise<LocationAccess> {
  return access(await Location.getForegroundPermissionsAsync());
}

/** Systemowe pytanie o lokalizację („podczas używania aplikacji”). */
export async function requestLocationAccess(): Promise<LocationAccess> {
  return access(await Location.requestForegroundPermissionsAsync());
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Nazwa miejscowości dla współrzędnych (geokoder systemu); null, gdy się nie udało. */
async function placeName(latitude: number, longitude: number): Promise<string | null> {
  try {
    const [found] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return found?.city ?? found?.subregion ?? found?.district ?? found?.region ?? null;
  } catch {
    return null;
  }
}

/**
 * Okolica z lokalizacji telefonu. Nazwę bierzemy z dokładnej pozycji (geokoder systemu),
 * ale dalej – do serwera i prognozy – idą tylko współrzędne zaokrąglone do 0,1°.
 */
export async function devicePlace(): Promise<WeatherPlace> {
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 6 * 60 * 60 * 1000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
  const { latitude, longitude } = position.coords;
  return { lat: round(latitude), lon: round(longitude), name: await placeName(latitude, longitude), custom: false };
}

/** Szuka miejscowości po nazwie (geokoder systemu). Null – nic nie znaleziono. */
export async function findPlace(query: string): Promise<WeatherPlace | null> {
  const text = query.trim();
  if (text.length < 2) return null;
  try {
    const [found] = await Location.geocodeAsync(text);
    if (!found) return null;
    return {
      lat: round(found.latitude),
      lon: round(found.longitude),
      name: (await placeName(found.latitude, found.longitude)) ?? text,
      custom: true,
    };
  } catch {
    return null;
  }
}

const KEY = 'aloha.weather.place';

/** Ręcznie wybrane miejsce zapamiętane na tym telefonie (null – używamy lokalizacji telefonu). */
export function getSavedPlace(): WeatherPlace | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<WeatherPlace>) : null;
    if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return null;
    return { lat: p.lat, lon: p.lon, name: typeof p.name === 'string' ? p.name : null, custom: true };
  } catch {
    return null;
  }
}

export function savePlace(place: WeatherPlace | null) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (place) localStorage.setItem(KEY, JSON.stringify({ lat: place.lat, lon: place.lon, name: place.name }));
    else localStorage.removeItem(KEY);
  } catch {
    // Brak zapisu nie blokuje zmiany – wybór obowiązuje do zamknięcia aplikacji.
  }
}

const SESSIONS_KEY = 'aloha.weather.sessionPlaces';

export type SessionPlaces = Readonly<Record<string, WeatherPlace>>;

/** Miejsca wybrane dla pojedynczych treningów (id treningu → miejsce), zapamiętane na tym telefonie. */
export function getSessionPlaces(): SessionPlaces {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SESSIONS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Partial<WeatherPlace>>) : {};
    const out: Record<string, WeatherPlace> = {};
    for (const [id, p] of Object.entries(all)) {
      if (p && typeof p.lat === 'number' && typeof p.lon === 'number') {
        out[id] = { lat: p.lat, lon: p.lon, name: typeof p.name === 'string' ? p.name : null, custom: true };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeSessionPlaces(places: SessionPlaces) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (Object.keys(places).length === 0) localStorage.removeItem(SESSIONS_KEY);
    else localStorage.setItem(SESSIONS_KEY, JSON.stringify(places));
  } catch {
    // jak wyżej – wybór obowiązuje do zamknięcia aplikacji
  }
}

/** Ustawia (albo, z `null`, usuwa) miejsce jednego treningu. Zwraca aktualną mapę. */
export function saveSessionPlace(sessionId: string, place: WeatherPlace | null): SessionPlaces {
  const next: Record<string, WeatherPlace> = { ...getSessionPlaces() };
  if (place) next[sessionId] = place;
  else delete next[sessionId];
  writeSessionPlaces(next);
  return next;
}

/** Usuwa miejsca treningów, których nie ma już w planie. Zwraca aktualną mapę. */
export function pruneSessionPlaces(knownIds: ReadonlySet<string>): SessionPlaces {
  const all = getSessionPlaces();
  const kept = Object.fromEntries(Object.entries(all).filter(([id]) => knownIds.has(id)));
  if (Object.keys(kept).length !== Object.keys(all).length) writeSessionPlaces(kept);
  return kept;
}

/**
 * Pogoda do treningów z najbliższych 7 dni (Edge Function session-weather): w miejscu domyślnym,
 * a dla treningów z własnym miejscem – w tym miejscu.
 */
export async function fetchSessionWeather(
  locale: Locale,
  place: WeatherPlace | null,
  sessionPlaces: SessionPlaces,
): Promise<SessionForecast[]> {
  const places = Object.fromEntries(Object.entries(sessionPlaces).map(([id, p]) => [id, { lat: p.lat, lon: p.lon }]));
  const { data, error } = await supabase.functions.invoke<{ sessions: SessionForecast[] }>('session-weather', {
    method: 'POST',
    body: { ...(place ? { lat: place.lat, lon: place.lon } : {}), places, locale },
  });
  if (error) throw error;
  return data?.sessions ?? [];
}
