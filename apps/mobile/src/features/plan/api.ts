import type { SessionStructure, SessionType, WorkoutReview } from '@aloha/plan-engine';

import { fetchMatchSuggestions, fetchSessionActivities, type StravaActivity, type StravaSuggestion } from '@/features/strava/api';
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
  /** Realizacja (na razie ze Stravy): faktyczny dystans i czas ruchu. */
  actual_distance_m: number | null;
  actual_duration_s: number | null;
  /** Biegi ze Stravy przypisane do tego treningu. */
  activities: StravaActivity[];
  /** Ocena wykonania względem planu (liczy serwer po dopasowaniu biegu); null – jeszcze jej nie ma. */
  review: SessionReview | null;
  /** Rada trenera od AI (przy układaniu tygodnia); null – brak, aplikacja bierze radę z bazy. */
  coach_tip: string | null;
};

/** Ocena z notką trenera AI; `seen` – biegacz już ją otwierał (świętowanie gra tylko za pierwszym razem). */
export type SessionReview = WorkoutReview & { note: string | null; seen: boolean };

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
  /** Biegi ze Stravy z innego dnia niż trening – do pytania „to był ten trening?”. */
  suggestions: StravaSuggestion[];
};

const plans = () => supabase.from('plans');

/** Oceny otwarte w tej sesji aplikacji – zanim plan wczyta się ponownie z bazy. */
const seenHere = new Set<string>();

/** Zapamiętuje, że biegacz otworzył ocenę treningu (animacja świętowania nie zagra drugi raz). */
export function markReviewSeen(sessionId: string) {
  if (seenHere.has(sessionId)) return;
  seenHere.add(sessionId);
  supabase
    .from('session_reviews')
    .update({ seen_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .then(() => {});
}

/** Czy ocenę otwieramy pierwszy raz. */
export const isReviewNew = (sessionId: string, review: SessionReview | null) => !!review && !review.seen && !seenHere.has(sessionId);

/** Oceny treningów. Błąd (np. baza bez tej tabeli) = brak ocen, plan działa dalej. */
async function fetchReviews(): Promise<Map<string, SessionReview>> {
  const { data, error } = await supabase
    .from('session_reviews')
    .select('session_id, verdict, volume, intensity, facts, engine_version, note, seen_at');
  const map = new Map<string, SessionReview>();
  for (const r of error ? [] : (data ?? [])) {
    map.set(r.session_id as string, {
      version: r.engine_version as number,
      verdict: r.verdict as WorkoutReview['verdict'],
      volume: r.volume as WorkoutReview['volume'],
      intensity: r.intensity as WorkoutReview['intensity'],
      facts: (Array.isArray(r.facts) ? r.facts : []) as WorkoutReview['facts'],
      note: (r.note as string | null) ?? null,
      seen: r.seen_at !== null || seenHere.has(r.session_id as string),
    });
  }
  return map;
}

/** Aktywny plan z tygodniami i treningami (RLS: tylko własne). `null` – planu jeszcze nie ma. */
export async function fetchActivePlan(): Promise<ActivePlan | null> {
  const activitiesPromise = fetchSessionActivities();
  const suggestionsPromise = fetchMatchSuggestions();
  const reviewsPromise = fetchReviews();
  let { data, error } = await plans()
    .select(
      'id, starts_on, ends_on, weeks(id, week_index, starts_on, focus, sessions(id, scheduled_on, type, duration_min, distance_m, intensity, structure, status, actual_distance_m, actual_duration_s, coach_tip))',
    )
    .eq('status', 'active')
    .maybeSingle();
  // Baza bez migracji z radami trenera (42703 = nieznana kolumna) – plan bez rad AI, rady weźmiemy z zapasu.
  if (error?.code === '42703') {
    ({ data, error } = await plans()
      .select(
        'id, starts_on, ends_on, weeks(id, week_index, starts_on, focus, sessions(id, scheduled_on, type, duration_min, distance_m, intensity, structure, status, actual_distance_m, actual_duration_s))',
      )
      .eq('status', 'active')
      .maybeSingle());
  }
  if (error) throw error;
  if (!data) return null;
  const activities = await activitiesPromise;
  const reviews = await reviewsPromise;
  const weeks = [...(data.weeks as PlanWeek[])]
    .sort((a, b) => a.week_index - b.week_index)
    .map((w) => ({
      ...w,
      sessions: [...w.sessions]
        .map((s) => ({
          ...s,
          coach_tip: s.coach_tip ?? null,
          activities: activities.filter((a) => a.session_id === s.id),
          review: reviews.get(s.id) ?? null,
        }))
        .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on)),
    }));
  return { ...(data as Omit<ActivePlan, 'weeks' | 'suggestions'>), weeks, suggestions: await suggestionsPromise };
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
