'use client';

import { AI_EFFORTS, AI_MODELS, type AiPromptConfig } from '@aloha/plan-engine';
import { useState, useTransition } from 'react';

import { activatePrompt, createPromptVersion, type AiActionResult } from '@/app/(panel)/ai/actions';
import { inputClass, JsonBlock, primaryButton, secondaryButton } from '@/components/ai/ui';
import type { AiPromptVersion } from '@/lib/ai/data';
import { formatDateTime } from '@/lib/format';

type Draft = { model: string; effort: string; maxTokens: string; systemPrompt: string; note: string };

const fromConfig = (c: Pick<AiPromptConfig, 'model' | 'effort' | 'maxTokens' | 'systemPrompt'>): Draft => ({
  model: c.model,
  effort: c.effort ?? '',
  maxTokens: String(c.maxTokens),
  systemPrompt: c.systemPrompt,
  note: '',
});

const STATUS: Record<AiPromptVersion['status'], string> = { active: 'aktywna', draft: 'szkic', archived: 'archiwum' };

function Feedback({ result }: { result: AiActionResult | null }) {
  if (!result) return null;
  return (
    <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
      {result.message}
    </span>
  );
}

/** Edytor promptu: zawsze zapisuje nową wersję (historia zostaje), aktywacja osobno albo od razu. */
export function PromptWorkbench({
  fn,
  active,
  builtin,
  versions,
  rulesBlock,
}: {
  fn: string;
  active: AiPromptConfig;
  builtin: AiPromptConfig;
  versions: AiPromptVersion[];
  rulesBlock: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromConfig(active));
  const [base, setBase] = useState<string>(active.version ? `v${active.version}` : 'wbudowany');
  const [result, setResult] = useState<AiActionResult | null>(null);
  const [pending, start] = useTransition();

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const load = (c: Pick<AiPromptConfig, 'model' | 'effort' | 'maxTokens' | 'systemPrompt'>, label: string) => {
    setDraft(fromConfig(c));
    setBase(label);
    setResult(null);
  };
  const save = (activate: boolean) =>
    start(async () => {
      const res = await createPromptVersion(
        fn,
        {
          model: draft.model,
          effort: draft.effort || null,
          maxTokens: Number(draft.maxTokens),
          systemPrompt: draft.systemPrompt,
          note: draft.note,
        },
        activate,
      );
      setResult(res);
      if (res.ok) set({ note: '' });
    });
  const model = AI_MODELS.find((m) => m.id === draft.model);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Nowa wersja</h2>
          <span className="text-xs text-text-muted">na podstawie: {base}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Model</span>
            <select className={inputClass} value={draft.model} onChange={(e) => set({ model: e.target.value })}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} – ${m.price.input} / ${m.price.output}
                </option>
              ))}
            </select>
            {model ? <span className="text-xs text-text-muted">{model.note} · cena za 1M tokenów wej. / wyj.</span> : null}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Effort (głębokość myślenia)</span>
            <select className={inputClass} value={draft.effort} onChange={(e) => set({ effort: e.target.value })}>
              <option value="">domyślny modelu</option>
              {AI_EFFORTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <span className="text-xs text-text-muted">wyżej = lepiej, ale drożej i wolniej</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Limit tokenów odpowiedzi</span>
            <input
              type="number"
              min={256}
              max={64000}
              step={256}
              className={inputClass}
              value={draft.maxTokens}
              onChange={(e) => set({ maxTokens: e.target.value })}
            />
            <span className="text-xs text-text-muted">myślenie też się wlicza</span>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-text-muted">Prompt systemowy</span>
            <span className="text-xs text-text-muted">{draft.systemPrompt.length.toLocaleString('pl-PL')} znaków</span>
          </span>
          <textarea
            className={`${inputClass} min-h-[28rem] font-mono text-xs leading-relaxed`}
            value={draft.systemPrompt}
            onChange={(e) => set({ systemPrompt: e.target.value })}
            spellCheck={false}
          />
        </label>
        <details className="text-sm">
          <summary className="cursor-pointer text-text-muted">
            Dopisywane automatycznie: blok reguł z aktywnych Ram planu – liczby dla poziomu biegacza, tu przykład dla poziomu 3 (nie edytujesz go tutaj)
          </summary>
          <JsonBlock value={rulesBlock} maxHeight="max-h-80" />
        </details>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Co zmieniłeś? (notatka do historii)</span>
          <input className={inputClass} value={draft.note} onChange={(e) => set({ note: e.target.value })} placeholder="np. łagodniej dla początkujących" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} className={primaryButton} onClick={() => save(true)}>
            {pending ? 'Zapisuję…' : 'Zapisz i aktywuj'}
          </button>
          <button type="button" disabled={pending} className={secondaryButton} onClick={() => save(false)}>
            Zapisz jako szkic
          </button>
          <button type="button" disabled={pending} className={secondaryButton} onClick={() => load(builtin, 'wbudowany')}>
            Wczytaj wbudowany
          </button>
          <Feedback result={result} />
        </div>
        <p className="text-xs text-text-muted">
          Szkic możesz przetestować w Testerze planów (wybór wersji promptu przy „Podgląd z AI”), zanim go aktywujesz. Aplikacja używa zawsze
          wersji aktywnej.
        </p>
      </section>

      <aside className="flex flex-col gap-3">
        <h2 className="font-semibold">Historia wersji</h2>
        <VersionItem
          label="Wbudowany (kod)"
          status={active.version === null ? 'aktywna' : null}
          meta={`${builtin.model} · effort ${builtin.effort ?? 'domyślny'}`}
          onLoad={() => load(builtin, 'wbudowany')}
          onActivate={active.version === null ? null : () => start(async () => setResult(await activatePrompt(fn, null)))}
          pending={pending}
        />
        {versions.map((v) => (
          <VersionItem
            key={v.id}
            label={`v${v.version}`}
            status={STATUS[v.status]}
            meta={`${v.model} · effort ${v.effort ?? 'domyślny'} · ${formatDateTime(v.created_at)}`}
            note={v.note}
            onLoad={() => load({ model: v.model, effort: (v.effort as AiPromptConfig['effort']) ?? null, maxTokens: v.max_tokens, systemPrompt: v.system_prompt }, `v${v.version}`)}
            onActivate={v.status === 'active' ? null : () => start(async () => setResult(await activatePrompt(fn, v.id)))}
            pending={pending}
          />
        ))}
      </aside>
    </div>
  );
}

function VersionItem({
  label,
  status,
  meta,
  note,
  onLoad,
  onActivate,
  pending,
}: {
  label: string;
  status: string | null;
  meta: string;
  note?: string | null;
  onLoad: () => void;
  onActivate: (() => void) | null;
  pending: boolean;
}) {
  const isActive = status === 'aktywna';
  return (
    <div className={`flex flex-col gap-1.5 rounded-card border bg-surface p-3 text-sm ${isActive ? 'border-action' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {status ? (
          <span
            className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${isActive ? 'bg-surface-brand-soft text-text-brand' : 'bg-background text-text-muted'}`}
          >
            {status}
          </span>
        ) : null}
      </div>
      <span className="text-xs text-text-muted">{meta}</span>
      {note ? <span className="text-xs">{note}</span> : null}
      <div className="flex gap-3 text-xs">
        <button type="button" className="font-medium text-text-brand hover:underline" onClick={onLoad}>
          Wczytaj do edytora
        </button>
        {onActivate ? (
          <button type="button" disabled={pending} className="font-medium text-text-brand hover:underline disabled:opacity-60" onClick={onActivate}>
            Aktywuj
          </button>
        ) : null}
      </div>
    </div>
  );
}
