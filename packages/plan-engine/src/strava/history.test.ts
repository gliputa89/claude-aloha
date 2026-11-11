import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDaysIso } from '../core/dates.ts';
import { surveyFromStravaHistory, type StravaHistoryActivity } from './history.ts';

// Niedziela – tydzień 0 to 2026-11-02 (pn) … 2026-11-08 (nd).
const TODAY = '2026-11-08';
let nextId = 1;

const run = (daysAgo: number, km: number, minutes: number, over: Partial<StravaHistoryActivity> = {}): StravaHistoryActivity => {
  const localDate = addDaysIso(TODAY, -daysAgo);
  return {
    id: nextId++,
    sportType: 'Run',
    localDate,
    startedAt: `${localDate}T06:00:00Z`,
    distanceM: km * 1000,
    movingTimeS: minutes * 60,
    elapsedTimeS: minutes * 60 + 60,
    ...over,
  };
};

/** Biegi w te same dni tygodnia przez `weeks` ostatnich tygodni; `daysAgo` liczone od niedzieli. */
const weekly = (weeks: number, pattern: { daysAgo: number; km: number; minutes: number }[]) =>
  Array.from({ length: weeks }, (_, w) => pattern.map((p) => run(w * 7 + p.daysAgo, p.km, p.minutes))).flat();

test('brak biegów → „nie biegam”, bez wyniku i bez podpowiedzi dni', () => {
  const p = surveyFromStravaHistory([], TODAY);
  assert.equal(p.level, 'beginner');
  assert.equal(p.runsPerWeek, 0);
  assert.equal(p.recentResult, null);
  assert.equal(p.availability, null);
  assert.equal(p.runs, 0);
});

test('dwa biegi w dwa miesiące to wciąż „nie biegam”', () => {
  assert.equal(surveyFromStravaHistory([run(3, 4, 28), run(40, 3, 22)], TODAY).level, 'beginner');
});

test('regularnie: 3 razy w tygodniu przez 8 tygodni → dni, liczba treningów i czasy', () => {
  // wtorek 6 km / 36 min, czwartek 8 km / 48 min, niedziela 14 km / 90 min
  const p = surveyFromStravaHistory(
    weekly(8, [
      { daysAgo: 5, km: 6, minutes: 36 },
      { daysAgo: 3, km: 8, minutes: 48 },
      { daysAgo: 0, km: 14, minutes: 90 },
    ]),
    TODAY,
  );
  assert.equal(p.level, 'advanced');
  assert.equal(p.runsPerWeek, 3);
  assert.equal(p.runs, 24);
  assert.equal(p.weeklyDistanceM, 28000);
  assert.equal(p.longestRunM, 14000);
  assert.deepEqual(p.availability, {
    preferredDays: [2, 4, 7],
    sessionsPerWeek: 3,
    typicalMinutesWeekday: 48,
    typicalMinutesWeekend: 90,
  });
});

test('okazjonalnie: bieg co tydzień, ale tylko raz', () => {
  const p = surveyFromStravaHistory(weekly(8, [{ daysAgo: 1, km: 5, minutes: 32 }]), TODAY);
  assert.equal(p.level, 'intermediate');
  assert.equal(p.runsPerWeek, 1);
  assert.deepEqual(p.availability?.preferredDays, [6]);
  assert.equal(p.availability?.typicalMinutesWeekday, null);
});

test('częstotliwość z ostatnich 4 tygodni – świeży start liczy się bardziej niż puste tygodnie przed nim', () => {
  const p = surveyFromStravaHistory(
    weekly(3, [
      { daysAgo: 5, km: 4, minutes: 28 },
      { daysAgo: 3, km: 4, minutes: 28 },
      { daysAgo: 1, km: 5, minutes: 35 },
    ]),
    TODAY,
  );
  assert.equal(p.level, 'intermediate');
  assert.equal(p.runsPerWeek, 2);
});

test('wynik: najszybszy bieg na dystansie, dłuższy przeliczony średnim tempem', () => {
  const p = surveyFromStravaHistory(
    [run(2, 5.02, 27), run(9, 6, 30), run(16, 5, 31), run(23, 4, 18)],
    TODAY,
  );
  // 6 km w 30 min = 5:00/km → 5 km w 25:00; lepsze niż 5,02 km w 27:00. 4 km jest za krótkie na wynik.
  assert.deepEqual(p.recentResult, { distanceM: 5000, timeS: 25 * 60, fromRace: false });
});

test('wynik: zawody mają pierwszeństwo przed szybszym treningiem', () => {
  const p = surveyFromStravaHistory(
    [run(2, 5, 24), run(9, 10, 52, { race: true }), run(16, 6, 36), run(23, 6, 36)],
    TODAY,
  );
  assert.deepEqual(p.recentResult, { distanceM: 10000, timeS: 52 * 60, fromRace: true });
});

test('pomija inne dyscypliny, strzępki zapisów, nierealne tempo i biegi sprzed okna', () => {
  const p = surveyFromStravaHistory(
    [
      run(1, 30, 60, { sportType: 'Ride' }),
      run(2, 0.4, 3),
      run(60, 10, 50),
      run(3, 5, 10),
      run(4, 5, 30),
      run(11, 5, 30),
      run(18, 5, 30),
    ],
    TODAY,
  );
  // Zostają 4 biegi (ten 5 km w 10 min też – liczy się do częstotliwości, ale nie do wyniku).
  assert.equal(p.runs, 4);
  assert.deepEqual(p.recentResult, { distanceM: 5000, timeS: 30 * 60, fromRace: false });
});
