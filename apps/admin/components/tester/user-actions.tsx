'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteTestUser, regeneratePlan, type SurveyResult } from '@/app/tester/survey-actions';

const button = 'rounded-button px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60';

/** Przycisk z potwierdzeniem na stronie (window.confirm bywa blokowane). */
function ConfirmButton({
  label,
  question,
  confirmLabel,
  danger,
  onConfirm,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<SurveyResult>;
}) {
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [pending, start] = useTransition();

  if (asking) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-accent-soft px-3 py-2">
        <span className="text-sm text-text-accent-strong">{question}</span>
        <button
          type="button"
          autoFocus
          onClick={() => {
            setAsking(false);
            start(async () => setResult(await onConfirm()));
          }}
          className={`${button} ${danger ? 'bg-workout-tempo text-white' : 'bg-action text-text-on-brand hover:bg-action-hover'}`}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setAsking(false)} className={`${button} border border-border-strong hover:bg-background`}>
          Anuluj
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {result ? (
        <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
          {result.message}
        </span>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(true)}
        className={`${button} border border-border-strong hover:bg-background ${danger ? 'text-workout-tempo' : ''}`}
      >
        {pending ? 'Pracuję…' : label}
      </button>
    </div>
  );
}

export function RegeneratePlanButton({ userId, hasPlan }: { userId: string; hasPlan: boolean }) {
  return (
    <ConfirmButton
      label="Plan od nowa (jak po ankiecie)"
      question={hasPlan ? 'Zarchiwizować obecny plan i ułożyć 2 tygodnie od nowa?' : 'Ułożyć plan jak po ankiecie?'}
      confirmLabel="Tak, ułóż"
      onConfirm={() => regeneratePlan(userId)}
    />
  );
}

export function DeleteTestUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Usuń konto testowe"
      question="Usunąć konto testowe ze wszystkimi danymi?"
      confirmLabel="Tak, usuń"
      danger
      onConfirm={async () => {
        const r = await deleteTestUser(userId);
        if (r.ok) router.push('/tester');
        return r;
      }}
    />
  );
}
