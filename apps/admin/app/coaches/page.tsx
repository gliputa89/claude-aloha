import { MODULES, PACKAGES } from '@aloha/plan-engine';
import Link from 'next/link';
import { Suspense } from 'react';

import { addCoach, replyAsCoach, setCoachActive, setUserPackage } from '@/app/coaches/actions';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

const field = 'rounded-button border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-action';
const primary = 'rounded-button bg-action px-3 py-2 text-sm font-semibold text-text-on-brand hover:bg-action-hover';
const secondary = 'rounded-button border border-border-strong bg-surface px-3 py-2 text-sm font-semibold hover:bg-background';
const card = 'flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-5';

export default function CoachesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Trenerzy i rozmowy</h1>
          <p className="max-w-3xl text-sm text-text-muted">
            Trenerzy widoczni w aplikacji i rozmowy biegaczy z prawdziwym trenerem. Za Pana Aloha odpowiada model – jego rozmowy
            widać w AI → Wywołania (funkcja coach-chat).
          </p>
        </div>
        <Link href="/" className="text-sm text-text-muted hover:text-text">
          ← Panel
        </Link>
      </header>
      <Suspense fallback={<p className="text-text-muted">Wczytuję…</p>}>
        <Coaches />
      </Suspense>
    </main>
  );
}

type Message = { id: number; sender: string; body: string; created_at: string };

async function Coaches() {
  await requireAdmin();
  const db = createServiceClient();
  const [coaches, threads] = await Promise.all([
    db.from('coaches').select('id, kind, display_name, title, bio, active, coach_assignments(count)').order('kind').order('created_at'),
    db
      .from('chat_threads')
      .select('id, user_id, session_id, last_message_at, coaches!inner(kind, display_name), chat_messages(id, sender, body, created_at)')
      .eq('coaches.kind', 'human')
      .not('last_message_at', 'is', null)
      .order('last_message_at', { ascending: false })
      .limit(30),
  ]);
  const users = new Map<string, string>();
  for (const id of new Set((threads.data ?? []).map((t) => t.user_id as string))) {
    const { data } = await db.auth.admin.getUserById(id);
    users.set(id, data.user?.email ?? id);
  }
  const when = (iso: string) => new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <section className={card}>
        <h2 className="font-semibold">Trenerzy</h2>
        {coaches.error ? <p className="text-sm text-text-accent-strong">Nie udało się wczytać trenerów (czy migracja czatu jest wgrana?).</p> : null}
        <ul className="flex flex-col divide-y divide-border">
          {(coaches.data ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold">
                  {c.display_name} <span className="font-normal text-text-muted">· {c.kind === 'ai' ? 'AI' : 'człowiek'}{c.active ? '' : ' · wyłączony'}</span>
                </span>
                <span className="text-text-muted">{[c.title, c.bio].filter(Boolean).join(' – ') || 'bez opisu'}</span>
                {c.kind === 'human' ? (
                  <span className="text-xs text-text-muted">biegaczy: {(c.coach_assignments as unknown as { count: number }[])[0]?.count ?? 0}</span>
                ) : null}
              </div>
              {c.kind === 'human' ? (
                <form action={setCoachActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={String(!c.active)} />
                  <button type="submit" className={secondary}>
                    {c.active ? 'Wyłącz' : 'Włącz'}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <form action={addCoach} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Imię i nazwisko
            <input name="name" required maxLength={80} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Tytuł (np. trener biegania)
            <input name="title" maxLength={120} className={field} />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-text-muted">
            Opis dla biegacza
            <input name="bio" maxLength={1000} className={field} />
          </label>
          <button type="submit" className={primary}>
            Dodaj trenera
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Pakiet biegacza</h2>
        <p className="text-sm text-text-muted">
          „{MODULES.coach_human.label}” jest w pakietach: {(['free', 'trial', 'paid'] as const).filter((p) => PACKAGES[p].includes('coach_human')).join(', ')}.
          Id użytkownika znajdziesz w testerze planów.
        </p>
        <form action={setUserPackage} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-text-muted">
            Id użytkownika
            <input name="userId" required className={`${field} font-mono`} placeholder="00000000-0000-…" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Pakiet
            <select name="status" className={field} defaultValue="paid">
              <option value="free">free</option>
              <option value="trial">trial</option>
              <option value="paid">paid</option>
            </select>
          </label>
          <button type="submit" className={secondary}>
            Ustaw pakiet
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Rozmowy z prawdziwym trenerem</h2>
        {(threads.data ?? []).length === 0 ? <p className="text-sm text-text-muted">Nikt jeszcze nie napisał do trenera.</p> : null}
        {(threads.data ?? []).map((t) => {
          const messages = [...((t.chat_messages ?? []) as Message[])].sort((a, b) => a.id - b.id).slice(-8);
          const waiting = messages.at(-1)?.sender === 'user';
          return (
            <article key={t.id} className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-semibold">{users.get(t.user_id as string)}</h3>
                <span className="text-text-muted">
                  → {(t.coaches as unknown as { display_name: string }).display_name} · {t.session_id ? 'przy treningu' : 'rozmowa ogólna'}
                </span>
                {waiting ? <span className="rounded-pill bg-surface-accent-soft px-2 py-0.5 text-xs font-semibold text-text-accent-strong">czeka na odpowiedź</span> : null}
              </div>
              <ul className="flex flex-col gap-1">
                {messages.map((m) => (
                  <li key={m.id} className={m.sender === 'user' ? '' : 'text-text-brand'}>
                    <span className="text-xs text-text-muted">{when(m.created_at)} · {m.sender === 'user' ? 'biegacz' : 'trener'}: </span>
                    {m.body}
                  </li>
                ))}
              </ul>
              <form action={replyAsCoach} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="threadId" value={t.id} />
                <label className="sr-only" htmlFor={`reply-${t.id}`}>
                  Odpowiedź trenera
                </label>
                <textarea id={`reply-${t.id}`} name="body" required maxLength={4000} rows={2} className={`${field} min-w-0 flex-1`} placeholder="Odpowiedź trenera…" />
                <button type="submit" className={primary}>
                  Wyślij
                </button>
              </form>
            </article>
          );
        })}
      </section>
    </>
  );
}
