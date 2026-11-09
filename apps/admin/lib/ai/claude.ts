import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { supportsRefusalFallback, type AiCaller } from '@aloha/plan-engine';

// Adapter Claude API dla runnera z packages/plan-engine (ten sam kształt co supabase/functions/_shared/claude.ts).
// Klucz: ANTHROPIC_API_KEY (Vercel / apps/admin/.env.local) – tylko na serwerze.

export const hasClaudeKey = () => !!process.env.ANTHROPIC_API_KEY;

export function claudeCaller(): AiCaller {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 2 });
  return async (req) => {
    const fallback = supportsRefusalFallback(req.model);
    const message = await client.beta.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      // Stały prompt + blok reguł → cache (ostatni blok systemowy).
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
