// Generator pierwszych tygodni planu (docs/PROJECT.md 4.3 i 5 – silnik reguł).
// Deterministyczny i bezpieczny: działa bez AI, jest też trybem awaryjnym.
//
// Zasady:
//  - plan od dnia startu; tydzień 0 trwa do najbliższej niedzieli, kolejne pon–nd,
//  - treningi tylko w preferowane dni, rozłożone możliwie równo w tygodniu,
//  - „nie biegam” → marsz-bieg; reszta: spokojne biegi + długi bieg w weekend,
//  - najwyżej jedna mocniejsza jednostka w tygodniu, nigdy dzień przed/po długim biegu; od poziomu 3 interwały
//    przeplatają się z treningiem progowym, którego odcinki wydłużają się z tygodnia na tydzień,
//  - na wyższych poziomach cykl obciążenia: kilka tygodni rosnących, potem jeden lżejszy (parametr deloadEveryWeeks),
//  - objętość i przyrost wg poziomu zaawansowania 1–5 (levels.ts), każdy trening ≤ limit czasu z ankiety,
//  - przeciwwskazania → tylko spokojne jednostki, krótsze o ok. 20%.

import { addDaysIso, daysBetween, isoWeekday } from '../core/dates.ts';
import type { Level, RaceDistanceM } from './goal.ts';
import { trainingLevelOf, type TrainingLevel } from './levels.ts';
import { paramsForLevel, resolveEngineParams, type EngineParams, type LevelParams } from './params.ts';
import { paceZonesFrom, stepsFromStructure, type WorkoutItem } from '../core/workout.ts';

export const ENGINE_VERSION = '0.7.0';

export type SessionType = 'walk_run' | 'easy' | 'long' | 'intervals' | 'tempo' | 'recovery' | 'race';
export type Intensity = 'easy' | 'moderate' | 'hard';
/** `recovery` – lżejszy tydzień cyklu (np. co czwarty): mniejsza objętość, krótsza mocna jednostka. */
export type WeekFocus = 'base' | 'build' | 'recovery' | 'race';

export type SessionStructure = (
  | { kind: 'walk_run'; warmupWalkMin: number; repeats: number; runMin: number; walkMin: number }
  | { kind: 'steady' }
  | { kind: 'intervals'; warmupMin: number; repeats: number; workMin: number; recoveryMin: number; cooldownMin: number }
  /** Tempo ciągłe albo – z `repeats` – trening progowy w odcinkach (np. 3×10 min z 2 min truchtu). */
  | { kind: 'tempo'; warmupMin: number; workMin: number; cooldownMin: number; repeats?: number; recoveryMin?: number }
  /** `checkpoint`: start kontrolny (B) albo sprawdzian formy z celu wynikowego; brak – główne zawody. */
  | { kind: 'race'; distanceM: number; checkpoint?: CheckpointKind }
) & {
  /** Odcinki: rozgrzewka → część główna (powtórzenia, przerwy) → schłodzenie; suma = długość treningu. */
  steps?: WorkoutItem[];
  /** Część główna ułożona przez AI (a nie domyślna z typu). */
  custom?: boolean;
};

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
  /**
   * Baza objętości tygodnia: długość spokojnego biegu przed zaokrągleniem i skróceniem przy przeciwwskazaniach.
   * Zapisywana z tygodniem – kolejny tydzień rośnie od niej (bez zaokrągleń, które przy małym przyroście zatrzymałyby wzrost).
   */
  baseEasyMin?: number;
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

/** Start kontrolny z celu obok (zawody B) albo sprawdzian z celu wynikowego (bieg na czas w wybranym tygodniu). */
export type CheckpointKind = 'B' | 'trial';

export type Checkpoint = {
  kind: CheckpointKind;
  /** Zawody B: dzień startu. Sprawdzian: dowolny dzień tygodnia, w którym ma się odbyć (plan wybiera dzień treningu). */
  date: string;
  distanceM: number;
};

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
  /**
   * Nie przesuwaj startu na poniedziałek, gdy niepełny tydzień 0 nie ma treningów.
   * Używane przy dogenerowaniu tygodnia do istniejącego planu – numeracja tygodni musi zostać ta sama.
   */
  keepStartDate?: boolean;
  /** Parametry silnika (wersja z panelu, wszystkie poziomy); brak = wartości wbudowane. Wartości spoza granic → wbudowane. */
  params?: Partial<EngineParams>;
  /** Poziom zaawansowania zapisany w profilu (przegląd co tydzień). Brak → wyliczony z ankiety. */
  trainingLevel?: TrainingLevel | null;
  /** Ostatni wynik z ankiety – z niego strefy tempa odcinków. Brak → odcinki tylko ze strefą wysiłku. */
  recentResult?: { distanceM: number; timeS: number | null } | null;
  /** Starty kontrolne i sprawdziany z celów (zakładka „Cele”) – w ich tygodniu zastępują mocny trening. */
  checkpoints?: Checkpoint[];
};

/** Parametry wejścia po sprawdzeniu granic. */
export const paramsOf = (input: PlanInput): LevelParams => paramsForLevel(resolveEngineParams(input.params), trainingLevelOf(input));

/** Odcinki treningu z jego typu i struktury (rozgrzewka → część główna → schłodzenie), z tempem z wyniku. */
export function withSteps(session: PlannedSession, input: PlanInput): PlannedSession {
  const paces = paceZonesFrom(input.recentResult);
  const { steps: _old, custom: _custom, ...base } = session.structure;
  const steps = stepsFromStructure(session.type, session.durationMin, base, paces);
  return { ...session, structure: { ...base, steps } as SessionStructure };
}

/** Mnożnik przyrostu tygodnia (np. 1,1 przy 10%). */
export const weeklyGrowth = (p: LevelParams) => 1 + p.weeklyGrowthPct / 100;

export const isWeekend = (weekday: number) => weekday >= 6;
export const round5 = (min: number) => Math.max(5, Math.round(min / 5) * 5);

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

/** Limit czasu treningu w danym dniu tygodnia (z ankiety albo domyślny z parametrów). */
export function dayCap(input: PlanInput, weekday: number) {
  const p = paramsOf(input);
  const cap = isWeekend(weekday) ? input.maxMinutesWeekend : input.maxMinutesWeekday;
  return cap ?? (isWeekend(weekday) ? p.defaultMaxWeekendMin : p.defaultMaxWeekdayMin);
}

export function walkRun(duration: number, weekIndex: number, gentle: boolean): SessionStructure {
  const runMin = !gentle && weekIndex >= 1 ? 2 : 1;
  const walkMin = 2;
  const warmupWalkMin = 5;
  const repeats = Math.max(3, Math.floor((duration - warmupWalkMin) / (runMin + walkMin)));
  return { kind: 'walk_run', warmupWalkMin, repeats, runMin, walkMin };
}

export function intervals(duration: number, level: TrainingLevel): SessionStructure {
  const warmupMin = duration >= 40 ? 10 : 8;
  const cooldownMin = duration >= 40 ? 10 : 7;
  const workMin = level >= 4 ? 3 : 2;
  const recoveryMin = 2;
  const repeats = Math.max(3, Math.min(8, Math.floor((duration - warmupMin - cooldownMin) / (workMin + recoveryMin))));
  return { kind: 'intervals', warmupMin, repeats, workMin, recoveryMin, cooldownMin };
}

export function tempo(duration: number): SessionStructure {
  const warmupMin = 10;
  const cooldownMin = 10;
  return { kind: 'tempo', warmupMin, workMin: Math.max(10, Math.min(25, duration - warmupMin - cooldownMin)), cooldownMin };
}

/**
 * Drabinka treningu progowego (strefa tempo): kolejne etapy wydłużają odcinek – od kilku krótszych powtórzeń
 * do biegu ciągłego. Biegacz przechodzi szczebel wyżej przy każdym kolejnym treningu progowym.
 */
export const THRESHOLD_LADDER: readonly { repeats: number; workMin: number; recoveryMin: number }[] = [
  { repeats: 3, workMin: 6, recoveryMin: 2 },
  { repeats: 3, workMin: 8, recoveryMin: 2 },
  { repeats: 3, workMin: 10, recoveryMin: 2 },
  { repeats: 2, workMin: 15, recoveryMin: 3 },
  { repeats: 1, workMin: 20, recoveryMin: 0 },
  { repeats: 1, workMin: 25, recoveryMin: 0 },
];

/**
 * Trening progowy na danym etapie drabinki (`stage` = który to już trening progowy w planie, od 0).
 * Poziomy 4–5 zaczynają szczebel wyżej. Gdy etap nie mieści się w treningu (czas albo limit minut w strefie tempo),
 * schodzimy na niższy; gdy nie mieści się żaden – zostaje tempo ciągłe.
 */
export function threshold(duration: number, level: TrainingLevel, stage: number, maxTempoSharePct: number): SessionStructure {
  const minWarmupMin = 10;
  const cooldownMin = 5;
  const target = Math.min(THRESHOLD_LADDER.length - 1, (level >= 4 ? 1 : 0) + Math.max(0, stage));
  for (let i = target; i >= 0; i--) {
    const rung = THRESHOLD_LADDER[i]!;
    const fits = rung.repeats * (rung.workMin + rung.recoveryMin) <= duration - minWarmupMin - cooldownMin;
    if (!fits || rung.repeats * rung.workMin > (duration * maxTempoSharePct) / 100) continue;
    // W długim treningu zapas czasu dzielimy między rozgrzewkę (do 20 min) i schłodzenie, zamiast doklejać go na koniec.
    const spare = duration - rung.repeats * (rung.workMin + rung.recoveryMin);
    const warmupMin = Math.min(20, Math.max(10, Math.floor(spare / 10) * 5));
    return rung.repeats === 1
      ? { kind: 'tempo', warmupMin, workMin: rung.workMin, cooldownMin }
      : { kind: 'tempo', warmupMin, workMin: rung.workMin, cooldownMin, repeats: rung.repeats, recoveryMin: rung.recoveryMin };
  }
  return tempo(duration);
}

/**
 * Czy mocna jednostka przeplata interwały z treningiem progowym: od poziomu 3, przy celu „popraw formę” i zawodach
 * do 10 km. Półmaraton i maraton mają co tydzień tempo ciągłe, poziom 2 – same krótkie interwały.
 */
const mixesThreshold = (input: PlanInput) =>
  trainingLevelOf(input) >= 3 && !(input.goal.type === 'race' && input.goal.distanceM >= 21097);

/** Długość cyklu obciążenia w tygodniach (ostatni jest lżejszy); 0 = bez lżejszych tygodni. Cykl krótszy niż 3 nie ma sensu. */
const deloadCycle = (input: PlanInput) => {
  const n = paramsOf(input).deloadEveryWeeks;
  return n >= 3 ? n : 0;
};

/** Czy to lżejszy tydzień cyklu (np. przy cyklu 4: tygodnie 4., 8., 12. planu). */
export function isDeloadWeek(input: PlanInput, weekIndex: number) {
  const n = deloadCycle(input);
  return n > 0 && weekIndex % n === n - 1;
}

/** Ile lżejszych tygodni było przed tygodniem `weekIndex` – one nie liczą się do przyrostu ani do progresji mocnych jednostek. */
const deloadsBefore = (input: PlanInput, weekIndex: number) => {
  const n = deloadCycle(input);
  return n > 0 ? Math.floor(weekIndex / n) : 0;
};

/** Który to tydzień z mocną jednostką (0 = pierwszy), bez lżejszych tygodni; ujemny przed ich startem. */
const qualityWeek = (input: PlanInput, weekIndex: number) => weekIndex - (qualityFrom(input) ?? 0) - deloadsBefore(input, weekIndex);

/** Rodzaj mocnej jednostki w tygodniu: co drugi tydzień trening progowy zamiast interwałów. */
export function qualityTypeFor(input: PlanInput, weekIndex: number): 'intervals' | 'tempo' {
  if (input.goal.type === 'race' && input.goal.distanceM >= 21097) return 'tempo';
  // Lżejszy tydzień: krótkie interwały dla podtrzymania szybkości, bez kolejnego szczebla progu.
  if (isDeloadWeek(input, weekIndex)) return 'intervals';
  return mixesThreshold(input) && qualityWeek(input, weekIndex) % 2 === 1 ? 'tempo' : 'intervals';
}

/** Domyślna część główna mocnej jednostki danego typu w danym tygodniu planu. */
export function qualityStructure(input: PlanInput, weekIndex: number, type: 'intervals' | 'tempo', duration: number): SessionStructure {
  const level = trainingLevelOf(input);
  if (type === 'intervals') {
    const full = intervals(duration, level);
    // Lżejszy tydzień: ok. 60% powtórzeń – bodziec zostaje, zmęczenie nie.
    return isDeloadWeek(input, weekIndex) && full.kind === 'intervals' ? { ...full, repeats: Math.max(3, Math.ceil(full.repeats * 0.6)) } : full;
  }
  if (!mixesThreshold(input)) return tempo(duration);
  const stage = Math.floor(Math.max(0, qualityWeek(input, weekIndex)) / 2);
  return threshold(duration, level, stage, paramsOf(input).maxTempoSharePct);
}

/** Czy w planie są mocniejsze jednostki (interwały / tempo) i w którym tygodniu się zaczynają. */
function qualityFrom(input: PlanInput): number | null {
  if (paramsOf(input).maxHardPerWeek < 1) return null;
  const level = trainingLevelOf(input);
  if (input.hasContraindications || level === 1) return null;
  if (input.goal.type === 'general' && input.goal.focus !== 'improve_fitness') return null;
  return level >= 4 ? 0 : 1;
}

/**
 * @param volumeBase baza objętości tygodnia (patrz `PlannedWeek.baseEasyMin`); domyślnie bazowy trening poziomu × przyrost^tydzień.
 */
function buildWeek(input: PlanInput, weekIndex: number, startsOn: string, endsOn: string, volumeBase?: number): PlannedWeek {
  const p = paramsOf(input);
  const level = trainingLevelOf(input);
  const gentle = input.hasContraindications;
  const deload = isDeloadWeek(input, weekIndex);
  // Baza rośnie tylko w tygodniach obciążenia; lżejszy tydzień stoi na bazie poprzedniego i schodzi z objętości
  // o ustawiony procent. Zapisujemy bazę bez tej obniżki – tydzień po lżejszym rośnie od niej dalej.
  const baseEasyMin = volumeBase ?? p.baseEasyMin * weeklyGrowth(p) ** (weekIndex - deloadsBefore(input, weekIndex) - (deload ? 1 : 0));
  const baseEasy = baseEasyMin * (gentle ? 1 - p.gentleReductionPct / 100 : 1) * (deload ? 1 - p.deloadReductionPct / 100 : 1);
  const MIN_SESSION = p.minSessionMin;

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

  const walkRunMode = level === 1;
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
    const pick = sorted.find((d) => dist(d) >= p.minDaysHardToLong);
    qualityDay = pick ?? null;
  }
  const qualityType = qualityTypeFor(input, weekIndex);

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
      const duration = Math.max(MIN_SESSION, Math.min(cap, round5(baseEasy * p.longFactor)));
      return { scheduledOn, type: 'long', durationMin: duration, distanceM: null, intensity: 'easy', structure: { kind: 'steady' } };
    }
    if (weekday === qualityDay) {
      const duration = Math.max(p.qualityMinMin, Math.min(cap, round5(baseEasy + 5)));
      return {
        scheduledOn,
        type: qualityType,
        durationMin: duration,
        distanceM: null,
        intensity: qualityType === 'intervals' ? 'hard' : 'moderate',
        structure: qualityStructure(input, weekIndex, qualityType, duration),
      };
    }
    const duration = Math.max(MIN_SESSION, Math.min(cap, round5(baseEasy)));
    return { scheduledOn, type: 'easy', durationMin: duration, distanceM: null, intensity: 'easy', structure: { kind: 'steady' } };
  });

  let focus: WeekFocus = deload ? 'recovery' : weekIndex === 0 ? 'base' : 'build';

  // Zawody w tym tygodniu: start w dniu zawodów, dzień przed i po – wolne, ostatnie 3 dni bez mocnych jednostek.
  // Tak samo starty kontrolne (B) i sprawdziany z celów: one są mocnym treningiem tygodnia.
  const inWeek = (d: string) => d >= startsOn && d <= endsOn;
  const starts: { date: string; distanceM: number; checkpoint?: CheckpointKind }[] = [];
  const mainRace = input.goal.type === 'race' && inWeek(input.goal.raceDate) ? input.goal : null;
  if (mainRace) starts.push({ date: mainRace.raceDate, distanceM: mainRace.distanceM });
  for (const cp of input.checkpoints ?? []) {
    if (!inWeek(cp.date) || cp.distanceM <= 0) continue;
    // Sprawdzian – w dzień długiego biegu (zwykle weekend), a bez niego w ostatni trening tygodnia.
    const date =
      cp.kind === 'B'
        ? cp.date
        : (sessions.find((s) => longDay !== null && s.scheduledOn === dateOf(longDay)) ?? sessions[sessions.length - 1])?.scheduledOn;
    // Dwa starty dzień po dniu się nie mieszczą – zostaje pierwszy (główne zawody są zawsze pierwsze).
    if (!date || starts.some((st) => Math.abs(daysBetween(st.date, date)) <= 1)) continue;
    starts.push({ date, distanceM: cp.distanceM, checkpoint: cp.kind });
  }
  if (starts.length > 0) {
    for (const start of starts) {
      sessions = sessions
        .filter((s) => Math.abs(daysBetween(s.scheduledOn, start.date)) > 1)
        .map((s) => {
          const daysBefore = daysBetween(s.scheduledOn, start.date);
          if (daysBefore > 0 && daysBefore <= p.raceEasyDaysBefore && s.intensity !== 'easy') {
            return { ...s, type: 'easy', intensity: 'easy', durationMin: Math.min(s.durationMin ?? 20, 20), structure: { kind: 'steady' } };
          }
          return s;
        });
    }
    // Start kontrolny albo sprawdzian zastępuje mocny trening tygodnia – drugi mocny bodziec byłby za dużo.
    if (!mainRace) {
      sessions = sessions.map((s) =>
        s.intensity === 'easy' ? s : { ...s, type: 'easy', intensity: 'easy', structure: { kind: 'steady' } },
      );
    }
    for (const start of starts) {
      sessions.push({
        scheduledOn: start.date,
        type: 'race',
        durationMin: null,
        distanceM: start.distanceM,
        intensity: 'hard',
        structure: start.checkpoint ? { kind: 'race', distanceM: start.distanceM, checkpoint: start.checkpoint } : { kind: 'race', distanceM: start.distanceM },
      });
    }
    sessions.sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn));
    if (mainRace) focus = 'race';
  }

  return { weekIndex, startsOn, endsOn, focus, sessions, baseEasyMin };
}

export const weekMinutes = (w: PlannedWeek) => w.sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0);

export const isFullWeek = (w: PlannedWeek) => daysBetween(w.startsOn, w.endsOn) === 6;

/**
 * Twardy limit przyrostu: pełny tydzień ≤ poprzedni pełny × 1,1.
 * Po niepełnym tygodniu 0 (start w środku tygodnia) nie ma z czym porównać – wtedy obowiązuje
 * tylko bazowy przyrost czasu jednostek.
 * Przycina po 5 min najdłuższe treningi (poza zawodami), nie schodząc poniżej minimum.
 */
function capGrowth(input: PlanInput, prev: PlannedWeek, week: PlannedWeek): PlannedWeek {
  // Lżejszy tydzień nie jest punktem odniesienia: tydzień po nim wraca na bazę sprzed niego (plus przyrost).
  if (week.focus === 'race' || prev.focus === 'recovery' || !isFullWeek(prev)) return week;
  const p = paramsOf(input);
  const MIN_SESSION = p.minSessionMin;
  const limit = weekMinutes(prev) * weeklyGrowth(p);
  const sessions = week.sessions.map((s) => ({ ...s }));
  const trimmed = { ...week, sessions };
  for (let guard = 0; guard < 50 && weekMinutes(trimmed) > limit; guard++) {
    const longest = sessions
      .filter((s) => s.type !== 'race' && (s.durationMin ?? 0) - 5 >= (s.intensity === 'easy' ? MIN_SESSION : p.qualityMinMin))
      .sort((a, b) => (b.durationMin ?? 0) - (a.durationMin ?? 0))[0];
    if (!longest || longest.durationMin === null) break;
    longest.durationMin -= 5;
    if (longest.structure.kind === 'intervals' || longest.structure.kind === 'tempo') {
      longest.structure = qualityStructure(input, week.weekIndex, longest.structure.kind, longest.durationMin);
    }
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
  // Niepełny pierwszy tydzień bez żadnego treningu (np. start w niedzielę, a biegasz wt/sb)
  // nie liczy się do planu – zaczynamy od najbliższego poniedziałku.
  if (!input.keepStartDate && isoWeekday(startsOn) !== 1 && buildWeek(input, 0, startsOn, addDaysIso(startsOn, 7 - isoWeekday(startsOn))).sessions.length === 0) {
    startsOn = addDaysIso(startsOn, 8 - isoWeekday(startsOn));
  }
  const planStart = startsOn;
  for (let i = 0; i < count; i++) {
    const endsOn = addDaysIso(startsOn, 7 - isoWeekday(startsOn));
    const week = buildWeek(input, i, startsOn, endsOn);
    const prev = weeks[weeks.length - 1];
    weeks.push(prev && weekMinutes(prev) > 0 ? capGrowth(input, prev, week) : week);
    startsOn = addDaysIso(endsOn, 1);
  }
  return {
    engineVersion: ENGINE_VERSION,
    startsOn: planStart,
    endsOn: weeks[weeks.length - 1]?.endsOn ?? input.startDate,
    weeks: weeks.map((w) => ({ ...w, sessions: w.sessions.map((s) => withSteps(s, input)) })),
  };
}

/**
 * Generuje jeden tydzień planu (numeracja od 0) dokładnie tak, jak wyglądałby w pełnym planie:
 * te same daty, ten sam przyrost obciążenia i limit 10% względem poprzednich tygodni.
 * `input.startDate` to dzień startu planu (`plans.starts_on`), nie początek tygodnia.
 */
export function generatePlanWeek(input: PlanInput, weekIndex: number): PlannedWeek {
  if (!Number.isInteger(weekIndex) || weekIndex < 0) throw new RangeError(`weekIndex must be ≥ 0, got ${weekIndex}`);
  const plan = generateInitialPlan({ ...input, weeks: weekIndex + 1, keepStartDate: true });
  return plan.weeks[weekIndex] as PlannedWeek;
}

export type LevelChange = 'up' | 'down' | 'none';

/** Baza objętości tygodnia z bazy danych: zapisana albo – dla starszych tygodni – odczytana z najdłuższego spokojnego treningu. */
export function volumeBaseOf(week: PlannedWeek, input: PlanInput): number | null {
  if (week.baseEasyMin && week.baseEasyMin > 0) return week.baseEasyMin;
  const p = paramsOf(input);
  const gentle = input.hasContraindications ? 1 - p.gentleReductionPct / 100 : 1;
  const easy = week.sessions.filter((s) => s.type === 'easy' || s.type === 'walk_run').map((s) => s.durationMin ?? 0);
  if (easy.length) return Math.max(...easy) / gentle;
  const long = week.sessions.filter((s) => s.type === 'long').map((s) => s.durationMin ?? 0);
  if (long.length) return Math.max(...long) / p.longFactor / gentle;
  return null;
}

/**
 * Kolejny tydzień po zapisanym tygodniu `prev` (cotygodniowe generowanie). Objętość rośnie od bazy poprzedniego
 * tygodnia × przyrost obecnego poziomu (`input.trainingLevel`) – zmiana poziomu zmienia przyrost i limity, ale nie
 * skacze do bazowego treningu nowego poziomu. Po spadku poziomu (`change: 'down'`) – bez przyrostu, najwyżej bazowy
 * trening nowego poziomu. Limit przyrostu sumy minut liczony względem faktycznego `prev`.
 */
export function generateNextWeek(input: PlanInput, prev: PlannedWeek, change: LevelChange = 'none'): PlannedWeek {
  const p = paramsOf(input);
  const startsOn = addDaysIso(prev.endsOn, 1);
  const endsOn = addDaysIso(startsOn, 6);
  const weekIndex = prev.weekIndex + 1;
  const prevBase = volumeBaseOf(prev, input);
  const base =
    prevBase === null
      ? p.baseEasyMin * weeklyGrowth(p) ** weekIndex
      : change === 'down'
        ? Math.min(prevBase, p.baseEasyMin)
        : prev.focus === 'race' || isDeloadWeek(input, weekIndex)
          ? prevBase
          : prevBase * weeklyGrowth(p);
  const week = buildWeek(input, weekIndex, startsOn, endsOn, base);
  const capped = weekMinutes(prev) > 0 && change !== 'down' ? capGrowth(input, prev, week) : week;
  return { ...capped, sessions: capped.sessions.map((s) => withSteps(s, input)) };
}
