'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { previewAiWeek, saveAiWeek, type AiPreview } from '@/app/tester/ai-actions';
import { inputClass, primaryButton, secondaryButton, StatusBadge } from '@/components/ai/ui';
import { CoachTipList } from '@/components/ai/coach-tips';
import { OperationList, WeekCompare } from '@/components/ai/week-compare';
import { formatUsd } from '@/lib/format';

type VersionOption = { id: number; label: string };

/**
 * Tester: tydzień przez silnik + Claude bez zapisu, obok szkicu. Można wybrać wersję promptu i parametrów
 * (np. szkic przed aktywacją). Każdy podgląd to płatne wywołanie zapisane w logu AI.
 */
export function AiPreviewPanel({
  userId,
  defaultWeek,
  prompts,
  configs,
  hasKey,
}: {
  userId: string;
  defaultWeek: number;
  prompts: VersionOption[];
  configs: VersionOption[];
  hasKey: boolean;
}) {
  const [week, setWeek] = useState(String(defaultWeek));
  const [promptId, setPromptId] = useState('');
  const [configId, setConfigId] = useState('');
  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [saved, setSaved] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();

  const run = () =>
    start(async () => {
      setSaved(null);
      setPreview(
        await previewAiWeek(userId, Number(week) - 1, promptId ? Number(promptId) : null, configId ? Number(configId) : null),
      );
    });

  return (
    <section className="flex flex-col gap-4 rounded-card border border-action bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Podgląd z AI</h2>
          <p className="text-sm text-text-muted">Silnik robi szkic, Claude go dopasowuje, silnik waliduje. Nic nie zapisuje się w planie, dopóki nie klikniesz „Zapisz”.</p>
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-3 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Tydzień</span>
          <input type="number" min={1} max={105} required value={week} onChange={(e) => setWeek(e.target.value)} className={`${inputClass} w-20`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Prompt</span>
          <select value={promptId} onChange={(e) => setPromptId(e.target.value)} className={inputClass}>
            <option value="">aktywny</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Parametry silnika</span>
          <select value={configId} onChange={(e) => setConfigId(e.target.value)} className={inputClass}>
            <option value="">aktywne</option>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending || !hasKey} className={primaryButton}>
          {pending ? 'Claude myśli…' : 'Podgląd z AI'}
        </button>
        {!hasKey ? <span className="text-text-accent-strong">Brak ANTHROPIC_API_KEY w środowisku panelu.</span> : null}
      </form>

      {preview && !preview.ok ? <p className="text-sm text-text-accent-strong">{preview.message}</p> : null}
      {preview?.ok ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <StatusBadge status={preview.status} />
            <span>
              koszt <b className="tabular-nums">{formatUsd(preview.costUsd)}</b>
            </span>
            <span className="text-text-muted">
              {preview.model} · prompt {preview.promptLabel} · parametry {preview.engineLabel}
            </span>
            {preview.callIds.map((id, i) => (
              <Link key={id} href={`/ai/calls/${id}`} className="font-medium text-text-brand hover:underline">
                wywołanie #{id}
                {preview.callIds.length > 1 ? ` (próba ${i + 1})` : ''} →
              </Link>
            ))}
          </div>
          {preview.error ? <p className="text-sm text-workout-tempo">{preview.error} – pokazany szkic silnika.</p> : null}
          {preview.summary ? (
            <blockquote className="rounded-md border-l-4 border-action bg-surface-brand-soft px-4 py-3 text-sm">{preview.summary}</blockquote>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-2">
            <WeekCompare draft={preview.draft} result={preview.result} />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Operacje i decyzje silnika</h3>
              <OperationList results={preview.operations} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Rady trenera</h3>
            <CoachTipList weeks={[preview.result]} tips={preview.tips} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {preview.finalCallId ? (
              <button
                type="button"
                disabled={saving}
                className={primaryButton}
                onClick={() => startSave(async () => setSaved(await saveAiWeek(userId, preview.weekIndex, preview.finalCallId as number)))}
              >
                {saving ? 'Zapisuję…' : `Zapisz wynik jako tydzień ${preview.weekIndex + 1}`}
              </button>
            ) : null}
            <button type="button" disabled={pending} className={secondaryButton} onClick={run}>
              Jeszcze raz
            </button>
            {saved ? (
              <span role="status" className={`text-sm ${saved.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
                {saved.message}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
