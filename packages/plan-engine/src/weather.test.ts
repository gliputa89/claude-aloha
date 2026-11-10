import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_AI_PROMPTS } from './ai-prompt.ts';
import type { AiCallRecord } from './ai-run.ts';
import { parseWeatherAdvice, weatherAdviceWithAi } from './weather-advice.ts';
import { assessSession, conditionOf, hoursFromOpenMeteo, weatherKey, type HourForecast } from './weather.ts';

const DAY = '2026-11-12';

/** Doba prognozy: łagodny, pochmurny dzień; `patch` nadpisuje wybrane godziny. */
function day(patch: (hour: number) => Partial<HourForecast> = () => ({}), date = DAY): HourForecast[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    time: `${date}T${String(hour).padStart(2, '0')}:00`,
    tempC: 10,
    feelsC: 10,
    precipProb: 5,
    precipMm: 0,
    windKmh: 8,
    gustKmh: 15,
    code: 3,
    uv: 1,
    isDay: hour >= 7 && hour < 16,
    pm25: 10,
    ...patch(hour),
  }));
}

test('spokojny dzień: dobra ocena, okno w dzień, bez ostrzeżeń', () => {
  const w = assessSession({ date: DAY, durationMin: 45, hours: day() })!;
  assert.equal(w.quality, 'good');
  assert.equal(w.allDay, true);
  assert.deepEqual(w.avoid, []);
  // zmrok nie zawęża okna, ale warunki opisujemy dla najlepszego (dziennego) startu
  assert.deepEqual(w.window, { from: '06:00', to: '22:00' });
  assert.equal(w.isDay, true);
});

test('deszcz po południu: okno przed opadem', () => {
  const w = assessSession({
    date: DAY,
    durationMin: 40,
    hours: day((h) => (h >= 13 ? { precipProb: 90, precipMm: 2.5, code: 63 } : {})),
  })!;
  assert.equal(w.window.to <= '13:00', true);
  assert.equal(w.flags.includes('rain'), false);
  assert.deepEqual(w.avoid, [{ from: '13:00', to: '22:00', reason: 'rain' }]);
  assert.equal(w.allDay, false);
});

test('upał w południe: okno rano albo wieczorem, południe do unikania', () => {
  const w = assessSession({
    date: '2026-07-10',
    durationMin: 60,
    hours: day(
      (h) => ({
        isDay: h >= 5 && h < 21,
        tempC: h >= 11 && h < 18 ? 31 : 20,
        feelsC: h >= 11 && h < 18 ? 33 : 19,
        uv: h >= 11 && h < 16 ? 8 : 2,
      }),
      '2026-07-10',
    ),
  })!;
  assert.ok(w.window.to <= '11:00' || w.window.from >= '18:00');
  assert.deepEqual(w.avoid, [{ from: '11:00', to: '18:00', reason: 'heat' }]);
  assert.equal(w.flags.includes('heat'), false);
});

test('burza przez cały dzień: ocena kiepska, flaga storm zostaje w oknie', () => {
  const w = assessSession({ date: DAY, durationMin: 30, hours: day(() => ({ code: 95, precipMm: 4, precipProb: 95 })) })!;
  assert.equal(w.quality, 'poor');
  assert.equal(w.flags[0], 'storm');
  assert.equal(w.condition, 'storm');
});

test('smog rano, czyściej po południu', () => {
  const w = assessSession({ date: DAY, durationMin: 45, hours: day((h) => (h < 12 ? { pm25: 70 } : { pm25: 15 })) })!;
  assert.ok(w.window.from >= '12:00');
  assert.deepEqual(w.avoid, [{ from: '06:00', to: '12:00', reason: 'smog' }]);
});

test('wieczorne okno dostaje flagę dark', () => {
  const w = assessSession({ date: DAY, durationMin: 45, hours: day(), nowHour: 17 })!;
  assert.equal(w.window.from, '18:00');
  assert.deepEqual(w.flags, ['dark']);
});

test('dziś: minione godziny odpadają, a po 21 nie ma już okna', () => {
  const w = assessSession({ date: DAY, durationMin: 90, hours: day(), nowHour: 14 })!;
  assert.equal(w.window.from, '15:00');
  assert.equal(assessSession({ date: DAY, durationMin: 90, hours: day(), nowHour: 20 }), null);
  assert.equal(assessSession({ date: DAY, durationMin: 30, hours: day(), nowHour: 21 }), null);
});

test('długi trening potrzebuje całego okna bez deszczu', () => {
  // sucho tylko 9–11: 2 h treningu mieszczą się dokładnie tam
  const w = assessSession({
    date: DAY,
    durationMin: 120,
    hours: day((h) => (h >= 9 && h < 11 ? {} : { precipProb: 90, precipMm: 3, code: 63 })),
  })!;
  assert.deepEqual(w.window, { from: '09:00', to: '11:00' });
});

test('brak prognozy na dany dzień → null', () => {
  assert.equal(assessSession({ date: '2026-12-01', durationMin: 45, hours: day() }), null);
});

test('ślisko: marznący deszcz i opad koło zera', () => {
  const w = assessSession({ date: DAY, durationMin: 30, hours: day(() => ({ code: 66, tempC: -1, feelsC: -5, precipMm: 1 })) })!;
  assert.equal(w.flags.includes('ice'), true);
  assert.equal(w.quality, 'poor');
});

test('odcisk nie zmienia się przy drobnej zmianie temperatury, zmienia przy innym oknie', () => {
  const a = assessSession({ date: DAY, durationMin: 45, hours: day() })!;
  const b = assessSession({ date: DAY, durationMin: 45, hours: day(() => ({ tempC: 11, feelsC: 11 })) })!;
  const c = assessSession({ date: DAY, durationMin: 45, hours: day((h) => (h >= 13 ? { precipMm: 3, precipProb: 90, code: 63 } : {})) })!;
  assert.equal(weatherKey(a), weatherKey(b));
  assert.notEqual(weatherKey(a), weatherKey(c));
});

test('kody WMO → warunki', () => {
  assert.equal(conditionOf(0), 'clear');
  assert.equal(conditionOf(2), 'partly');
  assert.equal(conditionOf(48), 'fog');
  assert.equal(conditionOf(55), 'drizzle');
  assert.equal(conditionOf(81), 'rain');
  assert.equal(conditionOf(73), 'snow');
  assert.equal(conditionOf(96), 'storm');
});

test('Open-Meteo: godziny z brakami są pomijane, PM2.5 dopasowane po czasie', () => {
  const hours = hoursFromOpenMeteo(
    {
      time: [`${DAY}T10:00`, `${DAY}T11:00`, `${DAY}T12:00`],
      temperature_2m: [5, null, 7],
      apparent_temperature: [2, null, null],
      precipitation: [0, 0, null],
      weather_code: [3, 3, 61],
      wind_speed_10m: [10, 10, 12],
      wind_gusts_10m: [20, 20, 25],
      is_day: [1, 1, 0],
    },
    { time: [`${DAY}T12:00`], pm2_5: [42] },
  );
  assert.equal(hours.length, 2);
  assert.deepEqual(hours[1], {
    time: `${DAY}T12:00`,
    tempC: 7,
    feelsC: 7,
    precipProb: null,
    precipMm: 0,
    windKmh: 12,
    gustKmh: 25,
    code: 61,
    uv: null,
    isDay: false,
    pm25: 42,
  });
  assert.equal(hours[0]!.pm25, null);
});

test('porady AI: tylko znane daty, bez pustych i za długich', () => {
  const parsed = parseWeatherAdvice(
    {
      advice: [
        { date: DAY, text: '  Wyjdź  przed 13:00.\nPotem leje. ' },
        { date: '2026-11-13', text: 'x'.repeat(400) },
        { date: '2030-01-01', text: 'Nie ta data.' },
        { date: '2026-11-14', text: '   ' },
      ],
    },
    [DAY, '2026-11-13', '2026-11-14'],
  );
  assert.deepEqual(parsed, { [DAY]: 'Wyjdź przed 13:00. Potem leje.' });
  assert.equal(parseWeatherAdvice({ foo: 1 }, [DAY]), null);
});

test('weatherAdviceWithAi: loguje wywołanie; błąd API → brak porad, status fallback', async () => {
  const weather = assessSession({ date: DAY, durationMin: 45, hours: day() })!;
  const base = {
    sessions: [{ type: 'easy', durationMin: 45, intensity: 'easy', weather }],
    locale: 'pl',
    today: DAY,
    nowHour: 8,
    prompt: DEFAULT_AI_PROMPTS['weather-advice'],
    meta: { userId: null, isTest: true },
  };
  const calls: AiCallRecord[] = [];
  const log = async (call: AiCallRecord) => calls.push(call);
  const usage = { inputTokens: 500, outputTokens: 60, cacheReadTokens: 0, cacheWriteTokens: 0 };

  const ok = await weatherAdviceWithAi({
    ...base,
    log,
    call: async (req) => {
      const sent = JSON.parse(req.messages[0]!.content);
      assert.equal(sent.sessions[0].isToday, true);
      assert.equal(sent.now, '08:00');
      return {
        requestId: 'msg_1',
        model: req.model,
        stopReason: 'end_turn',
        text: JSON.stringify({ advice: [{ date: DAY, text: 'Dziś pora nie gra roli – biegnij, kiedy Ci pasuje.' }] }),
        usage,
        raw: {},
      };
    },
  });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.advice[DAY], 'Dziś pora nie gra roli – biegnij, kiedy Ci pasuje.');
  assert.equal(ok.callId, 1);
  assert.equal(calls[0]!.function_name, 'weather-advice');
  assert.ok((calls[0]!.cost_usd ?? 0) > 0);

  const failed = await weatherAdviceWithAi({
    ...base,
    log,
    call: async () => {
      throw new Error('overloaded');
    },
  });
  assert.deepEqual(failed.advice, {});
  assert.equal(failed.status, 'fallback');
  assert.equal(calls[1]!.validation_status, 'fallback');
});
