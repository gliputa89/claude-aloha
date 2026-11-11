'use server';

import {
  AI_MODELS,
  describeSteps,
  noteActual,
  promptFromRow,
  REVIEW_SCENARIOS,
  reviewWorkout,
  scenarioInput,
  SIM_WORKOUTS,
  workoutNoteFlags,
  workoutNoteWithAi,
  type AiPromptRow,
  type NoteFlag,
  type WorkoutNoteContext,
  type WorkoutReview,
} from '@aloha/plan-engine';

import { claudeCaller, hasClaudeKey } from '@/lib/ai/claude';
import { aiLogger } from '@/lib/ai/runtime';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export type ReviewTestRow = {
  id: string;
  label: string;
  expect: WorkoutReview['verdict'];
  review: WorkoutReview;
  /** Czy reguły dały oczekiwany werdykt i nazwały oczekiwane fakty. */
  rulesOk: boolean;
  note: string | null;
  flags: NoteFlag[];
  callId: number | null;
  status: string;
};

export type ReviewTestResult =
  | { ok: true; rows: ReviewTestRow[]; model: string; promptLabel: string }
  | { ok: false; message: string };

/**
 * Puszcza scenariusze z packages/plan-engine/src/review/review-sim.ts przez reguły oceny i prawdziwy prompt notki trenera.
 * Nic nie zapisuje użytkownikom – tylko log wywołań AI (źródło: tester). Notki idą po kolei, każda dostaje
 * trzy poprzednie, żeby sprawdzić też, czy się nie powtarzają. `ids` – wybrane scenariusze; puste = wszystkie.
 * `model` – model tylko na ten test (null = ten z aktywnego promptu).
 */
export async function runReviewTest(ids: string[], model: string | null = null): Promise<ReviewTestResult> {
  await requireAdmin();
  if (!hasClaudeKey()) return { ok: false, message: 'Brak ANTHROPIC_API_KEY w środowisku panelu (Vercel / apps/admin/.env.local).' };
  const scenarios = REVIEW_SCENARIOS.filter((s) => ids.length === 0 || ids.includes(s.id));
  if (scenarios.length === 0) return { ok: false, message: 'Nie wybrano żadnego scenariusza.' };

  const db = createServiceClient();
  const promptRes = await db.rpc('get_ai_prompt', { p_function: 'workout-review', p_id: null });
  if (promptRes.error) console.warn('get_ai_prompt failed – prompt wbudowany', promptRes.error.message);
  const active = promptFromRow('workout-review', promptRes.error ? null : (promptRes.data as AiPromptRow | null));
  // Inny model tylko na czas testu – do porównania jakości; aktywnego promptu to nie zmienia.
  if (model !== null && !AI_MODELS.some((m) => m.id === model)) return { ok: false, message: 'Nieznany model.' };
  const prompt = model ? { ...active, model } : active;
  const call = claudeCaller();
  const log = aiLogger(db);

  const rows: ReviewTestRow[] = [];
  let previousNotes: string[] = [];
  // Kontekst planu inny dla każdego scenariusza (jak u prawdziwych biegaczy) – inaczej notki siłą rzeczy się powtarzają.
  const NEXT = ['easy', 'long', 'intervals', 'recovery', 'tempo'];
  for (const [i, scenario] of scenarios.entries()) {
    const input = scenarioInput(scenario);
    const review = reviewWorkout(input);
    const codes = review.facts.map((f) => f.code);
    const workout = SIM_WORKOUTS[scenario.workout];
    const context: WorkoutNoteContext = {
      locale: 'pl',
      workout: {
        type: workout.type,
        weekday: 2,
        plannedMin: workout.durationMin,
        plannedDistanceM: null,
        steps: describeSteps(workout.steps),
        shiftedDays: i % 5 === 3 ? 1 : 0,
        doneDaysAgo: i % 3,
      },
      actual: noteActual(input.actualDistanceM, input.actualDurationS),
      review,
      previousSameType: null,
      recent: { planned: 6 + (i % 3), done: 6 + (i % 3) - (i % 4) },
      next: { type: NEXT[i % NEXT.length]!, inDays: 1 + (i % 3) },
      previousNotes,
    };
    const outcome = await workoutNoteWithAi({ context, prompt, call, log, meta: { userId: null, isTest: true, source: 'tester' } });
    rows.push({
      id: scenario.id,
      label: scenario.label,
      expect: scenario.expect,
      review,
      rulesOk: review.verdict === scenario.expect && (scenario.facts ?? []).every((c) => codes.includes(c)),
      note: outcome.note,
      flags: outcome.note ? workoutNoteFlags(outcome.note, context) : [],
      callId: outcome.callId,
      status: outcome.status,
    });
    if (outcome.note) previousNotes = [outcome.note, ...previousNotes].slice(0, 3);
  }
  return { ok: true, rows, model: prompt.model, promptLabel: prompt.version ? `v${prompt.version}` : 'wbudowany' };
}
