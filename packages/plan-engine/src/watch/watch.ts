// Trening z planu w kształcie, jaki przyjmują zegarki: rozgrzewka → bloki (powtórzenia × odcinki) → schłodzenie.
// Tak układa treningi Apple WorkoutKit; Garmin i COROS mają te same elementy (kroki, powtórzenia, cel tempa),
// więc ten kształt posłuży też do kolejnych integracji.

import { isRepeat, type PaceRange, type PaceZone, type StepKind, type WorkoutItem, type WorkoutStep } from '../core/workout.ts';

/** Zakres prędkości w m/s (zegarki liczą prędkość, plan – tempo w s/km). */
export type SpeedRange = { lowMps: number; highMps: number };

export type WatchStep = { kind: StepKind; zone: PaceZone; durationS: number; speed: SpeedRange | null };
export type WatchIntervalStep = { purpose: 'work' | 'recovery'; step: WatchStep };
export type WatchBlock = { iterations: number; steps: WatchIntervalStep[] };
export type WatchWorkout = { warmup: WatchStep | null; blocks: WatchBlock[]; cooldown: WatchStep | null };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Tempo s/km → prędkość m/s. Wolniejsze tempo (slowS) to dolna granica prędkości. */
export function paceToSpeed(pace: PaceRange | null): SpeedRange | null {
  if (!pace || pace.fastS <= 0 || pace.slowS < pace.fastS) return null;
  return { lowMps: round3(1000 / pace.slowS), highMps: round3(1000 / pace.fastS) };
}

const toWatchStep = (s: WorkoutStep): WatchStep => ({
  kind: s.kind,
  zone: s.zone,
  durationS: s.durationS,
  speed: paceToSpeed(s.pace),
});

const interval = (s: WorkoutStep): WatchIntervalStep => ({
  purpose: s.kind === 'recovery' ? 'recovery' : 'work',
  step: toWatchStep(s),
});

/**
 * Odcinki planu → trening dla zegarka. Pierwsza rozgrzewka i ostatnie schłodzenie idą na swoje miejsca,
 * powtórzenia stają się blokami z liczbą powtórzeń, a kolejne pojedyncze odcinki – jednym blokiem bez powtórzeń.
 * Brak odcinków → null (np. dzień wolny albo start).
 */
export function toWatchWorkout(items: WorkoutItem[]): WatchWorkout | null {
  const clean = items
    .map((i) => (isRepeat(i) ? { ...i, steps: i.steps.filter((s) => s.durationS > 0) } : i))
    .filter((i) => (isRepeat(i) ? i.steps.length > 0 && i.times > 0 : i.durationS > 0));
  const [first] = clean;
  if (!first) return null;

  const warmup = !isRepeat(first) && first.kind === 'warmup' ? first : null;
  const rest = warmup ? clean.slice(1) : clean;
  const last = rest.at(-1);
  const cooldown = last && !isRepeat(last) && last.kind === 'cooldown' ? last : null;
  const middle = cooldown ? rest.slice(0, -1) : rest;

  const blocks: WatchBlock[] = [];
  let single: WatchIntervalStep[] = [];
  const flush = () => {
    if (single.length > 0) blocks.push({ iterations: 1, steps: single });
    single = [];
  };
  for (const item of middle) {
    if (isRepeat(item)) {
      flush();
      blocks.push({ iterations: item.times, steps: item.steps.map(interval) });
    } else {
      single.push(interval(item));
    }
  }
  flush();

  return { warmup: warmup ? toWatchStep(warmup) : null, blocks, cooldown: cooldown ? toWatchStep(cooldown) : null };
}
