'use server';

import { AI_EFFORTS, AI_FUNCTIONS, AI_MODELS, validateEngineParams, type AiFunctionName } from '@aloha/plan-engine';
import { refresh } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export type AiActionResult = { ok: true; message: string; id?: number } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const isFunction = (fn: string): fn is AiFunctionName => fn in AI_FUNCTIONS;

export type PromptDraft = {
  model: string;
  effort: string | null;
  maxTokens: number;
  systemPrompt: string;
  note: string;
};

/** Nowa wersja promptu (zawsze nowa – historii nie nadpisujemy). Opcjonalnie od razu aktywna. */
export async function createPromptVersion(fn: string, draft: PromptDraft, activate: boolean): Promise<AiActionResult> {
  const admin = await requireAdmin();
  if (!isFunction(fn)) return { ok: false, message: 'Nieznana funkcja AI.' };
  if (!AI_MODELS.some((m) => m.id === draft.model)) return { ok: false, message: 'Model spoza cennika – dopisz go w plan-engine (ai-pricing.ts).' };
  if (draft.effort && !(AI_EFFORTS as readonly string[]).includes(draft.effort)) return { ok: false, message: 'Nieznany poziom effort.' };
  if (!Number.isInteger(draft.maxTokens) || draft.maxTokens < 256 || draft.maxTokens > 64000) {
    return { ok: false, message: 'Limit tokenów: 256–64000.' };
  }
  const text = draft.systemPrompt.trim();
  if (text.length < 20) return { ok: false, message: 'Prompt jest za krótki.' };
  if (text.length > 60000) return { ok: false, message: 'Prompt jest za długi (max 60 000 znaków).' };

  const db = createServiceClient();
  const { data, error } = await db.rpc('admin_create_ai_prompt', {
    p_admin_id: admin.id,
    p_function: fn,
    p_model: draft.model,
    p_effort: draft.effort,
    p_max_tokens: draft.maxTokens,
    p_system_prompt: text,
    p_note: draft.note,
  });
  if (error) return { ok: false, message: `Zapis nie powiódł się: ${error.message}` };
  const row = data as { id: number; version: number };
  if (activate) {
    const res = await db.rpc('admin_activate_ai_prompt', { p_admin_id: admin.id, p_function: fn, p_id: row.id });
    if (res.error) return { ok: false, message: `Zapisano v${row.version}, ale aktywacja nie powiodła się: ${res.error.message}` };
  }
  refresh();
  return { ok: true, id: row.id, message: activate ? `Wersja ${row.version} zapisana i aktywna.` : `Zapisano szkic v${row.version}.` };
}

/** Aktywuje wersję promptu; `null` = wróć do promptu wbudowanego w kod. */
export async function activatePrompt(fn: string, id: number | null): Promise<AiActionResult> {
  const admin = await requireAdmin();
  if (!isFunction(fn)) return { ok: false, message: 'Nieznana funkcja AI.' };
  const { error } = await createServiceClient().rpc('admin_activate_ai_prompt', { p_admin_id: admin.id, p_function: fn, p_id: id });
  if (error) return { ok: false, message: `Aktywacja nie powiodła się: ${error.message}` };
  refresh();
  return { ok: true, message: id === null ? 'Aktywny jest prompt wbudowany.' : 'Wersja aktywna.' };
}

/** Nowa wersja parametrów silnika (granice sprawdzane w kodzie). Opcjonalnie od razu aktywna. */
export async function createEngineConfig(raw: Record<string, string>, note: string, activate: boolean): Promise<AiActionResult> {
  const admin = await requireAdmin();
  const checked = validateEngineParams(raw);
  if (!checked.ok) {
    return {
      ok: false,
      message: 'Popraw wartości spoza granic.',
      fieldErrors: Object.fromEntries(checked.errors.map((e) => [e.key, e.message])),
    };
  }
  const db = createServiceClient();
  const { data, error } = await db.rpc('admin_create_engine_config', { p_admin_id: admin.id, p_params: checked.params, p_note: note });
  if (error) return { ok: false, message: `Zapis nie powiódł się: ${error.message}` };
  const row = data as { id: number; version: number };
  if (activate) {
    const res = await db.rpc('admin_activate_engine_config', { p_admin_id: admin.id, p_id: row.id });
    if (res.error) return { ok: false, message: `Zapisano v${row.version}, ale aktywacja nie powiodła się: ${res.error.message}` };
  }
  refresh();
  return { ok: true, id: row.id, message: activate ? `Parametry v${row.version} zapisane i aktywne.` : `Zapisano szkic v${row.version}.` };
}

/** Aktywuje wersję parametrów; `null` = wróć do wartości wbudowanych. */
export async function activateEngineConfig(id: number | null): Promise<AiActionResult> {
  const admin = await requireAdmin();
  const { error } = await createServiceClient().rpc('admin_activate_engine_config', { p_admin_id: admin.id, p_id: id });
  if (error) return { ok: false, message: `Aktywacja nie powiodła się: ${error.message}` };
  refresh();
  return { ok: true, message: id === null ? 'Aktywne są wartości wbudowane.' : 'Wersja aktywna.' };
}
