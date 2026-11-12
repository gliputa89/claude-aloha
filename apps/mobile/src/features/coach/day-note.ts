import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Notka z tej sesji aplikacji: dzień → tekst (albo null, gdy serwer jej nie dał) – nie pytamy drugi raz. */
const cache = new Map<string, string | null>();
/** Trwające zapytania – ekran „Dzisiaj” i ekran startowy czekają na tę samą odpowiedź. */
const inflight = new Map<string, Promise<string | null>>();

async function fetchDayNote(today: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{ text: string | null }>('day-note', {
      method: 'POST',
      body: { today },
    });
    return error ? null : (data?.text ?? null);
  } catch {
    return null;
  }
}

function loadDayNote(today: string): Promise<string | null> {
  let request = inflight.get(today);
  if (!request) {
    request = fetchDayNote(today).then((text) => {
      cache.set(today, text);
      inflight.delete(today);
      return text;
    });
    inflight.set(today, request);
  }
  return request;
}

/**
 * Notka trenera AI na dzień bez treningu (Edge Function day-note; jedna na dzień, zapisana na serwerze).
 * `text: null` – jeszcze jej nie ma albo się nie udała (ekran pokazuje wtedy tekst ze słownika);
 * `pending` – odpowiedź jeszcze nie przyszła.
 */
export function useDayNote(today: string, enabled: boolean): { text: string | null; pending: boolean } {
  // Dzień, dla którego odpowiedź przyszła w tej instancji hooka (cache nie wywołuje renderu).
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || cache.has(today)) return;
    let active = true;
    loadDayNote(today).then(() => active && setLoaded(today));
    return () => {
      active = false;
    };
  }, [today, enabled]);
  if (!enabled) return { text: null, pending: false };
  const settled = loaded === today || cache.has(today);
  return { text: cache.get(today) ?? null, pending: !settled };
}
