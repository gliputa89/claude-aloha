import assert from 'node:assert/strict';
import { test } from 'node:test';

import { duplicateActivityIds, type SourcedActivity } from './duplicates.ts';

const run = (id: number, source: SourcedActivity['source'], startedAt: string, elapsedTimeS: number): SourcedActivity => ({
  id,
  source,
  startedAt,
  elapsedTimeS,
});

test('bieg z Apple Zdrowie, który jest też w Stravie, jest odkładany', () => {
  const ids = duplicateActivityIds([
    run(111, 'strava', '2026-11-14T07:00:05Z', 2700),
    run(-1, 'apple_health', '2026-11-14T07:00:00Z', 2712),
  ]);
  assert.deepEqual([...ids], [-1]);
});

test('dwa różne biegi tego samego dnia zostają', () => {
  const ids = duplicateActivityIds([
    run(111, 'strava', '2026-11-14T07:00:00Z', 2700),
    run(-1, 'apple_health', '2026-11-14T18:00:00Z', 1800),
  ]);
  assert.equal(ids.size, 0);
});

test('bez Stravy nic nie odkładamy', () => {
  const ids = duplicateActivityIds([run(-1, 'apple_health', '2026-11-14T07:00:00Z', 2700), run(-2, 'apple_health', '2026-11-14T07:01:00Z', 2700)]);
  assert.equal(ids.size, 0);
});

test('ten sam start, ale zupełnie inna długość – to nie kopia', () => {
  const ids = duplicateActivityIds([
    run(111, 'strava', '2026-11-14T07:00:00Z', 600),
    run(-1, 'apple_health', '2026-11-14T07:00:00Z', 3600),
  ]);
  assert.equal(ids.size, 0);
});
