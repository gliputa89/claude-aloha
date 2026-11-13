'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { runReviewTest, type ReviewTestResult } from '@/app/(panel)/ai/review-test/actions';

const VERDICT: Record<string, string> = {
  spot_on: 'W punkt',
  good: 'Dobra robota',
  passed_but: 'Zaliczone, ale…',
  different: 'Inny trening',
};
const FLAG: Record<string, string> = {
  too_long: 'za długa',
  gendered: 'forma zależna od płci',
  unknown_number: 'liczba spoza danych',
  contradiction: 'sprzeczna z oceną',
};

type Scenario = { id: string; label: string; workout: string; expect: string };

/** Wybór scenariuszy, uruchomienie i tabela wyników: werdykt z reguł obok oczekiwanego, fakty, notka i flagi. */
export function ReviewTestRunner({ scenarios, models }: { scenarios: Scenario[]; models: { id: string; label: string }[] }) {
  const [model, setModel] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ReviewTestResult | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const count = selected.length || scenarios.length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Scenariusze ({scenarios.length})</h2>
          <label className="ml-auto flex items-center gap-2 text-sm text-text-muted">
            Model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-button border border-border-strong bg-surface px-2 py-1.5 text-sm text-text"
            >
              <option value="">z aktywnego promptu</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setResult(await runReviewTest(selected, model || null)))}
            className="rounded-button bg-action px-3 py-2 text-sm font-semibold text-text-on-brand transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? `Liczę ${count} notek…` : `Uruchom ${selected.length ? `wybrane (${count})` : `wszystkie (${count})`}`}
          </button>
        </div>
        <ul className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
          {scenarios.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-1" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                <span>
                  {s.label} <span className="text-text-muted">→ {VERDICT[s.expect]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-muted">Bez zaznaczenia idą wszystkie. Jedna notka to ok. 2–5 s i ułamek centa.</p>
      </section>

      {result && !result.ok ? (
        <p role="status" className="rounded-md bg-surface-accent-soft px-3 py-2 text-sm text-text-accent-strong">
          {result.message}
        </p>
      ) : null}

      {result?.ok ? (
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
          <h2 className="font-semibold">
            Wynik: reguły {result.rows.filter((r) => r.rulesOk).length}/{result.rows.length}, notki bez flag{' '}
            {result.rows.filter((r) => r.note && r.flags.length === 0).length}/{result.rows.length}
            <span className="font-normal text-text-muted">
              {' '}
              · {result.model} · prompt {result.promptLabel}
            </span>
          </h2>
          <div className="flex flex-col divide-y divide-border">
            {result.rows.map((r) => (
              <article key={r.id} data-scenario={r.id} className="flex flex-col gap-2 py-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-semibold">{r.label}</h3>
                  <span className={r.rulesOk ? 'text-text-brand' : 'font-semibold text-text-accent-strong'}>
                    {r.rulesOk ? '✓' : '✗'} {VERDICT[r.review.verdict]}
                    {r.rulesOk ? '' : ` (oczekiwano: ${VERDICT[r.expect]})`}
                  </span>
                  <span className="text-text-muted">
                    objętość: {r.review.volume}
                    {r.review.intensity ? ` · intensywność: ${r.review.intensity}` : ''}
                  </span>
                </div>
                <p className="font-mono text-xs text-text-muted">
                  {r.review.facts.map((f) => `${f.code}${Object.keys(f.values).length ? ` ${JSON.stringify(f.values)}` : ''}`).join(' · ')}
                </p>
                {r.note ? <p>{r.note}</p> : <p className="text-text-accent-strong">Brak notki ({r.status}).</p>}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {r.note ? <span className="text-text-muted">{r.note.length} znaków</span> : null}
                  {r.flags.map((f) => (
                    <span key={f} className="rounded-pill bg-surface-accent-soft px-2 py-0.5 font-semibold text-text-accent-strong">
                      {FLAG[f]}
                    </span>
                  ))}
                  {r.callId ? (
                    <Link href={`/ai/calls/${r.callId}`} className="text-text-brand underline">
                      wywołanie #{r.callId}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
