import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

/** Bieg ze Stravy przypisany do treningu z planu. */
export type StravaActivity = {
  id: number;
  session_id: string | null;
  name: string | null;
  started_at: string;
  distance_m: number;
  moving_time_s: number;
};

/** Stan połączenia do zakładki „Profil”. `null` – konto nie jest połączone. */
export type StravaStatus = {
  athleteName: string | null;
  lastSyncedAt: string | null;
  /** Strava odrzuciła dostęp – trzeba połączyć konto od nowa. */
  needsReconnect: boolean;
};

export async function fetchStravaStatus(): Promise<StravaStatus | null> {
  // Tylko kolumny stanu – tokeny są poza zasięgiem aplikacji (uprawnienia na kolumnach).
  const { data, error } = await supabase
    .from('strava_connections')
    .select('athlete_name, last_synced_at, last_error')
    .maybeSingle();
  if (error || !data) return null;
  return {
    athleteName: data.athlete_name as string | null,
    lastSyncedAt: data.last_synced_at as string | null,
    needsReconnect: data.last_error === 'reauthorize',
  };
}

/** Biegi ze Stravy dopasowane do treningów. Błąd (np. baza bez tej tabeli) = brak biegów, plan działa dalej. */
export async function fetchSessionActivities(): Promise<StravaActivity[]> {
  const { data, error } = await supabase
    .from('strava_activities')
    .select('id, session_id, name, started_at, distance_m, moving_time_s')
    .not('session_id', 'is', null)
    .order('started_at');
  return error ? [] : ((data ?? []) as StravaActivity[]);
}

/** Po odpowiedzi „niepołączone” nie pytamy ponownie do końca tej sesji aplikacji. */
let disconnected = false;

/**
 * Pobiera nowe biegi ze Stravy i odhacza treningi (Edge Function strava-sync).
 * Zwraca liczbę treningów, w których coś się zmieniło. Nigdy nie rzuca – Strava to dodatek do planu.
 */
export async function syncStrava(force = false): Promise<number> {
  if (disconnected) return 0;
  try {
    const { data, error } = await supabase.functions.invoke<{ connected: boolean; updated: number }>('strava-sync', {
      method: 'POST',
      body: { force },
    });
    if (error || !data) return 0;
    if (!data.connected) disconnected = true;
    return data.updated ?? 0;
  } catch {
    return 0;
  }
}

export type StravaConnectResult = 'connected' | 'cancelled' | 'no_activity_scope' | 'failed';

/**
 * „Połącz przez Stravę”: ekran zgody Stravy w systemowym oknie logowania. Funkcja strava-oauth zapisuje
 * połączenie po stronie serwera i wraca do aplikacji z wynikiem – tokeny nie przechodzą przez telefon.
 */
export async function connectStrava(): Promise<StravaConnectResult> {
  try {
    const returnTo = Linking.createURL('/profile');
    const { data, error } = await supabase.functions.invoke<{ url: string }>('strava-oauth', {
      method: 'POST',
      body: { action: 'start', returnTo },
    });
    if (error || !data?.url) return 'failed';
    const session = await WebBrowser.openAuthSessionAsync(data.url, returnTo);
    if (session.type !== 'success') return 'cancelled';
    const result = Linking.parse(session.url).queryParams?.strava;
    if (result === 'connected') {
      disconnected = false;
      return 'connected';
    }
    return result === 'cancelled' || result === 'no_activity_scope' ? result : 'failed';
  } catch {
    return 'failed';
  }
}

/** Cofa dostęp w Stravie i usuwa pobrane biegi. Odhaczone treningi zostają. */
export async function disconnectStrava(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke<{ disconnected: boolean }>('strava-oauth', {
      method: 'POST',
      body: { action: 'disconnect' },
    });
    if (error || !data?.disconnected) return false;
    disconnected = true;
    return true;
  } catch {
    return false;
  }
}

export const stravaActivityUrl = (id: number) => `https://www.strava.com/activities/${id}`;

/** Tempo `m:ss` na kilometr; null, gdy nie ma z czego policzyć. */
export function paceMinPerKm(distanceM: number | null, durationS: number | null) {
  if (!distanceM || !durationS) return null;
  const s = Math.round(durationS / (distanceM / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
