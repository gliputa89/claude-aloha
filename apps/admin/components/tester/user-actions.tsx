'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteUser, regeneratePlan, type SurveyResult } from '@/app/tester/survey-actions';

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
  const question = hasPlan ? 'Zarchiwizować obecny plan i ułożyć 2 tygodnie od nowa' : 'Ułożyć plan jak po ankiecie';
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ConfirmButton
        label="Plan od nowa z AI (jak w aplikacji)"
        question={`${question} – silnik + Claude (płatne wywołanie)?`}
        confirmLabel="Tak, ułóż z AI"
        onConfirm={() => regeneratePlan(userId, true)}
      />
      <ConfirmButton
        label="Plan od nowa – sam silnik"
        question={`${question} – sam silnik reguł?`}
        confirmLabel="Tak, ułóż"
        onConfirm={() => regeneratePlan(userId, false)}
      />
    </div>
  );
}

/**
 * Twarde usunięcie użytkownika. Konto testowe – potwierdzenie na stronie; prawdziwe – trzeba wpisać jego e-mail.
 */
export function DeleteUserButton({ userId, email, isTest }: { userId: string; email: string | null; isTest: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [pending, start] = useTransition();
  const expected = email ?? userId;

  if (isTest) {
    return (
      <ConfirmButton
        label="Usuń konto testowe"
        question="Usunąć konto testowe ze wszystkimi danymi?"
        confirmLabel="Tak, usuń"
        danger
        onConfirm={async () => {
          const r = await deleteUser(userId);
          if (r.ok) router.push('/tester');
          return r;
        }}
      />
    );
  }

  const submit = () =>
    start(async () => {
      const r = await deleteUser(userId, typed);
      setResult(r);
      if (r.ok) router.push('/tester');
    });

  if (asking) {
    return (
      <form
        className="flex max-w-md flex-col gap-2 rounded-md bg-surface-accent-soft p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <p className="text-sm text-text-accent-strong">
          Usuwa na stałe: konto i logowanie, ankietę, plan, kalendarz, treningi, check-iny, historię poziomu i wywołania AI. Nie da się
          tego cofnąć.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Wpisz <b className="break-all">{expected}</b>, żeby potwierdzić:
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="rounded-button border border-border-strong bg-surface px-3 py-2 outline-none focus:border-action"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending || typed.trim().toLowerCase() !== expected.toLowerCase()}
            className={`${button} bg-workout-tempo text-white`}
          >
            {pending ? 'Usuwam…' : 'Usuń na stałe'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAsking(false);
              setTyped('');
            }}
            className={`${button} border border-border-strong hover:bg-background`}
          >
            Anuluj
          </button>
          {result ? (
            <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
              {result.message}
            </span>
          ) : null}
        </div>
      </form>
    );
  }
  return (
    <button type="button" onClick={() => setAsking(true)} className={`${button} border border-border-strong text-workout-tempo hover:bg-background`}>
      Usuń użytkownika
    </button>
  );
}
