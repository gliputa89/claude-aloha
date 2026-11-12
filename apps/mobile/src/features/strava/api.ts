import type { StravaSurveyProposal } from '@aloha/plan-engine';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { todayIso } from '@/features/onboarding/time';
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
  /** Od kiedy można znów ręcznie pobrać biegi; `null` – można od razu. */
  nextManualAt: string | null;
};

/** Ręczne pobranie biegów: najwyżej raz na 3 godziny (pilnuje tego funkcja strava-sync). */
const MANUAL_INTERVAL_MS = 3 * 60 * 60 * 1000;

export async function fetchStravaStatus(): Promise<StravaStatus | null> {
  // Tylko kolumny stanu – tokeny są poza zasięgiem aplikacji (uprawnienia na kolumnach).
  const { data, error } = await supabase
    .from('strava_connections')
    .select('athlete_name, last_synced_at, last_manual_sync_at, last_error')
    .maybeSingle();
  if (error || !data) return null;
  const manual = data.last_manual_sync_at ? Date.parse(data.last_manual_sync_at as string) + MANUAL_INTERVAL_MS : 0;
  return {
    athleteName: data.athlete_name as string | null,
    lastSyncedAt: data.last_synced_at as string | null,
    needsReconnect: data.last_error === 'reauthorize',
    nextManualAt: manual > Date.now() ? new Date(manual).toISOString() : null,
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

/** Bieg z innego dnia niż trening w planie – czeka na odpowiedź „to był ten trening?”. */
export type StravaSuggestion = {
  id: number;
  suggested_session_id: string;
  local_date: string;
  distance_m: number;
  moving_time_s: number;
};

/** Pytania o przesunięte treningi. Błąd (np. baza bez tych kolumn) = brak pytań, plan działa dalej. */
export async function fetchMatchSuggestions(): Promise<StravaSuggestion[]> {
  const { data, error } = await supabase
    .from('strava_activities')
    .select('id, suggested_session_id, local_date, distance_m, moving_time_s')
    .not('suggested_session_id', 'is', null)
    .order('started_at');
  return error ? [] : ((data ?? []) as StravaSuggestion[]);
}

/** Odpowiedź na „to był ten trening?”: tak → trening odhaczony tym biegiem; nie → nie pytamy więcej. */
export async function answerStravaMatch(activityId: number, accept: boolean): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke<{ error?: string }>('strava-sync', {
      method: 'POST',
      body: { answer: { activityId, accept } },
    });
    return !error && !!data && !data.error;
  } catch {
    return false;
  }
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

export type StravaManualResult =
  | { status: 'done'; imported: number; updated: number }
  | { status: 'limited'; nextAt: string }
  | { status: 'failed' };

/**
 * „Pobierz biegi” w Profilu: wymusza pobranie aktywności z ostatnich 3 dni. Serwer pozwala na to raz na 3 godziny –
 * przy odmowie zwraca, od kiedy będzie można znowu.
 */
export async function fetchRecentStravaRuns(): Promise<StravaManualResult> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      connected: boolean;
      updated: number;
      imported?: number;
      skipped?: boolean;
      nextManualAt?: string;
      error?: string;
    }>('strava-sync', { method: 'POST', body: { manual: true } });
    if (error || !data?.connected || data.error) return { status: 'failed' };
    if (data.skipped) return data.nextManualAt ? { status: 'limited', nextAt: data.nextManualAt } : { status: 'failed' };
    return { status: 'done', imported: data.imported ?? 0, updated: data.updated ?? 0 };
  } catch {
    return { status: 'failed' };
  }
}

export type StravaConnectResult = 'connected' | 'cancelled' | 'no_activity_scope' | 'athlete_limit' | 'failed';

/**
 * „Połącz przez Stravę”: ekran zgody Stravy w systemowym oknie logowania. Funkcja strava-oauth zapisuje
 * połączenie po stronie serwera i wraca do aplikacji z wynikiem – tokeny nie przechodzą przez telefon.
 */
export async function connectStrava(returnPath = '/profile'): Promise<StravaConnectResult> {
  try {
    const returnTo = Linking.createURL(returnPath);
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
    return result === 'cancelled' || result === 'no_activity_scope' || result === 'athlete_limit' ? result : 'failed';
  } catch {
    return 'failed';
  }
}

export type StravaSurveyResult =
  | { status: 'ready'; proposal: StravaSurveyProposal }
  | { status: 'not_connected' }
  | { status: 'failed' };

/**
 * Ankieta startowa: propozycja odpowiedzi z biegów z ostatnich 26 tygodni (Edge Function strava-history).
 * Serwer niczego nie zapisuje – wynik trafia tylko do szkicu ankiety. Nigdy nie rzuca: bez Stravy ankietę
 * wypełnia się ręcznie.
 */
export async function fetchStravaSurvey(): Promise<StravaSurveyResult> {
  try {
    const { data, error } = await supabase.functions.invoke<{ connected?: boolean; proposal?: StravaSurveyProposal; error?: string }>(
      'strava-history',
      { method: 'POST', body: { today: todayIso() } },
    );
    if (error || !data) return { status: 'failed' };
    if (!data.connected) return { status: 'not_connected' };
    return data.proposal ? { status: 'ready', proposal: data.proposal } : { status: 'failed' };
  } catch {
    return { status: 'failed' };
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
