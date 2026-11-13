import type { Locale } from '@aloha/i18n';
import { useEffect, useState } from 'react';

import { useLocale } from '@/hooks/use-t';
import { readCache, writeCache } from '@/lib/data-cache';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** Notka zapamiętana na telefonie – ważna tylko w swoim dniu i języku. */
type StoredNote = { day: string; locale: Locale; text: string };

/** Notka z tej sesji aplikacji: „dzień|język” → tekst (albo null, gdy serwer jej nie dał) – nie pytamy drugi raz. */
const cache = new Map<string, string | null>();
/** Trwające zapytania – ekran „Dzisiaj” i ekran startowy czekają na tę samą odpowiedź. */
const inflight = new Map<string, Promise<string | null>>();

const keyOf = (today: string, locale: Locale) => `${today}|${locale}`;

async function fetchDayNote(today: string, locale: Locale): Promise<string | null> {
  try {
    // Język z telefonu: po zmianie w Profilu serwer pisze notkę od nowa, nawet zanim profil w bazie się zsynchronizuje.
    const { data, error } = await supabase.functions.invoke<{ text: string | null }>('day-note', {
      method: 'POST',
      body: { today, locale },
    });
    return error ? null : (data?.text ?? null);
  } catch {
    return null;
  }
}

/** Notka z pamięci telefonu trafia do pamięci sesji – „Dzisiaj” nie czeka drugi raz na tę samą odpowiedź. */
function fromStorage(today: string, locale: Locale, userId: string | null) {
  const key = keyOf(today, locale);
  if (cache.has(key)) return;
  const stored = readCache<StoredNote>('dayNote', userId);
  if (stored?.day === today && stored.locale === locale) cache.set(key, stored.text);
}

function loadDayNote(today: string, locale: Locale, userId: string | null): Promise<string | null> {
  const key = keyOf(today, locale);
  let request = inflight.get(key);
  if (!request) {
    request = fetchDayNote(today, locale).then((text) => {
      cache.set(key, text);
      inflight.delete(key);
      // Tylko udana notka – po błędzie spróbujemy przy następnym uruchomieniu.
      if (text) writeCache<StoredNote>('dayNote', userId, { day: today, locale, text });
      return text;
    });
    inflight.set(key, request);
  }
  return request;
}

/** Pobiera notkę z wyprzedzeniem (np. zaraz po ułożeniu planu), żeby „Dzisiaj” miało ją od razu. */
export function prefetchDayNote(today: string, locale: Locale, userId: string): Promise<unknown> {
  fromStorage(today, locale, userId);
  return cache.has(keyOf(today, locale)) ? Promise.resolve() : loadDayNote(today, locale, userId);
}

/**
 * Notka trenera AI na dzień bez treningu (Edge Function day-note; jedna na dzień, zapisana na serwerze,
 * a po zmianie języka pisana od nowa). `text: null` – jeszcze jej nie ma albo się nie udała (ekran pokazuje wtedy
 * tekst ze słownika); `pending` – odpowiedź jeszcze nie przyszła.
 */
export function useDayNote(today: string, enabled: boolean): { text: string | null; pending: boolean } {
  const userId = useAuth().session?.user.id ?? null;
  const locale = useLocale();
  const key = keyOf(today, locale);
  // Klucz, dla którego odpowiedź przyszła w tej instancji hooka (cache nie wywołuje renderu).
  const [loaded, setLoaded] = useState<string | null>(null);
  if (enabled) fromStorage(today, locale, userId);
  useEffect(() => {
    if (!enabled || cache.has(key)) return;
    let active = true;
    loadDayNote(today, locale, userId).then(() => active && setLoaded(key));
    return () => {
      active = false;
    };
  }, [today, locale, key, enabled, userId]);
  if (!enabled) return { text: null, pending: false };
  const settled = loaded === key || cache.has(key);
  return { text: cache.get(key) ?? null, pending: !settled };
}
