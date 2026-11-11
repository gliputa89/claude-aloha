import assert from 'node:assert/strict';
import { test } from 'node:test';

import { danielsEquivalentS, forecastRace, timeForVdot, vdotFromResult, vdotGain, volumePenalty, type ForecastInput } from './forecast.ts';

const hms = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;
const near = (actual: number | null, expected: number, toleranceS: number) =>
  assert.ok(actual !== null && Math.abs(actual - expected) <= toleranceS, `${actual} ≉ ${expected} (±${toleranceS})`);

test('VDOT zgodny z tabelami Danielsa', () => {
  // Tabela: VDOT 50 → 5 km 19:57, 10 km 41:21, półmaraton 1:31:35, maraton 3:10:49.
  near(vdotFromResult(5000, hms(0, 19, 57)), 50, 0.2);
  near(timeForVdot(50, 10000), hms(0, 41, 21), 12);
  near(timeForVdot(50, 21097), hms(1, 31, 35), 25);
  near(timeForVdot(50, 42195), hms(3, 10, 49), 50);
  // VDOT 40 → 5 km 24:08, maraton 3:49:45.
  near(timeForVdot(40, 5000), hms(0, 24, 8), 8);
  near(timeForVdot(40, 42195), hms(3, 49, 45), 60);
});

test('5 km w 18:53 to na papierze maraton ok. 3:00, nie 2:40', () => {
  const marathon = danielsEquivalentS({ distanceM: 5000, timeS: hms(0, 18, 53) }, 42195);
  near(marathon, hms(3, 0, 30), 120);
});

test('nierealny wynik nie daje VDOT', () => {
  assert.equal(vdotFromResult(5000, 300), null);
  assert.equal(vdotFromResult(500, 100), null);
});

test('kara za objętość rośnie z dystansem i znika przy pełnym kilometrażu', () => {
  assert.equal(volumePenalty(42195, 70), 0);
  assert.equal(volumePenalty(42195, 90), 0);
  assert.ok(volumePenalty(42195, 20) > volumePenalty(21097, 20));
  assert.ok(volumePenalty(21097, 20) > volumePenalty(5000, 20));
  // Małe braki kosztują mało, duże – nieproporcjonalnie dużo.
  assert.ok(volumePenalty(42195, 60) < 0.02);
  assert.ok(volumePenalty(42195, 18) > 0.1);
});

test('poprawa: im wyższy poziom, tym mniej do zyskania; większość w pierwszych tygodniach', () => {
  assert.ok(vdotGain(35, 16) > 3);
  assert.ok(vdotGain(55, 16) < 1);
  assert.ok(vdotGain(45, 16) > vdotGain(55, 16) * 2);
  assert.equal(vdotGain(45, 0), 0);
  assert.ok(vdotGain(45, 24) - vdotGain(45, 12) < vdotGain(45, 12));
});

const runner: ForecastInput = {
  distanceM: 42195,
  weeks: 24,
  level: 'advanced',
  recent: { distanceM: 5000, timeS: hms(0, 18, 53) },
  weeklyKm: 18,
  runsPerWeek: 3,
  longestRunKm: 20,
  weeklyMinutesCap: 4 * 90 + 120,
};

test('maraton z 5 km w 18:53 przy 18 km tygodniowo: dziś wyraźnie wolniej niż z tabel, na start ok. 3:00', () => {
  const f = forecastRace(runner);
  assert.ok(f);
  near(f.danielsS, hms(3, 0, 30), 120);
  // Dziś: brak objętości maratońskiej kosztuje kilkanaście minut.
  assert.ok(f.todayS > f.danielsS + 10 * 60 && f.todayS < f.danielsS + 30 * 60);
  // Na start: pół roku budowania zamyka większość braku (do ok. 45 km tygodniowo, nie do 70) – i nie schodzi do 2:40.
  assert.equal(f.volume.projectedKm, 45);
  assert.ok(f.raceDayS > hms(2, 58) && f.raceDayS < hms(3, 10));
  assert.ok(f.fastestS > hms(2, 50));
  assert.ok(f.fastestS <= f.raceDayS && f.raceDayS <= f.todayS && f.todayS <= f.slowestS);
  assert.equal(f.volume.neededKm, 70);
  assert.equal(f.volume.known, true);
});

test('krótko do startu albo mało czasu w tygodniu: objętość nie zdąży urosnąć i prognoza zostaje wolniejsza', () => {
  const full = forecastRace(runner)!;
  const soon = forecastRace({ ...runner, weeks: 6 })!;
  assert.ok(soon.raceDayS > full.raceDayS + 8 * 60);
  const busy = forecastRace({ ...runner, weeklyMinutesCap: 3 * 45 })!;
  assert.ok(busy.volume.projectedKm < 35);
  assert.ok(busy.raceDayS > full.raceDayS + 5 * 60);
});

test('bez znanego kilometrażu liczymy ostrożnie z liczby biegów', () => {
  const f = forecastRace({ ...runner, weeklyKm: null })!;
  assert.equal(f.volume.known, false);
  assert.equal(f.volume.currentKm, 18);
});

test('5 km → 10 km: przeliczenie prawie wprost, kara symboliczna', () => {
  const f = forecastRace({ ...runner, distanceM: 10000, weeks: 8 })!;
  near(f.danielsS, hms(0, 39, 10), 40);
  assert.ok(f.todayS - f.danielsS < 60);
});
