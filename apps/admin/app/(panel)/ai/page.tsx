import Link from 'next/link';
import { Suspense } from 'react';

import { Card, Stat, TestBadge, TextLink } from '@/components/ai/ui';
import { getAiCostByUser, getAiCostSummary, type AiCostSummary } from '@/lib/ai/data';
import { requireAdmin } from '@/lib/auth';
import { AI_STATUS_LABEL, formatDateTime, formatShortDate, formatUsd } from '@/lib/format';

export default function AiCostsPage({ searchParams }: PageProps<'/ai'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję koszty…</p>}>
      <Costs searchParams={searchParams} />
    </Suspense>
  );
}

async function Costs({ searchParams }: Pick<PageProps<'/ai'>, 'searchParams'>) {
  await requireAdmin();
  const sp = await searchParams;
  const includeTest = sp.test !== '0';
  const [summary, users] = await Promise.all([getAiCostSummary(includeTest), getAiCostByUser(50)]);
  const shownUsers = includeTest ? users : users.filter((u) => !u.is_test);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Koszty AI</h1>
          <p className="text-sm text-text-muted">
            Z każdego wywołania Claude API: tokeny × cena modelu z chwili wywołania. Miesiąc = bieżący miesiąc kalendarzowy (UTC).
          </p>
        </div>
        <div className="flex gap-1 rounded-button border border-border bg-surface p-1 text-sm">
          <Link
            href="/ai"
            className={`rounded-button px-3 py-1 ${includeTest ? 'bg-surface-brand-soft font-semibold text-text-brand' : 'text-text-muted'}`}
          >
            Wszystko
          </Link>
          <Link
            href="/ai?test=0"
            className={`rounded-button px-3 py-1 ${!includeTest ? 'bg-surface-brand-soft font-semibold text-text-brand' : 'text-text-muted'}`}
          >
            Bez kont testowych
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Dziś" value={formatUsd(summary.today)} />
        <Stat label="Ostatnie 7 dni" value={formatUsd(summary.last7)} />
        <Stat
          label="Ten miesiąc"
          value={formatUsd(summary.month)}
          hint={`${summary.month_calls} wywołań · ${summary.month_users} użytk.`}
        />
        <Stat
          label="Średnio na użytkownika (miesiąc)"
          value={formatUsd(summary.month_users ? summary.month / summary.month_users : 0)}
          hint={`razem od początku: ${formatUsd(summary.total)}`}
        />
      </section>

      <Card title="Ostatnie 30 dni">
        <DayChart days={summary.by_day} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Model (miesiąc)">
          <BreakdownTable rows={summary.by_model.map((r) => ({ key: r.model, label: r.model, calls: r.calls, cost: r.cost_usd }))} />
        </Card>
        <Card title="Funkcja (miesiąc)">
          <BreakdownTable
            rows={summary.by_function.map((r) => ({
              key: r.function_name,
              label: r.function_name,
              calls: r.calls,
              cost: r.cost_usd,
              href: `/ai/calls?fn=${encodeURIComponent(r.function_name)}`,
            }))}
          />
        </Card>
        <Card title="Wynik walidacji (miesiąc)">
          <ul className="flex flex-col gap-1 text-sm">
            {Object.entries(summary.by_status).length ? (
              Object.entries(summary.by_status).map(([status, n]) => (
                <li key={status} className="flex justify-between gap-3">
                  <Link href={`/ai/calls?status=${status}`} className="hover:underline">
                    {AI_STATUS_LABEL[status] ?? status}
                  </Link>
                  <span className="font-semibold tabular-nums">{n}</span>
                </li>
              ))
            ) : (
              <li className="text-text-muted">Brak wywołań w tym miesiącu.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card title="Koszt na użytkownika" actions={<span className="text-xs text-text-muted">najdrożsi pierwsi · top 50</span>}>
        {shownUsers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs text-text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 font-medium">Użytkownik</th>
                  <th className="py-2 text-right font-medium">Wywołania</th>
                  <th className="py-2 text-right font-medium">Ten miesiąc</th>
                  <th className="py-2 text-right font-medium">Razem</th>
                  <th className="py-2 text-right font-medium">Ostatnio</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {shownUsers.map((u) => (
                  <tr key={u.user_id} className="border-b border-border last:border-b-0">
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <TextLink href={`/tester/${u.user_id}`}>{u.email ?? u.user_id.slice(0, 8)}</TextLink>
                        {u.is_test ? <TestBadge /> : null}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{u.calls}</td>
                    <td className="py-2 text-right tabular-nums">{formatUsd(u.month_cost_usd)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{formatUsd(u.cost_usd)}</td>
                    <td className="py-2 text-right text-text-muted">{formatDateTime(u.last_at)}</td>
                    <td className="py-2 text-right">
                      <TextLink href={`/ai/calls?user=${u.user_id}`}>wywołania →</TextLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Brak wywołań przypisanych do użytkowników.</p>
        )}
      </Card>
    </>
  );
}

function BreakdownTable({ rows }: { rows: { key: string; label: string; calls: number; cost: number; href?: string }[] }) {
  if (!rows.length) return <p className="text-sm text-text-muted">Brak wywołań w tym miesiącu.</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {rows.map((r) => (
        <li key={r.key} className="flex items-baseline justify-between gap-3">
          {r.href ? (
            <Link href={r.href} className="truncate hover:underline">
              {r.label}
            </Link>
          ) : (
            <span className="truncate">{r.label}</span>
          )}
          <span className="flex shrink-0 gap-3 tabular-nums">
            <span className="text-text-muted">{r.calls}×</span>
            <span className="font-semibold">{formatUsd(r.cost)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function DayChart({ days }: { days: AiCostSummary['by_day'] }) {
  const max = Math.max(...days.map((d) => Number(d.cost_usd)), 0);
  if (max === 0) return <p className="text-sm text-text-muted">Brak kosztów w ostatnich 30 dniach.</p>;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Koszt AI dzień po dniu, ostatnie 30 dni">
        {days.map((d) => {
          const v = Number(d.cost_usd);
          return (
            <div
              key={d.day}
              title={`${formatShortDate(d.day)}: ${formatUsd(v)} · ${d.calls} wyw.`}
              className="min-w-0 flex-1 rounded-t-sm bg-action/80 hover:bg-action"
              style={{ height: `${v > 0 ? Math.max(3, (v / max) * 100) : 0}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>{formatShortDate(days[0]?.day ?? '')}</span>
        <span>maks. {formatUsd(max)} / dzień</span>
        <span>{formatShortDate(days[days.length - 1]?.day ?? '')}</span>
      </div>
    </div>
  );
}
