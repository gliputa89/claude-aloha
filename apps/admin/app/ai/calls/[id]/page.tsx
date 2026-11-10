import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Card, JsonBlock, StatusBadge, TestBadge, TextLink } from '@/components/ai/ui';
import { CoachTipList } from '@/components/ai/coach-tips';
import { OperationList, WeekCompare } from '@/components/ai/week-compare';
import { getAiCall, type AiCallDetail } from '@/lib/ai/data';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatDateTime, formatMs, formatTokens, formatUsd } from '@/lib/format';

export default function AiCallPage({ params }: PageProps<'/ai/calls/[id]'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję wywołanie…</p>}>
      <CallDetail params={params} />
    </Suspense>
  );
}

/** Tekst odpowiedzi modelu z surowej wiadomości (bloki text). */
function responseText(raw: unknown): string | null {
  const content = (raw as { content?: { type: string; text?: string }[] } | null)?.content;
  if (!Array.isArray(content)) return null;
  return content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') || null;
}

function prettyJson(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

async function CallDetail({ params }: Pick<PageProps<'/ai/calls/[id]'>, 'params'>) {
  const admin = await requireAdmin();
  const { id } = await params;
  const callId = Number(id);
  if (!Number.isInteger(callId) || callId <= 0) notFound();
  const detail = await getAiCall(admin.id, callId);
  if (!detail) notFound();
  const { call, payload, related } = detail;
  const result = payload?.result ?? null;
  const text = payload ? responseText(payload.response) : null;

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">
          <TextLink href="/ai/calls">← wywołania</TextLink>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Wywołanie #{call.id}</h1>
          <StatusBadge status={call.validation_status} />
          {call.attempt > 1 ? <span className="text-sm text-text-muted">próba {call.attempt}</span> : null}
          <span className="font-display text-2xl font-semibold tabular-nums">{formatUsd(call.cost_usd)}</span>
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
          <span>{formatDateTime(call.created_at)}</span>
          <span>{call.function_name}</span>
          <span>{call.source === 'tester' ? 'z testera' : 'z aplikacji'}</span>
          <span>{call.model}</span>
          <span>{formatMs(call.duration_ms)}</span>
          {call.user_id ? (
            <span className="flex items-center gap-1.5">
              <TextLink href={`/tester/${call.user_id}`}>{call.email ?? call.user_id}</TextLink>
              {call.is_test ? <TestBadge /> : null}
              <TextLink href={`/ai/calls?user=${call.user_id}`}>(wszystkie jego wywołania)</TextLink>
            </span>
          ) : (
            <span>konto usunięte</span>
          )}
        </p>
        {related.length ? (
          <p className="flex flex-wrap gap-3 text-sm">
            <span className="text-text-muted">Inne próby tego zadania:</span>
            {related.map((r) => (
              <TextLink key={r.id} href={`/ai/calls/${r.id}`}>
                #{r.id} (próba {r.attempt}, {formatUsd(r.cost_usd)})
              </TextLink>
            ))}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <CostCard call={call} />
        <Card title="Wersje i odpowiedź API">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-text-muted">Prompt</dt>
            <dd>
              <TextLink href="/ai/prompts">{call.prompt_version ? `v${call.prompt_version}` : 'wbudowany (kod)'}</TextLink>
            </dd>
            <dt className="text-text-muted">Parametry silnika</dt>
            <dd>
              <TextLink href="/ai/rules">{call.engine_config_version ? `v${call.engine_config_version}` : 'wbudowane (kod)'}</TextLink>
            </dd>
            <dt className="text-text-muted">Silnik</dt>
            <dd>{call.engine_version ?? '–'}</dd>
            <dt className="text-text-muted">stop_reason</dt>
            <dd>{call.stop_reason ?? '–'}</dd>
            <dt className="text-text-muted">id wiadomości</dt>
            <dd className="font-mono text-xs break-all">{call.request_id ?? '–'}</dd>
            {call.error ? (
              <>
                <dt className="text-text-muted">Błąd</dt>
                <dd className="text-workout-tempo">{call.error}</dd>
              </>
            ) : null}
          </dl>
        </Card>
      </div>

      {!payload ? (
        <Card title="Treść">
          <p className="text-sm text-text-muted">
            Treść wywołania wygasła (u prawdziwych użytkowników przechowujemy ją 30 dni) albo konto zostało usunięte. Metryki i koszt powyżej
            zostają na stałe.
          </p>
        </Card>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            Treść przechowywana {payload.expires_at ? `do ${formatDate(payload.expires_at)}` : 'bez limitu (konto testowe)'}.
            {!call.is_test ? ' Wgląd zapisany w logu działań administratora.' : ''}
          </p>

          {result ? (
            <Card title="Wynik: szkic silnika → po AI">
              {result.response?.summary ? (
                <blockquote className="rounded-md border-l-4 border-action bg-surface-brand-soft px-4 py-3 text-sm">
                  {result.response.summary}
                </blockquote>
              ) : null}
              <div className="grid gap-6 xl:grid-cols-2">
                {result.draft.map((d) => {
                  const r = result.weeks.find((w) => w.weekIndex === d.weekIndex) ?? d;
                  return <WeekCompare key={d.weekIndex} draft={d} result={r} />;
                })}
              </div>
              <h3 className="pt-2 text-sm font-semibold">Operacje modelu i decyzje silnika</h3>
              {result.apply ? <OperationList results={result.apply.results} /> : <p className="text-sm text-text-muted">{result.error ?? 'Brak operacji.'}</p>}
              {result.apply?.remaining.length ? (
                <p className="text-xs text-text-muted">
                  Naruszenia obecne już w szkicu (AI nie mogło ich pogłębić): {result.apply.remaining.map((v) => v.message).join('; ')}
                </p>
              ) : null}
              <h3 className="pt-2 text-sm font-semibold">Rady trenera</h3>
              {result.response ? (
                <CoachTipList weeks={result.weeks} tips={result.response.tips ?? []} />
              ) : (
                <p className="text-sm text-text-muted">Brak odpowiedzi modelu – brak rad.</p>
              )}
            </Card>
          ) : null}

          <Card title="Wejście do modelu">
            <InputSection request={payload.request} />
          </Card>

          <Card title="Odpowiedź modelu">
            {text ? <JsonBlock value={prettyJson(text)} /> : <p className="text-sm text-text-muted">Brak tekstu odpowiedzi.</p>}
            <details>
              <summary className="cursor-pointer text-sm text-text-muted">Surowa odpowiedź API (JSON)</summary>
              <JsonBlock value={payload.response} />
            </details>
          </Card>
        </>
      )}
    </>
  );
}

function CostCard({ call }: { call: AiCallDetail['call'] }) {
  const p = call.price;
  const rows = [
    { label: 'Wejście', tokens: call.input_tokens, price: p?.input },
    { label: 'Wyjście (z myśleniem)', tokens: call.output_tokens, price: p?.output },
    { label: 'Odczyt z cache', tokens: call.cache_read_tokens, price: p?.cacheRead },
    { label: 'Zapis do cache', tokens: call.cache_write_tokens, price: p?.cacheWrite },
  ];
  return (
    <Card title="Koszt">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-text-muted">
          <tr className="border-b border-border">
            <th className="py-1.5 font-medium" />
            <th className="py-1.5 text-right font-medium">Tokeny</th>
            <th className="py-1.5 text-right font-medium">$ / 1M</th>
            <th className="py-1.5 text-right font-medium">Koszt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border">
              <td className="py-1.5">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums">{formatTokens(r.tokens)}</td>
              <td className="py-1.5 text-right text-text-muted tabular-nums">{r.price ?? '–'}</td>
              <td className="py-1.5 text-right tabular-nums">
                {r.tokens != null && r.price != null ? formatUsd((r.tokens * r.price) / 1_000_000) : '–'}
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-1.5 font-semibold" colSpan={3}>
              Razem
            </td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{formatUsd(call.cost_usd)}</td>
          </tr>
        </tbody>
      </table>
      {!p ? <p className="text-xs text-workout-tempo">Model spoza cennika – koszt nieznany. Dopisz go w plan-engine (ai-pricing.ts).</p> : null}
    </Card>
  );
}

function InputSection({ request }: { request: NonNullable<AiCallDetail['payload']>['request'] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap gap-x-4 text-sm text-text-muted">
        <span>model: {request.model}</span>
        <span>effort: {request.effort ?? 'domyślny'}</span>
        <span>max_tokens: {request.maxTokens}</span>
      </p>
      {request.system.map((block, i) => (
        <div key={i} className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">
            Prompt systemowy – {i === 0 ? 'treść z wersji promptu' : 'reguły z parametrów silnika'}
            {i === request.system.length - 1 ? <span className="ml-2 text-xs font-normal text-text-muted">(cache)</span> : null}
          </h3>
          <JsonBlock value={block} maxHeight="max-h-80" />
        </div>
      ))}
      {request.messages.map((m, i) => (
        <div key={i} className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">
            {m.role === 'user' ? (i === 0 ? 'Wiadomość: dane biegacza i szkic' : 'Wiadomość: wynik walidacji (ponowienie)') : 'Poprzednia odpowiedź modelu'}
          </h3>
          <JsonBlock value={prettyJson(m.content)} />
        </div>
      ))}
      <details>
        <summary className="cursor-pointer text-sm text-text-muted">Schemat odpowiedzi (structured outputs)</summary>
        <JsonBlock value={request.outputSchema} />
      </details>
    </div>
  );
}
