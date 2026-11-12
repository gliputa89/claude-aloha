// Cele biegacza (zakładka „Cele”, docs/PROJECT.md 4.2 i 8): rodzaje, propozycje z ankiety, wpływ na plan i postęp.
//
// Jeden cel PROWADZI plan (role = primary): z niego silnik wie, jak układać tygodnie (zawody albo cel ogólny).
// Do trzech celów jest OBOK (secondary): mają własny postęp, a na plan wpływają tylko lokalnie –
// zawody B i sprawdziany z celów wynikowych zastępują mocny trening w swoim tygodniu (`checkpointsFromGoals`).
// Wszystko deterministyczne, bez AI – to samo liczy aplikacja, Edge Functions i testy.

import { addDaysIso, daysBetween, isoWeekday } from '../core/dates.ts';
import { forecastRace, danielsEquivalentS } from '../plan/forecast.ts';
import { RACE_DISTANCES_M, type Level, type RaceDistanceM } from '../plan/goal.ts';
import type { Checkpoint } from '../plan/plan.ts';

export type GoalKind = 'race' | 'performance' | 'continuous' | 'consistency' | 'volume';
export type GoalRole = 'primary' | 'secondary';
/** Zawody: A – prowadzą plan, B – start kontrolny, C – dla zabawy (plan bez zmian). */
export type RacePriority = 'A' | 'B' | 'C';
export type GoalStatus = 'active' | 'achieved' | 'completed' | 'abandoned';
/** Nastawienie planu przy celu ogólnym (goals.general_focus). */
export type PlanFocus = 'start_running' | 'improve_fitness' | 'run_regularly';

/** Najwięcej celów obok prowadzącego (tak samo pilnuje baza: goals_check_secondary_limit). */
export const MAX_SECONDARY_GOALS = 3;

/**
 * Cel do zapisania (RPC goal_from_spec, add_goal, complete_onboarding). Pola zależą od rodzaju:
 *   race – distanceM, date (dzień zawodów), opcjonalnie targetTimeS, name, priority,
 *   performance – distanceM, targetTimeS, opcjonalnie date (tydzień sprawdzianu),
 *   continuous – targetMinutes i/lub distanceM,
 *   consistency – sessionsPerWeek, periodStart, periodEnd,
 *   volume – volumeKm, periodStart, periodEnd.
 */
export type GoalSpec = {
  kind: GoalKind;
  name?: string | null;
  distanceM?: number | null;
  date?: string | null;
  targetTimeS?: number | null;
  targetMinutes?: number | null;
  sessionsPerWeek?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  volumeKm?: number | null;
  priority?: RacePriority | null;
  focus?: PlanFocus | null;
};

/** Cel z bazy (public.goals). */
export type GoalRow = {
  id: string;
  kind: GoalKind;
  role: GoalRole;
  priority: RacePriority | null;
  status: GoalStatus;
  distance_m: number | null;
  race_date: string | null;
  target_time_s: number | null;
  race_name: string | null;
  target_minutes: number | null;
  sessions_per_week: number | null;
  volume_km: number | null;
  period_start: string | null;
  period_end: string | null;
  due_on: string | null;
  result_time_s: number | null;
  finished_at: string | null;
  plan_starts_on: string | null;
  created_at: string;
};

/** Kolumny celu do zapytania `select` (aplikacja, Edge Functions). */
export const GOAL_COLUMNS =
  'id, kind, role, priority, status, distance_m, race_date, target_time_s, race_name, target_minutes, sessions_per_week, volume_km, period_start, period_end, due_on, result_time_s, finished_at, plan_starts_on, created_at';

const DAY = 1;
const WEEK = 7 * DAY;

/** Nastawienie planu dla celu (gdy cel prowadzi): to samo wylicza baza, gdy `focus` nie przyjdzie. */
export function planFocusOf(spec: Pick<GoalSpec, 'kind' | 'focus'>): PlanFocus | null {
  if (spec.kind === 'race') return null;
  if (spec.focus) return spec.focus;
  return spec.kind === 'continuous' ? 'start_running' : spec.kind === 'performance' ? 'improve_fitness' : 'run_regularly';
}

/** Dzień tygodnia → poniedziałek tego tygodnia. */
const mondayOf = (iso: string) => addDaysIso(iso, 1 - isoWeekday(iso));

// ───────────────────────── wpływ na plan ─────────────────────────

/**
 * Starty kontrolne i sprawdziany z aktywnych celów: zawody B (dzień startu) i cele wynikowe z datą (tydzień
 * sprawdzianu – także cel prowadzący). Zawody A prowadzą plan same, zawody C plan pomija.
 */
export function checkpointsFromGoals(goals: GoalRow[]): Checkpoint[] {
  const out: Checkpoint[] = [];
  for (const g of goals) {
    if (g.status !== 'active' || !g.distance_m) continue;
    if (g.kind === 'race' && g.role === 'secondary' && g.priority === 'B' && g.race_date) {
      out.push({ kind: 'B', date: g.race_date, distanceM: g.distance_m });
    } else if (g.kind === 'performance' && g.due_on) {
      out.push({ kind: 'trial', date: g.due_on, distanceM: g.distance_m });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ───────────────────────── propozycje z ankiety ─────────────────────────

/** Kierunek z pierwszego kroku ankiety („Co chcesz osiągnąć?”). */
export type GoalDirection = 'start_running' | 'run_regularly' | 'faster' | 'race' | 'further';

export type SuggestGoalsInput = {
  direction: GoalDirection;
  level: Level;
  /** Ostatni wynik z ankiety. */
  recent: { distanceM: number; timeS: number } | null;
  weeklyKm: number | null;
  runsPerWeek: number;
  /** Treningi w tygodniu z planu (krok dostępności). */
  sessionsPerWeek: number;
  /** Ile minut w tygodniu biegacz ma na treningi. */
  weeklyMinutesCap: number | null;
  planStartDate: string;
  /** Zawody z pierwszego kroku (kierunek `race`). */
  race?: { distanceM: RaceDistanceM; date: string; name: string | null; targetTimeS: number | null } | null;
  /** Dystans z pierwszego kroku (kierunek `further`). */
  furtherDistanceM?: RaceDistanceM | null;
};

export type GoalSuggestion = { spec: GoalSpec; checked: boolean };

export type SuggestedGoals = {
  primary: GoalSpec;
  /** Cele obok: zaznaczone domyślnie te, które pasują prawie zawsze. */
  secondary: GoalSuggestion[];
};

/** Tygodnie przygotowań do celu wynikowego bez daty zawodów (sprawdzian na końcu). */
export const PERFORMANCE_WEEKS = 10;
/** Okres celu „regularnie” proponowany w ankiecie. */
export const CONSISTENCY_WEEKS: Record<GoalDirection, number> = {
  start_running: 8,
  run_regularly: 12,
  faster: PERFORMANCE_WEEKS,
  race: 12,
  further: 10,
};

/**
 * Czas celu zaokrąglony w górę (nie obiecuje za dużo): do 10 km co 10 s, półmaraton co 30 s, dłuższe co minutę.
 * Grubsze zaokrąglenie na 10 km zjadałoby całą poprawę z kilku tygodni (np. 47:20 → 48:00 = obecny wynik).
 */
export function roundTargetS(distanceM: number, timeS: number) {
  const step = distanceM <= 10000 ? 10 : distanceM <= 21097 ? 30 : 60;
  return Math.ceil(timeS / step) * step;
}

/** Dystans zawodów najbliższy podanemu (wynik z ankiety może być z dowolnego z listy). */
const raceDistanceOf = (distanceM: number): RaceDistanceM =>
  RACE_DISTANCES_M.reduce((best, d) => (Math.abs(d - distanceM) < Math.abs(best - distanceM) ? d : best), RACE_DISTANCES_M[0]);

/** Krótszy dystans do sprawdzianu w połowie przygotowań (półmaraton → 10 km). */
const SHORTER: Partial<Record<RaceDistanceM, RaceDistanceM>> = { 10000: 5000, 21097: 10000, 42195: 21097 };

/** Realny czas na dystansie za `weeks` tygodni (reguły: tabele Danielsa + objętość), zaokrąglony jak cel. */
export function realisticTargetS(input: {
  distanceM: RaceDistanceM;
  weeks: number;
  level: Level;
  recent: { distanceM: number; timeS: number } | null;
  weeklyKm: number | null;
  runsPerWeek: number;
  weeklyMinutesCap: number | null;
}): number | null {
  if (!input.recent) return null;
  const forecast = forecastRace({
    distanceM: input.distanceM,
    weeks: Math.max(0, input.weeks),
    level: input.level,
    recent: input.recent,
    weeklyKm: input.weeklyKm,
    runsPerWeek: Math.max(1, input.runsPerWeek),
    weeklyMinutesCap: input.weeklyMinutesCap,
  });
  return forecast ? roundTargetS(input.distanceM, forecast.raceDayS) : null;
}

/** Kilometry w tygodniu: wpisane albo szacunek z liczby treningów (ok. 5 km na trening, 3 km u początkujących). */
const weeklyKmEstimate = (input: SuggestGoalsInput) =>
  input.weeklyKm ?? input.sessionsPerWeek * (input.level === 'beginner' ? 3 : 5);

const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Cele z odpowiedzi w ankiecie: prowadzący + propozycje obok (docs/PROJECT.md 4.2, makieta „Twoje cele”). */
export function suggestGoals(input: SuggestGoalsInput): SuggestedGoals {
  const start = input.planStartDate;
  const consistency = (weeks: number, checked: boolean): GoalSuggestion => ({
    checked,
    spec: {
      kind: 'consistency',
      sessionsPerWeek: input.sessionsPerWeek,
      periodStart: start,
      periodEnd: addDaysIso(start, weeks * WEEK - 1),
    },
  });

  switch (input.direction) {
    case 'start_running':
      return {
        primary: { kind: 'continuous', distanceM: 5000, targetMinutes: 30, focus: 'start_running' },
        secondary: [
          consistency(CONSISTENCY_WEEKS.start_running, true),
          {
            checked: false,
            spec: {
              kind: 'volume',
              volumeKm: roundTo5(weeklyKmEstimate(input) * 4),
              periodStart: start,
              periodEnd: addDaysIso(start, 4 * WEEK - 1),
            },
          },
        ],
      };

    case 'run_regularly': {
      const secondary: GoalSuggestion[] = [
        {
          checked: false,
          spec: {
            kind: 'volume',
            volumeKm: roundTo5(weeklyKmEstimate(input) * 4 * 1.1),
            periodStart: start,
            periodEnd: addDaysIso(start, 4 * WEEK - 1),
          },
        },
      ];
      const recentDistance = input.recent ? raceDistanceOf(input.recent.distanceM) : null;
      const target = recentDistance
        ? realisticTargetS({ ...input, distanceM: recentDistance, weeks: PERFORMANCE_WEEKS })
        : null;
      if (recentDistance && target) {
        secondary.push({
          checked: false,
          spec: { kind: 'performance', distanceM: recentDistance, targetTimeS: target, date: addDaysIso(start, PERFORMANCE_WEEKS * WEEK - 1) },
        });
      }
      return {
        primary: {
          kind: 'consistency',
          sessionsPerWeek: input.sessionsPerWeek,
          periodStart: start,
          periodEnd: addDaysIso(start, CONSISTENCY_WEEKS.run_regularly * WEEK - 1),
          focus: 'run_regularly',
        },
        secondary,
      };
    }

    case 'faster': {
      const distanceM = input.recent ? raceDistanceOf(input.recent.distanceM) : 5000;
      // Bez wyniku nie zgadujemy czasu – biegacz wpisze go sam na ekranie celów.
      const target = realisticTargetS({ ...input, distanceM, weeks: PERFORMANCE_WEEKS });
      return {
        primary: {
          kind: 'performance',
          distanceM,
          targetTimeS: target,
          date: addDaysIso(start, PERFORMANCE_WEEKS * WEEK - 1),
          focus: 'improve_fitness',
        },
        secondary: [consistency(CONSISTENCY_WEEKS.faster, true)],
      };
    }

    case 'further': {
      const distanceM = input.furtherDistanceM ?? 10000;
      return {
        primary: { kind: 'continuous', distanceM, targetMinutes: null, focus: input.level === 'beginner' ? 'start_running' : 'run_regularly' },
        secondary: [consistency(CONSISTENCY_WEEKS.further, true)],
      };
    }

    case 'race': {
      const race = input.race;
      if (!race) return suggestGoals({ ...input, direction: 'run_regularly' });
      const secondary: GoalSuggestion[] = [];
      const weeks = Math.floor(daysBetween(start, race.date) / WEEK);
      const shorter = SHORTER[race.distanceM];
      // Sprawdzian na krótszym dystansie w połowie drogi – gdy do startu jest dość czasu i znamy wynik.
      if (shorter && weeks >= 8 && input.recent) {
        const midWeeks = Math.floor(weeks / 2);
        const target = realisticTargetS({ ...input, distanceM: shorter, weeks: midWeeks });
        if (target) {
          secondary.push({
            checked: true,
            spec: { kind: 'performance', distanceM: shorter, targetTimeS: target, date: addDaysIso(mondayOf(start), midWeeks * WEEK + 6) },
          });
        }
      }
      // Regularność do tygodnia przed startem.
      if (weeks >= 3) {
        secondary.push({
          checked: true,
          spec: {
            kind: 'consistency',
            sessionsPerWeek: input.sessionsPerWeek,
            periodStart: start,
            periodEnd: addDaysIso(race.date, -1),
          },
        });
      }
      return {
        primary: { kind: 'race', distanceM: race.distanceM, date: race.date, name: race.name, targetTimeS: race.targetTimeS },
        secondary,
      };
    }
  }
}

// ───────────────────────── po osiągnięciu celu ─────────────────────────

/** Propozycje kolejnego celu po zakończonym (ekran „Co dalej?”). `race` – zachęta do dodania zawodów (bez daty). */
export type NextGoalSuggestion = { spec: GoalSpec; recommended: boolean } | { addRace: true; distanceM: RaceDistanceM };

export function nextGoalSuggestions(input: {
  finished: Pick<GoalRow, 'kind' | 'distance_m' | 'target_minutes'>;
  resultTimeS: number | null;
  sessionsPerWeek: number;
  today: string;
}): NextGoalSuggestion[] {
  const { finished, today } = input;
  const out: NextGoalSuggestion[] = [];
  const due = addDaysIso(today, 12 * WEEK - 1);
  const distance = finished.distance_m ? raceDistanceOf(finished.distance_m) : null;

  if ((finished.kind === 'race' || finished.kind === 'performance') && distance && input.resultTimeS) {
    // Szybciej na krótszym dystansie: ok. 2% lepiej niż odpowiednik obecnej formy.
    const shorter = SHORTER[distance] ?? distance;
    const equivalent = danielsEquivalentS({ distanceM: distance, timeS: input.resultTimeS }, shorter);
    if (equivalent) {
      out.push({
        recommended: true,
        spec: { kind: 'performance', distanceM: shorter, targetTimeS: roundTargetS(shorter, equivalent * 0.98), date: due },
      });
    }
    const longer = RACE_DISTANCES_M.find((d) => d > distance);
    if (longer) out.push({ addRace: true, distanceM: longer });
  } else if (finished.kind === 'continuous') {
    // Po pierwszym ciągłym biegu: dłużej albo pierwsze zawody na tym dystansie.
    const next = RACE_DISTANCES_M.find((d) => d > (finished.distance_m ?? 5000)) ?? 10000;
    out.push({ recommended: true, spec: { kind: 'continuous', distanceM: next, focus: 'run_regularly' } });
    out.push({ addRace: true, distanceM: raceDistanceOf(finished.distance_m ?? 5000) });
  } else {
    out.push({ addRace: true, distanceM: 10000 });
  }

  out.push({
    recommended: out.length === 0,
    spec: { kind: 'consistency', sessionsPerWeek: input.sessionsPerWeek, periodStart: today, periodEnd: due, focus: 'run_regularly' },
  });
  return out;
}

// ───────────────────────── postęp ─────────────────────────

/** Trening z bazy do liczenia postępu (dowolny plan, także archiwalny). */
export type ProgressSession = {
  scheduled_on: string;
  type: string;
  status: string;
  duration_min: number | null;
  structure: unknown;
  actual_distance_m: number | null;
  actual_duration_s: number | null;
};

/** Bieg ze Stravy (także bez treningu w planie). */
export type ProgressActivity = { local_date: string; distance_m: number; moving_time_s: number };

export type ProgressContext = {
  today: string;
  sessions: ProgressSession[];
  activities: ProgressActivity[];
  level: Level;
  /** Ostatni wynik z ankiety – punkt wyjścia celu wynikowego i podstawa prognozy. */
  recent: { distanceM: number; timeS: number } | null;
  weeklyKm: number | null;
  runsPerWeek: number;
  weeklyMinutesCap: number | null;
};

export type GoalProgress =
  | {
      kind: 'race';
      daysLeft: number;
      /** Tydzień przygotowań (od 1) i ile ich jest – od startu celu do zawodów. */
      week: number;
      weeks: number;
      /** Prognoza z reguł: dziś i na dzień startu; `null` bez wyniku z ankiety. */
      forecastTodayS: number | null;
      forecastRaceDayS: number | null;
      /** Zawody już były – czas wpisać wynik. */
      past: boolean;
    }
  | {
      kind: 'performance';
      /** Najlepszy czas na dystansie od założenia celu (wpisany, ze startu albo przeliczony z biegu ze Stravy). */
      bestS: number | null;
      /** Punkt wyjścia: wynik z ankiety przeliczony na dystans celu. */
      baselineS: number | null;
      fraction: number;
      achieved: boolean;
      daysLeft: number | null;
    }
  | {
      kind: 'continuous';
      mode: 'minutes' | 'distance';
      /** Kroki drabinki (minuty) – tylko dla celu liczonego czasem. */
      steps: number[];
      /** Najdłuższy ciągły bieg: minuty albo metry. */
      current: number;
      target: number;
      fraction: number;
      achieved: boolean;
    }
  | {
      kind: 'consistency';
      /** Każdy tydzień okresu: `done` (komplet), `current` (trwa), `open` (przed nami albo bez kompletu – bez wstydu). */
      weeks: ('done' | 'current' | 'open')[];
      doneWeeks: number;
      totalWeeks: number;
      thisWeek: number;
      perWeek: number;
      /** Ile pełnych tygodni z rzędu do ostatniego zakończonego (bieżący nie przerywa serii). */
      streak: number;
      achieved: boolean;
    }
  | {
      kind: 'volume';
      km: number;
      targetKm: number;
      /** Ile kilometrów „powinno być” dziś przy równym tempie. */
      expectedKm: number;
      fraction: number;
      daysLeft: number;
      achieved: boolean;
    };

const DONE = new Set(['done', 'partial']);
const RUN_TYPES = new Set(['walk_run', 'easy', 'long', 'intervals', 'tempo', 'recovery', 'race']);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Dzień założenia celu `YYYY-MM-DD`. */
const createdOn = (g: Pick<GoalRow, 'created_at'>) => g.created_at.slice(0, 10);

/**
 * Kroki drabinki „bez zatrzymania” do `target` minut: 1 → 3 → 5 → 10 → 20 → 30 (dla dłuższych celów dalej co 15 min),
 * najwyżej 7 kroków.
 */
export function continuousSteps(target: number): number[] {
  const base = [1, 3, 5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120];
  let steps = base.filter((m) => m < target);
  if (target <= 30) steps = steps.filter((m) => m !== 15);
  steps.push(target);
  while (steps.length > 7) {
    // Zostaw pierwszy i ostatni, usuwaj co drugi ze środka.
    steps = steps.filter((_, i) => i === 0 || i === steps.length - 1 || i % 2 === 0);
  }
  return steps;
}

/**
 * Tygodnie celu „regularnie” (poniedziałki): tydzień kalendarzowy liczy się, gdy co najmniej 4 jego dni są w okresie
 * celu – start w piątek nie dokłada niepełnego tygodnia, a „przez 12 tygodni” to 12 kresek, nie 13.
 */
export function consistencyWeeks(start: string, end: string): string[] {
  const out: string[] = [];
  for (let monday = mondayOf(start); monday <= end; monday = addDaysIso(monday, WEEK)) {
    const from = monday > start ? monday : start;
    const sunday = addDaysIso(monday, 6);
    const to = sunday < end ? sunday : end;
    if (daysBetween(from, to) + 1 >= 4) out.push(monday);
  }
  return out.length ? out : [mondayOf(start)];
}

/** Najdłuższy ciągły bieg (minuty) z wykonanych treningów: marsz-bieg → odcinek biegu, reszta → cały trening. */
function longestContinuousMin(sessions: ProgressSession[], since: string) {
  let best = 0;
  for (const s of sessions) {
    if (!DONE.has(s.status) || s.scheduled_on < since || !RUN_TYPES.has(s.type)) continue;
    const st = (s.structure ?? {}) as { kind?: string; runMin?: number };
    const minutes =
      s.type === 'walk_run' || st.kind === 'walk_run'
        ? (st.runMin ?? 0)
        : s.actual_duration_s
          ? s.actual_duration_s / 60
          : (s.duration_min ?? 0) * (s.status === 'partial' ? 0.5 : 1);
    best = Math.max(best, Math.floor(minutes));
  }
  return best;
}

/** Najdłuższy bieg (metry) z treningów (poza marszobiegiem) i ze Stravy. */
function longestRunM(ctx: ProgressContext, since: string) {
  let best = 0;
  for (const s of ctx.sessions) {
    if (!DONE.has(s.status) || s.scheduled_on < since || s.type === 'walk_run' || !RUN_TYPES.has(s.type)) continue;
    best = Math.max(best, s.actual_distance_m ?? 0);
  }
  for (const a of ctx.activities) if (a.local_date >= since) best = Math.max(best, a.distance_m);
  return best;
}

/** Najlepszy czas na dystansie: wpisany wynik, start / sprawdzian z planu, bieg ze Stravy co najmniej tak długi (tempo × dystans). */
export function bestTimeOnDistance(distanceM: number, ctx: ProgressContext, since: string, entered: number | null): number | null {
  let best = entered ?? Number.POSITIVE_INFINITY;
  const consider = (distance: number | null, timeS: number | null) => {
    if (!distance || !timeS || distance < distanceM * 0.98 || distance > distanceM * 1.5) return;
    best = Math.min(best, Math.round((timeS * distanceM) / distance));
  };
  for (const s of ctx.sessions) {
    if (s.scheduled_on >= since && DONE.has(s.status)) consider(s.actual_distance_m, s.actual_duration_s);
  }
  for (const a of ctx.activities) if (a.local_date >= since) consider(a.distance_m, a.moving_time_s);
  return Number.isFinite(best) ? best : null;
}

/** Biegi w dniu (treningi z planu i biegi ze Stravy bez treningu – liczone raz na dzień i trening). */
function runsByDay(ctx: ProgressContext) {
  const days = new Map<string, number>();
  const sessionDays = new Map<string, number>();
  for (const s of ctx.sessions) {
    if (DONE.has(s.status) && RUN_TYPES.has(s.type)) sessionDays.set(s.scheduled_on, (sessionDays.get(s.scheduled_on) ?? 0) + 1);
  }
  const activityDays = new Map<string, number>();
  for (const a of ctx.activities) if (a.distance_m >= 1000) activityDays.set(a.local_date, (activityDays.get(a.local_date) ?? 0) + 1);
  // Bieg ze Stravy zwykle JEST treningiem z planu – w danym dniu bierzemy większą z dwóch liczb, nie sumę.
  for (const day of new Set([...sessionDays.keys(), ...activityDays.keys()])) {
    days.set(day, Math.max(sessionDays.get(day) ?? 0, activityDays.get(day) ?? 0));
  }
  return days;
}

/** Kilometry w okresie: biegi ze Stravy; dni bez nich – faktyczny dystans wykonanych treningów. */
function kmIn(ctx: ProgressContext, from: string, to: string) {
  let m = 0;
  const stravaDays = new Set<string>();
  for (const a of ctx.activities) {
    if (a.local_date < from || a.local_date > to) continue;
    m += a.distance_m;
    stravaDays.add(a.local_date);
  }
  for (const s of ctx.sessions) {
    if (s.scheduled_on < from || s.scheduled_on > to || !DONE.has(s.status) || stravaDays.has(s.scheduled_on)) continue;
    m += s.actual_distance_m ?? 0;
  }
  return Math.round(m / 100) / 10;
}

export function goalProgress(goal: GoalRow, ctx: ProgressContext): GoalProgress {
  const { today } = ctx;
  const since = createdOn(goal);

  switch (goal.kind) {
    case 'race': {
      const raceDate = goal.race_date ?? today;
      const startOn = goal.plan_starts_on && goal.plan_starts_on < raceDate ? goal.plan_starts_on : since;
      const weeks = Math.max(1, Math.ceil((daysBetween(startOn, raceDate) + 1) / WEEK));
      const week = Math.min(weeks, Math.max(1, Math.floor(daysBetween(startOn, today) / WEEK) + 1));
      const distance = goal.distance_m ? raceDistanceOf(goal.distance_m) : null;
      const forecast =
        distance && ctx.recent
          ? forecastRace({
              distanceM: distance,
              weeks: Math.max(0, Math.floor(daysBetween(today, raceDate) / WEEK)),
              level: ctx.level,
              recent: ctx.recent,
              weeklyKm: ctx.weeklyKm,
              runsPerWeek: Math.max(1, ctx.runsPerWeek),
              weeklyMinutesCap: ctx.weeklyMinutesCap,
            })
          : null;
      const daysLeft = daysBetween(today, raceDate);
      return {
        kind: 'race',
        daysLeft,
        week,
        weeks,
        forecastTodayS: forecast?.todayS ?? null,
        forecastRaceDayS: forecast?.raceDayS ?? null,
        past: daysLeft < 0,
      };
    }

    case 'performance': {
      const distance = goal.distance_m ?? 5000;
      const target = goal.target_time_s ?? 0;
      const bestS = bestTimeOnDistance(distance, ctx, since, goal.result_time_s);
      const baselineS = ctx.recent ? (danielsEquivalentS(ctx.recent, distance) ?? null) : null;
      const from = baselineS !== null && bestS !== null ? Math.max(baselineS, bestS) : baselineS;
      const achieved = bestS !== null && target > 0 && bestS <= target;
      const fraction = achieved ? 1 : from !== null && bestS !== null && from > target ? clamp01((from - bestS) / (from - target)) : 0;
      return {
        kind: 'performance',
        bestS,
        baselineS: baselineS === null ? null : Math.round(baselineS),
        fraction,
        achieved,
        daysLeft: goal.due_on ? daysBetween(today, goal.due_on) : null,
      };
    }

    case 'continuous': {
      if (goal.target_minutes) {
        const current = longestContinuousMin(ctx.sessions, since);
        const distanceDone = goal.distance_m ? longestRunM({ ...ctx, activities: [] }, since) >= goal.distance_m : false;
        const achieved = current >= goal.target_minutes || distanceDone;
        return {
          kind: 'continuous',
          mode: 'minutes',
          steps: continuousSteps(goal.target_minutes),
          current: achieved ? Math.max(current, goal.target_minutes) : current,
          target: goal.target_minutes,
          fraction: achieved ? 1 : clamp01(current / goal.target_minutes),
          achieved,
        };
      }
      const target = goal.distance_m ?? 5000;
      const current = longestRunM(ctx, since);
      return {
        kind: 'continuous',
        mode: 'distance',
        steps: [],
        current,
        target,
        fraction: clamp01(current / target),
        achieved: current >= target * 0.99,
      };
    }

    case 'consistency': {
      const perWeek = goal.sessions_per_week ?? 3;
      const startOn = goal.period_start ?? since;
      const endOn = goal.period_end ?? addDaysIso(startOn, 12 * WEEK - 1);
      const runs = runsByDay(ctx);
      const weeks: ('done' | 'current' | 'open')[] = [];
      let thisWeek = 0;
      // Tygodnie kalendarzowe (pn–nd) okresu celu – patrz `consistencyWeeks`.
      for (const monday of consistencyWeeks(startOn, endOn)) {
        const sunday = addDaysIso(monday, 6);
        let count = 0;
        for (let d = monday; d <= sunday; d = addDaysIso(d, 1)) if (d >= startOn && d <= endOn) count += runs.get(d) ?? 0;
        const isCurrent = today >= monday && today <= sunday;
        if (isCurrent) thisWeek = count;
        weeks.push(count >= perWeek ? 'done' : isCurrent ? 'current' : 'open');
      }
      const doneWeeks = weeks.filter((w) => w === 'done').length;
      // Seria: pełne tygodnie z rzędu wstecz od dzisiejszego; niepełny bieżący tydzień serii nie przerywa.
      let streak = 0;
      const mondays = consistencyWeeks(startOn, endOn);
      let i = mondays.filter((m) => m <= today).length - 1;
      if (i >= 0 && weeks[i] === 'current') i--;
      for (; i >= 0 && weeks[i] === 'done'; i--) streak++;
      return {
        kind: 'consistency',
        weeks,
        doneWeeks,
        totalWeeks: weeks.length,
        thisWeek,
        perWeek,
        streak,
        achieved: weeks.length > 0 && doneWeeks >= weeks.length,
      };
    }

    case 'volume': {
      const from = goal.period_start ?? since;
      const to = goal.period_end ?? addDaysIso(from, 4 * WEEK - 1);
      const targetKm = goal.volume_km ?? 0;
      const km = kmIn(ctx, from, to);
      const total = daysBetween(from, to) + 1;
      const elapsed = Math.max(0, Math.min(total, daysBetween(from, today) + 1));
      return {
        kind: 'volume',
        km,
        targetKm,
        expectedKm: Math.round((targetKm * elapsed) / total),
        fraction: targetKm > 0 ? clamp01(km / targetKm) : 0,
        daysLeft: Math.max(0, daysBetween(today, to)),
        achieved: targetKm > 0 && km >= targetKm,
      };
    }
  }
}

/** Kolejność na liście: najpierw te z bliższą datą (zawody, sprawdzian, koniec okresu), na końcu bez daty. */
export function goalDate(goal: Pick<GoalRow, 'kind' | 'race_date' | 'due_on' | 'period_end'>): string | null {
  return goal.kind === 'race' ? goal.race_date : goal.kind === 'performance' ? goal.due_on : goal.period_end;
}

export function sortGoals<T extends Pick<GoalRow, 'kind' | 'race_date' | 'due_on' | 'period_end' | 'created_at'>>(goals: T[]): T[] {
  return [...goals].sort((a, b) => {
    const da = goalDate(a) ?? '9999-12-31';
    const db = goalDate(b) ?? '9999-12-31';
    return da === db ? a.created_at.localeCompare(b.created_at) : da.localeCompare(db);
  });
}
