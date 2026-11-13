'use client';

import {
  DEFAULT_ENGINE_PARAMS,
  ENGINE_PARAM_GROUPS,
  ENGINE_PARAM_SPECS,
  METRIC_SPECS,
  paramKey,
  TRAINING_LEVEL_INFO,
  TRAINING_LEVELS,
  type EngineParams,
  type ParamGroup,
} from '@aloha/plan-engine';
import { useState, useTransition } from 'react';

import { activateEngineConfig, createEngineConfig, type AiActionResult } from '@/app/(panel)/ai/actions';
import { inputClass, primaryButton, secondaryButton } from '@/components/ai/ui';
import type { EngineConfigVersion } from '@/lib/ai/data';
import { formatDateTime } from '@/lib/format';

const STATUS: Record<EngineConfigVersion['status'], string> = { active: 'aktywna', draft: 'szkic', archived: 'archiwum' };

const toStrings = (p: EngineParams) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as Record<string, string>;

/** Edycja parametrów silnika: nowa wersja (granice z kodu), aktywacja, powrót do wbudowanych. */
export function ParamsWorkbench({
  active,
  activeVersion,
  versions,
}: {
  active: EngineParams;
  activeVersion: number;
  versions: EngineConfigVersion[];
}) {
  const [values, setValues] = useState<Record<string, string>>(() => toStrings(active));
  const [note, setNote] = useState('');
  const [base, setBase] = useState(activeVersion ? `v${activeVersion}` : 'wbudowane');
  const [result, setResult] = useState<AiActionResult | null>(null);
  const [pending, start] = useTransition();
  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const load = (p: EngineParams, label: string) => {
    setValues(toStrings({ ...DEFAULT_ENGINE_PARAMS, ...p }));
    setBase(label);
    setResult(null);
  };
  const save = (activate: boolean) =>
    start(async () => {
      const res = await createEngineConfig(values, note, activate);
      setResult(res);
      if (res.ok) setNote('');
    });
  const changed = ENGINE_PARAM_SPECS.filter((s) => Number(values[s.key]) !== active[s.key]).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex min-w-0 flex-col gap-5 rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Parametry</h2>
          <span className="text-xs text-text-muted">
            na podstawie: {base}
            {changed ? ` · zmienione: ${changed}` : ''}
          </span>
        </div>
        <LevelTable
          values={values}
          active={active}
          fieldErrors={fieldErrors}
          onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Co zmieniłeś? (notatka do historii)</span>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="np. wolniejszy przyrost dla wracających" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} className={primaryButton} onClick={() => save(true)}>
            {pending ? 'Zapisuję…' : 'Zapisz i aktywuj'}
          </button>
          <button type="button" disabled={pending} className={secondaryButton} onClick={() => save(false)}>
            Zapisz jako szkic
          </button>
          <button type="button" disabled={pending} className={secondaryButton} onClick={() => load(DEFAULT_ENGINE_PARAMS, 'wbudowane')}>
            Wczytaj wbudowane
          </button>
          {result ? (
            <span role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
              {result.message}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-text-muted">
          Aktywna wersja działa od razu: generowanie planu w aplikacji, kolejne tygodnie, walidacja AI i blok reguł w prompcie. Szkic sprawdzisz w
          Testerze planów („Podgląd z AI” → wersja parametrów).
        </p>
      </section>

      <aside className="flex flex-col gap-3">
        <h2 className="font-semibold">Historia wersji</h2>
        <Version
          label="Wbudowane (kod)"
          status={activeVersion === 0 ? 'aktywna' : null}
          onLoad={() => load(DEFAULT_ENGINE_PARAMS, 'wbudowane')}
          onActivate={activeVersion === 0 ? null : () => start(async () => setResult(await activateEngineConfig(null)))}
          pending={pending}
        />
        {versions.map((v) => (
          <Version
            key={v.id}
            label={`v${v.version}`}
            status={STATUS[v.status]}
            meta={formatDateTime(v.created_at)}
            note={v.note}
            onLoad={() => load(v.params as unknown as EngineParams, `v${v.version}`)}
            onActivate={v.status === 'active' ? null : () => start(async () => setResult(await activateEngineConfig(v.id)))}
            pending={pending}
          />
        ))}
      </aside>
    </div>
  );
}

/** Wszystkie parametry: wiersz = metryka (pogrupowane), kolumna = poziom zaawansowania 1–5. */
function LevelTable({
  values,
  active,
  fieldErrors,
  onChange,
}: {
  values: Record<string, string>;
  active: EngineParams;
  fieldErrors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const groups = Object.keys(ENGINE_PARAM_GROUPS) as ParamGroup[];
  return (
    <div className="overflow-x-auto rounded-md bg-background">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left align-bottom">
            <th scope="col" className="w-[13rem] px-3 py-2 font-semibold">
              Metryka
            </th>
            {TRAINING_LEVELS.map((level) => (
              <th key={level} scope="col" className="w-[6.5rem] px-2 py-2 font-normal">
                <span className="block font-semibold">
                  {level} · {TRAINING_LEVEL_INFO[level].label}
                </span>
                <span className="block text-xs leading-snug text-text-muted">{TRAINING_LEVEL_INFO[level].criterion}</span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group}>
            <tr>
              <th scope="colgroup" colSpan={TRAINING_LEVELS.length + 1} className="px-3 pb-1 pt-4 text-left text-sm font-semibold text-text-brand">
                {ENGINE_PARAM_GROUPS[group]}
              </th>
            </tr>
            {METRIC_SPECS.filter((m) => m.group === group).map((m) => (
              <tr key={m.metric} className="border-b border-border align-top last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <span className="block font-medium">
                    {m.label} <span className="text-xs font-normal text-text-muted">({m.unit})</span>
                  </span>
                  <span className="block text-xs text-text-muted">{m.description}</span>
                  <span className="block text-xs text-text-muted">
                    granice {m.min}–{m.max} {m.unit}
                  </span>
                </th>
                {TRAINING_LEVELS.map((level) => {
                  const key = paramKey(m.metric, level);
                  const v = values[key] ?? '';
                  const differs = Number(v) !== active[key];
                  const error = fieldErrors[key];
                  return (
                    <td key={level} className={`px-2 py-2 ${differs ? 'bg-surface-accent-soft' : ''}`}>
                      <input
                        type="number"
                        inputMode="decimal"
                        aria-label={`${m.label} – poziom ${level} (${m.unit})`}
                        min={m.min}
                        max={m.max}
                        step={m.step}
                        value={v}
                        aria-invalid={!!error}
                        onChange={(e) => onChange(key, e.target.value)}
                        className={`${inputClass} w-16 text-right tabular-nums`}
                      />
                      <span className="mt-1 block text-xs text-text-muted">
                        wbud. {m.defaults[level]}
                        {differs ? ` · akt. ${active[key]}` : ''}
                      </span>
                      {error ? <span className="block text-xs text-danger">{error}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Version({
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
  meta?: string;
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
          <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${isActive ? 'bg-surface-brand-soft text-text-brand' : 'bg-background text-text-muted'}`}>
            {status}
          </span>
        ) : null}
      </div>
      {meta ? <span className="text-xs text-text-muted">{meta}</span> : null}
      {note ? <span className="text-xs">{note}</span> : null}
      <div className="flex gap-3 text-xs">
        <button type="button" className="font-medium text-text-brand hover:underline" onClick={onLoad}>
          Wczytaj do edycji
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
