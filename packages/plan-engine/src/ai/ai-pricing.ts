// Cennik Claude API (USD za 1 mln tokenów, pierwsza strona Anthropic, stan: październik 2026).
// Koszt liczymy z `usage` odpowiedzi; do wywołania zapisujemy cenę z chwili wywołania (ops.ai_calls.price).
// Zapis do cache (5 min) = 1,25 × cena wejścia.

export type ModelPrice = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type AiModelInfo = { id: string; label: string; note: string; price: ModelPrice };

export const AI_MODELS: readonly AiModelInfo[] = [
  {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5',
    note: 'najlepsza jakość planu; domyślny',
    price: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    note: 'o połowę taniej, szybszy',
    price: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  },
  {
    id: 'claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    note: 'najtańszy – raczej do interpretacji check-inu',
    price: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  },
  {
    id: 'claude-fable-5-1',
    label: 'Claude Fable 5.1',
    note: 'najmocniejszy, najdroższy',
    price: { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  },
];

export const AI_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type AiEffort = (typeof AI_EFFORTS)[number];

export function modelPrice(model: string): ModelPrice | null {
  return AI_MODELS.find((m) => model === m.id || model.startsWith(`${m.id}-`))?.price ?? null;
}

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

/** Koszt wywołania w USD (null, gdy model spoza cennika – wtedy trzeba dopisać go do AI_MODELS). */
export function costUsd(usage: AiUsage, price: ModelPrice | null): number | null {
  if (!price) return null;
  const total =
    usage.inputTokens * price.input +
    usage.outputTokens * price.output +
    usage.cacheReadTokens * price.cacheRead +
    usage.cacheWriteTokens * price.cacheWrite;
  return Math.round((total / 1_000_000) * 1_000_000) / 1_000_000;
}
