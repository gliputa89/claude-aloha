'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { archivePlan, deleteUser, regeneratePlan, resetUser, type SurveyResult } from '@/app/(panel)/tester/survey-actions';
import { usePlanRegen } from '@/components/tester/plan-regen';

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

/** Licznik sekund od startu – przy układaniu kilku tygodni widać, że to trwa, a nie że coś zawisło. */
function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`}</span>;
}

/**
 * Cały plan od nowa, jak po ankiecie w aplikacji. Po potwierdzeniu najpierw archiwizujemy stary plan
 * (znika z ekranu od razu), potem układamy nowy – układanie kilku tygodni to kilka wywołań modelu i trwa,
 * więc przez ten czas widać loader, a nie nieaktualny plan.
 */
export function RegeneratePlanButton({ userId, hasPlan, maxWeeks }: { userId: string; hasPlan: boolean; maxWeeks: number }) {
  const router = useRouter();
  const { setBusy } = usePlanRegen();
  const [weeks, setWeeks] = useState(2);
  const [asking, setAsking] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [pending, start] = useTransition();
  const span = weeks === 1 ? '1 tydzień' : weeks <= 4 ? `${weeks} tygodnie` : `${weeks} tygodni`;
  const question = hasPlan ? `Wyrzucić obecny plan i ułożyć ${span} od nowa` : `Ułożyć ${span} planu jak po ankiecie`;
  // Jak aplikacja w czasie: 2 tygodnie po ankiecie w jednym wywołaniu, każdy kolejny tydzień osobno.
  const calls = Math.max(1, weeks - 1);
  const cost = calls === 1 ? 'płatne wywołanie' : `${calls} płatnych wywołań, ok. ${Math.ceil(calls / 2)} min`;

  // Archiwizacja celowo poza `startTransition`: w trakcie przejścia React trzyma stary ekran, więc plan zniknąłby
  // dopiero po ułożeniu nowego. Tak znika od razu po potwierdzeniu, a dopiero potem rusza (długie) układanie.
  const run = async () => {
    setAsking(false);
    setResult(null);
    setArchiving(true);
    // Tygodnie znikają z ekranu już teraz – na serwerze stary plan za chwilę trafi do archiwum.
    setBusy(true);
    const archived = await archivePlan(userId);
    setArchiving(false);
    if (!archived.ok) {
      setBusy(false);
      setResult(archived);
      return;
    }
    start(async () => {
      const done = await regeneratePlan(userId, true, weeks);
      setResult(done);
      setBusy(false);
      router.refresh();
    });
  };

  if (archiving || pending) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-card border border-action bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">{archiving ? 'Wyrzucam stary plan…' : `Układam ${span} od nowa…`}</span>
          <span className="text-text-muted">
            <Elapsed /> · {calls === 1 ? '1 wywołanie' : `${calls} wywołania`} modelu
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-background" role="progressbar" aria-label="Układanie planu">
          <div className="h-full w-1/3 animate-pulse rounded-pill bg-action" />
        </div>
        <p className="text-xs text-text-muted">
          {archiving ? 'Stary plan trafia do archiwum.' : 'Stary plan jest już zarchiwizowany.'} Każdy tydzień przechodzi tę
          samą drogę co u użytkownika: szkic silnika → Claude → walidacja silnika → zapis. Nie zamykaj strony.
        </p>
      </div>
    );
  }

  if (asking) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-accent-soft px-3 py-2">
        <span className="text-sm text-text-accent-strong">{`${question} – silnik + Claude (${cost})?`}</span>
        <button
          type="button"
          autoFocus
          onClick={run}
          className={`${button} bg-action text-text-on-brand hover:bg-action-hover`}
        >
          Tak, ułóż z AI
        </button>
        <button type="button" onClick={() => setAsking(false)} className={`${button} border border-border-strong hover:bg-background`}>
          Anuluj
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {result ? (
        <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
          {result.message}
        </span>
      ) : null}
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
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={`${button} border border-border-strong hover:bg-background`}
      >
        Cały plan od nowa (jak w aplikacji)
      </button>
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
