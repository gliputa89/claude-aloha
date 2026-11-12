'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteUser, regeneratePlan, resetUser, type SurveyResult } from '@/app/tester/survey-actions';

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
          className={`${button} ${danger ? 'bg-danger text-white' : 'bg-action text-text-on-brand hover:bg-action-hover'}`}
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
        className={`${button} border border-border-strong hover:bg-background ${danger ? 'text-danger' : ''}`}
      >
        {pending ? 'Pracuję…' : label}
      </button>
    </div>
  );
}

export function RegeneratePlanButton({ userId, hasPlan, maxWeeks }: { userId: string; hasPlan: boolean; maxWeeks: number }) {
  const [weeks, setWeeks] = useState(2);
  const span = weeks === 1 ? '1 tydzień' : weeks <= 4 ? `${weeks} tygodnie` : `${weeks} tygodni`;
  const question = hasPlan ? `Zarchiwizować obecny plan i ułożyć ${span} od nowa` : `Ułożyć ${span} planu jak po ankiecie`;
  // Jak aplikacja w czasie: 2 tygodnie po ankiecie w jednym wywołaniu, każdy kolejny tydzień osobno.
  const calls = Math.max(1, weeks - 1);
  const cost = calls === 1 ? 'płatne wywołanie' : `${calls} płatnych wywołań, ok. ${Math.ceil(calls / 2)} min`;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="flex items-center gap-2 text-sm text-text-muted">
        Tygodni
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="rounded-button border border-border-strong bg-surface px-2 py-2 text-sm text-text outline-none focus:border-action"
        >
          {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <ConfirmButton
        label="Plan od nowa z AI (jak w aplikacji)"
        question={`${question} – silnik + Claude (${cost})?`}
        confirmLabel="Tak, ułóż z AI"
        onConfirm={() => regeneratePlan(userId, true, weeks)}
      />
      <ConfirmButton
        label="Plan od nowa – sam silnik"
        question={`${question} – sam silnik reguł?`}
        confirmLabel="Tak, ułóż"
        onConfirm={() => regeneratePlan(userId, false, weeks)}
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
          Tak samo jak „Usuń konto” w aplikacji: cofa dostęp Stravy i Apple, potem usuwa na stałe konto i logowanie, ankietę, plan,
          treningi, check-iny, rozmowy, biegi ze Stravy, historię poziomu i wywołania AI. Zostaje tylko zapis o usunięciu (e-mail i
          data). Nie da się tego cofnąć.
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
            className={`${button} bg-danger text-white`}
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
    <button type="button" onClick={() => setAsking(true)} className={`${button} border border-border-strong text-danger hover:bg-background`}>
      Usuń użytkownika
    </button>
  );
}

/**
 * Reset do stanu po rejestracji (ankieta od nowa) – zostaje konto i połączenie ze Stravą.
 * Konto testowe – potwierdzenie na stronie; prawdziwe – trzeba wpisać jego e-mail.
 */
export function ResetUserButton({ userId, email, isTest }: { userId: string; email: string | null; isTest: boolean }) {
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [pending, start] = useTransition();
  const expected = email ?? userId;

  if (isTest) {
    return (
      <ConfirmButton
        label="Wyczyść dane (zostaw Stravę)"
        question="Usunąć ankietę, plan, treningi i rozmowy? Konto i Strava zostają."
        confirmLabel="Tak, wyczyść"
        danger
        onConfirm={() => resetUser(userId)}
      />
    );
  }

  const status = result ? (
    <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
      {result.message}
    </span>
  ) : null;

  if (asking) {
    return (
      <form
        className="flex max-w-md flex-col gap-2 rounded-md bg-surface-accent-soft p-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await resetUser(userId, typed);
            setResult(r);
            if (r.ok) {
              setAsking(false);
              setTyped('');
            }
          });
        }}
      >
        <p className="text-sm text-text-accent-strong">
          Usuwa na stałe: ankietę, plan, kalendarz, treningi, check-iny, rozmowy z trenerem, historię poziomu, pobrane biegi i
          wywołania AI. Zostają: konto, logowanie i połączenie ze Stravą. Aplikacja pokaże ankietę od nowa.
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
            className={`${button} bg-danger text-white`}
          >
            {pending ? 'Czyszczę…' : 'Wyczyść dane'}
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
          {status}
        </div>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status}
      <button type="button" onClick={() => setAsking(true)} className={`${button} border border-border-strong text-danger hover:bg-background`}>
        Wyczyść dane (zostaw Stravę)
      </button>
    </div>
  );
}
