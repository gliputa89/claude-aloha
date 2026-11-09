// Adapter Claude API dla runnera z plan-engine (Deno). Ten sam kształt co apps/admin/lib/ai/claude.ts.
// Klucz: sekret ANTHROPIC_API_KEY w Supabase (supabase secrets set ANTHROPIC_API_KEY=…).

import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0';

import { supportsRefusalFallback, type AiCaller } from './plan-engine/index.ts';

export const claudeKey = () => Deno.env.get('ANTHROPIC_API_KEY') ?? null;

export function claudeCaller(apiKey: string): AiCaller {
  const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 2 });
  return async (req) => {
    const fallback = supportsRefusalFallback(req.model);
    const message = await client.beta.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      system: req.system.map((text, i, all) =>
        i === all.length - 1 ? { type: 'text' as const, text, cache_control: { type: 'ephemeral' as const } } : { type: 'text' as const, text },
      ),
      messages: req.messages,
      output_config: {
        ...(req.effort ? { effort: req.effort as Anthropic.Beta.Messages.BetaOutputConfig['effort'] } : {}),
        format: { type: 'json_schema', schema: req.outputSchema },
      },
    });
    const text = message.content
      .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return {
      requestId: message.id,
      model: message.model,
      stopReason: message.stop_reason,
      text: text || null,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
      raw: message,
    };
  };
}
