// Prognoza czasu na zawody liczona przez model (funkcja AI 'race-forecast') w widełkach z reguł.
//
// Reguły (plan/forecast.ts) dają stan z tabel Danielsa, karę za objętość i realną poprawę – to liczby odniesienia
// i twarde granice. Model waży to, czego wzór nie widzi: skąd pochodzi wynik (zawody czy szacunek z treningu),
// jak daleko od niego jest docelowy dystans, czy biegacz zdąży zbudować objętość w czasie, który ma w tygodniu.
// Odpowiedź spoza widełek jest do nich dociągana; błąd modelu = prognoza z samych reguł.

import { KM_PER_MILE, unitsForModel, type Units } from '../core/units.ts';
import { ENGINE_VERSION } from '../plan/plan.ts';
import { forecastRace, RACE_VOLUME, type ForecastInput, type RaceForecast } from '../plan/forecast.ts';
import { costUsd, modelPrice } from './ai-pricing.ts';
import type { AiPromptConfig } from './ai-prompt.ts';
import type { AiCaller, AiLogger, AiModelRequest, AiModelResult, AiStatus } from './ai-run.ts';


export const RACE_FORECAST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['todayTimeS', 'raceDayTimeS', 'confidence', 'note'],
  properties: {
    todayTimeS: { type: 'integer', description: 'Realny czas dziś, w sekundach.' },
    raceDayTimeS: { type: 'integer', description: 'Realny czas w dniu startu, w sekundach; nie wolniejszy niż todayTimeS.' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    note: { type: 'string', description: '1–2 zdania do biegacza w jego języku: skąd ta liczba i co o niej zdecyduje.' },
  },
} as const;

export const RACE_FORECAST_NOTE_MAX_LENGTH = 320;

export type RaceForecastContext = ForecastInput & {
  locale: string;
  /** Jednostki biegacza (domyślnie metryczne) – w nich model pisze notkę. */
  units?: Units;
  /** Skąd wynik: zawody, najszybszy odcinek w treningu, szacunek z całego biegu albo wpisany ręcznie. */
  resultSource: 'race' | 'effort' | 'run' | 'manual';
  /** Ile dni temu padł wynik; `null`, gdy nie wiemy. */
  resultDaysAgo: number | null;
  sessionsPerWeek: number;
  /** Docelowy czas wpisany przez biegacza; `null`, gdy go nie podał. */
  targetTimeS: number | null;
};

export type RaceForecastResult = {
  /** Skąd liczby: model w widełkach reguł albo same reguły. */
  source: 'ai' | 'rules';
  vdot: number;
  danielsS: number;
  todayS: number;
  raceDayS: number;
  confidence: 'low' | 'medium' | 'high' | null;
  /** Wyjaśnienie od modelu w języku biegacza; `null` przy prognozie z reguł. */
  note: string | null;
  volume: RaceForecast['volume'];
};

export function raceForecastUserMessage(ctx: RaceForecastContext, base: RaceForecast): string {
  return JSON.stringify(
    {
      locale: ctx.locale,
      ...unitsForModel(ctx.units ?? 'metric'),
      race: { distanceM: ctx.distanceM, weeksToRace: ctx.weeks, targetTimeS: ctx.targetTimeS },
      runner: {
        level: ctx.level,
        runsPerWeek: ctx.runsPerWeek,
        recentResult: { distanceM: ctx.recent.distanceM, timeS: ctx.recent.timeS, source: ctx.resultSource, daysAgo: ctx.resultDaysAgo },
        longestRunKm: ctx.longestRunKm ?? null,
      },
      availability: { sessionsPerWeek: ctx.sessionsPerWeek, weeklyMinutesCap: ctx.weeklyMinutesCap ?? null },
      volume: { ...base.volume, table: RACE_VOLUME[ctx.distanceM] },
      // Kilometraż w milach, żeby model nie przeliczał sam (notka zwykle mówi o tygodniowej objętości).
      ...(ctx.units === 'imperial'
        ? {
            volumeInMiles: Object.fromEntries(
              (['currentKm', 'projectedKm', 'neededKm', 'minKm', 'longRunKm'] as const).map((k) => [
                k.replace('Km', 'Mi'),
                Math.round((base.volume[k] / KM_PER_MILE) * 10) / 10,
              ]),
            ),
          }
        : {}),
      engine: { vdot: base.vdot, danielsEquivalentS: base.danielsS, rulesTodayS: base.todayS, rulesRaceDayS: base.raceDayS },
      bounds: { fastestS: base.fastestS, slowestS: base.slowestS },
    },
    null,
    2,
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Sprawdza odpowiedź modelu i dociąga czasy do widełek. `corrected` – coś trzeba było poprawić.
 * `null` – odpowiedź nie nadaje się do użycia.
 */
export function parseRaceForecast(
  raw: unknown,
  base: RaceForecast,
): { todayS: number; raceDayS: number; confidence: 'low' | 'medium' | 'high'; note: string | null; corrected: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.todayTimeS !== 'number' || typeof r.raceDayTimeS !== 'number') return null;
  if (!Number.isFinite(r.todayTimeS) || !Number.isFinite(r.raceDayTimeS)) return null;
  const todayS = clamp(Math.round(r.todayTimeS), base.fastestS, base.slowestS);
  const raceDayS = Math.min(todayS, clamp(Math.round(r.raceDayTimeS), base.fastestS, base.slowestS));
  const confidence = r.confidence === 'low' || r.confidence === 'high' ? r.confidence : 'medium';
  const note = typeof r.note === 'string' ? r.note.trim().slice(0, RACE_FORECAST_NOTE_MAX_LENGTH) : '';
  return {
    todayS,
    raceDayS,
    confidence,
    note: note || null,
    corrected: todayS !== Math.round(r.todayTimeS) || raceDayS !== Math.round(r.raceDayTimeS),
  };
}

const fromRules = (base: RaceForecast): RaceForecastResult => ({
  source: 'rules',
  vdot: base.vdot,
  danielsS: base.danielsS,
  todayS: base.todayS,
  raceDayS: base.raceDayS,
  confidence: null,
  note: null,
  volume: base.volume,
});

/** Prognoza z samych reguł (bez modelu) – ten sam kształt co wynik z AI. `null`, gdy z wyniku nie da się nic policzyć. */
export function raceForecastFromRules(ctx: ForecastInput): RaceForecastResult | null {
  const base = forecastRace(ctx);
  return base ? fromRules(base) : null;
}

export type RaceForecastOptions = {
  context: RaceForecastContext;
  prompt: AiPromptConfig;
  call: AiCaller;
  log: AiLogger;
  /** `source` – skąd wywołanie (domyślnie aplikacja; symulator w panelu podaje 'tester'). */
  meta: { userId: string | null; isTest: boolean; source?: 'app' | 'tester' };
  now?: () => number;
};

export type RaceForecastOutcome = { forecast: RaceForecastResult | null; status: AiStatus; callId: number | null };

/** Prognoza od modelu w widełkach reguł; każde niepowodzenie kończy się prognozą z reguł (`status: 'fallback'`). */
export async function raceForecastWithAi(opts: RaceForecastOptions): Promise<RaceForecastOutcome> {
  const base = forecastRace(opts.context);
  if (!base) return { forecast: null, status: 'fallback', callId: null };
  const now = opts.now ?? Date.now;
  const request: AiModelRequest = {
    model: opts.prompt.model,
    maxTokens: opts.prompt.maxTokens,
    effort: opts.prompt.effort,
    system: [opts.prompt.systemPrompt],
    messages: [{ role: 'user', content: raceForecastUserMessage(opts.context, base) }],
    outputSchema: RACE_FORECAST_SCHEMA as unknown as Record<string, unknown>,
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

  let forecast = fromRules(base);
  let status: AiStatus = 'fallback';
  if (model && !error) {
    let parsed: ReturnType<typeof parseRaceForecast> = null;
    try {
      parsed = parseRaceForecast(model.text ? JSON.parse(model.text) : null, base);
    } catch {
      parsed = null;
    }
    if (!parsed) {
      status = 'rejected';
      error = 'odpowiedź nie jest poprawnym JSON ze schematu';
    } else {
      status = parsed.corrected ? 'corrected' : 'ok';
      if (parsed.corrected) error = 'czas spoza widełek – dociągnięty do granicy';
      forecast = { ...forecast, source: 'ai', todayS: parsed.todayS, raceDayS: parsed.raceDayS, confidence: parsed.confidence, note: parsed.note };
    }
  }

  const price = modelPrice(model?.model ?? opts.prompt.model);
  const callId = await opts
    .log(
      {
        user_id: opts.meta.userId,
        function_name: 'race-forecast',
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

  return { forecast, status, callId };
}
