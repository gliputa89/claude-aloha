// Pętla „szkic silnika → Claude → walidacja → (ponowienie) → wynik” dla funkcji 'plan-weeks'.
//
// Bez zależności: wywołanie modelu i zapis logu wstrzykuje środowisko (Edge Function – Deno, panel – Node),
// więc produkcja i tester liczą dokładnie tym samym kodem. Każda próba to osobny wpis w ops.ai_calls
// (ponowienie wskazuje pierwszą próbę przez parent_call_id) z pełnym wejściem, wyjściem i wynikiem walidacji.

import {
  AI_PLAN_RESPONSE_SCHEMA,
  applyOperations,
  parseAiPlanResponse,
  validateWeeks,
  type AiPlanResponse,
  type ApplyResult,
} from './ai-ops.ts';
import { costUsd, modelPrice, type AiUsage, type ModelPrice } from './ai-pricing.ts';
import {
  planWeeksUserMessage,
  retryUserMessage,
  rulesPromptBlock,
  type AiAthlete,
  type AiFunctionName,
  type AiPromptConfig,
} from './ai-prompt.ts';
import type { EngineParams } from './params.ts';
import { dayCap, ENGINE_VERSION, type PlanInput, type PlannedWeek } from './plan.ts';

export type AiMessage = { role: 'user' | 'assistant'; content: string };

/** Zapytanie do modelu w formie niezależnej od SDK (adapter tłumaczy je na messages.create). */
export type AiModelRequest = {
  model: string;
  maxTokens: number;
  effort: string | null;
  /** Bloki promptu systemowego; adapter oznacza ostatni do cache. */
  system: string[];
  messages: AiMessage[];
  /** JSON Schema odpowiedzi (structured outputs). */
  outputSchema: Record<string, unknown>;
};

export type AiModelResult = {
  requestId: string | null;
  /** Model, który faktycznie odpowiedział (może się różnić przy fallbacku po odmowie). */
  model: string;
  stopReason: string | null;
  text: string | null;
  usage: AiUsage;
  /** Surowa odpowiedź do logu. */
  raw: unknown;
};

/** Wywołanie modelu. Błąd API → wyjątek (runner zapisze go i wróci do szkicu). */
export type AiCaller = (request: AiModelRequest) => Promise<AiModelResult>;

export type AiCallRecord = {
  user_id: string | null;
  function_name: AiFunctionName;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  cost_usd: number | null;
  duration_ms: number;
  validation_status: AiStatus;
  error: string | null;
  source: 'app' | 'tester';
  is_test: boolean;
  attempt: number;
  parent_call_id: number | null;
  prompt_id: number | null;
  prompt_version: number | null;
  engine_config_id: number | null;
  engine_config_version: number;
  engine_version: string;
  request_id: string | null;
  stop_reason: string | null;
  price: ModelPrice | null;
};

export type AiCallPayload = {
  request: AiModelRequest;
  response: unknown;
  result: AttemptResult | null;
};

/** Zapis wywołania; zwraca id wpisu (null, gdy zapis się nie udał – plan i tak powstaje). */
export type AiLogger = (call: AiCallRecord, payload: AiCallPayload) => Promise<number | null>;

/**
 * ok – wszystkie operacje przyjęte (albo model uznał szkic za dobry),
 * corrected – część operacji odrzucona przez silnik, reszta przyjęta,
 * rejected – wszystkie operacje odrzucone albo odpowiedź nie do odczytania (wynik = szkic),
 * fallback – błąd API / odmowa / ucięta odpowiedź (wynik = szkic).
 */
export type AiStatus = 'ok' | 'corrected' | 'rejected' | 'fallback';

export type AttemptResult = {
  status: AiStatus;
  response: AiPlanResponse | null;
  apply: ApplyResult | null;
  draft: PlannedWeek[];
  weeks: PlannedWeek[];
  error: string | null;
};

export type AiEngineConfig = {
  /** id wersji w ops.engine_configs; null = parametry wbudowane. */
  id: number | null;
  /** 0 = parametry wbudowane. */
  version: number;
  params: EngineParams;
};

export type PlanWeeksWithAiOptions = {
  /** Wejście silnika (parametry bierzemy z `engine`). */
  input: PlanInput;
  /** Szkic silnika – tygodnie do dopasowania. */
  draft: PlannedWeek[];
  /** Tydzień przed szkicem (przy kolejnym tygodniu planu), do przyrostu i odstępów. */
  previousWeek: PlannedWeek | null;
  athlete: AiAthlete;
  today: string;
  prompt: AiPromptConfig;
  engine: AiEngineConfig;
  call: AiCaller;
  log: AiLogger;
  meta: { userId: string | null; source: 'app' | 'tester'; isTest: boolean };
  /** Ile prób łącznie (domyślnie 2: odpowiedź + jedno ponowienie z wynikiem walidacji). */
  maxAttempts?: number;
  now?: () => number;
};

export type PlanWeeksOutcome = {
  weeks: PlannedWeek[];
  /** 'ai' – wynik po przejrzeniu przez model, 'rules' – sam szkic (błąd / brak AI). */
  source: 'ai' | 'rules';
  status: AiStatus;
  summary: string | null;
  callIds: number[];
  finalCallId: number | null;
  costUsd: number;
  attempts: AttemptResult[];
};

function evaluate(text: string | null, opts: PlanWeeksWithAiOptions, input: PlanInput): AttemptResult {
  const base = { draft: opts.draft, weeks: opts.draft };
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    return { ...base, status: 'rejected', response: null, apply: null, error: 'odpowiedź nie jest poprawnym JSON' };
  }
  const parsed = parseAiPlanResponse(json);
  if (!parsed.ok) return { ...base, status: 'rejected', response: null, apply: null, error: parsed.error };

  const apply = applyOperations(parsed.value.operations, { input, draft: opts.draft, previousWeek: opts.previousWeek });
  const applied = apply.results.filter((r) => r.status === 'applied').length;
  const rejected = apply.results.length - applied;
  const status: AiStatus = rejected === 0 ? 'ok' : applied === 0 ? 'rejected' : 'corrected';
  return { ...base, status, response: parsed.value, apply, weeks: apply.weeks, error: null };
}

/** Dopasowuje szkic tygodni przez Claude z walidacją silnika. Nigdy nie rzuca – w najgorszym razie zwraca szkic. */
export async function planWeeksWithAi(opts: PlanWeeksWithAiOptions): Promise<PlanWeeksOutcome> {
  const now = opts.now ?? Date.now;
  const input: PlanInput = { ...opts.input, params: opts.engine.params };
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);

  const system = [opts.prompt.systemPrompt, rulesPromptBlock(opts.engine.params)];
  const messages: AiMessage[] = [
    {
      role: 'user',
      content: planWeeksUserMessage({
        athlete: opts.athlete,
        input,
        draft: opts.draft,
        previousWeek: opts.previousWeek,
        today: opts.today,
        dayCapOf: (weekday) => dayCap(input, weekday),
      }),
    },
  ];

  const attempts: AttemptResult[] = [];
  const callIds: number[] = [];
  let parentId: number | null = null;
  let total = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const request: AiModelRequest = {
      model: opts.prompt.model,
      maxTokens: opts.prompt.maxTokens,
      effort: opts.prompt.effort,
      system,
      messages: messages.map((m) => ({ ...m })),
      outputSchema: AI_PLAN_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    };

    const started = now();
    let result: AttemptResult;
    let model: AiModelResult | null = null;
    let errorText: string | null = null;
    try {
      model = await opts.call(request);
      if (model.stopReason === 'refusal') errorText = 'model odmówił odpowiedzi (refusal)';
      else if (model.stopReason === 'max_tokens') errorText = 'odpowiedź ucięta (max_tokens) – zwiększ limit tokenów';
    } catch (e) {
      errorText = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    const durationMs = Math.max(0, Math.round(now() - started));

    if (!model || errorText) {
      result = { status: 'fallback', response: null, apply: null, draft: opts.draft, weeks: opts.draft, error: errorText };
    } else {
      result = evaluate(model.text, opts, input);
    }
    attempts.push(result);

    const price = model ? modelPrice(model.model) : modelPrice(opts.prompt.model);
    const cost = model ? costUsd(model.usage, price) : null;
    total += cost ?? 0;

    const id: number | null = await opts
      .log(
        {
          user_id: opts.meta.userId,
          function_name: 'plan-weeks',
          model: model?.model ?? opts.prompt.model,
          input_tokens: model?.usage.inputTokens ?? null,
          output_tokens: model?.usage.outputTokens ?? null,
          cache_read_tokens: model?.usage.cacheReadTokens ?? null,
          cache_write_tokens: model?.usage.cacheWriteTokens ?? null,
          cost_usd: cost,
          duration_ms: durationMs,
          validation_status: result.status,
          error: result.error,
          source: opts.meta.source,
          is_test: opts.meta.isTest,
          attempt,
          parent_call_id: parentId,
          prompt_id: opts.prompt.id,
          prompt_version: opts.prompt.version,
          engine_config_id: opts.engine.id,
          engine_config_version: opts.engine.version,
          engine_version: ENGINE_VERSION,
          request_id: model?.requestId ?? null,
          stop_reason: model?.stopReason ?? null,
          price,
        },
        { request, response: model ? model.raw : { error: errorText }, result },
      )
      .catch(() => null);
    if (id !== null) {
      callIds.push(id);
      parentId ??= id;
    }

    // Ponawiamy tylko, gdy model odpowiedział, ale silnik coś odrzucił (błąd API → od razu szkic).
    const rejected = result.apply?.results.filter((r) => r.status === 'rejected') ?? [];
    const retry = attempt < maxAttempts && model && !errorText && (result.status === 'corrected' || result.status === 'rejected');
    if (!retry) break;
    messages.push({ role: 'assistant', content: model?.text ?? '' });
    messages.push({
      role: 'user',
      content: result.response
        ? retryUserMessage(rejected, result.apply?.remaining ?? [])
        : `Odpowiedź była niepoprawna (${result.error}). Zwróć ją ponownie zgodnie ze schematem.`,
    });
  }

  const final = attempts[attempts.length - 1] as AttemptResult;
  const reviewed = final.status !== 'fallback' && final.response !== null;
  return {
    weeks: final.weeks,
    source: reviewed ? 'ai' : 'rules',
    status: final.status,
    summary: reviewed ? (final.response?.summary ?? null) : null,
    callIds,
    finalCallId: callIds[callIds.length - 1] ?? null,
    costUsd: Math.round(total * 1_000_000) / 1_000_000,
    attempts,
  };
}

/** Szkic jest zgodny z regułami? (dla testów i panelu). */
export const draftViolations = (draft: PlannedWeek[], input: PlanInput, previousWeek: PlannedWeek | null = null) =>
  validateWeeks(draft, { input, draft, previousWeek });
