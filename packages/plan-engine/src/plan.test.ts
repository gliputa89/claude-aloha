import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isoWeekday } from './dates.ts';
import { generateInitialPlan, pickTrainingDays, type PlanInput, type PlannedSession } from './plan.ts';

// 2026-11-09 to poniedziałek.
const base: PlanInput = {
  startDate: '2026-11-09',
  level: 'intermediate',
  goal: { type: 'general', focus: 'improve_fitness' },
  preferredDays: [2, 4, 6],
  sessionsPerWeek: 3,
  maxMinutesWeekday: 45,
  maxMinutesWeekend: 90,
  hasContraindications: false,
};

const all = (input: PlanInput): PlannedSession[] => generateInitialPlan(input).weeks.flatMap((w) => w.sessions);
const hard = (s: PlannedSession) => s.type === 'intervals' || s.type === 'tempo';

test('dwa tygodnie pon–nd od poniedziałku', () => {
  const plan = generateInitialPlan(base);
  assert.equal(plan.weeks.length, 2);
  assert.deepEqual(
    plan.weeks.map((w) => [w.startsOn, w.endsOn]),
    [
      ['2026-11-09', '2026-11-15'],
      ['2026-11-16', '2026-11-22'],
    ],
  );
});

test('start w środku tygodnia → tydzień 0 do niedzieli, bez treningów przed startem', () => {
  const plan = generateInitialPlan({ ...base, startDate: '2026-11-12' }); // czwartek
  assert.deepEqual([plan.weeks[0]?.startsOn, plan.weeks[0]?.endsOn], ['2026-11-12', '2026-11-15']);
  assert.ok(all({ ...base, startDate: '2026-11-12' }).every((s) => s.scheduledOn >= '2026-11-12'));
});

test('treningi tylko w preferowane dni i nie więcej niż zadeklarowano', () => {
  const input = { ...base, preferredDays: [1, 3, 5, 7], sessionsPerWeek: 3 };
  for (const week of generateInitialPlan(input).weeks) {
    assert.ok(week.sessions.length <= 3);
    assert.ok(week.sessions.every((s) => input.preferredDays.includes(isoWeekday(s.scheduledOn))));
  }
});

test('każdy trening mieści się w limicie czasu z ankiety', () => {
  const input = { ...base, level: 'advanced' as const, maxMinutesWeekday: 30, maxMinutesWeekend: 45 };
  for (const s of all(input)) {
    const cap = isoWeekday(s.scheduledOn) >= 6 ? 45 : 30;
    assert.ok((s.durationMin ?? 0) <= cap, `${s.type} ${s.durationMin} > ${cap}`);
  }
});

test('„nie biegam” → wyłącznie marsz-bieg, łagodnie', () => {
  const sessions = all({ ...base, level: 'beginner', goal: { type: 'general', focus: 'start_running' } });
  assert.ok(sessions.length > 0);
  assert.ok(sessions.every((s) => s.type === 'walk_run' && s.intensity === 'easy'));
});

test('przeciwwskazania → bez mocnych jednostek', () => {
  assert.ok(!all({ ...base, level: 'advanced', hasContraindications: true }).some(hard));
});

test('„biegaj regularnie” → bez mocnych jednostek', () => {
  assert.ok(!all({ ...base, level: 'advanced', goal: { type: 'general', focus: 'run_regularly' } }).some(hard));
});

test('najwyżej jedna mocna jednostka w tygodniu, nigdy obok długiego biegu', () => {
  const input = { ...base, level: 'advanced' as const, preferredDays: [1, 2, 3, 4, 5, 6, 7], sessionsPerWeek: 5 };
  for (const week of generateInitialPlan(input).weeks) {
    const q = week.sessions.filter(hard);
    assert.ok(q.length <= 1);
    const long = week.sessions.find((s) => s.type === 'long');
    if (q[0] && long) {
      const gap = Math.abs(isoWeekday(q[0].scheduledOn) - isoWeekday(long.scheduledOn));
      assert.ok(gap >= 2, 'mocna jednostka obok długiego biegu');
    }
  }
});

test('przyrost czasu tydzień do tygodnia ≤ 10% (przy pełnych tygodniach)', () => {
  const [w0, w1] = generateInitialPlan({ ...base, maxMinutesWeekday: 120, maxMinutesWeekend: 180 }).weeks;
  const total = (w: typeof w0) => (w?.sessions ?? []).reduce((sum, s) => sum + (s.durationMin ?? 0), 0);
  assert.ok(total(w1) <= total(w0) * 1.1 + 5, `${total(w0)} → ${total(w1)}`);
});

test('półmaraton → mocna jednostka to tempo, nie interwały', () => {
  const sessions = all({
    ...base,
    level: 'advanced',
    goal: { type: 'race', distanceM: 21097, raceDate: '2027-03-01' },
  });
  assert.ok(sessions.some((s) => s.type === 'tempo'));
  assert.ok(!sessions.some((s) => s.type === 'intervals'));
});

test('zawody w drugim tygodniu → start w dniu zawodów, dzień przed wolny', () => {
  const plan = generateInitialPlan({
    ...base,
    preferredDays: [1, 2, 3, 4, 5, 6, 7],
    sessionsPerWeek: 5,
    goal: { type: 'race', distanceM: 5000, raceDate: '2026-11-21' },
  });
  const w1 = plan.weeks[1];
  assert.equal(w1?.focus, 'race');
  assert.ok(w1?.sessions.some((s) => s.type === 'race' && s.scheduledOn === '2026-11-21'));
  assert.ok(!w1?.sessions.some((s) => s.scheduledOn === '2026-11-20' || s.scheduledOn === '2026-11-22'));
});

test('rozkład dni: 3 z 7 → nie dzień po dniu', () => {
  const days = pickTrainingDays([1, 2, 3, 4, 5, 6, 7], 3);
  assert.equal(days.length, 3);
  for (let i = 1; i < days.length; i++) assert.ok((days[i] ?? 0) - (days[i - 1] ?? 0) >= 2);
});

test('start w środku tygodnia nie skraca treningów w tygodniu 1', () => {
  const plan = generateInitialPlan({
    ...base,
    startDate: '2026-11-12',
    level: 'beginner',
    goal: { type: 'general', focus: 'start_running' },
    preferredDays: [1, 3, 6],
  });
  assert.ok((plan.weeks[1]?.sessions ?? []).every((s) => (s.durationMin ?? 0) >= 25));
});

test('start w niedzielę bez treningu tego dnia → plan od poniedziałku, oba tygodnie z treningami', () => {
  const plan = generateInitialPlan({ ...base, startDate: '2026-11-08' }); // niedziela, biega wt/cz/sb
  assert.equal(plan.startsOn, '2026-11-09');
  assert.deepEqual(plan.weeks.map((w) => w.startsOn), ['2026-11-09', '2026-11-16']);
  assert.ok(plan.weeks.every((w) => w.sessions.length > 0));
});

test('start w niedzielę, gdy niedziela jest dniem treningowym → plan od niedzieli', () => {
  const plan = generateInitialPlan({ ...base, startDate: '2026-11-08', preferredDays: [2, 4, 7] });
  assert.equal(plan.startsOn, '2026-11-08');
  assert.equal(plan.weeks[0]?.sessions.length, 1);
});
