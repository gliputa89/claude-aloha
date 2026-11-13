import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateInitialPlan, type PlanInput } from '../plan/plan.ts';
import { chatChangeWrite, chatContextFromRows, checkChatChange, coachChatMessages, mentionsHealth, parseCoachChat, type ChatChange, type CoachChatContext } from './chat.ts';

// 2026-11-09 to poniedziałek; treningi we wtorek, czwartek i sobotę.
const input: PlanInput = {
  startDate: '2026-11-09',
  level: 'intermediate',
  goal: { type: 'general', focus: 'improve_fitness' },
  preferredDays: [2, 4, 6],
  sessionsPerWeek: 3,
  maxMinutesWeekday: 45,
  maxMinutesWeekend: 90,
  hasContraindications: false,
};
const weeks = generateInitialPlan(input).weeks;
const sessions = weeks.flatMap((w) => w.sessions);
const statuses = new Map(sessions.map((s) => [s.scheduledOn, 'planned']));
const check = (change: Partial<ChatChange>, over: { today?: string; statuses?: Map<string, string> } = {}) =>
  checkChatChange(
    { op: 'move', date: sessions[0]!.scheduledOn, toDate: null, type: null, durationMin: null, summary: 'test', ...change },
    { input, weeks, statuses: over.statuses ?? statuses, today: over.today ?? '2026-11-09' },
  );

test('przeniesienie na wolny dzień spoza ankiety przechodzi i daje wiersz do zapisu', () => {
  const first = sessions[0]!;
  const result = check({ op: 'move', date: first.scheduledOn, toDate: '2026-11-11' });
  assert.ok(result.ok, JSON.stringify(result));
  const write = chatChangeWrite({ op: 'move', date: first.scheduledOn, toDate: '2026-11-11', type: null, durationMin: null, summary: '' }, result.weeks);
  assert.equal(write?.kind, 'update');
  assert.equal(write?.kind === 'update' && write.session.scheduledOn, '2026-11-11');
  assert.equal(write?.kind === 'update' && write.session.type, first.type);
});

test('skrócenie i odpuszczenie treningu', () => {
  const first = sessions[0]!;
  const shorter = check({ op: 'set_duration', durationMin: 25 });
  assert.ok(shorter.ok, JSON.stringify(shorter));
  assert.equal(shorter.weeks.flatMap((w) => w.sessions).find((s) => s.scheduledOn === first.scheduledOn)?.durationMin, 25);
  assert.ok(check({ op: 'remove' }).ok);
  assert.deepEqual(chatChangeWrite({ op: 'remove', date: first.scheduledOn, toDate: null, type: null, durationMin: null, summary: '' }, []), {
    kind: 'delete',
    date: first.scheduledOn,
  });
});

test('odrzucone: zajęty dzień, zrobiony trening, miniony dzień, dzień bez treningu', () => {
  assert.ok(!check({ op: 'move', toDate: sessions[1]!.scheduledOn }).ok);
  assert.ok(!check({ op: 'remove' }, { statuses: new Map([[sessions[0]!.scheduledOn, 'done']]) }).ok);
  assert.ok(!check({ op: 'remove' }, { today: '2026-11-20' }).ok);
  assert.ok(!check({ op: 'remove', date: '2026-11-09' }).ok);
});

test('odpowiedź modelu: sama rozmowa, poprawna propozycja, wadliwa propozycja znika', () => {
  const none = { op: 'none', date: null, toDate: null, type: null, durationMin: null, summary: '' };
  assert.deepEqual(parseCoachChat({ reply: ' Jasne. ', change: none }), { reply: 'Jasne.', change: null });
  const move = parseCoachChat({ reply: 'Przenieśmy.', change: { ...none, op: 'move', date: '2026-11-10', toDate: '2026-11-11', summary: 'Przenieść' } });
  assert.equal(move?.change?.op, 'move');
  assert.equal(parseCoachChat({ reply: 'Ok', change: { ...none, op: 'move', date: '2026-11-10' } })?.change, null);
  assert.equal(parseCoachChat({ reply: '', change: none }), null);
});

test('wiadomości dla modelu zaczynają się od biegacza, a kontekst trafia do ostatniej', () => {
  const ctx = { locale: 'pl', today: '2026-11-09' } as CoachChatContext;
  const messages = coachChatMessages(
    [
      { sender: 'coach', body: 'Hej' },
      { sender: 'user', body: 'Pytanie 1' },
      { sender: 'coach', body: 'Odpowiedź' },
      { sender: 'user', body: 'Pytanie 2' },
    ],
    ctx,
  );
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(messages[0]!.content, 'Pytanie 1');
  assert.ok(messages[2]!.content.startsWith('<kontekst>') && messages[2]!.content.endsWith('Pytanie 2'));
});

test('tematy zdrowotne: ból, kontuzja, choroba, leki – tak; zwykłe pytania o trening – nie', () => {
  for (const text of [
    'Boli mnie kolano po wczorajszym biegu',
    'mam ból achillesa',
    'Jestem chory, mam gorączkę',
    'Wracam po kontuzji',
    'Biorę leki na ciśnienie',
    'Jestem w ciąży',
    'My knee hurts',
    'I was sick last week',
  ]) {
    assert.ok(mentionsHealth(text), text);
  }
  for (const text of [
    'Jak pobiec jutrzejsze interwały?',
    'Nie mam czasu, mogę przenieść trening na sobotę?',
    'Lekki bieg czy tempówka przed zawodami?',
    'Czuję się zmęczony po pracy',
    'Can I move the long run to Sunday?',
    'I will run uphill tomorrow',
  ]) {
    assert.ok(!mentionsHealth(text), text);
  }
});

test('kontekst: imię i świeża pogoda tylko przy nadchodzących, niezrobionych treningach', () => {
  const session = (id: string, scheduled_on: string, status = 'planned') => ({
    id, scheduled_on, type: 'easy', duration_min: 40, structure: null, status, actual_distance_m: null, actual_duration_s: null,
  });
  const forecast = (date: string) => ({
    date, window: { from: '07:00', to: '10:00' }, allDay: false, quality: 'ok' as const, tempC: 3.6, feelsC: -0.4, precipProb: 20,
    windKmh: 12.2, condition: 'cloudy' as const, isDay: true, pm25: 41.7, flags: ['smog' as const], avoid: [{ from: '17:00', to: '19:00', reason: 'rain' as const }],
  });
  const now = Date.parse('2026-11-12T12:00:00Z');
  const fresh = '2026-11-12T08:00:00Z';
  const ctx = chatContextFromRows({
    locale: 'pl',
    name: '  Ola   Maria ',
    level: 'beginner',
    goal: null,
    weeks: [{ starts_on: '2026-11-09', sessions: [session('a', '2026-11-10', 'done'), session('b', '2026-11-12'), session('c', '2026-11-14'), session('d', '2026-11-15'), session('e', '2026-11-16')] }],
    reviews: [],
    weather: [
      { session_id: 'a', forecast: forecast('2026-11-10'), advice: 'x', fetched_at: fresh },
      { session_id: 'b', forecast: forecast('2026-11-12'), advice: ' Ubierz się na cebulkę. ', fetched_at: fresh },
      { session_id: 'c', forecast: forecast('2026-11-14'), advice: null, fetched_at: '2026-11-10T08:00:00Z' },
      { session_id: 'd', forecast: forecast('2026-11-13'), advice: null, fetched_at: fresh },
    ],
    now,
    today: '2026-11-12',
    focusId: 'b',
  });
  assert.equal(ctx.athlete.name, 'Ola Maria');
  const byDate = new Map(ctx.plan.sessions.map((s) => [s.date, s.weather]));
  assert.equal(byDate.get('2026-11-10'), null, 'zrobiony trening');
  assert.deepEqual(byDate.get('2026-11-12'), {
    bestTime: '07:00–10:00', quality: 'ok', tempC: 4, feelsC: 0, precipProb: 20, windKmh: 12, condition: 'cloudy', pm25: 42,
    flags: ['smog'], avoid: [{ time: '17:00–19:00', reason: 'rain' }], advice: 'Ubierz się na cebulkę.',
  });
  assert.equal(byDate.get('2026-11-14'), null, 'stara prognoza');
  assert.equal(byDate.get('2026-11-15'), null, 'prognoza na inny dzień (trening przeniesiony)');
  assert.equal(byDate.get('2026-11-16'), null, 'brak prognozy');
  assert.equal(ctx.focus?.weather?.bestTime, '07:00–10:00');
  assert.equal(chatContextFromRows({ locale: 'pl', name: '   ', level: null, goal: null, weeks: [], reviews: [], today: '2026-11-12', focusId: null }).athlete.name, null);
});
