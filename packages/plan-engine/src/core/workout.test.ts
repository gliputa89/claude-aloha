import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyOperations, type AiOperation } from '../ai/ai-ops.ts';
import { generateInitialPlan, type PlanInput } from '../plan/plan.ts';
import {
  buildFromMainSets,
  needsFuel,
  describeSteps,
  flattenSteps,
  hardSeconds,
  paceZonesFrom,
  stepsOf,
  stepsTotalS,
  type WorkoutItem,
} from './workout.ts';

const base: PlanInput = {
  startDate: '2026-11-09',
  level: 'advanced',
  goal: { type: 'race', distanceM: 10000, raceDate: '2027-01-18' },
  preferredDays: [1, 3, 5, 7],
  sessionsPerWeek: 4,
  maxMinutesWeekday: 60,
  maxMinutesWeekend: 90,
  hasContraindications: false,
  recentResult: { distanceM: 10000, timeS: 48 * 60 },
};

const op = (o: Partial<AiOperation> & Pick<AiOperation, 'op' | 'date'>): AiOperation => ({
  toDate: null,
  type: null,
  durationMin: null,
  sets: null,
  reason: 'test',
  ...o,
});

test('strefy tempa z wyniku 10 km w 48:00 (4:48/km)', () => {
  const z = paceZonesFrom({ distanceM: 10000, timeS: 48 * 60 })!;
  assert.equal(z.walk, null);
  // interwał szybciej niż tempo 10 km, spokojnie wolniej
  assert.ok(z.interval!.fastS < 288 && z.interval!.slowS <= 288);
  assert.ok(z.easy!.fastS > 288 + 30);
  assert.ok(z.recovery!.slowS > z.easy!.slowS);
  assert.equal(paceZonesFrom(null), null);
  assert.equal(paceZonesFrom({ distanceM: 5000, timeS: null }), null);
});

test('każdy trening ma odcinki: rozgrzewka → część główna → schłodzenie, suma = długość', () => {
  for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
    const plan = generateInitialPlan({ ...base, level, weeks: 4 });
    for (const s of plan.weeks.flatMap((w) => w.sessions)) {
      const steps = s.structure.steps ?? [];
      if (s.type === 'race') {
        assert.deepEqual(steps, []);
        continue;
      }
      assert.equal(stepsTotalS(steps), (s.durationMin ?? 0) * 60, `${level} ${s.type} ${s.scheduledOn}`);
      assert.equal(steps[0]?.kind, 'warmup');
      assert.equal(steps[steps.length - 1]?.kind, 'cooldown');
    }
  }
});

test('interwały: powtórzenia praca/przerwa z tempem ze stref', () => {
  const plan = generateInitialPlan(base);
  const iv = plan.weeks.flatMap((w) => w.sessions).find((s) => s.type === 'intervals')!;
  const rep = iv.structure.steps!.find((i) => i.kind === 'repeat');
  assert.ok(rep && rep.kind === 'repeat' && rep.times >= 3);
  assert.equal(rep.steps[0]?.zone, 'interval');
  assert.ok(rep.steps[0]?.pace);
  assert.equal(rep.steps[1]?.kind, 'recovery');
});

test('bez wyniku: odcinki bez tempa (tylko strefa)', () => {
  const plan = generateInitialPlan({ ...base, recentResult: null });
  const s = plan.weeks[0]!.sessions[0]!;
  assert.ok(flattenSteps(s.structure.steps!).every((x) => x.pace === null));
});

test('stare treningi bez steps dostają odcinki wyliczone w locie', () => {
  const steps = stepsOf({ type: 'tempo', duration_min: 45, structure: { kind: 'tempo', warmupMin: 10, workMin: 20, cooldownMin: 10 } });
  assert.equal(stepsTotalS(steps), 45 * 60);
  assert.match(describeSteps(steps), /rozgrzewki .* tempo .* schłodzenia/);
});

const rules = { type: 'intervals', durationMin: 50, walkRunOnly: false, gentle: false, maxHardSharePct: 35 };

test('część główna od AI: drabinka z przerwami, silnik dokłada rozgrzewkę i schłodzenie', () => {
  const res = buildFromMainSets(
    [
      { repeat: 1, workS: 60, workZone: 'interval', recoveryS: 60, recoveryZone: 'recovery' },
      { repeat: 1, workS: 120, workZone: 'interval', recoveryS: 90, recoveryZone: 'recovery' },
      { repeat: 1, workS: 180, workZone: 'interval', recoveryS: 120, recoveryZone: 'recovery' },
      { repeat: 1, workS: 120, workZone: 'interval', recoveryS: 90, recoveryZone: 'recovery' },
      { repeat: 1, workS: 60, workZone: 'interval', recoveryS: null, recoveryZone: null },
    ],
    rules,
    paceZonesFrom(base.recentResult),
  );
  assert.ok(res.ok);
  const steps = res.steps as WorkoutItem[];
  assert.equal(stepsTotalS(steps), 50 * 60);
  assert.equal(steps[0]?.kind, 'warmup');
  assert.equal(steps[steps.length - 1]?.kind, 'cooldown');
  assert.equal(hardSeconds(steps), 540);
});

test('część główna od AI: reguły', () => {
  const tooHard = buildFromMainSets([{ repeat: 10, workS: 180, workZone: 'interval', recoveryS: 60, recoveryZone: 'recovery' }], rules, null);
  assert.equal(tooHard.ok, false);
  const noWarmup = buildFromMainSets([{ repeat: 1, workS: 45 * 60, workZone: 'easy', recoveryS: null, recoveryZone: null }], rules, null);
  assert.equal(noWarmup.ok, false);
  const easyWithTempo = buildFromMainSets(
    [{ repeat: 1, workS: 600, workZone: 'tempo', recoveryS: null, recoveryZone: null }],
    { ...rules, type: 'easy', durationMin: 40 },
    null,
  );
  assert.equal(easyWithTempo.ok, false);
  const strides = buildFromMainSets(
    [
      { repeat: 1, workS: 25 * 60, workZone: 'easy', recoveryS: null, recoveryZone: null },
      { repeat: 4, workS: 20, workZone: 'sprint', recoveryS: 60, recoveryZone: 'walk' },
    ],
    { ...rules, type: 'easy', durationMin: 40 },
    null,
  );
  assert.ok(strides.ok);
  const gentle = buildFromMainSets(
    [{ repeat: 4, workS: 120, workZone: 'interval', recoveryS: 60, recoveryZone: 'recovery' }],
    { ...rules, gentle: true },
    null,
  );
  assert.equal(gentle.ok, false);
});

test('operacja set_main w planie: przyjęta i zapisana jako custom; łamiąca reguły odrzucona', () => {
  const draft = generateInitialPlan(base).weeks;
  const iv = draft.flatMap((w) => w.sessions).find((s) => s.type === 'intervals')!;
  const res = applyOperations(
    [
      op({
        op: 'set_main',
        date: iv.scheduledOn,
        sets: [
          { repeat: 3, workS: 300, workZone: 'tempo', recoveryS: 90, recoveryZone: 'recovery' },
        ],
      }),
      op({ op: 'set_main', date: iv.scheduledOn, sets: [{ repeat: 20, workS: 300, workZone: 'interval', recoveryS: 60, recoveryZone: 'recovery' }] }),
    ],
    { input: base, draft },
  );
  assert.deepEqual(res.results.map((r) => r.status), ['applied', 'rejected']);
  const after = res.weeks.flatMap((w) => w.sessions).find((s) => s.scheduledOn === iv.scheduledOn)!;
  assert.equal(after.structure.custom, true);
  assert.equal(stepsTotalS(after.structure.steps!), (after.durationMin ?? 0) * 60);
});

test('estimateDistanceM: czas ÷ tempo strefy, bez wyniku – typowe tempo rekreacyjne', async () => {
  const { estimateDistanceM, formatApproxKm, paceZonesFrom, stepsFromStructure } = await import('./workout.ts');
  // 30 min biegu po 6:00/km = 5 km
  const fixed = [{ kind: 'work' as const, zone: 'easy' as const, durationS: 1800, pace: { fastS: 350, slowS: 370 } }];
  assert.equal(Math.round(estimateDistanceM(fixed)), 5000);
  // marsz 11 min ≈ 1 km
  const walk = [{ kind: 'warmup' as const, zone: 'walk' as const, durationS: 655, pace: null }];
  assert.equal(Math.round(estimateDistanceM(walk)), 1000);
  // spokojne 45 min bez wyniku: realne 4–8 km; szybszy biegacz przebiegnie więcej
  const easy = stepsFromStructure('easy', 45, null, null);
  const slow = estimateDistanceM(easy);
  assert.ok(slow > 4000 && slow < 8000, `${slow}`);
  const fast = estimateDistanceM(easy, paceZonesFrom({ distanceM: 10000, timeS: 45 * 60 }));
  assert.ok(fast > slow);
  assert.equal(formatApproxKm(6240), 'ok. 6 km');
  assert.equal(formatApproxKm(6300), 'ok. 6,5 km');
  assert.equal(formatApproxKm(640), 'ok. 0,6 km');
  assert.equal(formatApproxKm(6300, 'en'), '~6.5 km');
});

test('część główna od AI: strefa tempo ma osobny, wyższy limit niż interwały', () => {
  const tempoRules = { ...rules, type: 'tempo', durationMin: 60, maxTempoSharePct: 55 };
  const set = (repeat: number, min: number, zone: 'tempo' | 'interval') => [
    { repeat, workS: min * 60, workZone: zone, recoveryS: 120, recoveryZone: 'recovery' as const },
  ];
  // 3×10 i 2×15 min w strefie tempo = 30 min z 60 (50%) – mieszczą się w 55%.
  assert.equal(buildFromMainSets(set(3, 10, 'tempo'), tempoRules, null).ok, true);
  assert.equal(buildFromMainSets(set(2, 15, 'tempo'), tempoRules, null).ok, true);
  // Te same minuty w strefie interwału przekraczają 35%.
  const intervals = buildFromMainSets(set(3, 10, 'interval'), tempoRules, null);
  assert.equal(intervals.ok, false);
  assert.match(intervals.ok ? '' : intervals.error, /interval \/ sprint/);
  // 3×12 min tempa = 36 min (60%) – ponad limit łączny.
  const tooMuch = buildFromMainSets(set(3, 12, 'tempo'), tempoRules, null);
  assert.match(tooMuch.ok ? '' : tooMuch.error, /tempo \+ interval/);
  // Bez nowego parametru (starsze wywołania) tempo liczy się po staremu – do wspólnego limitu 35%.
  assert.equal(buildFromMainSets(set(3, 10, 'tempo'), { ...rules, type: 'tempo', durationMin: 60 }, null).ok, false);
});

test('jedzenie w trakcie: biegi dłuższe niż 75 min i starty od półmaratonu', () => {
  assert.equal(needsFuel({ type: 'long', durationMin: 75 }), false);
  assert.equal(needsFuel({ type: 'long', durationMin: 80 }), true);
  assert.equal(needsFuel({ type: 'tempo', durationMin: 90 }), true);
  assert.equal(needsFuel({ type: 'race', durationMin: null, distanceM: 10000 }), false);
  assert.equal(needsFuel({ type: 'race', durationMin: null, distanceM: 21097 }), true);
});
