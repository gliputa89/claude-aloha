// Notka trenera AI do zrobionego treningu (funkcja 'workout-review').
//
// Werdykt i fakty liczą reguły (review.ts) – model ich nie zmienia, tylko ubiera w 2–3 zdania i dodaje kontekst.
// Żeby notki się nie powtarzały, dostaje poprzednie notki, poprzedni trening tego typu i regularność z 2 tygodni.
// Jak w weather-advice.ts: wywołanie modelu i log wstrzykuje środowisko; nigdy nie rzuca – brak notki = sama ocena.
// Do modelu NIE trafiają dane osobowe ani tętno – tylko plan, wykonanie i ocena treningu.

import { costUsd, modelPrice } from './ai-pricing.ts';
import type { AiPromptConfig } from './ai-prompt.ts';
import type { AiCaller, AiLogger, AiModelRequest, AiModelResult, AiStatus } from './ai-run.ts';
import { ENGINE_VERSION } from './plan.ts';
import type { ReviewFact, ReviewVerdict, WorkoutReview } from './review.ts';

/** Prompt prosi o 280 znaków; dłuższe odpowiedzi odrzucamy (limit w bazie: 600). */
export const WORKOUT_NOTE_MAX_LENGTH = 400;
const WORKOUT_NOTE_MIN_LENGTH = 30;

export const WORKOUT_NOTE_SCHEMA = {
  type: 'object',
  properties: { note: { type: 'string' } },
  required: ['note'],
  additionalProperties: false,
} as const;

export type WorkoutNoteContext = {
  locale: string;
  workout: {
    type: string;
    /** Dzień tygodnia z planu, 1 = poniedziałek. */
    weekday: number;
    plannedMin: number | null;
    plannedDistanceM: number | null;
    /** Skrócony przebieg, np. „10′ spokojnie + 4× (3′ interwał / 2′ trucht) + 10′ spokojnie”. */
    steps: string;
    /** O ile dni później (albo wcześniej, ujemne) trening został zrobiony względem planu. */
    shiftedDays: number;
  };
  actual: { distanceM: number | null; durationS: number | null; paceSPerKm: number | null };
  review: WorkoutReview;
  /** Poprzedni oceniony trening tego samego typu – do porównania. */
  previousSameType: { date: string; verdict: ReviewVerdict; facts: ReviewFact[] } | null;
  /** Regularność: treningi z planu w ostatnich 14 dniach i ile z nich zrobione. */
  recent: { planned: number; done: number };
  /** Następny trening w planie. */
  next: { type: string; inDays: number } | null;
  /** Ostatnie notki (najnowsza pierwsza) – nie wolno ich powtarzać. */
  previousNotes: string[];
};

/** Klucz oceny, do której powstała notka – zmiana werdyktu albo faktów = nowa notka. */
export const workoutNoteKey = (review: WorkoutReview) => JSON.stringify([review.verdict, review.facts.map((f) => [f.code, f.values])]);

export const workoutNoteUserMessage = (ctx: WorkoutNoteContext) => JSON.stringify(ctx, null, 2);

/** Odpowiedź modelu → notka. Pusta, za krótka, za długa albo powtórzona słowo w słowo = brak notki. */
export function parseWorkoutNote(json: unknown, previousNotes: string[]): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const note = (json as { note?: unknown }).note;
  if (typeof note !== 'string') return null;
  const clean = note.replace(/\s+/g, ' ').trim();
  if (clean.length < WORKOUT_NOTE_MIN_LENGTH || clean.length > WORKOUT_NOTE_MAX_LENGTH) return null;
  return previousNotes.includes(clean) ? null : clean;
}

export type WorkoutNoteOptions = {
  context: WorkoutNoteContext;
  prompt: AiPromptConfig;
  call: AiCaller;
  log: AiLogger;
  meta: { userId: string | null; isTest: boolean };
  now?: () => number;
};

export type WorkoutNoteOutcome = { note: string | null; status: AiStatus; callId: number | null };

export async function workoutNoteWithAi(opts: WorkoutNoteOptions): Promise<WorkoutNoteOutcome> {
  const now = opts.now ?? Date.now;
  const request: AiModelRequest = {
    model: opts.prompt.model,
    maxTokens: opts.prompt.maxTokens,
    effort: opts.prompt.effort,
    system: [opts.prompt.systemPrompt],
    messages: [{ role: 'user', content: workoutNoteUserMessage(opts.context) }],
    outputSchema: WORKOUT_NOTE_SCHEMA as unknown as Record<string, unknown>,
  };

  const started = now();
  let model: AiModelResult | null = null;
  let error: string | null = null;
  try {
    model = await opts.call(request);
    if (model.stopReason === 'refusal') error = 'model odmówił odpowiedzi (refusal)';
    else if (model.stopReason === 'max_tokens') error = 'odpowiedź ucięta (max_tokens) – zwiększ limit tokenów';
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  const durationMs = Math.max(0, Math.round(now() - started));

  let note: string | null = null;
  let status: AiStatus = 'fallback';
  if (model && !error) {
    try {
      note = parseWorkoutNote(model.text ? JSON.parse(model.text) : null, opts.context.previousNotes);
    } catch {
      note = null;
    }
    status = note ? 'ok' : 'rejected';
    if (!note) error = 'notka pusta, za długa, powtórzona albo spoza schematu';
  }

  const price = modelPrice(model?.model ?? opts.prompt.model);
  const callId = await opts
    .log(
      {
        user_id: opts.meta.userId,
        function_name: 'workout-review',
        model: model?.model ?? opts.prompt.model,
        input_tokens: model?.usage.inputTokens ?? null,
        output_tokens: model?.usage.outputTokens ?? null,
        cache_read_tokens: model?.usage.cacheReadTokens ?? null,
        cache_write_tokens: model?.usage.cacheWriteTokens ?? null,
        cost_usd: model ? costUsd(model.usage, price) : null,
        duration_ms: durationMs,
        validation_status: status,
        error,
        source: 'app',
        is_test: opts.meta.isTest,
        attempt: 1,
        parent_call_id: null,
        prompt_id: opts.prompt.id,
        prompt_version: opts.prompt.version,
        engine_config_id: null,
        engine_config_version: 0,
        engine_version: ENGINE_VERSION,
        request_id: model?.requestId ?? null,
        stop_reason: model?.stopReason ?? null,
        price,
      },
      { request, response: model ? model.raw : { error }, result: null },
    )
    .catch(() => null);

  return { note, status, callId };
}
