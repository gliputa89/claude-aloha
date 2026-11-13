'use client';

import { TRAINING_LEVEL_INFO, TRAINING_LEVELS } from '@aloha/plan-engine';
import { useState, useTransition } from 'react';

import type { ActionResult } from '@/app/(panel)/tester/actions';
import { generateNextWeekWithReview, setTrainingLevel } from '@/app/(panel)/tester/level-actions';

const button = 'rounded-button px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const field = 'rounded-button border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-action';

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
      {result.message}
    </span>
  );
}

/** Ręczna zmiana poziomu (wpis w historii jako „panel”). */
export function SetLevelForm({ userId, current }: { userId: string; current: number }) {
  const [level, setLevel] = useState(String(current));
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await setTrainingLevel(userId, Number(level), reason)));
      }}
    >
      <label className="sr-only" htmlFor="level-select">
        Nowy poziom
      </label>
      <select id="level-select" className={field} value={level} onChange={(e) => setLevel(e.target.value)}>
        {TRAINING_LEVELS.map((l) => (
          <option key={l} value={l}>
            {l} · {TRAINING_LEVEL_INFO[l].label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="level-reason">
        Powód
      </label>
      <input
        id="level-reason"
        className={`${field} min-w-0 flex-1`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="powód (do historii)"
        maxLength={400}
      />
      <button type="submit" disabled={pending} className={`${button} border border-border-strong bg-surface hover:bg-background`}>
        {pending ? 'Zapisuję…' : 'Ustaw poziom'}
      </button>
      <Feedback result={result} />
    </form>
  );
}

/** Jak cotygodniowy cron: przegląd poziomu + kolejny tydzień silnikiem reguł (bez AI). */
export function NextWeekWithReviewButton({ userId }: { userId: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await generateNextWeekWithReview(userId)))}
        className={`${button} bg-action text-text-on-brand hover:bg-action-hover`}
      >
        {pending ? 'Układam z AI…' : 'Kolejny tydzień: przegląd poziomu + AI'}
      </button>
      <Feedback result={result} />
    </div>
  );
}
