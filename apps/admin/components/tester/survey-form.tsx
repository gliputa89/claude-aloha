'use client';

import { useState, useTransition, type ReactNode } from 'react';

import { saveSurvey, type SurveyResult } from '@/app/(panel)/tester/survey-actions';
import type { SurveyErrors, SurveyValues } from '@/lib/survey';

const DAYS = [
  [1, 'pn'],
  [2, 'wt'],
  [3, 'śr'],
  [4, 'cz'],
  [5, 'pt'],
  [6, 'sb'],
  [7, 'nd'],
] as const;

const input =
  'w-full rounded-button border border-border-strong bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-action';

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
      {label}
      {children}
      {error ? <span className="text-text-accent-strong">{error}</span> : null}
    </label>
  );
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

/** Karta „Ankieta”: podgląd (children) albo formularz edycji. */
export function SurveyPanel({
  userId,
  initial,
  children,
}: {
  userId: string;
  initial: SurveyValues;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<SurveyErrors>({});
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof SurveyValues>(key: K, value: SurveyValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const race = values.goalType === 'race';

  if (!editing) {
    return (
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Ankieta</h2>
          <button
            type="button"
            onClick={() => {
              setValues(initial);
              setErrors({});
              setResult(null);
              setEditing(true);
            }}
            className="rounded-button border border-border-strong px-3 py-1.5 text-sm font-semibold hover:bg-background"
          >
            Edytuj
          </button>
        </div>
        {result?.ok ? (
          <p role="status" className="text-sm text-text-brand">
            {result.message} Plan się nie zmienił – wygeneruj tydzień albo cały plan od nowa.
          </p>
        ) : null}
        {children}
      </section>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-action bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSurvey(userId, values);
          setResult(r);
          setErrors(!r.ok && r.errors ? r.errors : {});
          if (r.ok) setEditing(false);
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Edycja ankiety</h2>
        <span className="text-xs text-text-muted">zmiana dotyczy tylko danych – plan zostaje</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Imię">
          <input className={input} value={values.displayName} onChange={(e) => set('displayName', e.target.value)} />
        </Field>
        <Field label="Poziom">
          <select className={input} value={values.level} onChange={(e) => set('level', e.target.value as SurveyValues['level'])}>
            <option value="beginner">nie biega (beginner)</option>
            <option value="intermediate">okazjonalnie (intermediate)</option>
            <option value="advanced">regularnie (advanced)</option>
          </select>
        </Field>

        <Field label="Cel">
          <select className={input} value={values.goalType} onChange={(e) => set('goalType', e.target.value as SurveyValues['goalType'])}>
            <option value="general">ogólny</option>
            <option value="race">zawody</option>
          </select>
        </Field>
        {race ? (
          <Field label="Dystans" error={errors.distanceM}>
            <select className={input} value={values.distanceM} onChange={(e) => set('distanceM', Number(e.target.value) as SurveyValues['distanceM'])}>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={21097}>półmaraton</option>
              <option value={42195}>maraton</option>
            </select>
          </Field>
        ) : (
          <Field label="Wariant celu">
            <select className={input} value={values.generalFocus} onChange={(e) => set('generalFocus', e.target.value as SurveyValues['generalFocus'])}>
              <option value="start_running">zacznij biegać</option>
              <option value="improve_fitness">popraw formę</option>
              <option value="run_regularly">biegaj regularnie</option>
            </select>
          </Field>
        )}

        {race ? (
          <>
            <Field label="Data zawodów" error={errors.raceDate}>
              <input type="date" className={input} value={values.raceDate} onChange={(e) => set('raceDate', e.target.value)} />
            </Field>
            <Field label="Czas docelowy (opcjonalnie)" error={errors.targetTime}>
              <input className={input} placeholder="1:55:00" value={values.targetTime} onChange={(e) => set('targetTime', e.target.value)} />
            </Field>
          </>
        ) : null}

        <Field label="Start planu (puste = od razu)" error={errors.planStartsOn}>
          <input type="date" className={input} value={values.planStartsOn} onChange={(e) => set('planStartsOn', e.target.value)} />
        </Field>
        <Field label="Biega obecnie (× / tydz.)" error={errors.currentRunsPerWeek}>
          <input type="number" min={0} max={14} className={input} value={values.currentRunsPerWeek} onChange={(e) => set('currentRunsPerWeek', Number(e.target.value))} />
        </Field>

        <Field label="Ostatni wynik – dystans">
          <select className={input} value={values.recentDistanceM ?? ''} onChange={(e) => set('recentDistanceM', numOrNull(e.target.value))}>
            <option value="">brak</option>
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={21097}>półmaraton</option>
            <option value={42195}>maraton</option>
          </select>
        </Field>
        <Field label="Ostatni wynik – czas" error={errors.recentTime}>
          <input className={input} placeholder="52:30" disabled={!values.recentDistanceM} value={values.recentTime} onChange={(e) => set('recentTime', e.target.value)} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-text-muted">Dni treningowe</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(([day, label]) => {
            const on = values.preferredDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => set('preferredDays', on ? values.preferredDays.filter((d) => d !== day) : [...values.preferredDays, day])}
                className={`w-10 rounded-button border py-1.5 text-sm font-semibold ${on ? 'border-action bg-action text-text-on-brand' : 'border-border-strong hover:bg-background'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {errors.preferredDays ? <span className="text-xs text-text-accent-strong">{errors.preferredDays}</span> : null}
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Treningów / tydz." error={errors.sessionsPerWeek}>
          <input type="number" min={1} max={7} className={input} value={values.sessionsPerWeek} onChange={(e) => set('sessionsPerWeek', Number(e.target.value))} />
        </Field>
        <Field label="Limit pn–pt (min)" error={errors.maxMinutesWeekday}>
          <input type="number" min={10} max={300} className={input} placeholder="brak" value={values.maxMinutesWeekday ?? ''} onChange={(e) => set('maxMinutesWeekday', numOrNull(e.target.value))} />
        </Field>
        <Field label="Limit sb–nd (min)" error={errors.maxMinutesWeekend}>
          <input type="number" min={10} max={300} className={input} placeholder="brak" value={values.maxMinutesWeekend ?? ''} onChange={(e) => set('maxMinutesWeekend', numOrNull(e.target.value))} />
        </Field>
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={values.hasContraindications} onChange={(e) => set('hasContraindications', e.target.checked)} className="size-4 accent-action" />
          Przeciwwskazania (tryb łagodny)
        </label>
        <Field label="Strefa czasowa" error={errors.timezone}>
          <input className={input} value={values.timezone} onChange={(e) => set('timezone', e.target.value)} />
        </Field>
      </div>

      {result && !result.ok ? (
        <p role="alert" className="rounded-md bg-surface-accent-soft px-3 py-2 text-sm text-text-accent-strong">
          {result.message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-button bg-action px-4 py-2 text-sm font-semibold text-text-on-brand hover:bg-action-hover disabled:opacity-60">
          {pending ? 'Zapisuję…' : 'Zapisz ankietę'}
        </button>
        <button type="button" disabled={pending} onClick={() => setEditing(false)} className="rounded-button border border-border-strong px-4 py-2 text-sm font-semibold hover:bg-background">
          Anuluj
        </button>
      </div>
    </form>
  );
}
