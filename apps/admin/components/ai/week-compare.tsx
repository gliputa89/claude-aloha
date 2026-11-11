import { AI_OPERATION_LABEL, describeSteps, estimateDistanceM, formatApproxKm, formatStepDuration, stepsOf, ZONE_INFO, type OperationResult, type PlannedSession, type PlannedWeek } from '@aloha/plan-engine';

import { WorkoutChart } from '@/components/workout/workout-chart';

import { formatShortDate, isoWeekdayOf, SESSION_COLOR, SESSION_LABEL, weekdayShort } from '@/lib/format';

// Porównanie „szkic silnika → wynik po AI” dzień po dniu. Bez stanu – używane w testerze i w szczegółach wywołania.

const minutes = (w: PlannedWeek) => w.sessions.reduce((n, s) => n + (s.durationMin ?? 0), 0);

/** Orientacyjny dystans treningu z czasu odcinków i stref tempa; zawody – dystans startu. */
const approxM = (s: PlannedSession) => {
  const steps = stepsOf(s);
  return s.durationMin && steps.length ? estimateDistanceM(steps) : (s.distanceM ?? 0);
};
const weekKm = (w: PlannedWeek) => formatApproxKm(w.sessions.reduce((n, s) => n + approxM(s), 0));

function SessionCell({ s, changed }: { s: PlannedSession | undefined; changed: boolean }) {
  if (!s) return <span className={`text-sm ${changed ? 'text-danger line-through' : 'text-text-muted'}`}>—</span>;
  return (
    <span className={`flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1 ${changed ? 'bg-surface-accent-soft' : ''}`}>
      <span className="flex items-center gap-2 text-sm">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${SESSION_COLOR[s.type] ?? 'bg-workout-rest'}`} />
        <span className="font-medium">{SESSION_LABEL[s.type] ?? s.type}</span>
        <span className="ml-auto font-semibold tabular-nums">
          {s.durationMin ? `${s.durationMin} min` : ''}
          {s.durationMin && stepsOf(s).length ? (
            <span className="ml-1 text-xs font-normal text-text-muted">· {formatApproxKm(approxM(s))}</span>
          ) : null}
        </span>
      </span>
      <span className="text-xs text-text-muted">{describeSteps(stepsOf(s))}</span>
      <WorkoutChart steps={stepsOf(s)} height="h-6" />
    </span>
  );
}

const same = (a: PlannedSession | undefined, b: PlannedSession | undefined) =>
  !!a &&
  !!b &&
  a.type === b.type &&
  a.durationMin === b.durationMin &&
  a.intensity === b.intensity &&
  JSON.stringify(a.structure.steps ?? null) === JSON.stringify(b.structure.steps ?? null);

export function WeekCompare({ draft, result }: { draft: PlannedWeek; result: PlannedWeek }) {
  const dates = [...new Set([...draft.sessions, ...result.sessions].map((s) => s.scheduledOn))].sort();
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 border-b border-border pb-1 text-xs font-semibold text-text-muted">
        <span>Tydzień {draft.weekIndex + 1}</span>
        <span>Szkic silnika · {minutes(draft)} min · {weekKm(draft)}</span>
        <span>Po AI · {minutes(result)} min · {weekKm(result)}</span>
      </div>
      {dates.map((d) => {
        const a = draft.sessions.find((s) => s.scheduledOn === d);
        const b = result.sessions.find((s) => s.scheduledOn === d);
        const changed = !same(a, b);
        return (
          <div key={d} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2 py-1">
            <span className="text-sm text-text-muted">
              <span className="font-semibold text-text">{weekdayShort(isoWeekdayOf(d))}</span> {formatShortDate(d)}
            </span>
            <SessionCell s={a} changed={false} />
            <SessionCell s={b} changed={changed} />
          </div>
        );
      })}
      {!dates.length ? <p className="text-sm text-text-muted">Brak treningów w tym tygodniu.</p> : null}
    </div>
  );
}

export function OperationList({ results }: { results: OperationResult[] }) {
  if (!results.length) return <p className="text-sm text-text-muted">Model nie zaproponował zmian – szkic bez zmian.</p>;
  return (
    <ol className="flex flex-col divide-y divide-border">
      {results.map((r, i) => {
        const o = r.operation;
        const detail = [
          o.toDate ? `→ ${formatShortDate(o.toDate)}` : null,
          o.type ? (SESSION_LABEL[o.type] ?? o.type) : null,
          o.durationMin !== null ? `${o.durationMin} min` : null,
          o.sets?.length
            ? o.sets
                .map(
                  (s) =>
                    `${s.repeat > 1 ? `${s.repeat}× ` : ''}${formatStepDuration(s.workS)} ${ZONE_INFO[s.workZone].label}${
                      s.recoveryS && s.recoveryZone ? ` / ${formatStepDuration(s.recoveryS)} ${ZONE_INFO[s.recoveryZone].label}` : ''
                    }`,
                )
                .join(' → ')
            : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={i} className="flex flex-col gap-0.5 py-2 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${
                  r.status === 'applied' ? 'bg-surface-brand-soft text-text-brand' : 'bg-surface-accent-soft text-danger'
                }`}
              >
                {r.status === 'applied' ? 'przyjęta' : 'odrzucona'}
              </span>
              <span className="font-medium">
                {AI_OPERATION_LABEL[o.op] ?? o.op} {formatShortDate(o.date)}
              </span>
              {detail ? <span className="text-text-muted">{detail}</span> : null}
            </span>
            {o.reason ? <span className="text-text-muted">{o.reason}</span> : null}
            {r.reason ? <span className="text-danger">Silnik: {r.reason}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
