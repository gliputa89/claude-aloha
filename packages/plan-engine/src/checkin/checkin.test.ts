import assert from 'node:assert/strict';
import { test } from 'node:test';

import { proposeFromCheckIn, type CheckInSession } from './checkin.ts';

const easy: CheckInSession = { date: '2026-11-17', type: 'easy', durationMin: 40 };
const intervals: CheckInSession = { date: '2026-11-17', type: 'intervals', durationMin: 55 };
const propose = (session: CheckInSession, wellbeing: number, tags: string[] = []) =>
  proposeFromCheckIn({ session, wellbeing, tags, minSessionMin: 20 });

test('dobry dzień bez podpowiedzi → trening bez zmian', () => {
  for (const w of [3, 4, 5]) assert.equal(propose(easy, w), null);
  assert.equal(propose(intervals, 4), null);
});

test('słabszy dzień: spokojny bieg krótszy, tym bardziej im gorzej', () => {
  const two = propose(easy, 2);
  assert.deepEqual(two?.change, { op: 'set_duration', date: '2026-11-17', toDate: null, type: null, durationMin: 30, sets: null, summary: 'shorter' });
  assert.equal(two?.level, 1);
  const one = propose(easy, 1);
  assert.equal(one?.change.durationMin, 20);
  assert.equal(one?.level, 2);
});

test('słabszy dzień: mocna jednostka zamienia się w spokojny bieg', () => {
  const two = propose(intervals, 2);
  assert.deepEqual(two?.change, { op: 'set_type', date: '2026-11-17', toDate: null, type: 'easy', durationMin: 40, sets: null, summary: 'easier' });
  assert.equal(two?.level, 2);
  // Ocena 1: najwyżej pół godziny spokojnie.
  assert.equal(propose(intervals, 1)?.change.durationMin, 30);
  assert.equal(propose({ ...intervals, type: 'tempo' }, 2)?.change.type, 'easy');
});

test('mało czasu: skrót do 25 min przy każdej ocenie, typ zostaje', () => {
  const p = propose(intervals, 4, ['little_time']);
  assert.deepEqual(p?.change, { op: 'set_duration', date: '2026-11-17', toDate: null, type: null, durationMin: 25, sets: null, summary: 'little_time' });
  assert.equal(p?.level, 1);
  // Trening już krótszy niż 25 min – nie ma czego skracać.
  assert.equal(propose({ ...easy, durationMin: 20 }, 4, ['little_time']), null);
  // Słabszy dzień + mało czasu przy mocnej jednostce: spokojnie i krótko, powód „lżej”.
  const both = propose(intervals, 2, ['little_time']);
  assert.equal(both?.change.type, 'easy');
  assert.equal(both?.change.durationMin, 25);
  assert.equal(both?.reason, 'easier');
});

test('mało snu liczy się jak ocena o jeden niższa', () => {
  assert.equal(propose(easy, 3, ['little_sleep'])?.change.durationMin, 30);
  assert.equal(propose(easy, 2, ['little_sleep'])?.change.durationMin, 20);
  assert.equal(propose(easy, 4, ['little_sleep']), null);
});

test('ból, zawody, odpoczynek i trening na minimum: reguły niczego nie proponują', () => {
  assert.equal(propose(easy, 1, ['pain']), null);
  assert.equal(propose({ date: '2026-11-17', type: 'race', durationMin: null }, 1), null);
  assert.equal(propose({ date: '2026-11-17', type: 'rest', durationMin: null }, 1), null);
  assert.equal(propose({ ...easy, durationMin: 20 }, 2), null);
});

test('nie skracamy poniżej najkrótszego treningu dla poziomu', () => {
  assert.equal(proposeFromCheckIn({ session: easy, wellbeing: 1, tags: [], minSessionMin: 30 })?.change.durationMin, 30);
});
