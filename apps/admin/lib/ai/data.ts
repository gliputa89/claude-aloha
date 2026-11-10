import 'server-only';

import type { AiCallPayload, AiCallRecord, AiFunctionName } from '@aloha/plan-engine';

import { createServiceClient } from '@/lib/supabase/server';

// Odczyty panelu AI (schemat ops przez funkcje w public). Wołać tylko po requireAdmin().

export type AiCallRow = {
  id: number;
  created_at: string;
  user_id: string | null;
  email: string | null;
  is_test: boolean;
  function_name: string;
  model: string;
  source: 'app' | 'tester';
  attempt: number;
  parent_call_id: number | null;
  prompt_version: number | null;
  engine_config_version: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  validation_status: AiCallRecord['validation_status'] | null;
  error: string | null;
  has_payload: boolean;
};

export type AiCallList = { total: number; cost_usd: number; rows: AiCallRow[] };

export type AiCallFilters = { userId?: string | null; fn?: string | null; status?: string | null; page?: number };

export const CALLS_PAGE_SIZE = 50;

export async function listAiCalls(f: AiCallFilters = {}): Promise<AiCallList> {
  const page = Math.max(1, f.page ?? 1);
  const { data, error } = await createServiceClient().rpc('admin_ai_calls', {
    p_limit: CALLS_PAGE_SIZE,
    p_offset: (page - 1) * CALLS_PAGE_SIZE,
    p_user_id: f.userId ?? null,
    p_function: f.fn ?? null,
    p_status: f.status ?? null,
  });
  if (error) throw error;
  return data as AiCallList;
}

export type AiCallDetail = {
  call: AiCallRow & {
    prompt_id: number | null;
    engine_config_id: number | null;
    engine_version: string | null;
    request_id: string | null;
    stop_reason: string | null;
    price: { input: number; output: number; cacheRead: number; cacheWrite: number } | null;
  };
  payload: (AiCallPayload & { expires_at: string | null; created_at: string }) | null;
  related: { id: number; attempt: number; validation_status: string | null; cost_usd: number | null; created_at: string }[];
};

/** Jedno wywołanie z treścią. Wgląd w treść prawdziwego użytkownika zapisuje się w logu admina (w bazie). */
export async function getAiCall(adminId: string, id: number): Promise<AiCallDetail | null> {
  const { data, error } = await createServiceClient().rpc('admin_ai_call', { p_admin_id: adminId, p_id: id });
  if (error) throw error;
  return (data as AiCallDetail | null) ?? null;
}

export type AiCostSummary = {
  today: number;
  last7: number;
  month: number;
  total: number;
  calls: number;
  month_calls: number;
  month_users: number;
  by_model: { model: string; calls: number; cost_usd: number }[];
  by_function: { function_name: string; calls: number; cost_usd: number }[];
  by_status: Record<string, number>;
  by_day: { day: string; cost_usd: number; calls: number }[];
};

export async function getAiCostSummary(includeTest = true): Promise<AiCostSummary> {
  const { data, error } = await createServiceClient().rpc('admin_ai_cost_summary', { p_include_test: includeTest });
  if (error) throw error;
  return data as AiCostSummary;
}

export type AiUserCost = {
  user_id: string;
  email: string | null;
  is_test: boolean;
  calls: number;
  cost_usd: number;
  month_cost_usd: number;
  month_calls: number;
  last_at: string;
};

export async function getAiCostByUser(limit = 50, userId: string | null = null): Promise<AiUserCost[]> {
  const { data, error } = await createServiceClient().rpc('admin_ai_cost_by_user', { p_limit: limit, p_user_id: userId });
  if (error) throw error;
  return (data as AiUserCost[]) ?? [];
}

export type AiPromptVersion = {
  id: number;
  function_name: AiFunctionName;
  version: number;
  status: 'draft' | 'active' | 'archived';
  model: string;
  effort: string | null;
  max_tokens: number;
  system_prompt: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  activated_at: string | null;
};

export async function listAiPrompts(fn: AiFunctionName): Promise<AiPromptVersion[]> {
  const { data, error } = await createServiceClient().rpc('admin_ai_prompts', { p_function: fn });
  if (error) throw error;
  return (data as AiPromptVersion[]) ?? [];
}

export type EngineConfigVersion = {
  id: number;
  version: number;
  status: 'draft' | 'active' | 'archived';
  params: Record<string, number>;
  note: string | null;
  created_by: string | null;
  created_at: string;
  activated_at: string | null;
};

export async function listEngineConfigs(): Promise<EngineConfigVersion[]> {
  const { data, error } = await createServiceClient().rpc('admin_engine_configs');
  if (error) throw error;
  return (data as EngineConfigVersion[]) ?? [];
}
