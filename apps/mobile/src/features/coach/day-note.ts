import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Notka z tej sesji aplikacji: dzień → tekst (albo null, gdy serwer jej nie dał) – nie pytamy drugi raz. */
const cache = new Map<string, string | null>();

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

/**
 * Notka trenera AI na dzień bez treningu (Edge Function day-note; jedna na dzień, zapisana na serwerze).
 * `null` – jeszcze jej nie ma albo się nie udała; ekran pokazuje wtedy tekst ze słownika.
 */
export function useDayNote(today: string, enabled: boolean) {
  const [note, setNote] = useState<string | null>(() => cache.get(today) ?? null);
  useEffect(() => {
    if (!enabled || cache.has(today)) return;
    let active = true;
    fetchDayNote(today).then((text) => {
      cache.set(today, text);
      if (active) setNote(text);
    });
    return () => {
      active = false;
    };
  }, [today, enabled]);
  return enabled ? note : null;
}
