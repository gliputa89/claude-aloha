'use client';

import { useState, useTransition } from 'react';

import type { ActionResult } from '@/app/(panel)/tester/actions';
import { clearSimulatedRun, simulateSessionRun } from '@/app/(panel)/tester/run-actions';
import { RUN_VARIANTS, RUN_VARIANT_INFO, type RunVariant } from '@/lib/run-sim';

// Symulacja wykonanego treningu: wybierasz, jak biegaczowi poszło i z którego źródła „przyszedł” bieg,
// a panel wstawia go w kształcie tego źródła i puszcza normalną ścieżką: ocena z reguł + notka trenera od AI.

const SOURCES = [
  { id: 'strava', label: 'Strava' },
  { id: 'apple_health', label: 'Apple Zdrowie' },
] as const;

const button =
  'rounded-button px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const select = 'rounded-button border border-border-strong bg-surface px-2 py-1.5 text-sm outline-none focus:border-action';

export function SimulateRun({
  userId,
  sessionId,
  simulated,
  hasKey,
}: {
  userId: string;
  sessionId: string;
  /** Trening ma już wstawiony symulowany bieg – wtedy można go tylko powtórzyć albo cofnąć. */
  simulated: boolean;
  hasKey: boolean;
}) {
  const [variant, setVariant] = useState<RunVariant>('ok');
  const [source, setSource] = useState<'strava' | 'apple_health'>('strava');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-1.5 pl-[4.25rem] text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-muted">Zasymuluj wykonanie:</span>
        <label className="sr-only" htmlFor={`variant-${sessionId}`}>
          Jak poszło
        </label>
        <select
          id={`variant-${sessionId}`}
          value={variant}
          onChange={(e) => setVariant(e.target.value as RunVariant)}
          className={select}
        >
          {RUN_VARIANTS.map((v) => (
            <option key={v} value={v}>
              {RUN_VARIANT_INFO[v].label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`source-${sessionId}`}>
          Źródło biegu
        </label>
        <select
          id={`source-${sessionId}`}
          value={source}
          onChange={(e) => setSource(e.target.value as 'strava' | 'apple_health')}
          className={select}
        >
          {SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          title={hasKey ? undefined : 'Brak ANTHROPIC_API_KEY – powstanie ocena z reguł, bez notki trenera'}
          onClick={() => start(async () => setResult(await simulateSessionRun(userId, sessionId, variant, source)))}
          className={`${button} bg-action text-text-on-brand hover:bg-action-hover`}
        >
          {pending ? 'Liczę bieg i ocenę…' : simulated ? 'Powtórz z tym wariantem' : 'Zasymuluj bieg'}
        </button>
        {simulated ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setResult(await clearSimulatedRun(userId, sessionId)))}
            className={`${button} border border-border-strong text-danger hover:bg-background`}
          >
            Cofnij
          </button>
        ) : null}
      </div>
      <p className="text-xs text-text-muted">{RUN_VARIANT_INFO[variant].detail}</p>
      {result ? (
        <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
