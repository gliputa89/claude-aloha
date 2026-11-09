import { AI_FUNCTIONS, DEFAULT_AI_PROMPTS, rulesPromptBlock, type AiFunctionName } from '@aloha/plan-engine';
import { Suspense } from 'react';

import { PromptWorkbench } from '@/components/ai/prompt-workbench';
import { listAiPrompts } from '@/lib/ai/data';
import { loadAiRuntime } from '@/lib/ai/runtime';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

export default function AiPromptsPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję prompty…</p>}>
      <Prompts />
    </Suspense>
  );
}

async function Prompts() {
  await requireAdmin();
  const fn: AiFunctionName = 'plan-weeks';
  const [versions, runtime] = await Promise.all([listAiPrompts(fn), loadAiRuntime(createServiceClient())]);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Prompty</h1>
        <p className="max-w-3xl text-sm text-text-muted">
          <b className="text-text">{fn}</b> – {AI_FUNCTIONS[fn].description} Prompt systemowy = treść z aktywnej wersji + blok reguł generowany z
          Ram planu. Dane biegacza i szkic idą w osobnej wiadomości (podgląd w szczegółach każdego wywołania).
        </p>
      </header>
      <PromptWorkbench
        fn={fn}
        active={runtime.prompt}
        builtin={DEFAULT_AI_PROMPTS[fn]}
        versions={versions}
        rulesBlock={rulesPromptBlock(runtime.engine.params, 3)}
      />
    </>
  );
}
