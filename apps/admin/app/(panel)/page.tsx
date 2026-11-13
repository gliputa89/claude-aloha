import Link from 'next/link';
import { Suspense } from 'react';

import { getAiCostSummary } from '@/lib/ai/data';
import { requireAdmin } from '@/lib/auth';
import { formatUsd } from '@/lib/format';

// Pulpit: punkt wejścia do sekcji panelu (te same sekcje co w pasku nawigacji) i KPI produktu.
// Dane produktowe pojawią się po podłączeniu schematów marketing / analytics – na razie puste.
const kpis = [
  { label: 'Zapisy na listę', value: '–' },
  { label: 'Aktywni (7 dni)', value: '–' },
  { label: 'Retencja po 4 tyg.', value: '–' },
  { label: 'Check-iny w dni treningowe', value: '–' },
  { label: 'Akceptacja propozycji', value: '–' },
];

const sections = [
  {
    href: '/tester',
    title: 'Tester planów',
    description: 'Konta testowe, ankieta, dokładne wejście silnika, generowanie i usuwanie dowolnego tygodnia.',
  },
  {
    href: '/ai',
    title: 'AI: koszty, wywołania, prompty, ramy planu',
    description: 'Każde wywołanie Claude z wejściem, odpowiedzią i kosztem; prompty i parametry silnika w wersjach.',
  },
  {
    href: '/coaches',
    title: 'Trenerzy i rozmowy',
    description: 'Trenerzy widoczni w aplikacji, pakiety użytkowników i rozmowy z prawdziwym trenerem.',
  },
  {
    href: '/jak-dziala',
    title: 'Jak to działa',
    description: 'Opis całego systemu dla trenera: skąd biorą się treningi i co da się zmienić bez programisty.',
  },
];

async function AiCostKpi() {
  await requireAdmin();
  const summary = await getAiCostSummary(false).catch(() => null);
  return (
    <Link href="/ai" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 hover:border-action">
      <span className="text-sm text-text-muted">Koszt AI (miesiąc, bez kont testowych)</span>
      <span className="font-display text-3xl font-semibold">{summary ? formatUsd(summary.month) : '–'}</span>
      {summary ? (
        <span className="text-xs text-text-muted">
          {summary.month_calls} wywołań · {summary.month_users} użytk.
        </span>
      ) : null}
    </Link>
  );
}

export default function Dashboard() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">Aloha Training</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Pulpit</h1>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col gap-1 rounded-card border border-border bg-surface p-5 hover:border-action"
          >
            <span className="font-display text-lg font-semibold">{s.title} →</span>
            <span className="text-sm text-text-muted">{s.description}</span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Liczby produktu</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
              <span className="text-sm text-text-muted">{kpi.label}</span>
              <span className="font-display text-3xl font-semibold">{kpi.value}</span>
            </div>
          ))}
          <Suspense
            fallback={<div className="rounded-card border border-border bg-surface p-5 text-sm text-text-muted">Koszt AI…</div>}
          >
            <AiCostKpi />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
