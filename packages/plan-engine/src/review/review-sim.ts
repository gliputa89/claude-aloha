// Symulator biegów do testowania oceny treningu: z planu i „odchylenia” buduje sztuczny przebieg tempa (i tętna)
// w tym samym formacie, który przychodzi ze Stravy. Używają go testy reguł (review-sim.test.ts) i strona
// „Test ocen” w panelu admina, która te same scenariusze puszcza przez prawdziwy prompt notki trenera.
// Wszystko deterministyczne (szum z ziarna) – ten sam scenariusz daje zawsze ten sam bieg.

import { REVIEW_RULES, type PaceBuckets, type ReviewFactCode, type ReviewInput, type ReviewVerdict } from './review.ts';
import { flattenSteps, HARD_ZONES, paceZonesFrom, type PaceRange, type WorkoutItem, type WorkoutStep } from '../core/workout.ts';

/** Biegacz testowy: 10 km w 50:00 – z tego wynikają strefy tempa wszystkich scenariuszy. */
const ZONES = paceZonesFrom({ distanceM: 10_000, timeS: 50 * 60 })!;
const step = (kind: WorkoutStep['kind'], zone: WorkoutStep['zone'], minutes: number): WorkoutStep => ({
  kind,
  zone,
  durationS: minutes * 60,
  pace: ZONES[zone],
});

export const SIM_WORKOUTS = {
  easy: { type: 'easy', durationMin: 40, steps: [step('work', 'easy', 40)] },
  long: { type: 'long', durationMin: 80, steps: [step('work', 'easy', 80)] },
  intervals: {
    type: 'intervals',
    durationMin: 55,
    steps: [
      step('warmup', 'easy', 10),
      { kind: 'repeat', times: 7, steps: [step('work', 'interval', 3), step('recovery', 'recovery', 2)] },
      step('cooldown', 'easy', 10),
    ],
  },
  tempo: {
    type: 'tempo',
    durationMin: 45,
    steps: [step('warmup', 'easy', 15), step('work', 'tempo', 20), step('cooldown', 'easy', 10)],
  },
} satisfies Record<string, { type: string; durationMin: number; steps: WorkoutItem[] }>;

export type SimWorkout = keyof typeof SIM_WORKOUTS;

export type SimOptions = {
  /** Część planowanego czasu, którą biegacz zrobił (1 = cały; > 1 = dołożył spokojnego biegu). */
  volume?: number;
  /** Odcinki spokojne: o tyle s/km wolniej (+) albo szybciej (−) niż środek ich strefy. */
  paceOffsetS?: number;
  /** Mocne odcinki: ile z planowanych zrobione (reszta truchtem), przesunięcie tempa i rozrzut między nimi. */
  repsDone?: number;
  repOffsetS?: number;
  repSpreadS?: number;
  /** Cały trening równym, spokojnym tempem zamiast akcentu. */
  steadyInstead?: boolean;
  /** Druga połowa wolniejsza o tyle s/km. */
  fadeS?: number;
  /** Postój w środku biegu (s) – np. światła, wiązanie buta. */
  stopS?: number;
  /** Podbieg w metrach na kilometr. */
  gainPerKm?: number;
  /** Szum tempa między kubełkami (± s/km), jak z GPS. */
  noiseS?: number;
  /**
   * Tętno: `max` – najwyższe zarejestrowane, `easy` – część maksimum w spokojnym biegu, `drift` – o tyle
   * procent tętno rośnie do końca biegu. Brak = zegarek bez pomiaru albo brak zgody.
   */
  hr?: { max: number; easy: number; drift?: number };
  seed?: number;
};

export type SimulatedRun = Pick<ReviewInput, 'buckets' | 'actualDistanceM' | 'actualDurationS' | 'elevationGainM' | 'hrMax'>;

/** Mały generator liczb pseudolosowych (mulberry32) – ten sam bieg przy tym samym ziarnie. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const middle = (range: PaceRange | null, fallback: number) => (range ? (range.fastS + range.slowS) / 2 : fallback);

/** Sztuczny bieg dla treningu `steps`: tempo sekunda po sekundzie → kubełki jak ze strumieni Stravy. */
export function simulateRun(steps: WorkoutItem[], opts: SimOptions = {}): SimulatedRun {
  const rand = random(opts.seed ?? 1);
  const flat = flattenSteps(steps);
  const easyPace = middle(ZONES.easy, 360) + (opts.paceOffsetS ?? 0);
  const hardSteps = flat.filter((s) => s.kind === 'work' && HARD_ZONES.includes(s.zone));

  // Tempo (s/km) i „wysiłek” (część tętna maksymalnego, do której dąży serce) w każdej sekundzie biegu.
  const pace: number[] = [];
  const effort: number[] = [];
  const easyEffort = opts.hr?.easy ?? 0.72;
  let rep = 0;
  for (const s of flat) {
    const hard = s.kind === 'work' && HARD_ZONES.includes(s.zone);
    let p: number;
    let e: number;
    if (opts.steadyInstead || !hard) {
      p = opts.steadyInstead ? easyPace : middle(s.pace, 360) + (opts.paceOffsetS ?? 0);
      e = s.zone === 'recovery' && !opts.steadyInstead ? easyEffort - 0.04 : easyEffort;
    } else {
      const done = rep < (opts.repsDone ?? hardSteps.length);
      const spread = hardSteps.length > 1 ? ((rep / (hardSteps.length - 1)) - 0.5) * (opts.repSpreadS ?? 0) : 0;
      p = done ? middle(s.pace, 300) + (opts.repOffsetS ?? 0) + spread : middle(ZONES.recovery, 400);
      e = done ? 0.92 : easyEffort - 0.04;
      rep++;
    }
    for (let i = 0; i < s.durationS; i++) {
      pace.push(p);
      effort.push(e);
    }
  }

  // Objętość: ucięcie albo dołożenie spokojnego biegu na końcu.
  const planned = pace.length;
  const target = Math.round(planned * (opts.volume ?? 1));
  pace.length = Math.min(planned, target);
  effort.length = pace.length;
  for (let i = planned; i < target; i++) {
    pace.push(easyPace);
    effort.push(easyEffort);
  }
  if (opts.fadeS) for (let i = Math.floor(pace.length / 2); i < pace.length; i++) pace[i]! += opts.fadeS;

  // Sekundy → kubełki: metry, tętno (serce dogania wysiłek z opóźnieniem), szum i postój w środku.
  const B = REVIEW_RULES.bucketS;
  const m: number[] = [];
  const hr: (number | null)[] = [];
  let pulse = (opts.hr?.max ?? 0) * (easyEffort - 0.1);
  const stopAt = opts.stopS ? Math.floor(pace.length / 2 / B) : -1;
  for (let start = 0; start + B <= pace.length; start += B) {
    if (m.length === stopAt) {
      for (let i = 0; i < Math.round(opts.stopS! / B); i++) {
        m.push(0);
        if (opts.hr) hr.push(Math.round(pulse * 0.85));
      }
    }
    const jitter = (rand() * 2 - 1) * (opts.noiseS ?? 0);
    let metres = 0;
    for (let i = start; i < start + B; i++) {
      metres += 1000 / (pace[i]! + jitter);
      if (opts.hr) {
        const drift = 1 + ((opts.hr.drift ?? 0) / 100) * (i / pace.length);
        pulse += (opts.hr.max * effort[i]! * drift - pulse) / 40;
      }
    }
    m.push(Math.round(metres));
    if (opts.hr) hr.push(Math.round(pulse));
  }

  const buckets: PaceBuckets = opts.hr ? { bucketS: B, m, hr } : { bucketS: B, m };
  const distance = m.reduce((n, x) => n + x, 0);
  return {
    buckets,
    actualDistanceM: distance,
    actualDurationS: pace.length,
    elevationGainM: Math.round(((opts.gainPerKm ?? 0) * distance) / 1000),
    hrMax: opts.hr?.max ?? null,
  };
}

export type ReviewScenario = {
  id: string;
  /** Opis po polsku: co biegacz faktycznie zrobił. */
  label: string;
  workout: SimWorkout;
  sim: SimOptions;
  expect: ReviewVerdict;
  /** Fakty, które ocena musi nazwać. */
  facts?: ReviewFactCode[];
};

const GPS = { noiseS: 6 };
const HR = { max: 185, easy: 0.72 };

/** Macierz scenariuszy: od biegu idealnego, przez „trochę inaczej”, po zupełnie inny trening. */
export const REVIEW_SCENARIOS: ReviewScenario[] = [
  { id: 'easy-ideal', label: 'Spokojny bieg dokładnie w strefie i w czasie', workout: 'easy', sim: { ...GPS }, expect: 'spot_on', facts: ['steady_ok'] },
  { id: 'easy-ideal-hr', label: 'Spokojny bieg w strefie, tętno spokojne (72% maks.)', workout: 'easy', sim: { ...GPS, hr: HR }, expect: 'spot_on', facts: ['hr_ok'] },
  { id: 'easy-slow', label: 'Spokojny bieg wyraźnie wolniej niż strefa', workout: 'easy', sim: { ...GPS, paceOffsetS: 45 }, expect: 'spot_on' },
  { id: 'easy-stop', label: 'Spokojny bieg w strefie z 2-minutowym postojem', workout: 'easy', sim: { ...GPS, stopS: 120 }, expect: 'spot_on' },
  { id: 'easy-bit-fast', label: 'Spokojny bieg o ok. 25 s/km szybciej niż środek strefy', workout: 'easy', sim: { ...GPS, paceOffsetS: -25 }, expect: 'good', facts: ['steady_fast'] },
  { id: 'easy-fast-long', label: 'Spokojny bieg dużo za szybko i o 30% dłuższy', workout: 'easy', sim: { ...GPS, paceOffsetS: -50, volume: 1.3 }, expect: 'passed_but', facts: ['steady_fast', 'volume_high'] },
  { id: 'easy-hilly', label: 'Spokojny bieg po pagórkach, tempo tuż poniżej strefy', workout: 'easy', sim: { ...GPS, paceOffsetS: -22, gainPerKm: 25 }, expect: 'spot_on' },
  { id: 'easy-hr-high', label: 'Spokojny bieg w strefie tempa, ale tętno 86% maks. (upał, zmęczenie)', workout: 'easy', sim: { ...GPS, hr: { max: 185, easy: 0.86 } }, expect: 'passed_but', facts: ['hr_high'] },
  { id: 'easy-fast-hr-ok', label: 'Spokojny bieg szybciej niż strefa przy spokojnym tętnie (forma urosła)', workout: 'easy', sim: { ...GPS, paceOffsetS: -30, hr: { max: 185, easy: 0.7 } }, expect: 'spot_on', facts: ['steady_fast_hr_ok'] },
  { id: 'easy-short', label: 'Spokojny bieg skrócony do 80% planu', workout: 'easy', sim: { ...GPS, volume: 0.8 }, expect: 'good', facts: ['volume_low'] },
  { id: 'easy-very-short', label: 'Spokojny bieg skrócony do 40% planu', workout: 'easy', sim: { ...GPS, volume: 0.4 }, expect: 'different', facts: ['volume_low'] },
  { id: 'long-fade', label: 'Długi bieg, druga połowa wolniejsza o 25 s/km', workout: 'long', sim: { ...GPS, fadeS: 25 }, expect: 'good', facts: ['fade'] },
  { id: 'long-hr-drift', label: 'Długi bieg równym tempem, tętno rośnie o 16% do końca', workout: 'long', sim: { ...GPS, hr: { max: 185, easy: 0.68, drift: 16 } }, expect: 'good', facts: ['hr_drift'] },
  { id: 'intervals-ideal', label: 'Interwały 7 z 7 w widełkach, przerwy truchtem', workout: 'intervals', sim: { ...GPS }, expect: 'spot_on', facts: ['reps_all', 'reps_ok'] },
  { id: 'intervals-5of7', label: 'Interwały: 5 z 7 odcinków w widełkach, dwa ostatnie truchtem', workout: 'intervals', sim: { ...GPS, repsDone: 5 }, expect: 'passed_but', facts: ['reps_missing'] },
  { id: 'intervals-6of7', label: 'Interwały: 6 z 7 odcinków w widełkach', workout: 'intervals', sim: { ...GPS, repsDone: 6 }, expect: 'good', facts: ['reps_missing'] },
  { id: 'intervals-too-fast', label: 'Interwały 7 z 7, ale o 25 s/km szybciej niż widełki', workout: 'intervals', sim: { ...GPS, repOffsetS: -30 }, expect: 'passed_but', facts: ['reps_fast'] },
  { id: 'intervals-slow', label: 'Interwały 7 z 7, o ok. 15 s/km wolniej niż widełki', workout: 'intervals', sim: { ...GPS, repOffsetS: 18 }, expect: 'good', facts: ['reps_slow'] },
  { id: 'intervals-uneven', label: 'Interwały 7 z 7, pierwszy dużo szybszy niż ostatni (rozrzut 30 s/km)', workout: 'intervals', sim: { ...GPS, repSpreadS: 30 }, expect: 'good', facts: ['reps_uneven'] },
  { id: 'intervals-steady', label: 'Zamiast interwałów równy, spokojny bieg', workout: 'intervals', sim: { ...GPS, steadyInstead: true }, expect: 'different', facts: ['no_reps'] },
  { id: 'tempo-ideal', label: 'Bieg tempowy: 20 min w strefie tempa', workout: 'tempo', sim: { ...GPS }, expect: 'spot_on', facts: ['reps_all', 'reps_ok'] },
  { id: 'tempo-slow', label: 'Bieg tempowy o ok. 15 s/km za wolno', workout: 'tempo', sim: { ...GPS, repOffsetS: 18 }, expect: 'good', facts: ['reps_slow'] },
];

/** Bieg i wejście do oceny dla scenariusza. */
export function scenarioInput(scenario: ReviewScenario): ReviewInput {
  const workout = SIM_WORKOUTS[scenario.workout];
  return {
    type: workout.type,
    durationMin: workout.durationMin,
    distanceM: null,
    steps: workout.steps,
    ...simulateRun(workout.steps, scenario.sim),
  };
}
