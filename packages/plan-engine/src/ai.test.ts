import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyOperations, parseAiPlanResponse, validateWeeks, type AiOperation } from './ai-ops.ts';
import { costUsd, modelPrice } from './ai-pricing.ts';
import { aiAthleteFromSurvey, DEFAULT_AI_PROMPTS, planWeeksUserMessage, rulesPromptBlock } from './ai-prompt.ts';
import { planWeeksWithAi, type AiCallRecord, type AiModelRequest, type AiModelResult } from './ai-run.ts';
import { DEFAULT_ENGINE_PARAMS, ENGINE_PARAM_SPECS, validateEngineParams } from './params.ts';
import { generateInitialPlan, generatePlanWeek, type PlanInput } from './plan.ts';

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

const op = (o: Partial<AiOperation> & Pick<AiOperation, 'op' | 'date'>): AiOperation => ({
  toDate: null,
  type: null,
  durationMin: null,
  sets: null,
  reason: 'test',
  ...o,
});

test('szkic silnika jest zgodny z walidacją dla wielu ankiet', () => {
  const levels = ['beginner', 'intermediate', 'advanced'] as const;
  const goals: PlanInput['goal'][] = [
    { type: 'general', focus: 'start_running' },
    { type: 'general', focus: 'improve_fitness' },
    { type: 'race', distanceM: 10000, raceDate: '2026-11-21' },
    { type: 'race', distanceM: 21097, raceDate: '2027-02-14' },
  ];
  const daySets = [[2, 4, 6], [1, 3, 5, 7], [6, 7], [1, 2, 3, 4, 5, 6, 7], [3]];
  const starts = ['2026-11-09', '2026-11-12', '2026-11-15'];
  let checked = 0;
  for (const level of levels)
    for (const goal of goals)
      for (const preferredDays of daySets)
        for (const startDate of starts)
          for (const hasContraindications of [false, true]) {
            const input: PlanInput = {
              ...base,
              level,
              goal,
              preferredDays,
              startDate,
              hasContraindications,
              sessionsPerWeek: Math.min(4, preferredDays.length),
              weeks: 4,
            };
            const draft = generateInitialPlan(input).weeks;
            const violations = validateWeeks(draft, { input, draft });
            assert.deepEqual(violations, [], `${level} ${JSON.stringify(goal)} ${preferredDays} ${startDate} ${hasContraindications}`);
            checked++;
          }
  assert.ok(checked > 300);
});

test('parametry: domyślne są w granicach, wartości spoza granic → błąd', () => {
  for (const s of ENGINE_PARAM_SPECS) assert.ok(s.default >= s.min && s.default <= s.max, s.key);
  assert.deepEqual(validateEngineParams({}), { ok: true, params: DEFAULT_ENGINE_PARAMS });
  const bad = validateEngineParams({ weeklyGrowthPctL2: 30 });
  assert.equal(bad.ok, false);
  const good = validateEngineParams({ weeklyGrowthPctL2: 5, longFactorL3: 1.2 });
  assert.ok(good.ok && good.params.weeklyGrowthPctL2 === 5 && good.params.longFactorL3 === 1.2);
});

test('parametry: stare wersje (3 bazowe czasy, jeden przyrost) przechodzą na poziomy 1–5', () => {
  const res = validateEngineParams({ baseEasyBeginner: 20, baseEasyIntermediate: 25, baseEasyAdvanced: 45, weeklyGrowthPct: 8 });
  assert.ok(res.ok);
  assert.equal(res.params.baseEasyMinL1, 20);
  assert.equal(res.params.baseEasyMinL2, 25);
  assert.equal(res.params.baseEasyMinL3, DEFAULT_ENGINE_PARAMS.baseEasyMinL3);
  assert.equal(res.params.baseEasyMinL4, 45);
  assert.ok([1, 2, 3, 4, 5].every((l) => res.params[`weeklyGrowthPctL${l}` as 'weeklyGrowthPctL1'] === 8));
  assert.ok(!('baseEasyBeginner' in res.params));
  // Pozostałe stare klucze (jedna wartość) trafiają do wszystkich poziomów.
  const flat = validateEngineParams({ longFactor: 1.2, maxHardPerWeekL5: 2, maxHardPerWeek: 0 });
  assert.ok(flat.ok);
  assert.equal(flat.params.longFactorL1, 1.2);
  assert.equal(flat.params.longFactorL5, 1.2);
  assert.equal(flat.params.maxHardPerWeekL4, 0);
  assert.equal(flat.params.maxHardPerWeekL5, 2);
});

test('parametry zmieniają szkic: niższy bazowy czas → krótsze treningi', () => {
  const normal = generateInitialPlan(base).weeks[0]!;
  const shorter = generateInitialPlan({ ...base, params: { baseEasyMinL2: 20 } }).weeks[0]!;
  const sum = (w: typeof normal) => w.sessions.reduce((n, s) => n + (s.durationMin ?? 0), 0);
  assert.ok(sum(shorter) < sum(normal));
  const noHard = generateInitialPlan({ ...base, level: 'advanced', params: { maxHardPerWeekL4: 0 } });
  assert.ok(noHard.weeks.every((w) => w.sessions.every((s) => s.intensity === 'easy')));
});

test('operacje: skrócenie i przeniesienie przechodzą, struktura liczona przez silnik', () => {
  // Skracamy w 2. tygodniu (skrócenie 1. obniżyłoby limit przyrostu dla 2. – to też reguła).
  const draft = generateInitialPlan(base).weeks;
  const res = applyOperations(
    [op({ op: 'set_duration', date: '2026-11-19', durationMin: 20 }), op({ op: 'move', date: '2026-11-12', toDate: '2026-11-10' })],
    { input: base, draft },
  );
  // 2026-11-10 jest już zajęty (wt) – przeniesienie odrzucone
  assert.equal(res.results[0]?.status, 'applied');
  assert.equal(res.results[1]?.status, 'rejected');
  assert.equal(res.weeks[1]!.sessions[1]!.durationMin, 20);
  assert.equal(res.weeks[1]!.sessions[1]!.structure.kind, 'steady');

  // Skrócenie 1. tygodnia bez skrócenia 2. łamie przyrost – odrzucone
  const r2 = applyOperations([op({ op: 'set_duration', date: '2026-11-10', durationMin: 20 })], { input: base, draft });
  assert.match(r2.results[0]!.reason ?? '', /przyrost/);
});

test('operacje łamiące reguły są cofane z powodem', () => {
  const draft = generateInitialPlan(base).weeks;
  const res = applyOperations(
    [
      op({ op: 'set_duration', date: '2026-11-10', durationMin: 120 }), // ponad limit dnia 45
      op({ op: 'add', date: '2026-11-11', type: 'easy', durationMin: 30 }), // środa spoza ankiety
      op({ op: 'set_duration', date: '2026-11-10', durationMin: 5 }), // poniżej minimum
    ],
    { input: base, draft },
  );
  assert.deepEqual(res.results.map((r) => r.status), ['rejected', 'rejected', 'rejected']);
  assert.match(res.results[0]!.reason ?? '', /limit czasu/);
  assert.match(res.results[1]!.reason ?? '', /spoza ankiety/);
  assert.deepEqual(res.weeks, draft);
});

test('przeciwwskazania i początkujący: AI nie doda mocnej jednostki', () => {
  const gentle = { ...base, hasContraindications: true };
  const draft = generateInitialPlan(gentle).weeks;
  const res = applyOperations([op({ op: 'set_type', date: '2026-11-10', type: 'intervals', durationMin: 40 })], { input: gentle, draft });
  assert.equal(res.results[0]?.status, 'rejected');

  const beginner = { ...base, level: 'beginner' as const };
  const d2 = generateInitialPlan(beginner).weeks;
  const r2 = applyOperations([op({ op: 'set_type', date: '2026-11-10', type: 'easy' })], { input: beginner, draft: d2 });
  assert.equal(r2.results[0]?.status, 'rejected');
});

test('zawodów nie da się ruszyć', () => {
  const race = { ...base, goal: { type: 'race' as const, distanceM: 10000 as const, raceDate: '2026-11-21' } };
  const draft = generateInitialPlan(race).weeks;
  const res = applyOperations([op({ op: 'remove', date: '2026-11-21' })], { input: race, draft });
  assert.equal(res.results[0]?.status, 'rejected');
  assert.match(res.results[0]!.reason ?? '', /zawod/);
});

test('przyrost względem poprzedniego tygodnia jest pilnowany przy kolejnym tygodniu', () => {
  const prev = generatePlanWeek(base, 1);
  const draft = [generatePlanWeek(base, 2)];
  const long = draft[0]!.sessions.find((s) => s.type === 'long')!;
  const res = applyOperations([op({ op: 'set_duration', date: long.scheduledOn, durationMin: 90 })], {
    input: base,
    draft,
    previousWeek: prev,
  });
  assert.equal(res.results[0]?.status, 'rejected');
});

test('parseAiPlanResponse odrzuca złe kształty', () => {
  assert.equal(parseAiPlanResponse(null).ok, false);
  assert.equal(parseAiPlanResponse({ summary: 'x', operations: [{ op: 'explode', date: '2026-11-10' }] }).ok, false);
  const ok = parseAiPlanResponse({ summary: 'x', operations: [{ op: 'remove', date: '2026-11-10', extra: 1 }] });
  assert.ok(ok.ok && ok.value.operations[0]?.toDate === null);
});

test('koszt z cennika', () => {
  const price = modelPrice('claude-opus-5-5');
  assert.equal(costUsd({ inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, price), 4);
  assert.equal(costUsd({ inputTokens: 1000, outputTokens: 500, cacheReadTokens: 2000, cacheWriteTokens: 0 }, price), 0.0144);
  assert.equal(costUsd({ inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, modelPrice('unknown')), null);
});

test('prompt: blok reguł z parametrów, wiadomość bez danych osobowych', () => {
  assert.match(rulesPromptBlock({ ...DEFAULT_ENGINE_PARAMS, weeklyGrowthPctL2: 5 }, 2), /× 1\.05/);
  const draft = generateInitialPlan(base).weeks;
  const athlete = aiAthleteFromSurvey({
    profile: { level: 'intermediate', locale: 'pl', weekly_km: 12 },
    goal: { type: 'general', general_focus: 'improve_fitness', distance_m: null, race_date: null },
    availability: { preferred_days: [2, 4, 6], sessions_per_week: 3, max_minutes_weekday: 45, max_minutes_weekend: 90 },
  });
  const msg = planWeeksUserMessage({ athlete, input: base, draft, previousWeek: null, today: '2026-11-09', dayCapOf: () => 45 });
  const parsed = JSON.parse(msg);
  assert.equal(parsed.draft.length, 2);
  assert.ok(Array.isArray(parsed.draft[0].freeDays));
  assert.doesNotMatch(msg, /email|display_name|user_id/);
});

// ───────────────────────── pętla z ponowieniem ─────────────────────────

const usage = { inputTokens: 2000, outputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 0 };
const reply = (body: unknown, extra: Partial<AiModelResult> = {}): AiModelResult => ({
  requestId: 'msg_1',
  model: 'claude-opus-5-5',
  stopReason: 'end_turn',
  text: JSON.stringify(body),
  usage,
  raw: {},
  ...extra,
});

function harness(replies: (AiModelResult | Error)[]) {
  const requests: AiModelRequest[] = [];
  const logs: AiCallRecord[] = [];
  let i = 0;
  return {
    requests,
    logs,
    call: async (r: AiModelRequest) => {
      requests.push(r);
      const next = replies[i++];
      if (!next) throw new Error('brak odpowiedzi w teście');
      if (next instanceof Error) throw next;
      return next;
    },
    log: async (c: AiCallRecord) => {
      logs.push(c);
      return logs.length;
    },
  };
}

const runOpts = (h: ReturnType<typeof harness>) => {
  const draft = generateInitialPlan(base).weeks;
  return {
    input: base,
    draft,
    previousWeek: null,
    athlete: aiAthleteFromSurvey({
      profile: { level: 'intermediate' },
      goal: { type: 'general', general_focus: 'improve_fitness', distance_m: null, race_date: null },
      availability: { preferred_days: [2, 4, 6], sessions_per_week: 3, max_minutes_weekday: 45, max_minutes_weekend: 90 },
    }),
    today: '2026-11-09',
    prompt: DEFAULT_AI_PROMPTS['plan-weeks'],
    engine: { id: null, version: 0, params: DEFAULT_ENGINE_PARAMS },
    call: h.call,
    log: h.log,
    meta: { userId: 'u1', source: 'tester' as const, isTest: true },
  };
};

test('runner: poprawna odpowiedź → ok, jeden wpis z kosztem', async () => {
  const h = harness([reply({ summary: 'Krócej na start.', operations: [op({ op: 'set_duration', date: '2026-11-19', durationMin: 20 })] })]);
  const out = await planWeeksWithAi(runOpts(h));
  assert.equal(out.status, 'ok');
  assert.equal(out.source, 'ai');
  assert.equal(out.weeks[1]!.sessions[1]!.durationMin, 20);
  assert.equal(h.logs.length, 1);
  assert.equal(h.logs[0]!.cost_usd, 0.014);
  assert.equal(h.requests[0]!.system.length, 2);
});

test('runner: odrzucona operacja → ponowienie z wynikiem walidacji, powiązane z pierwszą próbą', async () => {
  const h = harness([
    reply({ summary: 'a', operations: [op({ op: 'set_duration', date: '2026-11-10', durationMin: 200 })] }),
    reply({ summary: 'b', operations: [op({ op: 'set_duration', date: '2026-11-10', durationMin: 40 })] }),
  ]);
  const out = await planWeeksWithAi(runOpts(h));
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1]!.messages.length, 3);
  assert.match(h.requests[1]!.messages[2]!.content, /odrzucił/);
  assert.deepEqual(h.logs.map((l) => [l.attempt, l.parent_call_id, l.validation_status]), [
    [1, null, 'rejected'],
    [2, 1, 'ok'],
  ]);
  assert.equal(out.status, 'ok');
  assert.equal(out.summary, 'b');
  assert.deepEqual(out.callIds, [1, 2]);
});

test('runner: błąd API → szkic, status fallback, zapisany błąd', async () => {
  const h = harness([new Error('overloaded')]);
  const out = await planWeeksWithAi(runOpts(h));
  assert.equal(out.status, 'fallback');
  assert.equal(out.source, 'rules');
  assert.deepEqual(out.weeks, runOpts(h).draft);
  assert.match(h.logs[0]!.error ?? '', /overloaded/);
});

test('runner: ucięta odpowiedź (max_tokens) → fallback bez ponowienia', async () => {
  const h = harness([reply({}, { stopReason: 'max_tokens', text: '{"summ' })]);
  const out = await planWeeksWithAi(runOpts(h));
  assert.equal(out.status, 'fallback');
  assert.equal(h.requests.length, 1);
});
