import { AI_FUNCTIONS } from '@aloha/plan-engine';
import Link from 'next/link';
import { Suspense } from 'react';

import { Card, StatusBadge, TestBadge, TextLink } from '@/components/ai/ui';
import { CALLS_PAGE_SIZE, listAiCalls } from '@/lib/ai/data';
import { requireAdmin } from '@/lib/auth';
import { AI_STATUS_LABEL, formatDateTime, formatMs, formatTokens, formatUsd } from '@/lib/format';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

export default function AiCallsPage({ searchParams }: PageProps<'/ai/calls'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję wywołania…</p>}>
      <Calls searchParams={searchParams} />
    </Suspense>
  );
}

async function Calls({ searchParams }: Pick<PageProps<'/ai/calls'>, 'searchParams'>) {
  await requireAdmin();
  const sp = await searchParams;
  const user = one(sp.user);
  const filters = {
    userId: user && UUID.test(user) ? user : null,
    fn: one(sp.fn),
    status: one(sp.status),
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
  const list = await listAiCalls(filters);
  const pages = Math.max(1, Math.ceil(list.total / CALLS_PAGE_SIZE));
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { user: filters.userId, fn: filters.fn, status: filters.status, page: String(filters.page), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === 'page' && v === '1')) p.set(k, v);
    const s = p.toString();
    return s ? `/ai/calls?${s}` : '/ai/calls';
  };

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Wywołania AI</h1>
        <p className="text-sm text-text-muted">
          Każda próba osobno (ponowienie po walidacji to 2. próba). Kliknij wiersz, żeby zobaczyć wejście, odpowiedź modelu i walidację.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Funkcja</span>
          <select name="fn" defaultValue={filters.fn ?? ''} className="rounded-button border border-border-strong bg-surface px-3 py-2">
            <option value="">wszystkie</option>
            {Object.keys(AI_FUNCTIONS).map((fn) => (
              <option key={fn} value={fn}>
                {fn}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Walidacja</span>
          <select name="status" defaultValue={filters.status ?? ''} className="rounded-button border border-border-strong bg-surface px-3 py-2">
            <option value="">wszystkie</option>
            {Object.entries(AI_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[18rem] flex-1 flex-col gap-1">
          <span className="text-text-muted">Użytkownik (id)</span>
          <input
            name="user"
            defaultValue={filters.userId ?? ''}
            placeholder="uuid użytkownika"
            className="rounded-button border border-border-strong bg-surface px-3 py-2 font-mono text-xs"
          />
        </label>
        <button type="submit" className="rounded-button bg-action px-4 py-2 font-semibold text-text-on-brand hover:bg-action-hover">
          Filtruj
        </button>
        {filters.userId || filters.fn || filters.status ? (
          <Link href="/ai/calls" className="py-2 text-text-muted hover:text-text">
            Wyczyść
          </Link>
        ) : null}
      </form>

      <Card
        title={`${list.total} wywołań`}
        actions={<span className="text-sm text-text-muted">łączny koszt (filtr): <b className="text-text">{formatUsd(list.cost_usd)}</b></span>}
      >
        {list.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-left text-xs text-text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 font-medium">#</th>
                  <th className="py-2 font-medium">Kiedy</th>
                  <th className="py-2 font-medium">Użytkownik</th>
                  <th className="py-2 font-medium">Funkcja · źródło</th>
                  <th className="py-2 font-medium">Model</th>
                  <th className="py-2 font-medium">Wersje</th>
                  <th className="py-2 text-right font-medium" title="wejście / wyjście / z cache">Tokeny</th>
                  <th className="py-2 text-right font-medium">Koszt</th>
                  <th className="py-2 text-right font-medium">Czas</th>
                  <th className="py-2 pl-3 font-medium">Walidacja</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border align-top last:border-b-0 hover:bg-background">
                    <td className="py-2">
                      <TextLink href={`/ai/calls/${r.id}`}>{r.id}</TextLink>
                      {r.attempt > 1 ? <span className="ml-1 text-xs text-text-muted">próba {r.attempt}</span> : null}
                    </td>
                    <td className="py-2 whitespace-nowrap text-text-muted">{formatDateTime(r.created_at)}</td>
                    <td className="py-2">
                      {r.user_id ? (
                        <span className="flex items-center gap-1.5">
                          <Link href={qs({ user: r.user_id, page: '1' })} className="max-w-[14rem] truncate hover:underline">
                            {r.email ?? r.user_id.slice(0, 8)}
                          </Link>
                          {r.is_test ? <TestBadge /> : null}
                        </span>
                      ) : (
                        <span className="text-text-muted">konto usunięte</span>
                      )}
                    </td>
                    <td className="py-2">
                      {r.function_name}
                      {r.weeks ? <span className="text-text-muted"> · {r.weeks} tyg.</span> : null}
                      <span className="block text-xs text-text-muted">{r.source === 'tester' ? 'tester' : 'aplikacja'}</span>
                    </td>
                    <td className="py-2 text-xs">{r.model}</td>
                    <td className="py-2 text-xs text-text-muted whitespace-nowrap">
                      prompt {r.prompt_version ? `v${r.prompt_version}` : 'wbud.'}
                      <br />
                      ramy {r.engine_config_version ? `v${r.engine_config_version}` : 'wbud.'}
                    </td>
                    <td className="py-2 text-right text-xs tabular-nums whitespace-nowrap">
                      {formatTokens(r.input_tokens)} / {formatTokens(r.output_tokens)}
                      {r.cache_read_tokens ? <span className="block text-text-muted">cache {formatTokens(r.cache_read_tokens)}</span> : null}
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{formatUsd(r.cost_usd)}</td>
                    <td className="py-2 text-right text-text-muted tabular-nums">{formatMs(r.duration_ms)}</td>
                    <td className="py-2 pl-3">
                      <StatusBadge status={r.validation_status} />
                      {r.error ? <span className="mt-1 block max-w-[14rem] truncate text-xs text-workout-tempo" title={r.error}>{r.error}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Brak wywołań dla tego filtra.</p>
        )}
        {pages > 1 ? (
          <nav className="flex items-center justify-between text-sm" aria-label="Strony">
            {filters.page > 1 ? <TextLink href={qs({ page: String(filters.page - 1) })}>← nowsze</TextLink> : <span />}
            <span className="text-text-muted">
              strona {filters.page} z {pages}
            </span>
            {filters.page < pages ? <TextLink href={qs({ page: String(filters.page + 1) })}>starsze →</TextLink> : <span />}
          </nav>
        ) : null}
      </Card>
    </>
  );
}
