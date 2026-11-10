import assert from 'node:assert/strict';
import { test } from 'node:test';

import { matchStravaActivities, type StravaActivityInput, type StravaMatchSession } from './strava.ts';

const session = (over: Partial<StravaMatchSession> = {}): StravaMatchSession => ({
  id: 's1',
  scheduled_on: '2026-11-10',
  type: 'easy',
  duration_min: 40,
  distance_m: null,
  status: 'planned',
  ...over,
});

const activity = (over: Partial<StravaActivityInput> = {}): StravaActivityInput => ({
  id: 1,
  sportType: 'Run',
  localDate: '2026-11-10',
  startedAt: '2026-11-10T06:00:00Z',
  distanceM: 6500,
  movingTimeS: 40 * 60,
  elapsedTimeS: 42 * 60,
  ...over,
});

test('bieg z dnia treningu → trening zrobiony, z dystansem i czasem', () => {
  const { links, completions } = matchStravaActivities([session()], [activity()]);
  assert.equal(links.get(1), 's1');
  assert.deepEqual(completions, [
    { sessionId: 's1', status: 'done', actualDistanceM: 6500, actualDurationS: 2400, completedAt: '2026-11-10T06:42:00.000Z' },
  ]);
});

test('wyraźnie krótszy bieg → częściowo', () => {
  const { completions } = matchStravaActivities([session()], [activity({ movingTimeS: 15 * 60, distanceM: 2400 })]);
  assert.equal(completions[0]?.status, 'partial');
});

test('kilka aktywności jednego dnia sumuje się', () => {
  const { completions } = matchStravaActivities(
    [session()],
    [
      activity({ id: 1, movingTimeS: 15 * 60, distanceM: 2400 }),
      activity({ id: 2, startedAt: '2026-11-10T17:00:00Z', movingTimeS: 20 * 60, elapsedTimeS: 20 * 60, distanceM: 3300 }),
    ],
  );
  assert.equal(completions[0]?.status, 'done');
  assert.equal(completions[0]?.actualDurationS, 35 * 60);
  assert.equal(completions[0]?.actualDistanceM, 5700);
  assert.equal(completions[0]?.completedAt, '2026-11-10T17:20:00.000Z');
});

test('bieg w dzień bez treningu albo w dzień odpoczynku zostaje bez pary', () => {
  const { links, completions } = matchStravaActivities(
    [session({ id: 'rest', type: 'rest', duration_min: null })],
    [activity(), activity({ id: 2, localDate: '2026-11-11' })],
  );
  assert.equal(links.get(1), null);
  assert.equal(links.get(2), null);
  assert.equal(completions.length, 0);
});

test('rower nie liczy się wcale, marsz tylko do marszobiegu', () => {
  const ride = matchStravaActivities([session()], [activity({ sportType: 'Ride' })]);
  assert.equal(ride.links.get(1), null);
  const walkEasy = matchStravaActivities([session()], [activity({ sportType: 'Walk' })]);
  assert.equal(walkEasy.completions.length, 0);
  const walkRun = matchStravaActivities([session({ type: 'walk_run' })], [activity({ sportType: 'Walk' })]);
  assert.equal(walkRun.completions[0]?.status, 'done');
});

test('zrobiony trening nie wraca do „częściowo”', () => {
  const { completions } = matchStravaActivities([session({ status: 'done' })], [activity({ movingTimeS: 5 * 60 })]);
  assert.equal(completions[0]?.status, 'done');
});

test('trening na dystans: liczy się lepszy ze wskaźników', () => {
  const { completions } = matchStravaActivities(
    [session({ duration_min: 60, distance_m: 10000 })],
    [activity({ movingTimeS: 40 * 60, distanceM: 9000 })],
  );
  assert.equal(completions[0]?.status, 'done');
});

test('dwa treningi jednego dnia → aktywność do bliższego czasem', () => {
  const { links } = matchStravaActivities(
    [session({ id: 'short', duration_min: 20 }), session({ id: 'long', duration_min: 60 })],
    [activity({ movingTimeS: 55 * 60 })],
  );
  assert.equal(links.get(1), 'long');
});
