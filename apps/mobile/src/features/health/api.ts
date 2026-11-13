import { Platform } from 'react-native';

import { AlohaHealth } from '../../../modules/aloha-health/src/AlohaHealthModule';
import { supabase } from '@/lib/supabase';

/** Okno biegów wysyłanych na serwer – tyle samo, ile serwer bierze pod uwagę (LOOKBACK_DAYS w health-sync). */
const LOOKBACK_DAYS = 30;
const MAX_WORKOUTS = 100;
/** Synchronizacja przy starcie aplikacji nie częściej niż co tyle (pociągnięcie w dół – zawsze). */
const MIN_INTERVAL_MS = 10 * 60 * 1000;

/** Stan połączenia do zakładki „Profil”. `null` – Apple Zdrowie nie jest włączone. */
export type HealthStatus = { lastSyncedAt: string | null };

/** Czy ten telefon ma Apple Zdrowie i build z modułem HealthKit. */
export function healthAvailable(): boolean {
  if (Platform.OS !== 'ios' || !AlohaHealth) return false;
  try {
    return AlohaHealth.isAvailable();
  } catch {
    return false;
  }
}

export async function fetchHealthStatus(): Promise<HealthStatus | null> {
  const { data, error } = await supabase.from('health_connections').select('last_synced_at').maybeSingle();
  if (error || !data) return null;
  return { lastSyncedAt: data.last_synced_at as string | null };
}

export type HealthSyncResult = { updated: number; imported: number } | null;

let lastSyncAt = 0;
let disconnected = false;

/**
 * Czyta biegi z Apple Zdrowie z ostatnich 30 dni i wysyła je do funkcji health-sync (odhaczenie treningów, ocena).
 * Zwraca liczbę zmienionych treningów albo null przy błędzie. Nigdy nie rzuca – Apple Zdrowie to dodatek do planu.
 */
export async function syncHealth(force = false): Promise<HealthSyncResult> {
  if (!healthAvailable() || !AlohaHealth || disconnected) return null;
  if (!force && Date.now() - lastSyncAt < MIN_INTERVAL_MS) return null;
  try {
    const since = Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000;
    const workouts = await AlohaHealth.getWorkouts(since, MAX_WORKOUTS);
    const { data, error } = await supabase.functions.invoke<{ connected: boolean; updated: number; imported?: number; error?: string }>(
      'health-sync',
      { method: 'POST', body: { since: new Date(since).toISOString(), workouts } },
    );
    if (error || !data || data.error) return null;
    if (!data.connected) {
      disconnected = true;
      return null;
    }
    lastSyncAt = Date.now();
    return { updated: data.updated ?? 0, imported: data.imported ?? 0 };
  } catch {
    return null;
  }
}

export type HealthConnectResult = 'connected' | 'unavailable' | 'failed';

/** Prośba iOS o dostęp do treningów, znacznik połączenia na serwerze i pierwsze pobranie biegów. */
export async function connectHealth(userId: string): Promise<HealthConnectResult> {
  if (!healthAvailable() || !AlohaHealth) return 'unavailable';
  try {
    await AlohaHealth.requestAuthorization();
  } catch {
    return 'failed';
  }
  const { error } = await supabase.from('health_connections').upsert({ user_id: userId, source: 'apple_health' }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) return 'failed';
  disconnected = false;
  await syncHealth(true);
  return 'connected';
}

/** Wyłącza pobieranie. Odhaczone treningi zostają w planie; dostęp w iOS biegacz cofa sam w Ustawieniach. */
export async function disconnectHealth(): Promise<boolean> {
  const { error } = await supabase.from('health_connections').delete().not('user_id', 'is', null);
  if (!error) disconnected = true;
  return !error;
}
