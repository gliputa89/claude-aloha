import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateInitialPlan, type PlanInput } from '../plan/plan.ts';
import {
  checkpointsFromGoals,
  continuousSteps,
  goalProgress,
  nextGoalSuggestions,
  planFocusOf,
  suggestGoals,
  type GoalRow,
  type ProgressContext,
} from './goals.ts';

const row = (patch: Partial<GoalRow>): GoalRow => ({
  id: 'g',
  kind: 'consistency',
  role: 'secondary',
  priority: null,
  status: 'active',
  distance_m: null,
  race_date: null,
  target_time_s: null,
  race_name: null,
  target_minutes: null,
  sessions_per_week: null,
  volume_km: null,
  period_start: null,
  period_end: null,
  due_on: null,
  result_time_s: null,
  finished_at: null,
  plan_starts_on: null,
  created_at: '2026-11-02T10:00:00Z',
  ...patch,
});

const ctx = (patch: Partial<ProgressContext> = {}): ProgressContext => ({
  today: '2026-11-25',
  sessions: [],
  activities: [],
  level: 'intermediate',
  recent: null,
  weeklyKm: null,
  runsPerWeek: 3,
  weeklyMinutesCap: null,
  ...patch,
});

const base = {
  level: 'intermediate' as const,
  recent: { distanceM: 10000, timeS: 48 * 60 },
  weeklyKm: 30,
  runsPerWeek: 3,
  sessionsPerWeek: 4,
  weeklyMinutesCap: 240,
  planStartDate: '2026-11-16',
};

test('początkująca: prowadzi 5 km bez zatrzymania, obok regularność zaznaczona', () => {
  const s = suggestGoals({ ...base, direction: 'start_running', level: 'beginner', recent: null, weeklyKm: null, sessionsPerWeek: 3 });
  assert.equal(s.primary.kind, 'continuous');
  assert.equal(s.primary.targetMinutes, 30);
  assert.equal(planFocusOf(s.primary), 'start_running');
  assert.equal(s.secondary[0]?.spec.kind, 'consistency');
  assert.equal(s.secondary[0]?.checked, true);
  assert.equal(s.secondary[0]?.spec.sessionsPerWeek, 3);
  // 8 tygodni od startu planu, włącznie.
  assert.equal(s.secondary[0]?.spec.periodEnd, '2027-01-10');
});

test('półmaraton: sprawdzian 10 km w połowie drogi i regularność do startu', () => {
  const s = suggestGoals({
    ...base,
    direction: 'race',
    race: { distanceM: 21097, date: '2027-03-28', name: 'Półmaraton Wiosenny', targetTimeS: null },
  });
  assert.equal(s.primary.kind, 'race');
  const trial = s.secondary.find((g) => g.spec.kind === 'performance');
  assert.ok(trial);
  assert.equal(trial.spec.distanceM, 10000);
  // Prognoza na sprawdzian jest szybsza niż wynik z ankiety, ale nie przesadnie.
  assert.ok((trial.spec.targetTimeS ?? 0) < 48 * 60 && (trial.spec.targetTimeS ?? 0) > 44 * 60);
  assert.ok(trial.spec.date && trial.spec.date > '2026-12-31' && trial.spec.date < '2027-02-15');
  const regular = s.secondary.find((g) => g.spec.kind === 'consistency');
  assert.equal(regular?.spec.periodEnd, '2027-03-27');
});

test('„szybciej” bez wyniku: cel na 5 km bez czasu – wpisze go biegacz', () => {
  const s = suggestGoals({ ...base, direction: 'faster', recent: null });
  assert.equal(s.primary.kind, 'performance');
  assert.equal(s.primary.distanceM, 5000);
  assert.equal(s.primary.targetTimeS, null);
});

test('plan: start B w swoim tygodniu zastępuje mocny trening, dzień przed i po wolne', () => {
  const input: PlanInput = {
    startDate: '2026-11-16',
    level: 'advanced',
    goal: { type: 'race', distanceM: 21097, raceDate: '2027-03-28' },
    preferredDays: [2, 4, 6, 7],
    sessionsPerWeek: 4,
    maxMinutesWeekday: 60,
    maxMinutesWeekend: 120,
    hasContraindications: false,
    weeks: 2,
    trainingLevel: 4,
    checkpoints: checkpointsFromGoals([row({ kind: 'race', priority: 'B', distance_m: 10000, race_date: '2026-11-29' })]),
  };
  const week = generateInitialPlan(input).weeks[1]!;
  const race = week.sessions.find((s) => s.type === 'race');
  assert.ok(race);
  assert.equal(race.scheduledOn, '2026-11-29');
  assert.deepEqual(race.structure.kind === 'race' && race.structure.checkpoint, 'B');
  assert.ok(week.sessions.every((s) => s.type === 'race' || s.intensity === 'easy'));
  assert.ok(!week.sessions.some((s) => s.scheduledOn === '2026-11-28'));
  // Główny cel dalej prowadzi: tydzień nie jest tygodniem startowym.
  assert.notEqual(week.focus, 'race');
});

test('plan: sprawdzian z celu wynikowego wypada w dzień długiego biegu', () => {
  const input: PlanInput = {
    startDate: '2026-11-16',
    level: 'intermediate',
    goal: { type: 'general', focus: 'improve_fitness' },
    preferredDays: [2, 4, 6],
    sessionsPerWeek: 3,
    maxMinutesWeekday: 45,
    maxMinutesWeekend: 90,
    hasContraindications: false,
    weeks: 2,
    checkpoints: checkpointsFromGoals([row({ kind: 'performance', role: 'primary', distance_m: 5000, target_time_s: 1500, due_on: '2026-11-27' })]),
  };
  const week = generateInitialPlan(input).weeks[1]!;
  const trial = week.sessions.find((s) => s.type === 'race');
  assert.equal(trial?.scheduledOn, '2026-11-28');
  assert.deepEqual(trial?.structure.kind === 'race' && trial.structure.checkpoint, 'trial');
});

test('zawody C i cele bez daty nie zmieniają planu', () => {
  assert.deepEqual(
    checkpointsFromGoals([
      row({ kind: 'race', priority: 'C', distance_m: 5000, race_date: '2026-12-01' }),
      row({ kind: 'performance', distance_m: 5000, target_time_s: 1500 }),
      row({ kind: 'volume', volume_km: 100 }),
    ]),
    [],
  );
});

test('drabinka bez zatrzymania do 30 min', () => {
  assert.deepEqual(continuousSteps(30), [1, 3, 5, 10, 20, 30]);
  assert.ok(continuousSteps(90).length <= 7);
  assert.equal(continuousSteps(90).at(-1), 90);
});

test('postęp „bez zatrzymania”: najdłuższy odcinek biegu z marszobiegu', () => {
  const p = goalProgress(
    row({ kind: 'continuous', role: 'primary', distance_m: 5000, target_minutes: 30 }),
    ctx({
      sessions: [
        { scheduled_on: '2026-11-10', type: 'walk_run', status: 'done', duration_min: 30, structure: { kind: 'walk_run', runMin: 5 }, actual_distance_m: null, actual_duration_s: null },
        { scheduled_on: '2026-11-12', type: 'walk_run', status: 'planned', duration_min: 30, structure: { kind: 'walk_run', runMin: 10 }, actual_distance_m: null, actual_duration_s: null },
      ],
    }),
  );
  assert.equal(p.kind, 'continuous');
  assert.equal(p.kind === 'continuous' && p.current, 5);
  assert.equal(p.kind === 'continuous' && p.achieved, false);
});

test('postęp regularności: pełne tygodnie i seria, bieżący tydzień jej nie przerywa', () => {
  const run = (day: string) => ({ local_date: day, distance_m: 5000, moving_time_s: 1800 });
  const p = goalProgress(
    row({ kind: 'consistency', sessions_per_week: 2, period_start: '2026-11-02', period_end: '2026-12-27' }),
    ctx({
      today: '2026-11-25',
      activities: [run('2026-11-03'), run('2026-11-05'), run('2026-11-10'), run('2026-11-12'), run('2026-11-17'), run('2026-11-19'), run('2026-11-24')],
    }),
  );
  assert.equal(p.kind, 'consistency');
  if (p.kind !== 'consistency') return;
  assert.equal(p.totalWeeks, 8);
  assert.equal(p.doneWeeks, 3);
  assert.equal(p.streak, 3);
  assert.equal(p.thisWeek, 1);
  assert.equal(p.weeks[3], 'current');
});

test('postęp wyniku: bieg ze Stravy przeliczony na dystans celu', () => {
  const p = goalProgress(
    row({ kind: 'performance', distance_m: 10000, target_time_s: 47 * 60 }),
    ctx({ recent: { distanceM: 10000, timeS: 48 * 60 }, activities: [{ local_date: '2026-11-20', distance_m: 10200, moving_time_s: 48 * 60 }] }),
  );
  assert.equal(p.kind, 'performance');
  if (p.kind !== 'performance') return;
  assert.equal(p.bestS, Math.round((48 * 60 * 10000) / 10200));
  assert.ok(p.fraction > 0.8 && p.fraction < 1);
  assert.equal(p.achieved, false);
});

test('postęp kilometrów: Strava i treningi bez biegu ze Stravy, bez liczenia podwójnie', () => {
  const p = goalProgress(
    row({ kind: 'volume', volume_km: 100, period_start: '2026-11-01', period_end: '2026-11-30' }),
    ctx({
      activities: [{ local_date: '2026-11-03', distance_m: 10000, moving_time_s: 3000 }],
      sessions: [
        { scheduled_on: '2026-11-03', type: 'easy', status: 'done', duration_min: 50, structure: {}, actual_distance_m: 10000, actual_duration_s: 3000 },
        { scheduled_on: '2026-11-05', type: 'easy', status: 'done', duration_min: 30, structure: {}, actual_distance_m: 6000, actual_duration_s: 1800 },
      ],
    }),
  );
  assert.equal(p.kind === 'volume' && p.km, 16);
});

test('zawody: tydzień przygotowań, prognoza i stan „po zawodach”', () => {
  const goal = row({ kind: 'race', role: 'primary', priority: 'A', distance_m: 21097, race_date: '2027-03-28', plan_starts_on: '2026-11-16' });
  const p = goalProgress(goal, ctx({ recent: { distanceM: 10000, timeS: 48 * 60 }, weeklyKm: 30 }));
  assert.equal(p.kind, 'race');
  if (p.kind !== 'race') return;
  assert.equal(p.week, 2);
  assert.equal(p.weeks, 19);
  assert.ok(p.forecastRaceDayS && p.forecastTodayS && p.forecastRaceDayS <= p.forecastTodayS);
  assert.equal(p.past, false);
  const after = goalProgress(goal, ctx({ today: '2027-03-29' }));
  assert.equal(after.kind === 'race' && after.past, true);
});

test('po półmaratonie: polecany szybszy wynik na 10 km i zachęta do dłuższych zawodów', () => {
  const next = nextGoalSuggestions({
    finished: { kind: 'race', distance_m: 21097, target_minutes: null },
    resultTimeS: 1 * 3600 + 46 * 60 + 12,
    sessionsPerWeek: 4,
    today: '2027-03-29',
  });
  const first = next[0];
  assert.ok(first && 'spec' in first);
  assert.equal(first.spec.kind, 'performance');
  assert.equal(first.spec.distanceM, 10000);
  assert.equal(first.recommended, true);
  assert.ok(next.some((n) => 'addRace' in n && n.distanceM === 42195));
});
