'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';

import type { ActionResult } from '@/app/(panel)/tester/actions';
import { requireAdmin, type Admin } from '@/lib/auth';
import { serviceRoleKey, supabaseUrl } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Odpowiedź Edge Function strava-sync (wywołanie z kluczem service_role dla jednego użytkownika). */
type SyncOutcome = {
  connected?: boolean;
  updated?: number;
  imported?: number;
  matched?: number;
  athleteName?: string | null;
  error?: string;
  stage?: 'token' | 'activities';
};

const plural = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

function explain(o: SyncOutcome): ActionResult {
  switch (o.error) {
    case undefined:
      break;
    case 'not_configured':
      return {
        ok: false,
        message: 'Funkcja nie ma sekretów STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET (supabase secrets set … – patrz supabase/README.md).',
      };
    case 'reauthorize':
      return o.stage === 'activities'
        ? { ok: false, message: 'Token działa, ale Strava nie pozwala czytać aktywności – token nie ma zakresu activity:read.' }
        : {
            ok: false,
            message: 'Strava odrzuciła refresh token – jest nieaktualny, cofnięty albo pochodzi z innej aplikacji Stravy niż sekrety funkcji.',
          };
    case 'rate_limited':
      return { ok: false, message: 'Strava odmówiła z powodu limitu zapytań – spróbuj za kilkanaście minut.' };
    case 'save_failed':
      return { ok: false, message: 'Strava odpowiedziała, ale zapis w bazie się nie powiódł – szczegóły w logach funkcji.' };
    default:
      return { ok: false, message: 'Strava nie odpowiedziała poprawnie – szczegóły w logach funkcji strava-sync.' };
  }
  if (!o.connected) return { ok: false, message: 'Ten użytkownik nie ma połączenia ze Stravą.' };
  const imported = o.imported ?? 0;
  const updated = o.updated ?? 0;
  return {
    ok: true,
    message:
      `Działa${o.athleteName ? ` – konto ${o.athleteName}` : ''}: ${imported} ${plural(imported, 'bieg', 'biegi', 'biegów')} w oknie planu, ` +
      `${o.matched ?? 0} dopasowanych do treningów, ${updated} ${plural(updated, 'trening zmieniony', 'treningi zmienione', 'treningów zmienionych')}.`,
  };
}

/** Woła strava-sync dla jednego użytkownika – tą samą drogą, którą idzie cron, więc test sprawdza całość. */
async function callSync(body: { userId: string; refreshToken?: string }): Promise<ActionResult> {
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl()}/functions/v1/strava-sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { ok: false, message: 'Funkcja strava-sync nie odpowiedziała (sieć albo przekroczony czas).' };
  }
  if (res.status === 404) return { ok: false, message: 'Funkcja strava-sync nie jest wdrożona w tym projekcie Supabase.' };
  if (res.status === 401) return { ok: false, message: 'Funkcja strava-sync odrzuciła klucz service_role panelu.' };
  const outcome = (await res.json().catch(() => null)) as SyncOutcome | null;
  if (!res.ok || !outcome) return { ok: false, message: `Funkcja strava-sync zwróciła błąd ${res.status} – szczegóły w jej logach.` };
  return explain(outcome);
}

const log = (admin: Admin, action: string, userId: string) =>
  createServiceClient().rpc('admin_log', { p_admin_id: admin.id, p_action: action, p_target_type: 'user', p_target_id: userId });

/**
 * „Połącz przez Stravę”: zwraca adres ekranu zgody Stravy. Po zgodzie Strava wraca do funkcji strava-oauth,
 * a ta zapisuje połączenie i odsyła z powrotem na stronę użytkownika w testerze (?strava=connected).
 * Połączy się to konto Stravy, na które jest zalogowana przeglądarka.
 */
export async function startStravaOAuth(userId: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return { ok: false, message: 'Nie znam adresu panelu, na który Strava ma wrócić.' };
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl()}/functions/v1/strava-oauth`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', userId, returnTo: `${proto}://${host}/tester/${userId}` }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, message: 'Funkcja strava-oauth nie odpowiedziała.' };
  }
  if (res.status === 404) return { ok: false, message: 'Funkcja strava-oauth nie jest wdrożona w tym projekcie Supabase.' };
  if (res.status === 401) return { ok: false, message: 'Funkcja strava-oauth odrzuciła klucz service_role panelu.' };
  if (res.status === 503) return explain({ error: 'not_configured' }) as { ok: false; message: string };
  const body = (await res.json().catch(() => null)) as { url?: string } | null;
  if (!res.ok || !body?.url) return { ok: false, message: `Funkcja strava-oauth zwróciła błąd ${res.status}.` };
  await log(admin, 'tester_strava_oauth_start', userId);
  return { ok: true, url: body.url };
}

/** Ręczne połączenie: token jest sprawdzany w Stravie, zapisywany i od razu idzie pierwsza synchronizacja. */
export async function connectStrava(userId: string, refreshToken: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const token = refreshToken.trim();
  if (!/^[0-9a-f]{20,80}$/i.test(token)) {
    return { ok: false, message: 'To nie wygląda na refresh token Stravy (ciąg ok. 40 znaków: cyfry i litery a–f).' };
  }
  const result = await callSync({ userId, refreshToken: token });
  // W logu sam fakt połączenia – tokenu nie zapisujemy nigdzie poza strava_connections.
  await log(admin, result.ok ? 'tester_strava_connect' : 'tester_strava_connect_failed', userId);
  refresh();
  return result;
}

/** Synchronizacja od razu, z pominięciem 10-minutowej przerwy. */
export async function syncStravaNow(userId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const result = await callSync({ userId });
  refresh();
  return result;
}

/** Usuwa połączenie i pobrane biegi. Odhaczone treningi zostają tak, jak są. */
export async function disconnectStrava(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) return { ok: false, message: 'Nieprawidłowy użytkownik.' };
  const db = createServiceClient();
  const activities = await db.from('strava_activities').delete().eq('user_id', userId);
  const connection = activities.error ? activities : await db.from('strava_connections').delete().eq('user_id', userId);
  if (connection.error) return { ok: false, message: `Rozłączenie nie powiodło się: ${connection.error.message}` };
  await log(admin, 'tester_strava_disconnect', userId);
  refresh();
  return { ok: true, message: 'Rozłączono. Pobrane biegi usunięte, odhaczone treningi zostały.' };
}
