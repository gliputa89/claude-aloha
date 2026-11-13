import assert from 'node:assert/strict';
import { test } from 'node:test';

import { paceZonesFrom, stepsFromStructure, type WorkoutItem } from '../core/workout.ts';
import { paceToSpeed, toWatchWorkout } from './watch.ts';

test('tempo s/km zamienia się na zakres prędkości m/s', () => {
  // 5:00–5:30 min/km → 3,03–3,33 m/s
  assert.deepEqual(paceToSpeed({ fastS: 300, slowS: 330 }), { lowMps: 3.03, highMps: 3.333 });
  assert.equal(paceToSpeed(null), null);
  assert.equal(paceToSpeed({ fastS: 300, slowS: 200 }), null);
});

test('interwały: rozgrzewka, blok z powtórzeniami i schłodzenie', () => {
  const paces = paceZonesFrom({ distanceM: 10000, timeS: 50 * 60 });
  const steps = stepsFromStructure('intervals', 45, { kind: 'intervals', repeats: 5, workMin: 3, recoveryMin: 2 }, paces);
  const w = toWatchWorkout(steps);
  assert.ok(w);
  assert.equal(w.warmup?.durationS, 600);
  const [block] = w.blocks;
  assert.equal(w.blocks.length, 1);
  assert.ok(block);
  assert.equal(block.iterations, 5);
  assert.deepEqual(
    block.steps.map((s) => [s.purpose, s.step.durationS]),
    [
      ['work', 180],
      ['recovery', 120],
    ],
  );
  assert.ok(block.steps[0]?.step.speed, 'odcinek mocny ma cel tempa');
  assert.equal(w.cooldown?.kind, 'cooldown');
});

test('marszobieg bez znanego wyniku: marsz i bieg bez celu tempa', () => {
  const w = toWatchWorkout(stepsFromStructure('walk_run', 30, { kind: 'walk_run', runMin: 1, walkMin: 2, repeats: 6 }, null));
  assert.ok(w);
  assert.equal(w.blocks[0]?.iterations, 6);
  assert.ok(w.blocks[0]?.steps.every((s) => s.step.speed === null));
  assert.equal(w.warmup?.zone, 'walk');
});

test('kolejne pojedyncze odcinki trafiają do jednego bloku bez powtórzeń', () => {
  const step = (kind: 'warmup' | 'work' | 'cooldown', durationS: number) => ({ kind, zone: 'easy' as const, durationS, pace: null });
  const items: WorkoutItem[] = [step('warmup', 300), step('work', 600), step('work', 900), step('cooldown', 300)];
  const w = toWatchWorkout(items);
  assert.ok(w);
  assert.equal(w.blocks.length, 1);
  assert.equal(w.blocks[0]?.iterations, 1);
  assert.equal(w.blocks[0]?.steps.length, 2);
});

test('bez odcinków nie ma treningu dla zegarka', () => {
  assert.equal(toWatchWorkout([]), null);
  assert.equal(stepsFromStructure('race', 40, { kind: 'race' }, null).length, 0);
});
