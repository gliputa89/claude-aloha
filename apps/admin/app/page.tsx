import Link from "next/link";
import { Suspense } from "react";

import { getAiCostSummary } from "@/lib/ai/data";
import { requireAdmin } from "@/lib/auth";
import { formatUsd } from "@/lib/format";

// Tymczasowy dashboard – dane pojawią się po podłączeniu Supabase (schematy marketing / analytics).
const kpis = [
  { label: "Zapisy na listę", value: "–" },
  { label: "Aktywni (7 dni)", value: "–" },
  { label: "Retencja po 4 tyg.", value: "–" },
  { label: "Check-iny w dni treningowe", value: "–" },
  { label: "Akceptacja propozycji", value: "–" },
];

async function AiCostKpi() {
  await requireAdmin();
  const summary = await getAiCostSummary(false).catch(() => null);
  return (
    <Link href="/ai" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 hover:border-action">
      <span className="text-sm text-text-muted">Koszt AI (miesiąc, bez kont testowych)</span>
      <span className="font-display text-3xl font-semibold">{summary ? formatUsd(summary.month) : "–"}</span>
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
        <h1 className="font-display text-3xl font-semibold tracking-tight">Panel</h1>
      </header>
      <Link href="/coaches" className="self-start rounded-button border border-border-strong bg-surface px-3 py-2 text-sm font-semibold hover:bg-background">
        Trenerzy i rozmowy →
      </Link>
      <Link
        href="/tester"
        className="flex flex-col gap-1 rounded-card border border-action bg-surface-brand-soft p-5 hover:bg-surface"
      >
        <span className="font-display text-xl font-semibold text-text-brand">Tester planów →</span>
        <span className="text-sm text-text-muted">
          Podgląd użytkownika i ankiety, generowanie i usuwanie dowolnego tygodnia treningów.
        </span>
      </Link>
      <Link
        href="/ai"
        className="flex flex-col gap-1 rounded-card border border-border bg-surface p-5 hover:border-action"
      >
        <span className="font-display text-xl font-semibold">AI: koszty, wywołania, prompty, ramy planu →</span>
        <span className="text-sm text-text-muted">
          Każde wywołanie Claude z wejściem, odpowiedzią i kosztem; koszt na użytkownika; edycja promptów i parametrów silnika w wersjach.
        </span>
      </Link>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
            <span className="text-sm text-text-muted">{kpi.label}</span>
            <span className="font-display text-3xl font-semibold">{kpi.value}</span>
          </div>
        ))}
        <Suspense fallback={<div className="rounded-card border border-border bg-surface p-5 text-sm text-text-muted">Koszt AI…</div>}>
          <AiCostKpi />
        </Suspense>
      </section>
    </main>
  );
}
