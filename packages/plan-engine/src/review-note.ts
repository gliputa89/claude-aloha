// Notka trenera AI do zrobionego treningu (funkcja 'workout-review').
//
// Werdykt i fakty liczą reguły (review.ts) – model ich nie zmienia, tylko ubiera w 2–3 zdania i dodaje kontekst.
// Żeby notki się nie powtarzały, dostaje poprzednie notki, poprzedni trening tego typu i regularność z 2 tygodni.
// Jak w weather-advice.ts: wywołanie modelu i log wstrzykuje środowisko; nigdy nie rzuca – brak notki = sama ocena.
// Do modelu NIE trafiają dane osobowe ani tętno – tylko plan, wykonanie i ocena treningu.

import { costUsd, modelPrice } from './ai-pricing.ts';
import type { AiFunctionName, AiPromptConfig } from './ai-prompt.ts';
import type { AiCaller, AiLogger, AiModelRequest, AiModelResult, AiStatus } from './ai-run.ts';
import { ENGINE_VERSION } from './plan.ts';
import type { ReviewFact, ReviewVerdict, WorkoutReview } from './review.ts';

/** Prompt prosi o 280 znaków, ale model bywa rozwlekły – odrzucamy dopiero powyżej limitu z bazy (600). */
export const WORKOUT_NOTE_MAX_LENGTH = 600;
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
    /** Ile dni temu trening został zrobiony (0 = dziś, 1 = wczoraj). */
    doneDaysAgo: number;
  };
  /** Wykonanie już zaokrąglone tak, jak pokazuje je aplikacja – model nie przelicza i nie przepisuje surowych metrów. */
  actual: { distanceKm: number | null; durationMin: number | null; pace: string | null };
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

/** Wykonanie do kontekstu notki: kilometry z jednym miejscem po przecinku, pełne minuty, tempo `m:ss`. */
export function noteActual(distanceM: number | null, durationS: number | null): WorkoutNoteContext['actual'] {
  const pace = distanceM && durationS ? Math.round(durationS / (distanceM / 1000)) : null;
  return {
    distanceKm: distanceM ? Math.round(distanceM / 100) / 10 : null,
    durationMin: durationS ? Math.round(durationS / 60) : null,
    pace: pace ? `${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, '0')}` : null,
  };
}

export const workoutNoteUserMessage = (ctx: WorkoutNoteContext) => JSON.stringify(ctx, null, 2);

/** Odpowiedź modelu → notka. Pusta, za krótka, za długa albo powtórzona słowo w słowo = brak notki. */
export function parseWorkoutNote(json: unknown, previousNotes: string[], maxLength: number = WORKOUT_NOTE_MAX_LENGTH): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const note = (json as { note?: unknown }).note;
  if (typeof note !== 'string') return null;
  const clean = note.replace(/\s+/g, ' ').trim();
  if (clean.length < WORKOUT_NOTE_MIN_LENGTH || clean.length > maxLength) return null;
  return previousNotes.includes(clean) ? null : clean;
}

export type WorkoutNoteOptions = Omit<ShortNoteOptions, 'functionName' | 'message' | 'previousNotes'> & { context: WorkoutNoteContext };

export const workoutNoteWithAi = ({ context, ...rest }: WorkoutNoteOptions) =>
  shortNoteWithAi({
    ...rest,
    functionName: 'workout-review',
    message: workoutNoteUserMessage(context),
    previousNotes: context.previousNotes,
    locale: context.locale,
    softMaxLength: 300,
  });

/** Wspólne wywołanie dla krótkich notek trenera (jedno pole `note`): po treningu i na dzień bez treningu. */
export type ShortNoteOptions = {
  functionName: AiFunctionName;
  /** Wiadomość użytkownika (JSON z kontekstem). */
  message: string;
  previousNotes: string[];
  maxLength?: number;
  /** Język notki (reguła form zależnych od płci dotyczy polskiego) i długość, powyżej której prosimy o skrócenie. */
  locale?: string;
  softMaxLength?: number;
  prompt: AiPromptConfig;
  call: AiCaller;
  log: AiLogger;
  /** `source`: skąd wywołanie – aplikacja (domyślnie) albo tester w panelu. */
  meta: { userId: string | null; isTest: boolean; source?: 'app' | 'tester' };
  now?: () => number;
};

export type WorkoutNoteOutcome = { note: string | null; status: AiStatus; callId: number | null };

/** Formy czasu przeszłego w 2. osobie („zrobiłeś”, „pobiegłaś”) – zdradzają płeć, której nie znamy. */
const GENDERED_PL = /\p{L}{3,}(łeś|łaś)(?!\p{L})/u;

/** Co w notce łamie twarde reguły, które da się sprawdzić automatycznie (i poprawić drugą próbą). */
function noteProblems(note: string, opts: ShortNoteOptions): string[] {
  const problems: string[] = [];
  if ((opts.locale ?? 'pl') === 'pl' && GENDERED_PL.test(note)) {
    problems.push('Użyto czasu przeszłego w drugiej osobie (np. „zrobiłeś”) – płci biegacza nie znamy. Napisz to bezosobowo albo w czasie teraźniejszym.');
  }
  if (opts.softMaxLength && note.length > opts.softMaxLength) {
    problems.push(`Notka ma ${note.length} znaków – skróć ją do najwyżej ${opts.softMaxLength}, zostawiając najważniejszą myśl.`);
  }
  return problems;
}

/**
 * Notka od modelu z jedną poprawką: gdy pierwsza wersja łamie regułę sprawdzalną automatycznie (forma zależna
 * od płci, długość), model dostaje ją z uwagami i pisze drugą. Zostaje druga, jeśli się udała; inaczej pierwsza.
 */
export async function shortNoteWithAi(opts: ShortNoteOptions): Promise<WorkoutNoteOutcome> {
  const first = await attemptNote(opts, [{ role: 'user', content: opts.message }], 1, null);
  if (!first.note) return first;
  const problems = noteProblems(first.note, opts);
  if (problems.length === 0) return first;
  const second = await attemptNote(
    opts,
    [
      { role: 'user', content: opts.message },
      { role: 'assistant', content: JSON.stringify({ note: first.note }) },
      { role: 'user', content: ['Popraw notkę, zachowując jej sens:', ...problems.map((p) => `- ${p}`)].join('\n') },
    ],
    2,
    first.callId,
  );
  return second.note ? { ...second, status: 'corrected' } : first;
}

async function attemptNote(
  opts: ShortNoteOptions,
  messages: AiModelRequest['messages'],
  attempt: number,
  parentCallId: number | null,
): Promise<WorkoutNoteOutcome> {
  const now = opts.now ?? Date.now;
  const request: AiModelRequest = {
    model: opts.prompt.model,
    maxTokens: opts.prompt.maxTokens,
    effort: opts.prompt.effort,
    system: [opts.prompt.systemPrompt],
    messages,
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
      note = parseWorkoutNote(model.text ? JSON.parse(model.text) : null, opts.previousNotes, opts.maxLength);
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
        function_name: opts.functionName,
        model: model?.model ?? opts.prompt.model,
        input_tokens: model?.usage.inputTokens ?? null,
        output_tokens: model?.usage.outputTokens ?? null,
        cache_read_tokens: model?.usage.cacheReadTokens ?? null,
        cache_write_tokens: model?.usage.cacheWriteTokens ?? null,
        cost_usd: model ? costUsd(model.usage, price) : null,
        duration_ms: durationMs,
        validation_status: status,
        error,
        source: opts.meta.source ?? 'app',
        is_test: opts.meta.isTest,
        attempt,
        parent_call_id: parentCallId,
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

export type NoteFlag = 'too_long' | 'gendered' | 'unknown_number' | 'contradiction';

/** Liczby, które notka ma prawo przytoczyć: wszystko, co model dostał w danych (z typowymi zaokrągleniami). */
function allowedNumbers(ctx: WorkoutNoteContext): Set<string> {
  const out = new Set<string>(['1', '2', '3', '14']);
  const add = (n: number | null | undefined) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return;
    for (const v of [n, Math.round(n), Math.floor(n), Math.ceil(n)]) out.add(String(Math.abs(v)));
    out.add(Math.abs(n).toFixed(1).replace('.', ','));
    out.add(Math.abs(n).toFixed(2).replace('.', ','));
  };
  for (const f of ctx.review.facts) for (const v of Object.values(f.values)) add(v);
  add(ctx.workout.plannedMin);
  add(ctx.workout.shiftedDays);
  add(ctx.workout.doneDaysAgo);
  add(ctx.recent.planned);
  add(ctx.recent.done);
  add(ctx.next?.inDays);
  for (const n of ctx.workout.steps.match(/\d+/g) ?? []) out.add(n);
  add(ctx.actual.distanceKm);
  add(ctx.actual.durationMin);
  for (const n of ctx.actual.pace?.split(':') ?? []) {
    out.add(n);
    out.add(String(Number(n)));
  }
  return out;
}

/**
 * Automatyczne flagi jakości notki (tester w panelu): za długa, formy zależne od płci, liczba spoza danych,
 * sprzeczność z oceną. To sito na oczywiste błędy – ton i trafność i tak trzeba przeczytać.
 */
export function workoutNoteFlags(note: string, ctx: WorkoutNoteContext): NoteFlag[] {
  const flags: NoteFlag[] = [];
  if (note.length > 300) flags.push('too_long');
  if (ctx.locale === 'pl' && GENDERED_PL.test(note)) flags.push('gendered');
  const allowed = allowedNumbers(ctx);
  const numbers = note.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (numbers.some((n) => !allowed.has(n.replace('.', ',')) && !allowed.has(String(Number(n.replace(',', '.')))))) flags.push('unknown_number');
  const lower = note.toLowerCase();
  const percent = ctx.review.facts.find((f) => f.code.startsWith('volume_'))?.values.percent;
  const praise = /(idealn|wzorow|perfekcyjn|świetna robota|bez zarzutu)/.test(lower);
  if (
    (percent !== undefined && percent < 100 && /dłuższ|ponad plan/.test(lower)) ||
    (percent !== undefined && percent > 100 && /krótsz|krócej/.test(lower)) ||
    ((ctx.review.verdict === 'passed_but' || ctx.review.verdict === 'different') && praise)
  ) {
    flags.push('contradiction');
  }
  return flags;
}
