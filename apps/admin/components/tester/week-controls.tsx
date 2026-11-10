'use client';

import { useState, useTransition } from 'react';

import { deleteWeek, generateWeek, type ActionResult } from '@/app/tester/actions';

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
      {result.message}
    </span>
  );
}

const buttonBase =
  'rounded-button px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

/** Generuje dowolny tydzień (numeracja od 1 w UI, od 0 w silniku). Istniejący tydzień o tym numerze jest podmieniany. */
export function GenerateWeekForm({ userId, defaultWeek }: { userId: string; defaultWeek: number }) {
  const [week, setWeek] = useState(String(defaultWeek));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(week);
        start(async () => setResult(await generateWeek(userId, n - 1)));
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        Tydzień
        <input
          type="number"
          min={1}
          max={105}
          required
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="w-20 rounded-button border border-border-strong bg-surface px-3 py-2 outline-none focus:border-action"
        />
      </label>
      <button type="submit" disabled={pending} className={`${buttonBase} bg-action text-text-on-brand hover:bg-action-hover`}>
        {pending ? 'Generuję…' : 'Generuj tydzień'}
      </button>
      <Feedback result={result} />
    </form>
  );
}

type Pending = 'regenerate' | 'delete' | null;

/** Akcje tygodnia z potwierdzeniem na stronie (bez window.confirm – w części przeglądarek jest blokowane). */
export function WeekActions({
  userId,
  weekId,
  weekIndex,
  touchedSessions,
  canGenerate,
}: {
  userId: string;
  weekId: string;
  weekIndex: number;
  touchedSessions: number;
  canGenerate: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [pending, start] = useTransition();

  const run = (kind: Exclude<Pending, null>) => {
    setConfirming(null);
    start(async () =>
      setResult(kind === 'delete' ? await deleteWeek(userId, weekId) : await generateWeek(userId, weekIndex)),
    );
  };

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-accent-soft px-3 py-2">
        <span className="text-sm text-text-accent-strong">
          {confirming === 'delete'
            ? `Usunąć tydzień ${weekIndex + 1}?`
            : `Zastąpić treningi tygodnia ${weekIndex + 1}?`}
          {touchedSessions ? ` ${touchedSessions} z realizacją – zostanie utracona.` : ''}
        </span>
        <button
          type="button"
          autoFocus
          onClick={() => run(confirming)}
          className={`${buttonBase} ${confirming === 'delete' ? 'bg-workout-tempo text-white' : 'bg-action text-text-on-brand hover:bg-action-hover'}`}
        >
          {confirming === 'delete' ? 'Tak, usuń' : 'Tak, generuj'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(null)}
          className={`${buttonBase} border border-border-strong hover:bg-background`}
        >
          Anuluj
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Feedback result={result} />
      {canGenerate ? (
        <button
          type="button"
          disabled={pending}
          className={`${buttonBase} border border-border-strong hover:bg-background`}
          onClick={() => setConfirming('regenerate')}
        >
          {pending ? 'Pracuję…' : 'Generuj ponownie'}
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        className={`${buttonBase} border border-border-strong text-workout-tempo hover:bg-background`}
        onClick={() => setConfirming('delete')}
      >
        Usuń
      </button>
    </div>
  );
}
