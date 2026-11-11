import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reviewWorkout } from './review.ts';
import { REVIEW_SCENARIOS, scenarioInput, simulateRun, SIM_WORKOUTS } from './review-sim.ts';

for (const scenario of REVIEW_SCENARIOS) {
  test(`ocena: ${scenario.id} – ${scenario.label} → ${scenario.expect}`, () => {
    const review = reviewWorkout(scenarioInput(scenario));
    const codes = review.facts.map((f) => f.code);
    assert.equal(review.verdict, scenario.expect, JSON.stringify(review.facts));
    for (const code of scenario.facts ?? []) assert.ok(codes.includes(code), `brak faktu ${code}: ${JSON.stringify(review.facts)}`);
  });
}

test('symulator: ten sam scenariusz daje ten sam bieg, a czas i dystans zgadzają się z planem', () => {
  const a = simulateRun(SIM_WORKOUTS.easy.steps, { noiseS: 6, seed: 7 });
  const b = simulateRun(SIM_WORKOUTS.easy.steps, { noiseS: 6, seed: 7 });
  assert.deepEqual(a, b);
  assert.equal(a.actualDurationS, 40 * 60);
  assert.ok(a.actualDistanceM! > 5500 && a.actualDistanceM! < 6500, String(a.actualDistanceM));
});

test('werdykty są stabilne przy innym szumie GPS', () => {
  for (const scenario of REVIEW_SCENARIOS) {
    for (const seed of [2, 3, 4, 5]) {
      const review = reviewWorkout(scenarioInput({ ...scenario, sim: { ...scenario.sim, seed } }));
      assert.equal(review.verdict, scenario.expect, `${scenario.id} seed ${seed}: ${JSON.stringify(review.facts)}`);
    }
  }
});
