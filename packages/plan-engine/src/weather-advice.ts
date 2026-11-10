// Porada pogodowa od Claude (funkcja 'weather-advice'): model dostaje wynik reguł z weather.ts
// i pisze 1–2 zdania do każdego treningu. Nie decyduje o porze – tylko ubiera ją w słowa.
//
// Jak w ai-run.ts: wywołanie modelu i zapis logu wstrzykuje środowisko. Nigdy nie rzuca –
// błąd API albo zła odpowiedź = brak porady, aplikacja składa wtedy tekst ze słownika.
// Do modelu NIE trafia lokalizacja ani dane osobowe – tylko pogoda i rodzaj treningu.

import { costUsd, modelPrice } from './ai-pricing.ts';
import type { AiPromptConfig } from './ai-prompt.ts';
import type { AiCaller, AiLogger, AiModelRequest, AiModelResult, AiStatus } from './ai-run.ts';
import { isoWeekday } from './dates.ts';
import { ENGINE_VERSION } from './plan.ts';
import type { SessionWeather } from './weather.ts';

/** Limit w bazie (session_weather.advice); prompt prosi o 200 znaków. */
export const WEATHER_ADVICE_MAX_LENGTH = 300;

export const WEATHER_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    advice: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string' }, text: { type: 'string' } },
        required: ['date', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['advice'],
  additionalProperties: false,
} as const;

export type WeatherAdviceSession = {
  type: string;
  durationMin: number | null;
  intensity: string | null;
  weather: SessionWeather;
};

const WEEKDAY = ['', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];

/** Wiadomość użytkownika (JSON): bieżący czas w miejscu prognozy i treningi z wynikiem reguł. */
export function weatherAdviceUserMessage(m: { locale: string; today: string; nowHour: number; sessions: WeatherAdviceSession[] }): string {
  return JSON.stringify(
    {
      locale: m.locale,
      today: m.today,
      now: `${String(m.nowHour).padStart(2, '0')}:00`,
      sessions: m.sessions.map((s) => ({
        date: s.weather.date,
        weekday: WEEKDAY[isoWeekday(s.weather.date)],
        isToday: s.weather.date === m.today,
        type: s.type,
        durationMin: s.durationMin,
        intensity: s.intensity,
        window: s.weather.window,
        allDay: s.weather.allDay,
        quality: s.weather.quality,
        atWindow: {
          condition: s.weather.condition,
          tempC: s.weather.tempC,
          feelsC: s.weather.feelsC,
          precipProb: s.weather.precipProb,
          windKmh: s.weather.windKmh,
          pm25: s.weather.pm25,
          daylight: s.weather.isDay,
        },
        flags: s.weather.flags,
        avoid: s.weather.avoid,
      })),
    },
    null,
    2,
  );
}

/** Odpowiedź modelu → porady dla znanych dat. Nieznane daty, puste i za długie teksty odpadają. */
export function parseWeatherAdvice(json: unknown, dates: string[]): Record<string, string> | null {
  if (typeof json !== 'object' || json === null) return null;
  const list = (json as { advice?: unknown }).advice;
  if (!Array.isArray(list)) return null;
  const out: Record<string, string> = {};
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const { date, text } = item as { date?: unknown; text?: unknown };
    if (typeof date !== 'string' || typeof text !== 'string' || !dates.includes(date)) continue;
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length > 0 && clean.length <= WEATHER_ADVICE_MAX_LENGTH) out[date] = clean;
  }
  return out;
}

export type WeatherAdviceOptions = {
  sessions: WeatherAdviceSession[];
  locale: string;
  /** Dzisiejsza data i godzina w miejscu prognozy. */
  today: string;
  nowHour: number;
  prompt: AiPromptConfig;
  call: AiCaller;
  log: AiLogger;
  meta: { userId: string | null; isTest: boolean };
  now?: () => number;
};

export type WeatherAdviceOutcome = {
  /** Data treningu → porada (tylko dla dat, dla których model odpowiedział poprawnie). */
  advice: Record<string, string>;
  status: AiStatus;
  callId: number | null;
};

export async function weatherAdviceWithAi(opts: WeatherAdviceOptions): Promise<WeatherAdviceOutcome> {
  if (opts.sessions.length === 0) return { advice: {}, status: 'ok', callId: null };
  const now = opts.now ?? Date.now;
  const dates = opts.sessions.map((s) => s.weather.date);
  const request: AiModelRequest = {
    model: opts.prompt.model,
    maxTokens: opts.prompt.maxTokens,
    effort: opts.prompt.effort,
    system: [opts.prompt.systemPrompt],
    messages: [{ role: 'user', content: weatherAdviceUserMessage(opts) }],
    outputSchema: WEATHER_ADVICE_SCHEMA as unknown as Record<string, unknown>,
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

  let advice: Record<string, string> = {};
  let status: AiStatus = 'fallback';
  if (model && !error) {
    let parsed: Record<string, string> | null = null;
    try {
      parsed = parseWeatherAdvice(model.text ? JSON.parse(model.text) : null, dates);
    } catch {
      parsed = null;
    }
    if (!parsed) {
      status = 'rejected';
      error = 'odpowiedź nie jest poprawnym JSON ze schematu';
    } else {
      advice = parsed;
      const got = Object.keys(parsed).length;
      status = got === dates.length ? 'ok' : got === 0 ? 'rejected' : 'corrected';
      if (got < dates.length) error = `porady dla ${got} z ${dates.length} treningów`;
    }
  }

  const price = modelPrice(model?.model ?? opts.prompt.model);
  const callId = await opts
    .log(
      {
        user_id: opts.meta.userId,
        function_name: 'weather-advice',
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

  return { advice, status, callId };
}
