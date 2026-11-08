// Generator pierwszych tygodni planu (docs/PROJECT.md 4.3 i 5 – silnik reguł).
// Deterministyczny i bezpieczny: działa bez AI, jest też trybem awaryjnym.
//
// Zasady:
//  - plan od dnia startu; tydzień 0 trwa do najbliższej niedzieli, kolejne pon–nd,
//  - treningi tylko w preferowane dni, rozłożone możliwie równo w tygodniu,
//  - „nie biegam” → marsz-bieg; reszta: spokojne biegi + długi bieg w weekend,
//  - najwyżej jedna mocniejsza jednostka w tygodniu, nigdy dzień przed/po długim biegu,
//  - przyrost czasu tydzień do tygodnia ≤ 10%, każdy trening ≤ limit czasu z ankiety,
//  - przeciwwskazania → tylko spokojne jednostki, krótsze o ok. 20%.

import { addDaysIso, daysBetween, isoWeekday } from './dates.ts';
import type { Level, RaceDistanceM } from './goal.ts';

export const ENGINE_VERSION = '0.1.0';

export type SessionType = 'walk_run' | 'easy' | 'long' | 'intervals' | 'tempo' | 'recovery' | 'race';
export type Intensity = 'easy' | 'moderate' | 'hard';
export type WeekFocus = 'base' | 'build' | 'race';

export type SessionStructure =
  | { kind: 'walk_run'; warmupWalkMin: number; repeats: number; runMin: number; walkMin: number }
  | { kind: 'steady' }
  | { kind: 'intervals'; warmupMin: number; repeats: number; workMin: number; recoveryMin: number; cooldownMin: number }
  | { kind: 'tempo'; warmupMin: number; workMin: number; cooldownMin: number }
  | { kind: 'race'; distanceM: number };

export type PlannedSession = {
  scheduledOn: string;
  type: SessionType;
  durationMin: number | null;
  distanceM: number | null;
  intensity: Intensity;
  structure: SessionStructure;
};

export type PlannedWeek = {
  weekIndex: number;
  startsOn: string;
  endsOn: string;
  focus: WeekFocus;
  sessions: PlannedSession[];
};

export type GeneratedPlan = {
  engineVersion: string;
  startsOn: string;
  endsOn: string;
  weeks: PlannedWeek[];
};

export type PlanGoal =
  | { type: 'general'; focus: 'start_running' | 'improve_fitness' | 'run_regularly' }
  | { type: 'race'; distanceM: RaceDistanceM; raceDate: string };

export type PlanInput = {
  /** Dzień startu planu, `YYYY-MM-DD`. */
  startDate: string;
  level: Level;
  goal: PlanGoal;
  /** ISO: 1 = pn … 7 = nd. */
  preferredDays: number[];
  sessionsPerWeek: number;
  maxMinutesWeekday: number | null;
  maxMinutesWeekend: number | null;
  hasContraindications: boolean;
  /** Ile tygodni wygenerować (domyślnie 2). */
  weeks?: number;
};

const BASE_EASY_MIN: Record<Level, number> = { beginner: 25, intermediate: 30, advanced: 40 };
const WEEKLY_GROWTH = 1.1;
const LONG_FACTOR = 1.4;
const MIN_SESSION = 15;

const isWeekend = (weekday: number) => weekday >= 6;
const round5 = (min: number) => Math.max(5, Math.round(min / 5) * 5);

/** Wybiera `n` dni z dostępnych tak, by odstępy w tygodniu były jak największe (preferując weekend dla długiego biegu). */
export function pickTrainingDays(available: number[], n: number): number[] {
  const days = [...new Set(available)].sort((a, b) => a - b);
  if (n >= days.length) return days;
  if (n <= 0) return [];

  let best: number[] = [];
  let bestScore = -Infinity;
  const choose = (start: number, picked: number[]) => {
    if (picked.length === n) {
      const gaps = picked.map((d, i) => {
        const next = picked[(i + 1) % picked.length] ?? d;
        return (next - d + 7) % 7 || 7;
      });
      const minGap = Math.min(...gaps);
      const weekend = picked.some(isWeekend) ? 0.5 : 0;
      const score = minGap * 10 - Math.max(...gaps) + weekend;
      if (score > bestScore) {
        bestScore = score;
        best = [...picked];
      }
      return;
    }
    for (let i = start; i < days.length; i++) choose(i + 1, [...picked, days[i] as number]);
  };
  choose(0, []);
  return best;
}

function dayCap(input: PlanInput, weekday: number) {
  const cap = isWeekend(weekday) ? input.maxMinutesWeekend : input.maxMinutesWeekday;
  return cap ?? (isWeekend(weekday) ? 60 : 45);
}

function walkRun(duration: number, weekIndex: number, gentle: boolean): SessionStructure {
  const runMin = !gentle && weekIndex >= 1 ? 2 : 1;
  const walkMin = 2;
  const warmupWalkMin = 5;
  const repeats = Math.max(3, Math.floor((duration - warmupWalkMin) / (runMin + walkMin)));
  return { kind: 'walk_run', warmupWalkMin, repeats, runMin, walkMin };
}

function intervals(duration: number, level: Level): SessionStructure {
  const warmupMin = duration >= 40 ? 10 : 8;
  const cooldownMin = duration >= 40 ? 10 : 7;
  const workMin = level === 'advanced' ? 3 : 2;
  const recoveryMin = 2;
  const repeats = Math.max(3, Math.min(8, Math.floor((duration - warmupMin - cooldownMin) / (workMin + recoveryMin))));
  return { kind: 'intervals', warmupMin, repeats, workMin, recoveryMin, cooldownMin };
}

function tempo(duration: number): SessionStructure {
  const warmupMin = 10;
  const cooldownMin = 10;
  return { kind: 'tempo', warmupMin, workMin: Math.max(10, Math.min(25, duration - warmupMin - cooldownMin)), cooldownMin };
}

/** Czy w planie są mocniejsze jednostki (interwały / tempo) i w którym tygodniu się zaczynają. */
function qualityFrom(input: PlanInput): number | null {
  if (input.hasContraindications || input.level === 'beginner') return null;
  if (input.goal.type === 'general' && input.goal.focus !== 'improve_fitness') return null;
  return input.level === 'advanced' ? 0 : 1;
}

function buildWeek(input: PlanInput, weekIndex: number, startsOn: string, endsOn: string): PlannedWeek {
  const gentle = input.hasContraindications;
  const growth = WEEKLY_GROWTH ** weekIndex;
  const baseEasy = BASE_EASY_MIN[input.level] * growth * (gentle ? 0.8 : 1);

  // Dni tego tygodnia (tydzień 0 może być niepełny).
  const dates: string[] = [];
  for (let d = startsOn; d <= endsOn; d = addDaysIso(d, 1)) dates.push(d);
  const availableWeekdays = dates.map(isoWeekday).filter((w) => input.preferredDays.includes(w));
  const daysInWeek = dates.length;
  // W niepełnym tygodniu proporcjonalnie mniej treningów (co najmniej 1, jeśli są wolne dni).
  const target = Math.max(
    availableWeekdays.length ? 1 : 0,
    Math.min(availableWeekdays.length, Math.round((input.sessionsPerWeek * daysInWeek) / 7)),
  );
  const chosen = pickTrainingDays(availableWeekdays, target);
  const dateOf = (weekday: number) => dates.find((d) => isoWeekday(d) === weekday) as string;

  const walkRunMode = input.level === 'beginner';
  const longDay: number | null =
    !walkRunMode && chosen.length >= 2
      ? ([...chosen].reverse().find(isWeekend) ?? chosen[chosen.length - 1] ?? null)
      : null;

  const qWeek = qualityFrom(input);
  let qualityDay: number | null = null;
  if (qWeek !== null && weekIndex >= qWeek && chosen.length >= 3) {
    const candidates = chosen.filter((d) => d !== longDay);
    const dist = (d: number) => (longDay === null ? 7 : Math.min(Math.abs(d - longDay), 7 - Math.abs(d - longDay)));
    const sorted = [...candidates].sort((a, b) => dist(b) - dist(a));
    const pick = sorted.find((d) => dist(d) >= 2);
    qualityDay = pick ?? null;
  }
  const qualityType: SessionType =
    input.goal.type === 'race' && input.goal.distanceM >= 21097 ? 'tempo' : 'intervals';

  let sessions: PlannedSession[] = chosen.map((weekday) => {
    const scheduledOn = dateOf(weekday);
    const cap = dayCap(input, weekday);
    if (walkRunMode) {
      const duration = Math.max(MIN_SESSION, Math.min(cap, round5(baseEasy)));
      return {
        scheduledOn,
        type: 'walk_run',
        durationMin: duration,
        distanceM: null,
        intensity: 'easy',
        structure: walkRun(duration, weekIndex, gentle),
      };
    }
    if (weekday === longDay) {
      const duration = Math.max(MIN_SESSION, Math.min(cap, round5(baseEasy * LONG_FACTOR)));
      return { scheduledOn, type: 'long', durationMin: duration, distanceM: null, intensity: 'easy', structure: { kind: 'steady' } };
    }
    if (weekday === qualityDay) {
      const duration = Math.max(25, Math.min(cap, round5(baseEasy + 5)));
      return {
        scheduledOn,
        type: qualityType,
        durationMin: duration,
        distanceM: null,
        intensity: qualityType === 'intervals' ? 'hard' : 'moderate',
        structure: qualityType === 'intervals' ? intervals(duration, input.level) : tempo(duration),
      };
    }
    const duration = Math.max(MIN_SESSION, Math.min(cap, round5(baseEasy)));
    return { scheduledOn, type: 'easy', durationMin: duration, distanceM: null, intensity: 'easy', structure: { kind: 'steady' } };
  });

  let focus: WeekFocus = weekIndex === 0 ? 'base' : 'build';

  // Zawody w tym tygodniu: start w dniu zawodów, dzień przed i po – wolne, ostatnie 3 dni bez mocnych jednostek.
  if (input.goal.type === 'race' && input.goal.raceDate >= startsOn && input.goal.raceDate <= endsOn) {
    const raceDate = input.goal.raceDate;
    sessions = sessions
      .filter((s) => Math.abs(daysBetween(s.scheduledOn, raceDate)) > 1)
      .map((s) => {
        const daysBefore = daysBetween(s.scheduledOn, raceDate);
        if (daysBefore > 0 && daysBefore <= 3 && s.intensity !== 'easy') {
          return { ...s, type: 'easy', intensity: 'easy', durationMin: Math.min(s.durationMin ?? 20, 20), structure: { kind: 'steady' } };
        }
        return s;
      });
    sessions.push({
      scheduledOn: raceDate,
      type: 'race',
      durationMin: null,
      distanceM: input.goal.distanceM,
      intensity: 'hard',
      structure: { kind: 'race', distanceM: input.goal.distanceM },
    });
    sessions.sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn));
    focus = 'race';
  }

  return { weekIndex, startsOn, endsOn, focus, sessions };
}

const weekMinutes = (w: PlannedWeek) => w.sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);

const isFullWeek = (w: PlannedWeek) => daysBetween(w.startsOn, w.endsOn) === 6;

/**
 * Twardy limit przyrostu: pełny tydzień ≤ poprzedni pełny × 1,1.
 * Po niepełnym tygodniu 0 (start w środku tygodnia) nie ma z czym porównać – wtedy obowiązuje
 * tylko bazowy przyrost czasu jednostek.
 * Przycina po 5 min najdłuższe treningi (poza zawodami), nie schodząc poniżej minimum.
 */
function capGrowth(prev: PlannedWeek, week: PlannedWeek): PlannedWeek {
  if (week.focus === 'race' || !isFullWeek(prev)) return week;
  const limit = weekMinutes(prev) * WEEKLY_GROWTH;
  const sessions = week.sessions.map((s) => ({ ...s }));
  const trimmed = { ...week, sessions };
  for (let guard = 0; guard < 50 && weekMinutes(trimmed) > limit; guard++) {
    const longest = sessions
      .filter((s) => s.type !== 'race' && (s.durationMin ?? 0) - 5 >= MIN_SESSION)
      .sort((a, b) => (b.durationMin ?? 0) - (a.durationMin ?? 0))[0];
    if (!longest || longest.durationMin === null) break;
    longest.durationMin -= 5;
    if (longest.structure.kind === 'intervals') longest.structure = intervals(longest.durationMin, 'intermediate');
    if (longest.structure.kind === 'tempo') longest.structure = tempo(longest.durationMin);
    if (longest.structure.kind === 'walk_run') {
      longest.structure = { ...longest.structure, repeats: Math.max(3, longest.structure.repeats - 1) };
    }
  }
  return trimmed;
}

/** Generuje pierwsze tygodnie planu (domyślnie 2) od daty startu. */
export function generateInitialPlan(input: PlanInput): GeneratedPlan {
  const count = input.weeks ?? 2;
  const weeks: PlannedWeek[] = [];
  let startsOn = input.startDate;
  for (let i = 0; i < count; i++) {
    const endsOn = addDaysIso(startsOn, 7 - isoWeekday(startsOn));
    const week = buildWeek(input, i, startsOn, endsOn);
    const prev = weeks[weeks.length - 1];
    weeks.push(prev && weekMinutes(prev) > 0 ? capGrowth(prev, week) : week);
    startsOn = addDaysIso(endsOn, 1);
  }
  return {
    engineVersion: ENGINE_VERSION,
    startsOn: input.startDate,
    endsOn: weeks[weeks.length - 1]?.endsOn ?? input.startDate,
    weeks,
  };
}
