import { AI_MODELS, REVIEW_SCENARIOS } from '@aloha/plan-engine';
import { Suspense } from 'react';

import { ReviewTestRunner } from '@/components/ai/review-test-runner';
import { requireAdmin } from '@/lib/auth';

export default function ReviewTestPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję scenariusze…</p>}>
      <ReviewTest />
    </Suspense>
  );
}

async function ReviewTest() {
  await requireAdmin();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Test ocen treningów</h1>
        <p className="max-w-3xl text-sm text-text-muted">
          Sztuczne biegi (idealne, trochę inne, zupełnie inne) przechodzą przez reguły oceny i przez prawdziwy prompt notki
          trenera. Nic nie zapisuje się użytkownikom – zostaje tylko log wywołań AI. Werdykt i fakty sprawdzają się same;
          notki trzeba przeczytać: flagi wyłapują tylko oczywiste błędy.
        </p>
      </div>
      <ReviewTestRunner
        models={AI_MODELS.map((m) => ({ id: m.id, label: m.label }))}
        scenarios={REVIEW_SCENARIOS.map((s) => ({ id: s.id, label: s.label, workout: s.workout, expect: s.expect }))} />
    </>
  );
}
