// Wiersze z bazy (public.get_ai_prompt / public.get_engine_config) → konfiguracja runnera.
// Brak wiersza albo wiersz niepoprawny → wartości wbudowane w kod (bezpieczny tryb, nic nie blokuje planu).

import { AI_EFFORTS, type AiEffort } from './ai-pricing.ts';
import { DEFAULT_AI_PROMPTS, type AiFunctionName, type AiPromptConfig } from './ai-prompt.ts';
import type { AiEngineConfig } from './ai-run.ts';
import { DEFAULT_ENGINE_PARAMS, validateEngineParams } from '../plan/params.ts';

export type AiPromptRow = {
  id: number;
  version: number;
  model: string;
  effort: string | null;
  max_tokens: number;
  system_prompt: string;
};

export type EngineConfigRow = { id: number; version: number; params: unknown };

export function promptFromRow(fn: AiFunctionName, row: AiPromptRow | null | undefined): AiPromptConfig {
  if (!row || !row.model || !row.system_prompt) return { ...DEFAULT_AI_PROMPTS[fn] };
  return {
    id: row.id,
    version: row.version,
    model: row.model,
    effort: AI_EFFORTS.includes(row.effort as AiEffort) ? (row.effort as AiEffort) : null,
    maxTokens: row.max_tokens,
    systemPrompt: row.system_prompt,
  };
}

export function engineFromRow(row: EngineConfigRow | null | undefined): AiEngineConfig {
  if (!row) return { id: null, version: 0, params: { ...DEFAULT_ENGINE_PARAMS } };
  const checked = validateEngineParams(row.params);
  if (!checked.ok) return { id: null, version: 0, params: { ...DEFAULT_ENGINE_PARAMS } };
  return { id: row.id, version: row.version, params: checked.params };
}

/** Modele z server-side fallbackiem po odmowie (Haiku go nie ma). */
export const supportsRefusalFallback = (model: string) => !model.startsWith('claude-haiku');
