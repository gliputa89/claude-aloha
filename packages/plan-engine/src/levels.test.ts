import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trainingLevelOf } from './levels.ts';
import { DEFAULT_ENGINE_PARAMS } from './params.ts';
import { generateInitialPlan, type PlanInput } from './plan.ts';

const min = (m: number) => m * 60;

test('poziom: z deklaracji, gdy brak wyniku', () => {
  assert.equal(trainingLevelOf({ level: 'beginner' }), 1);
  assert.equal(trainingLevelOf({ level: 'intermediate' }), 2);
  assert.equal(trainingLevelOf({ level: 'advanced', recentResult: null }), 4);
  assert.equal(trainingLevelOf({ level: 'advanced', recentResult: { distanceM: 5000, timeS: null } }), 4);
});

test('poziom: wynik przeliczony na 10 km przesuwa o jeden', () => {
  assert.equal(trainingLevelOf({ level: 'intermediate', recentResult: { distanceM: 10000, timeS: min(54) } }), 3);
  assert.equal(trainingLevelOf({ level: 'intermediate', recentResult: { distanceM: 10000, timeS: min(40) } }), 3);
  assert.equal(trainingLevelOf({ level: 'intermediate', recentResult: { distanceM: 5000, timeS: min(30) } }), 2);
  assert.equal(trainingLevelOf({ level: 'advanced', recentResult: { distanceM: 10000, timeS: min(62) } }), 3);
  assert.equal(trainingLevelOf({ level: 'advanced', recentResult: { distanceM: 10000, timeS: min(50) } }), 4);
  // 5 km w 20 min ≈ 41:41 na 10 km
  assert.equal(trainingLevelOf({ level: 'advanced', recentResult: { distanceM: 5000, timeS: min(20) } }), 5);
  // „nie biegam” zostaje 1 nawet z wynikiem
  assert.equal(trainingLevelOf({ level: 'beginner', recentResult: { distanceM: 5000, timeS: min(20) } }), 1);
});

test('poziom: bazowy trening i przyrost brane z kolumny poziomu', () => {
  const base: PlanInput = {
    startDate: '2026-11-09',
    level: 'advanced',
    goal: { type: 'general', focus: 'run_regularly' },
    preferredDays: [2, 4, 6],
    sessionsPerWeek: 3,
    maxMinutesWeekday: 90,
    maxMinutesWeekend: 120,
    hasContraindications: false,
    weeks: 3,
  };
  const easyOf = (input: PlanInput, week: number) =>
    generateInitialPlan(input).weeks[week]!.sessions.find((s) => s.type === 'easy')!.durationMin;
  const l4 = { ...base, recentResult: { distanceM: 10000, timeS: min(50) } };
  const l5 = { ...base, recentResult: { distanceM: 10000, timeS: min(40) } };
  assert.equal(easyOf(l4, 0), DEFAULT_ENGINE_PARAMS.baseEasyMinL4);
  assert.equal(easyOf(l5, 0), DEFAULT_ENGINE_PARAMS.baseEasyMinL5);
  // Zero przyrostu tylko na poziomie 5 → tam tydzień 2 = tydzień 0, na 4 rośnie.
  const params = { weeklyGrowthPctL5: 0 };
  assert.equal(easyOf({ ...l5, params }, 2), easyOf({ ...l5, params }, 0));
  assert.ok(easyOf({ ...l4, params }, 2)! > easyOf({ ...l4, params }, 0)!);
});

test('poziom: każda metryka z kolumny poziomu (np. mocne jednostki tylko tam, gdzie > 0)', () => {
  const input: PlanInput = {
    startDate: '2026-11-09',
    level: 'advanced',
    goal: { type: 'general', focus: 'improve_fitness' },
    preferredDays: [1, 3, 6],
    sessionsPerWeek: 3,
    maxMinutesWeekday: 90,
    maxMinutesWeekend: 120,
    hasContraindications: false,
    params: { maxHardPerWeekL4: 0 },
  };
  const hard = (i: PlanInput) => generateInitialPlan(i).weeks.flatMap((w) => w.sessions).filter((s) => s.intensity !== 'easy').length;
  assert.equal(hard(input), 0); // poziom 4 (regularnie, bez wyniku) – wyłączone
  assert.ok(hard({ ...input, recentResult: { distanceM: 10000, timeS: min(40) } }) > 0); // poziom 5 – domyślnie 1
});

// ───────── przegląd poziomu i kolejny tydzień ─────────

import { levelReviewInputFromRows, reviewTrainingLevel, type LevelReviewInput } from './level-review.ts';
import { generateNextWeek, weekMinutes } from './plan.ts';

const reviewBase: LevelReviewInput = {
  current: 3,
  since: '2026-10-05',
  today: '2026-11-09',
  surveyLevel: 3,
  surveyLevelBefore: 3,
  weeks: [
    { startsOn: '2026-10-12', planned: 3, done: 3 },
    { startsOn: '2026-10-19', planned: 3, done: 3 },
    { startsOn: '2026-10-26', planned: 3, done: 3 },
    { startsOn: '2026-11-02', planned: 3, done: 2 },
  ],
  lastDoneOn: '2026-11-07',
  firstPlannedOn: '2026-10-06',
  painDays: [],
  params: DEFAULT_ENGINE_PARAMS,
};

test('przegląd: awans po 4 tygodniach z realizacją ≥ 85%, o jeden poziom', () => {
  const r = reviewTrainingLevel(reviewBase);
  assert.equal(r.code, 'progress');
  assert.equal(r.level, 4);
  assert.equal(r.stats.donePctLast3, 89);
  // za krótko na poziomie
  assert.equal(reviewTrainingLevel({ ...reviewBase, since: '2026-10-26' }).code, 'stay');
  // poziom 5 nie awansuje
  assert.equal(reviewTrainingLevel({ ...reviewBase, current: 5, surveyLevel: 5, surveyLevelBefore: 5 }).code, 'stay');
});

test('przegląd: ból → spadek od razu, ma pierwszeństwo przed awansem; poziom 1 nie spada', () => {
  const pain = reviewTrainingLevel({ ...reviewBase, painDays: ['2026-11-04'] });
  assert.equal(pain.code, 'pain');
  assert.equal(pain.level, 2);
  assert.equal(reviewTrainingLevel({ ...reviewBase, current: 1, painDays: ['2026-11-04'] }).level, 1);
  // ból sprzed 20 dni: nie spada, ale też nie awansuje
  assert.equal(reviewTrainingLevel({ ...reviewBase, painDays: ['2026-10-20'] }).code, 'stay');
});

test('przegląd: przerwa i niska realizacja → spadek o jeden', () => {
  assert.equal(reviewTrainingLevel({ ...reviewBase, lastDoneOn: '2026-10-20' }).code, 'break');
  const low = reviewTrainingLevel({
    ...reviewBase,
    weeks: [...reviewBase.weeks.slice(0, 2), { startsOn: '2026-10-26', planned: 4, done: 1 }, { startsOn: '2026-11-02', planned: 3, done: 1 }],
  });
  assert.equal(low.code, 'low_completion');
  assert.equal(low.level, 2);
});

test('przegląd: nowy wynik w ankiecie → o jeden w stronę poziomu z ankiety', () => {
  const up = reviewTrainingLevel({ ...reviewBase, since: '2026-11-02', surveyLevel: 5, surveyLevelBefore: 3 });
  assert.equal(up.code, 'survey_up');
  assert.equal(up.level, 4);
  const down = reviewTrainingLevel({ ...reviewBase, surveyLevel: 1, surveyLevelBefore: 3 });
  assert.equal(down.code, 'survey_down');
  assert.equal(down.level, 2);
  // pierwszy przegląd (brak poprzedniego odczytu ankiety) – bez reguły ankiety
  assert.equal(reviewTrainingLevel({ ...reviewBase, since: '2026-11-02', surveyLevel: 5, surveyLevelBefore: null }).code, 'stay');
});

test('przegląd z wierszy: tylko pełne, zakończone tygodnie; partial liczy się jako wykonany', () => {
  const s = (d: string, status: string) => ({ scheduled_on: d, type: 'easy', status });
  const input = levelReviewInputFromRows({
    current: 2,
    since: '2026-10-01',
    today: '2026-11-09',
    surveyLevel: 2,
    surveyLevelBefore: 2,
    weeks: [
      { starts_on: '2026-10-29', sessions: [s('2026-10-30', 'done')] }, // niepełny tydzień 0
      { starts_on: '2026-11-02', sessions: [s('2026-11-03', 'done'), s('2026-11-05', 'partial'), s('2026-11-07', 'missed')] },
      { starts_on: '2026-11-09', sessions: [s('2026-11-10', 'planned')] }, // trwa
    ],
    checkIns: [{ day: '2026-11-05', ai_pain: true, ai_red_flag: false }],
    params: DEFAULT_ENGINE_PARAMS,
  });
  assert.deepEqual(input.weeks, [{ startsOn: '2026-11-02', planned: 3, done: 2 }]);
  assert.equal(input.lastDoneOn, '2026-11-05');
  assert.equal(input.firstPlannedOn, '2026-10-30');
  assert.deepEqual(input.painDays, ['2026-11-05']);
});

test('kolejny tydzień: rośnie od bazy poprzedniego, zmiana poziomu bez skoku objętości', () => {
  const input: PlanInput = {
    startDate: '2026-11-02',
    level: 'intermediate',
    goal: { type: 'general', focus: 'run_regularly' },
    preferredDays: [2, 4, 6],
    sessionsPerWeek: 3,
    maxMinutesWeekday: 120,
    maxMinutesWeekend: 150,
    hasContraindications: false,
    trainingLevel: 2,
    params: { weeklyGrowthPctL2: 5, weeklyGrowthPctL3: 10 },
  };
  const w0 = generateInitialPlan({ ...input, weeks: 1 }).weeks[0]!;
  assert.equal(w0.baseEasyMin, 30);
  // 5% przyrostu: baza rośnie bez zaokrągleń (30 → 31,5 → 33,075), więc nie utyka na 30 min
  let w = w0;
  for (let i = 0; i < 3; i++) w = generateNextWeek(input, w);
  assert.ok(Math.abs(w.baseEasyMin! - 30 * 1.05 ** 3) < 1e-9);
  assert.equal(w.weekIndex, 3);
  assert.equal(w.startsOn, '2026-11-23');
  // awans na 3: przyrost 10% od bazy poprzedniego tygodnia, nie skok do 35 × 1,1^4
  const up = generateNextWeek({ ...input, trainingLevel: 3 }, w, 'up');
  assert.ok(Math.abs(up.baseEasyMin! - w.baseEasyMin! * 1.1) < 1e-9);
  assert.ok(weekMinutes(up) <= weekMinutes(w) * 1.1);
  // spadek: bez przyrostu, najwyżej bazowy trening nowego poziomu
  const down = generateNextWeek({ ...input, trainingLevel: 1 }, up, 'down');
  assert.equal(down.baseEasyMin, DEFAULT_ENGINE_PARAMS.baseEasyMinL1);
  assert.ok(down.sessions.every((s) => s.type === 'walk_run'));
});

test('planNextWeek: termin, przegląd poziomu i kolejny tydzień z wierszy bazy', async () => {
  const { planNextWeek } = await import('./next-week.ts');
  const sess = (d: string, status: string) => ({
    scheduled_on: d, type: 'easy', duration_min: 30, distance_m: null, intensity: 'easy', structure: { kind: 'steady' }, status,
  });
  const week = (i: number, start: string, days: string[], status: string) => ({
    week_index: i, starts_on: start, focus: 'build', base_easy_min: 30 * 1.1 ** i, sessions: days.map((d) => sess(d, status)),
  });
  const rows = {
    profile: { level: 'intermediate' as const, has_contraindications: false, training_level: 2, training_level_since: '2026-10-05', training_level_survey: 2 },
    goal: { type: 'general' as const, general_focus: 'run_regularly' as const, distance_m: null, race_date: null, plan_starts_on: null },
    availability: { preferred_days: [2, 4, 6], sessions_per_week: 3, max_minutes_weekday: 120, max_minutes_weekend: 150 },
    plan: {
      starts_on: '2026-10-05',
      weeks: [
        week(0, '2026-10-05', ['2026-10-06', '2026-10-08', '2026-10-10'], 'done'),
        week(1, '2026-10-12', ['2026-10-13', '2026-10-15', '2026-10-17'], 'done'),
        week(2, '2026-10-19', ['2026-10-20', '2026-10-22', '2026-10-24'], 'done'),
        week(3, '2026-10-26', ['2026-10-27', '2026-10-29', '2026-10-31'], 'done'),
        week(4, '2026-11-02', ['2026-11-03', '2026-11-05', '2026-11-07'], 'done'),
      ],
    },
    checkIns: [],
    params: DEFAULT_ENGINE_PARAMS,
    today: '2026-11-07',
  };
  const res = planNextWeek(rows);
  assert.ok(res.ok);
  assert.equal(res.review.code, 'progress');
  assert.equal(res.review.level, 3);
  assert.equal(res.week.weekIndex, 5);
  assert.equal(res.week.startsOn, '2026-11-09');
  assert.ok(Math.abs(res.week.baseEasyMin! - 30 * 1.1 ** 5) < 1e-9);
  // za wcześnie (tydzień kończy się za 6 dni)
  assert.deepEqual(planNextWeek({ ...rows, today: '2026-11-02' }), { ok: false, reason: 'not_due', nextStartsOn: '2026-11-09' });
  assert.ok(planNextWeek({ ...rows, today: '2026-11-02', force: true }).ok);
});
