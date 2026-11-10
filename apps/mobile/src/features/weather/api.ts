import type { Locale } from '@aloha/i18n';
import type { SessionWeather } from '@aloha/plan-engine';
import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';

/** Pogoda do treningu: wynik reguł (okno, ostrzeżenia) i porada od AI (null – tekst składamy ze słownika). */
export type SessionForecast = SessionWeather & { sessionId: string; advice: string | null };

export type LocationAccess = 'undetermined' | 'granted' | 'denied';

const access = (p: Location.LocationPermissionResponse): LocationAccess =>
  p.granted ? 'granted' : p.canAskAgain && p.status === Location.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';

export async function getLocationAccess(): Promise<LocationAccess> {
  return access(await Location.getForegroundPermissionsAsync());
}

/** Systemowe pytanie o lokalizację („podczas używania aplikacji”). */
export async function requestLocationAccess(): Promise<LocationAccess> {
  return access(await Location.requestForegroundPermissionsAsync());
}

/**
 * Przybliżona pozycja, zaokrąglona do 0,1° (ok. 10 km) – do prognozy wystarczy okolica,
 * dokładniejsze współrzędne nie opuszczają telefonu.
 */
async function approximatePosition() {
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 6 * 60 * 60 * 1000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
  const round = (n: number) => Math.round(n * 10) / 10;
  return { lat: round(position.coords.latitude), lon: round(position.coords.longitude) };
}

/** Pogoda do treningów z najbliższych 7 dni w aktualnej okolicy (Edge Function session-weather). */
export async function fetchSessionWeather(locale: Locale): Promise<SessionForecast[]> {
  const { lat, lon } = await approximatePosition();
  const { data, error } = await supabase.functions.invoke<{ sessions: SessionForecast[] }>('session-weather', {
    method: 'POST',
    body: { lat, lon, locale },
  });
  if (error) throw error;
  return data?.sessions ?? [];
}
