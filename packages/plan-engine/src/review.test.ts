import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bucketsFromStream, reviewWorkout, type PaceBuckets, type ReviewInput } from './review.ts';
import type { WorkoutItem } from './workout.ts';

const EASY = { fastS: 360, slowS: 400 };
const INTERVAL = { fastS: 285, slowS: 300 };

const easySteps: WorkoutItem[] = [{ kind: 'work', zone: 'easy', durationS: 40 * 60, pace: EASY }];
const intervalSteps: WorkoutItem[] = [
  { kind: 'warmup', zone: 'easy', durationS: 600, pace: EASY },
  {
    kind: 'repeat',
    times: 4,
    steps: [
      { kind: 'work', zone: 'interval', durationS: 180, pace: INTERVAL },
      { kind: 'recovery', zone: 'recovery', durationS: 120, pace: { fastS: 400, slowS: 440 } },
    ],
  },
  { kind: 'cooldown', zone: 'easy', durationS: 600, pace: EASY },
];

/** Kubełki 15 s z listy [sekundy, tempo s/km]. */
const run = (...parts: [number, number][]): PaceBuckets => ({
  bucketS: 15,
  m: parts.flatMap(([seconds, pace]) => Array.from({ length: seconds / 15 }, () => Math.round((15 / pace) * 1000))),
});

const easy = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  type: 'easy',
  durationMin: 40,
  distanceM: null,
  steps: easySteps,
  actualDistanceM: 6300,
  actualDurationS: 40 * 60,
  buckets: run([40 * 60, 380]),
  ...over,
});

const intervals = (buckets: PaceBuckets | null, over: Partial<ReviewInput> = {}): ReviewInput => ({
  type: 'intervals',
  durationMin: 40,
  distanceM: null,
  steps: intervalSteps,
  actualDistanceM: 7000,
  actualDurationS: 40 * 60,
  buckets,
  ...over,
});

const reps = (count: number, pace: number) =>
  run([600, 380], ...Array.from({ length: count }, (): [number, number][] => [[180, pace], [120, 420]]).flat(), [600, 380]);

const codes = (input: ReviewInput) => reviewWorkout(input).facts.map((f) => f.code);

test('spokojny bieg w strefie i w czasie → w punkt', () => {
  const r = reviewWorkout(easy());
  assert.equal(r.verdict, 'spot_on');
  assert.deepEqual([r.volume, r.intensity], ['ok', 'ok']);
});

test('spokojny bieg za szybko → nazwane wprost, z liczbą', () => {
  const slightly = reviewWorkout(easy({ buckets: run([40 * 60, 345]) }));
  assert.equal(slightly.verdict, 'good');
  // Kubełki zaokrąglają metry, więc tempo wychodzi o kilka sekund obok zadanego.
  const faster = slightly.facts.find((f) => f.code === 'steady_fast')?.values.s ?? 0;
  assert.ok(faster >= 10 && faster <= 16, String(faster));
  const clearly = reviewWorkout(easy({ buckets: run([40 * 60, 330]) }));
  assert.equal(clearly.verdict, 'passed_but');
  assert.equal(clearly.intensity, 'high');
});

test('wolniej niż strefa spokojna nie jest błędem', () => {
  assert.equal(reviewWorkout(easy({ buckets: run([40 * 60, 440]) })).verdict, 'spot_on');
});

test('objętość: za mało, dużo za mało, za dużo', () => {
  assert.equal(reviewWorkout(easy({ actualDurationS: 34 * 60 })).verdict, 'good');
  assert.equal(reviewWorkout(easy({ actualDurationS: 26 * 60 })).verdict, 'passed_but');
  assert.equal(reviewWorkout(easy({ actualDurationS: 15 * 60 })).verdict, 'different');
  const more = reviewWorkout(easy({ actualDurationS: 60 * 60 }));
  assert.deepEqual([more.verdict, more.volume], ['passed_but', 'high']);
});

test('pagórki poszerzają tolerancję tempa', () => {
  const input = easy({ buckets: run([40 * 60, 348]) });
  assert.equal(reviewWorkout(input).intensity, 'high');
  assert.equal(reviewWorkout({ ...input, elevationGainM: 200 }).intensity, 'ok');
});

test('długi bieg: wyraźnie wolniejsza druga połowa', () => {
  const input = easy({ type: 'long', buckets: run([20 * 60, 370], [20 * 60, 395]) });
  assert.ok(codes(input).includes('fade'));
});

test('interwały: wszystkie odcinki w zakresie → w punkt', () => {
  const r = reviewWorkout(intervals(reps(4, 292)));
  assert.equal(r.verdict, 'spot_on');
  assert.deepEqual(r.facts.find((f) => f.code === 'reps_all')?.values, { done: 4, planned: 4 });
});

test('interwały: brakuje odcinków, za szybko, za wolno', () => {
  assert.deepEqual(reviewWorkout(intervals(reps(2, 292))).facts.find((f) => f.code === 'reps_missing')?.values, { done: 2, planned: 4 });
  assert.equal(reviewWorkout(intervals(reps(2, 292))).verdict, 'passed_but');
  const fast = reviewWorkout(intervals(reps(4, 260)));
  assert.deepEqual([fast.verdict, fast.intensity], ['passed_but', 'high']);
  const slow = reviewWorkout(intervals(reps(4, 312)));
  assert.deepEqual([slow.verdict, slow.intensity], ['good', 'low']);
});

test('interwały: równy bieg zamiast akcentu → inny trening', () => {
  const r = reviewWorkout(intervals(run([40 * 60, 380])));
  assert.equal(r.verdict, 'different');
  assert.ok(r.facts.some((f) => f.code === 'no_reps'));
});

test('interwały: nierówne odcinki', () => {
  const uneven = run([600, 380], [180, 285], [120, 420], [180, 290], [120, 420], [180, 310], [120, 420], [180, 312], [600, 380]);
  assert.ok(codes(intervals(uneven)).includes('reps_uneven'));
});

test('akcent bez przebiegu tempa → najwyżej dobra robota', () => {
  const r = reviewWorkout(intervals(null));
  assert.deepEqual([r.verdict, r.intensity], ['good', null]);
});

test('bez stref tempa oceniamy tylko objętość', () => {
  const steps: WorkoutItem[] = [{ kind: 'work', zone: 'easy', durationS: 2400, pace: null }];
  const r = reviewWorkout(easy({ steps }));
  assert.deepEqual([r.verdict, r.intensity], ['spot_on', null]);
});

test('strumień Stravy → kubełki', () => {
  const time = Array.from({ length: 61 }, (_, i) => i);
  const distance = time.map((t) => t * 3);
  assert.deepEqual(bucketsFromStream(time, distance), { bucketS: 15, m: [45, 45, 45, 45] });
  assert.equal(bucketsFromStream([0, 1], [0]), null);
  assert.equal(bucketsFromStream(null, null), null);
});
