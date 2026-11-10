import {
  flattenSteps,
  formatPace,
  formatStepDuration,
  isRepeat,
  stepsTotalS,
  ZONE_INFO,
  type PaceZone,
  type WorkoutItem,
  type WorkoutStep,
} from '@aloha/plan-engine';

// Wykres interwałów (jak w zegarkach i aplikacjach biegowych): szerokość słupka = czas odcinka,
// wysokość = strefa wysiłku. Pod spodem lista odcinków z tempem. Bez stanu – serwer i klient.

const ZONE_COLOR: Record<PaceZone, string> = {
  walk: 'bg-workout-walk-run',
  recovery: 'bg-workout-rest',
  easy: 'bg-workout-easy',
  steady: 'bg-workout-long',
  tempo: 'bg-workout-tempo',
  interval: 'bg-workout-intervals',
  sprint: 'bg-accent',
};

const MAX_LEVEL = 7;

const KIND_LABEL: Record<WorkoutStep['kind'], string> = {
  warmup: 'Rozgrzewka',
  work: 'Odcinek',
  recovery: 'Przerwa',
  cooldown: 'Schłodzenie',
};

function paceText(s: WorkoutStep) {
  return s.pace ? `${formatPace(s.pace.fastS)}–${formatPace(s.pace.slowS)} /km` : ZONE_INFO[s.zone].effort;
}

export function WorkoutChart({ steps, height = 'h-14' }: { steps: WorkoutItem[]; height?: string }) {
  const flat = flattenSteps(steps);
  const total = stepsTotalS(steps);
  if (!flat.length || !total) return null;
  return (
    <div
      className={`flex ${height} w-full items-end gap-px overflow-hidden rounded-md bg-background`}
      role="img"
      aria-label={flat.map((s) => `${KIND_LABEL[s.kind]} ${formatStepDuration(s.durationS)} ${ZONE_INFO[s.zone].label}`).join(', ')}
    >
      {flat.map((s, i) => (
        <div
          key={i}
          title={`${KIND_LABEL[s.kind]} · ${formatStepDuration(s.durationS)} · ${ZONE_INFO[s.zone].label} · ${paceText(s)}`}
          className={`${ZONE_COLOR[s.zone]} min-w-[2px] rounded-t-[2px] opacity-90 hover:opacity-100`}
          style={{ width: `${(s.durationS / total) * 100}%`, height: `${(ZONE_INFO[s.zone].level / MAX_LEVEL) * 100}%` }}
        />
      ))}
    </div>
  );
}

function StepLine({ s }: { s: WorkoutStep }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${ZONE_COLOR[s.zone]}`} />
      <span className="w-24 shrink-0 text-text-muted">{KIND_LABEL[s.kind]}</span>
      <span className="w-20 shrink-0 font-semibold tabular-nums">{formatStepDuration(s.durationS)}</span>
      <span className="truncate">
        {ZONE_INFO[s.zone].label} <span className="text-text-muted">· {paceText(s)}</span>
      </span>
    </li>
  );
}

/** Lista odcinków; powtórzenia jako blok „N×”. */
export function WorkoutSteps({ steps }: { steps: WorkoutItem[] }) {
  return (
    <ol className="flex flex-col gap-1 text-xs">
      {steps.map((item, i) =>
        isRepeat(item) ? (
          <li key={i} className="flex gap-2 rounded-md border border-border px-2 py-1">
            <span className="w-8 shrink-0 font-display text-base font-semibold text-text-brand">{item.times}×</span>
            <ol className="flex min-w-0 flex-1 flex-col gap-1">
              {item.steps.map((s, j) => (
                <StepLine key={j} s={s} />
              ))}
            </ol>
          </li>
        ) : (
          <StepLine key={i} s={item} />
        ),
      )}
    </ol>
  );
}
