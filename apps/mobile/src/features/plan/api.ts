import type { SessionStructure, SessionType } from '@aloha/plan-engine';

import { supabase } from '@/lib/supabase';

export type PlanSession = {
  id: string;
  scheduled_on: string;
  type: SessionType | 'rest';
  duration_min: number | null;
  distance_m: number | null;
  intensity: 'easy' | 'moderate' | 'hard' | null;
  structure: SessionStructure | Record<string, never>;
  status: 'planned' | 'done' | 'partial' | 'missed';
};

export type PlanWeek = {
  id: string;
  week_index: number;
  starts_on: string;
  focus: string | null;
  sessions: PlanSession[];
};

export type ActivePlan = {
  id: string;
  starts_on: string;
  ends_on: string | null;
  weeks: PlanWeek[];
};

/** Aktywny plan z tygodniami i treningami (RLS: tylko własne). `null` – planu jeszcze nie ma. */
export async function fetchActivePlan(): Promise<ActivePlan | null> {
  const { data, error } = await supabase
    .from('plans')
    .select(
      'id, starts_on, ends_on, weeks(id, week_index, starts_on, focus, sessions(id, scheduled_on, type, duration_min, distance_m, intensity, structure, status))',
    )
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const weeks = [...(data.weeks as PlanWeek[])]
    .sort((a, b) => a.week_index - b.week_index)
    .map((w) => ({ ...w, sessions: [...w.sessions].sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on)) }));
  return { ...(data as Omit<ActivePlan, 'weeks'>), weeks };
}

/** Generuje plan na serwerze (Edge Function generate-plan) z odpowiedzi z ankiety. */
export async function generatePlan() {
  const { error } = await supabase.functions.invoke('generate-plan', { method: 'POST' });
  if (error) throw error;
}
