import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isoWeekday } from '../core/dates.ts';
import { stepsTotalS } from '../core/workout.ts';
import {
  generateInitialPlan,
  generateNextWeek,
  generatePlanWeek,
  pickTrainingDays,
  threshold,
  weekMinutes,
  type PlanInput,
  type PlannedSession,
} from './plan.ts';

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

test('generatePlanWeek: tydzień N taki sam jak w pełnym planie', () => {
  const full = generateInitialPlan({ ...base, weeks: 6 });
  for (let i = 0; i < 6; i++) assert.deepEqual(generatePlanWeek(base, i), full.weeks[i]);
});

test('generatePlanWeek: start planu w środku tygodnia → kolejne tygodnie pon–nd', () => {
  const start = '2026-11-12'; // czwartek
  assert.deepEqual([generatePlanWeek({ ...base, startDate: start }, 0).startsOn], [start]);
  const w3 = generatePlanWeek({ ...base, startDate: start }, 3);
  assert.deepEqual([w3.startsOn, w3.endsOn], ['2026-11-30', '2026-12-06']);
});

test('generatePlanWeek: nie przesuwa startu istniejącego planu (keepStartDate)', () => {
  // Niedziela, a biegasz wt/czw/sb → pełny plan zaczyna się w poniedziałek, ale tydzień 0 istniejącego planu zostaje.
  const input = { ...base, startDate: '2026-11-15' };
  assert.equal(generateInitialPlan(input).startsOn, '2026-11-16');
  const w0 = generatePlanWeek(input, 0);
  assert.deepEqual([w0.startsOn, w0.endsOn, w0.sessions.length], ['2026-11-15', '2026-11-15', 0]);
});

test('generatePlanWeek: odrzuca ujemny numer tygodnia', () => {
  assert.throws(() => generatePlanWeek(base, -1), RangeError);
});

// ── trening progowy ──

const quality = (input: PlanInput) =>
  generateInitialPlan(input)
    .weeks.flatMap((w) => w.sessions.filter(hard).map((s) => ({ week: w.weekIndex, type: s.type, structure: s.structure, durationMin: s.durationMin })));

const fitness5: PlanInput = { ...base, level: 'advanced', trainingLevel: 5, preferredDays: [2, 4, 6, 7], sessionsPerWeek: 4, maxMinutesWeekday: 90, weeks: 8 };

test('od poziomu 3 interwały przeplatają się z treningiem progowym, a jego odcinki rosną', () => {
  const q = quality(fitness5);
  // Tygodnie 4. i 8. są lżejsze (krótkie interwały) i nie liczą się do przeplatania ani do drabinki.
  assert.deepEqual(q.map((s) => s.type), ['intervals', 'tempo', 'intervals', 'intervals', 'tempo', 'intervals', 'tempo', 'intervals']);
  const reps = q.filter((s) => s.type === 'tempo').map((s) => (s.structure.kind === 'tempo' ? `${s.structure.repeats ?? 1}x${s.structure.workMin}` : ''));
  assert.deepEqual(reps, ['3x8', '3x10', '2x15']);
});

test('trening progowy: odcinki w strefie tempo z truchtem, suma odcinków = długość treningu', () => {
  const session = generateInitialPlan(fitness5).weeks[4]?.sessions.find((s) => s.type === 'tempo');
  assert.ok(session);
  const steps = session.structure.steps ?? [];
  const block = steps.find((s) => s.kind === 'repeat');
  assert.ok(block && block.kind === 'repeat');
  assert.equal(block.times, 3);
  assert.deepEqual(block.steps.map((s) => [s.zone, s.durationS]), [['tempo', 600], ['recovery', 120]]);
  assert.equal(stepsTotalS(steps), (session.durationMin ?? 0) * 60);
});

test('etap, który nie mieści się w treningu, schodzi niżej; przy bardzo krótkim zostaje tempo ciągłe', () => {
  // 45 min: 3×10 (36 min z truchtem) się nie mieści → 3×8.
  assert.deepEqual(threshold(45, 5, 1, 55), { kind: 'tempo', warmupMin: 10, workMin: 8, cooldownMin: 5, repeats: 3, recoveryMin: 2 });
  // Limit mocnych minut 35%: w 60 min najwyżej 21 min tempa → zamiast 2×15 zostaje 3×6.
  assert.equal((threshold(60, 5, 2, 35) as { workMin: number }).workMin, 6);
  assert.deepEqual(threshold(30, 3, 0, 55), { kind: 'tempo', warmupMin: 10, workMin: 10, cooldownMin: 10 });
});

test('poziom 2 zostaje przy interwałach, półmaraton przy tempie ciągłym', () => {
  assert.ok(quality({ ...base, trainingLevel: 2, weeks: 6 }).every((s) => s.type === 'intervals'));
  const half = quality({ ...fitness5, goal: { type: 'race', distanceM: 21097, raceDate: '2027-03-21' } });
  assert.ok(half.length > 0 && half.every((s) => s.type === 'tempo' && s.structure.kind === 'tempo' && !s.structure.repeats));
});

test('generatePlanWeek daje ten sam trening progowy co pełny plan', () => {
  const full = generateInitialPlan(fitness5).weeks[5];
  assert.deepEqual(generatePlanWeek(fitness5, 5), full);
});

// ── cykl obciążenia: 3 tygodnie rosnące + 1 lżejszy ──

test('poziomy 4–5: co czwarty tydzień lżejszy, a tydzień po nim wraca ponad poziom sprzed niego', () => {
  const weeks = generateInitialPlan(fitness5).weeks;
  assert.deepEqual(weeks.map((w) => w.focus), ['base', 'build', 'build', 'recovery', 'build', 'build', 'build', 'recovery']);
  const min = weeks.map(weekMinutes);
  // Trzy tygodnie rosną, czwarty schodzi o ok. 25%.
  assert.ok(min[0]! < min[1]! && min[1]! < min[2]!);
  assert.ok(min[3]! < min[2]! * 0.82 && min[3]! > min[2]! * 0.68);
  // Po lżejszym: więcej niż przed nim, ale nie więcej niż dwa kroki przyrostu naraz.
  assert.ok(min[4]! > min[2]! && min[4]! <= min[2]! * 1.1 * 1.03);
  assert.ok(min[7]! < min[6]!);
});

test('lżejszy tydzień: mocna jednostka to krótsze interwały z mniejszą liczbą powtórzeń', () => {
  const weeks = generateInitialPlan(fitness5).weeks;
  const reps = (i: number) => {
    const s = weeks[i]?.sessions.find((x) => x.type === 'intervals');
    return s && s.structure.kind === 'intervals' ? s.structure.repeats : null;
  };
  assert.equal(reps(2), 8);
  assert.equal(reps(3), 4);
});

test('poziomy 1–3 nie mają lżejszych tygodni; parametr 0 wyłącza je też na poziomie 5', () => {
  assert.ok(generateInitialPlan({ ...fitness5, trainingLevel: 3 }).weeks.every((w) => w.focus !== 'recovery'));
  const off = generateInitialPlan({ ...fitness5, params: { deloadEveryWeeksL5: 0 } });
  assert.ok(off.weeks.every((w) => w.focus !== 'recovery'));
});

test('generowanie tydzień po tygodniu daje ten sam cykl co pełny plan', () => {
  const full = generateInitialPlan(fitness5).weeks;
  let prev = full[1]!;
  for (let i = 2; i < full.length; i++) {
    prev = generateNextWeek(fitness5, prev);
    assert.equal(prev.focus, full[i]!.focus);
    assert.equal(weekMinutes(prev), weekMinutes(full[i]!));
  }
});
