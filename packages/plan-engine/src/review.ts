// Porównanie wykonanego biegu z treningiem z planu i werdykt. Czyste reguły – bez AI i bez tętna.
//
// Dwie osie: objętość (czas albo dystans względem planu) i intensywność (tempo względem stref treningu).
// Każde odchylenie ma wagę 0–3; najcięższe decyduje o werdykcie:
//   0 → „W punkt”, 1 → „Dobra robota”, 2 → „Zaliczone, ale…”, 3 → „Inny trening niż w planie”.
// `facts` to nazwane obserwacje z liczbami – z nich aplikacja składa opis (a później notkę trenera AI).
// Zasady tonu: oceniamy trening, nie człowieka; „za dużo” i „za szybko” to też odchylenie.

import { flattenSteps, HARD_ZONES, type PaceRange, type WorkoutItem } from './workout.ts';

export const REVIEW_VERSION = 1;

export const REVIEW_RULES = {
  /** Długość kubełka przebiegu tempa (s). */
  bucketS: 15,
  /** Poniżej tej prędkości (m/s) kubełek to postój – nie liczymy go do tempa. */
  stoppedMps: 0.5,
  /** Objętość: granice udziału planu dla wag 3 / 2 / 1 (za mało) i 1 / 2 (za dużo). */
  volume: { different: 0.5, low: 0.75, slightlyLow: 0.9, slightlyHigh: 1.2, high: 1.4 },
  /** Tolerancja tempa wokół zakresu (s/km) i dodatek na pagórki. */
  paceSlackS: 5,
  hillySlackS: 10,
  /** Od tylu metrów podbiegu na kilometr trasa liczy się jako pagórkowata. */
  hillyGainPerKm: 15,
  /** Odchylenie tempa większe niż tyle s/km to już waga 2. */
  paceMajorS: 15,
  /** Spokojny bieg: większe odchylenie niż tyle s/km to waga 2. */
  steadyMajorS: 20,
  /** Długi bieg: druga połowa wolniejsza o tyle s/km = odnotowany spadek. */
  fadeS: 15,
  /** Mocny odcinek bez znanych stref: tyle razy szybciej niż mediana tempa biegu. */
  relativeHard: 0.9,
  /** Rozrzut tempa między odcinkami (s/km), od którego o nim mówimy. */
  unevenS: 15,
} as const;

export type ReviewVerdict = 'spot_on' | 'good' | 'passed_but' | 'different';
export type ReviewAxis = 'low' | 'ok' | 'high';

export type ReviewFactCode =
  | 'volume_ok'
  | 'volume_low'
  | 'volume_high'
  | 'steady_ok'
  | 'steady_fast'
  | 'fade'
  | 'reps_all'
  | 'reps_missing'
  | 'reps_extra'
  | 'reps_ok'
  | 'reps_fast'
  | 'reps_slow'
  | 'reps_uneven'
  | 'no_reps'
  | 'no_pace_data';

export type ReviewFact = { code: ReviewFactCode; values: Record<string, number> };

export type WorkoutReview = {
  version: number;
  verdict: ReviewVerdict;
  volume: ReviewAxis;
  /** null – nie ma z czego ocenić (brak stref tempa albo przebiegu). */
  intensity: ReviewAxis | null;
  facts: ReviewFact[];
};

/** Przebieg tempa: metry pokonane w kolejnych kubełkach czasu od startu aktywności. */
export type PaceBuckets = { bucketS: number; m: number[] };

/** Strumienie Stravy (`time` w sekundach od startu, `distance` w metrach) → kubełki. Złe dane → null. */
export function bucketsFromStream(time: unknown, distance: unknown, bucketS: number = REVIEW_RULES.bucketS): PaceBuckets | null {
  if (!Array.isArray(time) || !Array.isArray(distance) || time.length < 2 || time.length !== distance.length) return null;
  const total = Number(time[time.length - 1]);
  if (!Number.isFinite(total) || total < bucketS || total > 24 * 3600) return null;
  const m: number[] = [];
  let i = 0;
  let previous = Number(distance[0]) || 0;
  for (let end = bucketS; end <= total; end += bucketS) {
    while (i + 1 < time.length && Number(time[i + 1]) <= end) i++;
    // Dystans w chwili `end`: liniowo między sąsiednimi próbkami.
    const t0 = Number(time[i]);
    const d0 = Number(distance[i]);
    const t1 = Number(time[Math.min(i + 1, time.length - 1)]);
    const d1 = Number(distance[Math.min(i + 1, time.length - 1)]);
    const at = t1 > t0 ? d0 + ((d1 - d0) * (end - t0)) / (t1 - t0) : d0;
    if (!Number.isFinite(at)) return null;
    m.push(Math.max(0, Math.round(at - previous)));
    previous = at;
  }
  return { bucketS, m };
}

export type ReviewInput = {
  type: string;
  durationMin: number | null;
  distanceM: number | null;
  steps: WorkoutItem[];
  actualDistanceM: number | null;
  actualDurationS: number | null;
  buckets: PaceBuckets | null;
  elevationGainM?: number | null;
};

const paceOf = (m: number, s: number) => (m > 0 ? s / (m / 1000) : Number.POSITIVE_INFINITY);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

type Segment = { s: number; m: number };

/** Ciągłe szybkie fragmenty (tempo ≤ próg); pojedynczy wolniejszy kubełek w środku nie przerywa odcinka. */
function fastSegments(buckets: PaceBuckets, thresholdS: number, minS: number): Segment[] {
  const fast = buckets.m.map((m) => paceOf(m, buckets.bucketS) <= thresholdS);
  const segments: Segment[] = [];
  let current: Segment | null = null;
  for (let i = 0; i < fast.length; i++) {
    const bridge = !fast[i] && current !== null && fast[i + 1] === true;
    if (fast[i] || bridge) {
      current ??= { s: 0, m: 0 };
      current.s += buckets.bucketS;
      current.m += buckets.m[i]!;
    } else if (current) {
      segments.push(current);
      current = null;
    }
  }
  if (current) segments.push(current);
  return segments.filter((seg) => seg.s >= minS);
}

export function reviewWorkout(input: ReviewInput): WorkoutReview {
  const R = REVIEW_RULES;
  const facts: ReviewFact[] = [];
  let severity = 0;
  const note = (code: ReviewFactCode, weight: number, values: Record<string, number> = {}) => {
    facts.push({ code, values });
    severity = Math.max(severity, weight);
  };

  // ── Objętość ──
  const ratio =
    input.durationMin && input.actualDurationS
      ? input.actualDurationS / (input.durationMin * 60)
      : input.distanceM && input.actualDistanceM
        ? input.actualDistanceM / input.distanceM
        : null;
  let volume: ReviewAxis = 'ok';
  if (ratio !== null) {
    const percent = Math.round(ratio * 100);
    if (ratio < R.volume.slightlyLow) {
      volume = 'low';
      note('volume_low', ratio < R.volume.different ? 3 : ratio < R.volume.low ? 2 : 1, { percent });
    } else if (ratio > R.volume.slightlyHigh) {
      volume = 'high';
      note('volume_high', ratio > R.volume.high ? 2 : 1, { percent });
    } else {
      note('volume_ok', 0, { percent });
    }
  }

  // ── Intensywność ──
  const km = (input.actualDistanceM ?? 0) / 1000;
  const hilly = km > 0 && (input.elevationGainM ?? 0) / km > R.hillyGainPerKm;
  const slack = R.paceSlackS + (hilly ? R.hillySlackS : 0);
  const flat = flattenSteps(input.steps);
  const hard = flat.filter((s) => s.kind === 'work' && HARD_ZONES.includes(s.zone));
  const moving = input.buckets
    ? { ...input.buckets, m: input.buckets.m.filter((m) => m / input.buckets!.bucketS >= R.stoppedMps) }
    : null;
  let intensity: ReviewAxis | null = null;
  let unknownAccent = false;

  if (hard.length > 0) {
    // Akcent: liczymy mocne odcinki w przebiegu tempa i porównujemy ich tempo z zakresem.
    if (!moving || moving.m.length < 4) {
      unknownAccent = true;
      note('no_pace_data', 0);
    } else {
      const range: PaceRange | null = hard[0]!.pace;
      const plannedRepS = median(hard.map((s) => s.durationS));
      const easyRef = flat.find((s) => !HARD_ZONES.includes(s.zone) && s.pace)?.pace?.fastS ?? null;
      const typical = median(moving.m.map((m) => paceOf(m, moving.bucketS)));
      const absolute = range ? range.slowS + (easyRef && easyRef > range.slowS ? (easyRef - range.slowS) / 2 : slack) : 0;
      const threshold = Math.max(absolute, typical * R.relativeHard);
      const reps = fastSegments(moving, threshold, Math.max(plannedRepS / 2, moving.bucketS));
      const planned = hard.length;
      if (reps.length === 0) {
        note('no_reps', 3);
      } else {
        const done = reps.length;
        if (done < planned) note('reps_missing', done / planned < 0.75 ? 2 : 1, { done, planned });
        else if (done > planned + 1) note('reps_extra', 1, { done, planned });
        else note('reps_all', 0, { done: Math.min(done, planned), planned });

        intensity = 'ok';
        const pace = paceOf(
          reps.reduce((n, r) => n + r.m, 0),
          reps.reduce((n, r) => n + r.s, 0),
        );
        if (range && pace < range.fastS - slack) {
          const s = Math.round(range.fastS - pace);
          intensity = 'high';
          note('reps_fast', s > R.paceMajorS ? 2 : 1, { s });
        } else if (range && pace > range.slowS + slack) {
          const s = Math.round(pace - range.slowS);
          intensity = 'low';
          note('reps_slow', s > R.paceMajorS ? 2 : 1, { s });
        } else if (range) {
          note('reps_ok', 0);
        } else {
          intensity = null;
        }
        if (done >= 3 && plannedRepS >= 60) {
          const paces = reps.map((r) => paceOf(r.m, r.s));
          const spread = Math.round(Math.max(...paces) - Math.min(...paces));
          if (spread > R.unevenS) note('reps_uneven', 1, { s: spread });
        }
      }
    }
  } else {
    // Bieg ciągły: liczy się, czy nie wyszedł szybciej niż jego strefa. Wolniej – nigdy nie jest błędem.
    const main = [...flat].filter((s) => s.kind === 'work' && s.pace).sort((a, b) => b.durationS - a.durationS)[0];
    const range = main?.pace ?? null;
    const average = moving
      ? paceOf(
          moving.m.reduce((n, m) => n + m, 0),
          moving.m.length * moving.bucketS,
        )
      : input.actualDistanceM && input.actualDurationS
        ? paceOf(input.actualDistanceM, input.actualDurationS)
        : null;
    if (range && average !== null && Number.isFinite(average)) {
      if (average < range.fastS - slack) {
        const s = Math.round(range.fastS - average);
        intensity = 'high';
        note('steady_fast', s > R.steadyMajorS ? 2 : 1, { s });
      } else {
        intensity = 'ok';
        note('steady_ok', 0);
      }
    }
    if (input.type === 'long' && moving && moving.m.length * moving.bucketS >= 20 * 60) {
      const half = Math.floor(moving.m.length / 2);
      const sum = (list: number[]) => list.reduce((n, m) => n + m, 0);
      const first = paceOf(sum(moving.m.slice(0, half)), half * moving.bucketS);
      const second = paceOf(sum(moving.m.slice(half)), (moving.m.length - half) * moving.bucketS);
      const s = Math.round(second - first);
      if (Number.isFinite(s) && s > R.fadeS + (hilly ? R.hillySlackS : 0)) note('fade', 1, { s });
    }
  }

  // Akcentu bez przebiegu tempa nie da się ocenić w pełni – najwyżej „Dobra robota”.
  const verdicts: ReviewVerdict[] = ['spot_on', 'good', 'passed_but', 'different'];
  const verdict = verdicts[Math.max(severity, unknownAccent ? 1 : 0)]!;
  return { version: REVIEW_VERSION, verdict, volume, intensity, facts };
}
