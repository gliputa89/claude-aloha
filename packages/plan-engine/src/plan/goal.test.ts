import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assessRaceGoal, predictTimeS, timeSanity, weeksUntil } from './goal.ts';

const today = '2026-11-08';

test('weeksUntil liczy pełne tygodnie', () => {
  assert.equal(weeksUntil('2026-11-22', today), 2);
  assert.equal(weeksUntil('2026-11-21', today), 1);
  assert.equal(weeksUntil('2026-11-01', today), 0);
});

test('przykład z PROJECT.md: maraton sub 3h za 6 tygodni z 10 km / 55 min → krótszy dystans', () => {
  const r = assessRaceGoal({
    goal: { distanceM: 42195, raceDate: '2026-12-20', targetTimeS: 3 * 3600 },
    level: 'intermediate',
    recent: { distanceM: 10000, timeS: 55 * 60 },
    today,
  });
  assert.equal(r.status, 'too_soon');
  assert.deepEqual(r.status === 'too_soon' && r.suggestion, { kind: 'shorter_distance', distanceM: 10000 });
});

test('początkujący, 5 km za 2 tygodnie → późniejsza data', () => {
  const r = assessRaceGoal({ goal: { distanceM: 5000, raceDate: '2026-11-22' }, level: 'beginner', today });
  assert.equal(r.status, 'too_soon');
  assert.deepEqual(r.status === 'too_soon' && r.suggestion, { kind: 'later_date', raceDate: '2027-01-03' });
});

test('persona Tomek: półmaraton za 4 miesiące z 10 km / 48 min, bez docelowego czasu → ok', () => {
  const r = assessRaceGoal({
    goal: { distanceM: 21097, raceDate: '2027-03-08' },
    level: 'advanced',
    recent: { distanceM: 10000, timeS: 48 * 60 },
    today,
  });
  assert.equal(r.status, 'ok');
});

test('zbyt ambitny czas → propozycja realnego czasu (pełne minuty)', () => {
  const r = assessRaceGoal({
    goal: { distanceM: 10000, raceDate: '2027-01-03', targetTimeS: 40 * 60 },
    level: 'advanced',
    recent: { distanceM: 10000, timeS: 50 * 60 },
    today,
  });
  assert.equal(r.status, 'target_too_fast');
  if (r.status === 'target_too_fast') {
    assert.equal(r.suggestion.targetTimeS % 60, 0);
    assert.ok(r.suggestion.targetTimeS > 40 * 60 && r.suggestion.targetTimeS < 50 * 60);
  }
});

test('Riegel: 10 km w 39 min ≈ maraton ok. 3h', () => {
  const t = predictTimeS({ distanceM: 10000, timeS: 39 * 60 }, 42195);
  assert.ok(t > 2.9 * 3600 && t < 3.1 * 3600);
});

test('maraton z 5 km w 18:53 przy małym kilometrażu: 2:40 to za szybko, realnie ok. 3:00', () => {
  const r = assessRaceGoal({
    goal: { distanceM: 42195, raceDate: '2027-04-25', targetTimeS: 2 * 3600 + 40 * 60 },
    level: 'advanced',
    recent: { distanceM: 5000, timeS: 18 * 60 + 53 },
    today,
    weeklyKm: 18,
    runsPerWeek: 3,
  });
  assert.equal(r.status, 'target_too_fast');
  if (r.status === 'target_too_fast') {
    assert.ok(r.suggestion.targetTimeS >= 2 * 3600 + 58 * 60 && r.suggestion.targetTimeS <= 3 * 3600 + 10 * 60);
    // Dziś – bez objętości maratońskiej – wyraźnie wolniej niż w dniu startu.
    assert.ok(r.predictedTimeS > r.suggestion.targetTimeS + 8 * 60);
  }
});

test('cel zgodny z tabelami przy solidnym kilometrażu przechodzi', () => {
  const r = assessRaceGoal({
    goal: { distanceM: 42195, raceDate: '2027-04-25', targetTimeS: 3 * 3600 + 2 * 60 },
    level: 'advanced',
    recent: { distanceM: 5000, timeS: 18 * 60 + 53 },
    today,
    weeklyKm: 65,
    runsPerWeek: 5,
  });
  assert.equal(r.status, 'ok');
});

test('wiarygodność czasu: szybciej niż rekord świata = pomyłka, poziom zawodowy = dopytujemy', () => {
  assert.equal(timeSanity(10000, 25 * 60), 'impossible');
  assert.equal(timeSanity(10000, 29 * 60 + 59), 'elite');
  assert.equal(timeSanity(10000, 30 * 60), 'ok');
  assert.equal(timeSanity(5000, 18 * 60 + 53), 'ok');
  assert.equal(timeSanity(5000, 14 * 60), 'elite');
  // 1:55 wpisane jako minuty:sekundy zamiast godziny:minuty – klasyczna pomyłka przy półmaratonie.
  assert.equal(timeSanity(21097, 115), 'impossible');
  assert.equal(timeSanity(42195, 2 * 3600 + 15 * 60), 'elite');
  assert.equal(timeSanity(42195, 2 * 3600), 'impossible');
  assert.equal(timeSanity(3000, 60), 'ok');
});
