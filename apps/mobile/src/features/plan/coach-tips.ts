import type { Locale, TranslationKey } from '@aloha/i18n';
import { useEffect, useState } from 'react';

import type { PlanSession } from '@/features/plan/api';
import { useLocale, useT } from '@/hooks/use-t';
import { supabase } from '@/lib/supabase';

type TipsByType = Map<PlanSession['type'], string[]>;

/** Baza rad wczytywana raz na język (na czas działania aplikacji). */
const cache = new Map<Locale, Promise<TipsByType>>();

function loadTips(locale: Locale): Promise<TipsByType> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = (async () => {
      const { data, error } = await supabase
        .from('coach_tips')
        .select('id, session_type, text')
        .eq('locale', locale)
        .order('id');
      if (error) throw error;
      const map: TipsByType = new Map();
      for (const row of data ?? []) {
        const type = row.session_type as PlanSession['type'];
        map.set(type, [...(map.get(type) ?? []), row.text as string]);
      }
      return map;
    })();
    // Nieudane wczytanie nie zostaje w pamięci – następne otwarcie spróbuje znowu.
    pending.catch(() => cache.delete(locale));
    cache.set(locale, pending);
  }
  return pending;
}

/** Stały „los” z id treningu – ten sam trening zawsze dostaje tę samą radę, różne treningi różne. */
function pick<T>(items: T[], seed: string): T | undefined {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length];
}

/**
 * Rada trenera do treningu: najpierw ta od AI (zapisana w treningu), potem z bazy rad,
 * a bez sieci – stały tekst ze słownika.
 */
export function useCoachTip(session: PlanSession): string {
  const t = useT();
  const locale = useLocale();
  const [fromDb, setFromDb] = useState<{ id: string; text: string } | null>(null);
  const fallback = t(`workoutDetail.tip.${session.type}` as TranslationKey);

  useEffect(() => {
    if (session.coach_tip) return;
    let active = true;
    loadTips(locale)
      .then((tips) => {
        const text = pick(tips.get(session.type) ?? [], session.id);
        if (active && text) setFromDb({ id: session.id, text });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [locale, session.coach_tip, session.id, session.type]);

  return session.coach_tip ?? (fromDb?.id === session.id ? fromDb.text : fallback);
}
