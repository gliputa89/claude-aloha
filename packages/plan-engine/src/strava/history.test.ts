import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDaysIso } from '../core/dates.ts';
import { stravaResultCandidates, surveyFromStravaHistory, type StravaHistoryActivity } from './history.ts';

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

test('dwa biegi w trzy miesiące to za mało na propozycję', () => {
  assert.equal(surveyFromStravaHistory([run(3, 4, 28), run(40, 3, 22)], TODAY).level, 'beginner');
});

test('długa przerwa: regularne bieganie sprzed 2 miesięcy nie mówi, jak jest teraz', () => {
  const old = weekly(10, [
    { daysAgo: 5, km: 6, minutes: 36 },
    { daysAgo: 3, km: 8, minutes: 48 },
  ]).filter((a) => a.localDate <= addDaysIso(TODAY, -7 * 7));
  const p = surveyFromStravaHistory(old, TODAY);
  assert.equal(p.level, 'beginner');
  assert.equal(p.availability, null);
});

test('regularnie: 3 razy w tygodniu przez 12 tygodni → dni, liczba treningów i czasy', () => {
  // wtorek 6 km / 36 min, czwartek 8 km / 48 min, niedziela 14 km / 90 min
  const p = surveyFromStravaHistory(
    weekly(12, [
      { daysAgo: 5, km: 6, minutes: 36 },
      { daysAgo: 3, km: 8, minutes: 48 },
      { daysAgo: 0, km: 14, minutes: 90 },
    ]),
    TODAY,
  );
  assert.equal(p.level, 'advanced');
  assert.equal(p.runsPerWeek, 3);
  assert.equal(p.runs, 36);
  assert.equal(p.weeklyDistanceM, 28000);
  assert.equal(p.longestRunM, 14000);
  assert.deepEqual(p.availability, {
    preferredDays: [2, 4, 7],
    sessionsPerWeek: 3,
    typicalMinutesWeekday: 48,
    typicalMinutesWeekend: 90,
  });
});

test('8 tygodni po 3 biegi to jeszcze nie „od dłuższego czasu”', () => {
  const p = surveyFromStravaHistory(
    weekly(8, [
      { daysAgo: 5, km: 6, minutes: 36 },
      { daysAgo: 3, km: 8, minutes: 48 },
      { daysAgo: 0, km: 10, minutes: 62 },
    ]),
    TODAY,
  );
  assert.equal(p.level, 'intermediate');
  assert.equal(p.runsPerWeek, 3);
});

test('okazjonalnie: bieg co tydzień, ale tylko raz', () => {
  const p = surveyFromStravaHistory(weekly(12, [{ daysAgo: 1, km: 5, minutes: 32 }]), TODAY);
  assert.equal(p.level, 'intermediate');
  assert.equal(p.runsPerWeek, 1);
  assert.deepEqual(p.availability?.preferredDays, [6]);
  assert.equal(p.availability?.typicalMinutesWeekday, null);
});

test('częstotliwość i kilometraż z ostatnich 4 tygodni, nie ze średniej z całego okna', () => {
  const p = surveyFromStravaHistory(
    [
      ...weekly(3, [
        { daysAgo: 5, km: 4, minutes: 28 },
        { daysAgo: 3, km: 4, minutes: 28 },
        { daysAgo: 1, km: 5, minutes: 35 },
      ]),
      // Dawniej, przed przerwą: jeden bieg w tygodniu.
      run(100, 5, 34),
      run(107, 5, 34),
    ],
    TODAY,
  );
  assert.equal(p.level, 'intermediate');
  assert.equal(p.runsPerWeek, 2);
  assert.equal(p.weeklyDistanceM, Math.round((3 * 13000) / 4));
  assert.equal(p.runs, 11);
});

test('wynik: cały bieg na dystansie, dłuższy przeliczony średnim tempem – także sprzed 4 miesięcy', () => {
  const p = surveyFromStravaHistory(
    [run(2, 5.02, 27), run(9, 6, 31), run(16, 5, 31), run(23, 4, 18), run(120, 6, 30)],
    TODAY,
  );
  // 6 km w 30 min = 5:00/km → 5 km w 25:00; lepsze niż świeższe biegi. 4 km jest za krótkie na wynik.
  assert.deepEqual(p.recentResult, { distanceM: 5000, timeS: 25 * 60, source: 'run', date: addDaysIso(TODAY, -120) });
});

test('wynik: najszybszy odcinek wewnątrz biegu bije średnie tempo całej aktywności', () => {
  // Trening tempowy: 10 km w 56 min razem z rozgrzewką i truchtem, ale 5 km w środku w 23:30.
  const tempo = run(9, 10, 56, { workout: true, bestEfforts: [{ distanceM: 1000, timeS: 262 }, { distanceM: 5000, timeS: 23 * 60 + 30 }] });
  const p = surveyFromStravaHistory([run(2, 5, 27), tempo, run(16, 6, 36), run(23, 6, 36)], TODAY);
  assert.deepEqual(p.recentResult, { distanceM: 5000, timeS: 23 * 60 + 30, source: 'effort', date: tempo.localDate });
});

test('wynik: czas z zawodów jest oznaczony jako zawody; odcinek z zawodów na dłuższym dystansie – jako odcinek', () => {
  const race = run(9, 10, 50, { race: true, bestEfforts: [{ distanceM: 5000, timeS: 24 * 60 + 40 }, { distanceM: 10000, timeS: 50 * 60 }] });
  const p = surveyFromStravaHistory([run(2, 5, 27), race, run(16, 6, 36)], TODAY);
  assert.deepEqual(p.recentResult, { distanceM: 10000, timeS: 50 * 60, source: 'race', date: race.localDate });

  // Druga połowa wyraźnie szybsza: 5 km w 23:00 to lepszy odpowiednik niż całe 10 km w 50:00.
  const negative = run(9, 10, 50, { race: true, bestEfforts: [{ distanceM: 5000, timeS: 23 * 60 }] });
  assert.equal(surveyFromStravaHistory([run(2, 5, 27), negative, run(16, 6, 36)], TODAY).recentResult?.source, 'effort');
});

test('pomija inne dyscypliny, strzępki zapisów, nierealne tempo i biegi sprzed okna', () => {
  const p = surveyFromStravaHistory(
    [
      run(1, 30, 60, { sportType: 'Ride' }),
      run(2, 0.4, 3),
      run(200, 10, 50),
      run(3, 5, 10, { bestEfforts: [{ distanceM: 5000, timeS: 600 }] }),
      run(4, 5, 30),
      run(11, 5, 30),
      run(18, 5, 30),
    ],
    TODAY,
  );
  // Zostają 4 biegi (ten 5 km w 10 min też – liczy się do częstotliwości, ale nie do wyniku).
  assert.equal(p.runs, 4);
  assert.deepEqual(p.recentResult, { distanceM: 5000, timeS: 30 * 60, source: 'run', date: addDaysIso(TODAY, -4) });
});

test('kandydaci do szczegółów: zawody, najszybsze biegi na każdym dystansie i treningi jakościowe, bez powtórek', () => {
  const easy = Array.from({ length: 12 }, (_, i) => run(3 + i * 7, 6, 39));
  const race = run(30, 10, 50, { race: true });
  const fast5 = run(12, 5, 24);
  const fast10 = run(40, 12, 62);
  const intervals = run(5, 9, 58, { workout: true });
  const short = run(6, 3, 12, { workout: true });
  const ids = stravaResultCandidates([...easy, race, fast5, fast10, intervals, short], TODAY);
  assert.equal(ids[0], race.id);
  for (const a of [fast5, fast10, intervals]) assert.ok(ids.includes(a.id));
  // 3 km to za mało na jakikolwiek dystans zawodów.
  assert.ok(!ids.includes(short.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length <= 8);
});
