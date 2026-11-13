'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { runChatTest, type ChatTestResult } from '@/app/(panel)/ai/chat-test/actions';

const field = 'rounded-button border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-action';

/** Id użytkownika + model → tabela: wiadomość biegacza, odpowiedź trenera, propozycja (i czy przeszła reguły), flagi. */
export function ChatTestRunner({ models }: { models: { id: string; label: string }[] }) {
  const [userId, setUserId] = useState('');
  const [model, setModel] = useState('');
  const [result, setResult] = useState<ChatTestResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setResult(await runChatTest(userId.trim(), [], model || null)));
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-text-muted">
          Id użytkownika z planem (z testera planów)
          <input name="userId" value={userId} onChange={(e) => setUserId(e.target.value)} required className={`${field} font-mono`} placeholder="00000000-0000-…" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Model
          <select value={model} onChange={(e) => setModel(e.target.value)} className={field}>
            <option value="">z aktywnego promptu</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-button bg-action px-3 py-2 text-sm font-semibold text-text-on-brand hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Rozmawiam…' : 'Uruchom scenariusze'}
        </button>
      </form>

      {result && !result.ok ? (
        <p role="status" className="rounded-md bg-surface-accent-soft px-3 py-2 text-sm text-text-accent-strong">
          {result.message}
        </p>
      ) : null}

      {result?.ok ? (
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
          <h2 className="font-semibold">
            Wynik: bez flag {result.rows.filter((r) => r.flags.length === 0).length}/{result.rows.length}
            <span className="font-normal text-text-muted">
              {' '}
              · {result.model} · dziś {result.today}
            </span>
          </h2>
          <div className="flex flex-col divide-y divide-border">
            {result.rows.map((r) => (
              <article key={r.id} data-scenario={r.id} className="flex flex-col gap-2 py-4 text-sm">
                <h3 className="font-semibold">
                  „{r.text}” <span className="font-normal text-text-muted">· {r.note}{r.focus ? ` · ${r.focus}` : ''}</span>
                </h3>
                {r.reply ? <p>{r.reply}</p> : <p className="text-text-accent-strong">Brak odpowiedzi.</p>}
                {r.change ? (
                  <p className="font-mono text-xs text-text-muted">
                    {r.changeOk ? '✓' : '✗'} {r.change.op} {r.change.date}
                    {r.change.toDate ? ` → ${r.change.toDate}` : ''}
                    {r.change.type ? ` · ${r.change.type}` : ''}
                    {r.change.durationMin ? ` · ${r.change.durationMin} min` : ''} · „{r.change.summary}”
                    {r.changeReason ? ` · odrzucona: ${r.changeReason}` : ''}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {r.reply ? <span className="text-text-muted">{r.reply.length} znaków</span> : null}
                  {r.flags.map((f) => (
                    <span key={f} className="rounded-pill bg-surface-accent-soft px-2 py-0.5 font-semibold text-text-accent-strong">
                      {f}
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
