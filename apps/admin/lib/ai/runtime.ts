import 'server-only';

import {
  engineFromRow,
  promptFromRow,
  type AiCallPayload,
  type AiCallRecord,
  type AiEngineConfig,
  type AiLogger,
  type AiPromptConfig,
  type AiPromptRow,
  type EngineConfigRow,
} from '@aloha/plan-engine';

import type { createServiceClient } from '@/lib/supabase/server';

type Db = ReturnType<typeof createServiceClient>;

/**
 * Prompt i parametry do wywołania: wskazane wersje (tester – np. szkic do porównania) albo aktywne.
 * `null` = aktywna; brak aktywnej = wbudowane w kod. Tak samo liczy Edge Function generate-plan.
 */
export async function loadAiRuntime(
  db: Db,
  opts: { promptId?: number | null; configId?: number | null } = {},
): Promise<{ prompt: AiPromptConfig; engine: AiEngineConfig }> {
  const [promptRes, configRes] = await Promise.all([
    db.rpc('get_ai_prompt', { p_function: 'plan-weeks', p_id: opts.promptId ?? null }),
    db.rpc('get_engine_config', { p_id: opts.configId ?? null }),
  ]);
  // Wskazana wersja (test szkicu) musi się wczytać; aktywna – przy błędzie bazy wracamy do wbudowanych.
  if (promptRes.error && opts.promptId != null) throw promptRes.error;
  if (configRes.error && opts.configId != null) throw configRes.error;
  if (promptRes.error) console.warn('get_ai_prompt failed – prompt wbudowany', promptRes.error.message);
  if (configRes.error) console.warn('get_engine_config failed – parametry wbudowane', configRes.error.message);
  return {
    prompt: promptFromRow('plan-weeks', promptRes.error ? null : (promptRes.data as AiPromptRow | null)),
    engine: engineFromRow(configRes.error ? null : (configRes.data as EngineConfigRow | null)),
  };
}

/** Zapis każdej próby do ops.ai_calls + ops.ai_call_payloads. */
export function aiLogger(db: Db): AiLogger {
  return async (call: AiCallRecord, payload: AiCallPayload) => {
    const { data, error } = await db.rpc('log_ai_call', { p_call: call, p_payload: payload });
    if (error) {
      console.error('log_ai_call failed', error.code, error.message);
      return null;
    }
    return (data as number | null) ?? null;
  };
}
