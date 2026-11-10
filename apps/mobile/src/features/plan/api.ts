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
  /** Rada trenera od AI (przy układaniu tygodnia); null – brak, aplikacja bierze radę z bazy. */
  coach_tip: string | null;
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

const plans = () => supabase.from('plans');

/** Aktywny plan z tygodniami i treningami (RLS: tylko własne). `null` – planu jeszcze nie ma. */
export async function fetchActivePlan(): Promise<ActivePlan | null> {
  let { data, error } = await plans()
    .select(
      'id, starts_on, ends_on, weeks(id, week_index, starts_on, focus, sessions(id, scheduled_on, type, duration_min, distance_m, intensity, structure, status, coach_tip))',
    )
    .eq('status', 'active')
    .maybeSingle();
  // Baza bez migracji z radami trenera (42703 = nieznana kolumna) – plan bez rad AI, rady weźmiemy z zapasu.
  if (error?.code === '42703') {
    ({ data, error } = await plans()
      .select(
        'id, starts_on, ends_on, weeks(id, week_index, starts_on, focus, sessions(id, scheduled_on, type, duration_min, distance_m, intensity, structure, status))',
      )
      .eq('status', 'active')
      .maybeSingle());
  }
  if (error) throw error;
  if (!data) return null;
  const weeks = [...(data.weeks as PlanWeek[])]
    .sort((a, b) => a.week_index - b.week_index)
    .map((w) => ({
      ...w,
      sessions: [...w.sessions]
        .map((s) => ({ ...s, coach_tip: s.coach_tip ?? null }))
        .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on)),
    }));
  return { ...(data as Omit<ActivePlan, 'weeks'>), weeks };
}

/** Odpowiedź funkcji generate-plan – do finału ekranu generowania. */
export type GeneratedPlan = {
  startsOn: string;
  endsOn: string;
  /** Liczba treningów w wygenerowanych tygodniach. */
  sessions: number;
  source: 'ai' | 'rules';
  /** Krótkie uzasadnienie od trenera (AI) w języku użytkownika. */
  summary: string | null;
};

/** Generuje plan na serwerze (Edge Function generate-plan) z odpowiedzi z ankiety. */
export async function generatePlan(): Promise<GeneratedPlan | null> {
  const { data, error } = await supabase.functions.invoke<GeneratedPlan>('generate-plan', { method: 'POST' });
  if (error) throw error;
  return data ?? null;
}
