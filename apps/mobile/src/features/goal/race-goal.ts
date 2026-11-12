import { useEffect, useState } from 'react';

import { fromIsoDate } from '@/features/onboarding/time';
import { supabase } from '@/lib/supabase';

/** Aktywny cel „Konkretne zawody” – do odliczania dni na ekranie Dzisiaj. */
export type RaceGoal = {
  distanceM: number;
  /** `YYYY-MM-DD` */
  raceDate: string;
  name: string | null;
};

/** Cel z bazy (RLS: tylko własny). `null` – brak aktywnego celu z datą zawodów. Błąd sieci = brak karty. */
export async function fetchRaceGoal(): Promise<RaceGoal | null> {
  const goals = () => supabase.from('goals');
  // Celów aktywnych może być kilka (zakładka „Cele”) – odliczamy do zawodów celu prowadzącego.
  let { data, error } = await goals().select('type, distance_m, race_date, race_name').eq('status', 'active').eq('role', 'primary').maybeSingle();
  // Baza bez migracji z celami / nazwą zawodów (42703 = nieznana kolumna) – stare zapytanie.
  if (error?.code === '42703') {
    ({ data, error } = await goals().select('type, distance_m, race_date').eq('status', 'active').maybeSingle());
  }
  if (error || !data || data.type !== 'race' || !data.race_date || !data.distance_m) return null;
  const name = 'race_name' in data && typeof data.race_name === 'string' ? data.race_name.trim() : '';
  return { distanceM: data.distance_m as number, raceDate: data.race_date as string, name: name || null };
}

/** Ile pełnych dni od `today` do `raceDate` (obie `YYYY-MM-DD`); 0 = dziś, ujemne = już po zawodach. */
export function daysUntil(raceDate: string, today: string) {
  // Zaokrąglenie łapie zmianę czasu (doba 23 albo 25 godzin).
  return Math.round((fromIsoDate(raceDate).getTime() - fromIsoDate(today).getTime()) / 86_400_000);
}

/** Cel na zawody, wczytywany ponownie, gdy zmieni się plan (np. po ponownej ankiecie). */
export function useRaceGoal(planId: string | null) {
  const [goal, setGoal] = useState<RaceGoal | null>(null);
  useEffect(() => {
    if (!planId) return;
    let active = true;
    fetchRaceGoal()
      .then((g) => active && setGoal(g))
      .catch(() => active && setGoal(null));
    return () => {
      active = false;
    };
  }, [planId]);
  return goal;
}
