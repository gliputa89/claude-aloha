// Pogoda do treningu: z prognozy godzinowej wybieramy najlepsze okno i ostrzeżenia.
//
// Czyste reguły – ten sam kod liczy w Edge Function (session-weather) i w testach. AI nie wybiera okna:
// dostaje gotowy wynik i tylko ubiera go w słowa (weather-advice.ts). Bez AI aplikacja składa tekst ze słownika.
// Godziny są lokalne dla miejsca prognozy (`YYYY-MM-DDTHH:00`), bez stref czasowych.

export type WeatherCondition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

/** Jedna godzina prognozy (jednostki: °C, mm, km/h, µg/m³). */
export type HourForecast = {
  /** Lokalny czas `YYYY-MM-DDTHH:00`. */
  time: string;
  tempC: number;
  feelsC: number;
  /** Szansa opadów 0–100; null, gdy prognoza jej nie podaje. */
  precipProb: number | null;
  precipMm: number;
  windKmh: number;
  gustKmh: number;
  /** Kod pogody WMO. */
  code: number;
  uv: number | null;
  isDay: boolean;
  pm25: number | null;
};

/** Co przeszkadza w bieganiu. Kolejność = ważność (najpoważniejsze pierwsze). */
export const WEATHER_FLAGS = ['storm', 'ice', 'heat', 'frost', 'smog', 'wind', 'rain', 'uv', 'dark'] as const;
export type WeatherFlag = (typeof WEATHER_FLAGS)[number];

export type WeatherQuality = 'good' | 'ok' | 'poor';

export type WeatherPeriod = { from: string; to: string };

/** Jedna godzina dnia do podglądu „pogoda na cały dzień” (tylko to, co widać na karcie). */
export type DayHour = {
  /** Godzina lokalna 0–23. */
  hour: number;
  tempC: number;
  precipProb: number | null;
  condition: WeatherCondition;
  isDay: boolean;
  /** Powód, dla którego lepiej unikać tej godziny (null – nic poważnego). */
  severe: WeatherFlag | null;
};

export type SessionWeather = {
  date: string;
  /** Najlepsza pora na trening (`HH:00`). */
  window: WeatherPeriod;
  /** Cały dzień jest podobnie dobry – pora nie ma znaczenia. */
  allDay: boolean;
  quality: WeatherQuality;
  /** Warunki w najlepszym oknie. */
  tempC: number;
  feelsC: number;
  precipProb: number | null;
  windKmh: number;
  condition: WeatherCondition;
  isDay: boolean;
  pm25: number | null;
  /** Co zostaje do ogarnięcia nawet w najlepszym oknie. */
  flags: WeatherFlag[];
  /** Pory dnia, których lepiej unikać (najwyżej dwie), z powodem. */
  avoid: (WeatherPeriod & { reason: WeatherFlag })[];
  /**
   * Godziny dnia od najwcześniejszej możliwej do końca dnia treningowego (dla dzisiaj – od następnej godziny).
   * Opcjonalne: starsze zapisy w pamięci podręcznej serwera jeszcze go nie mają.
   */
  day?: DayHour[];
};

/** Progi reguł – w jednym miejscu, żeby łatwo je stroić. */
export const WEATHER_RULES = {
  /** Trening planujemy między tymi godzinami (koniec okna najpóźniej o `dayEndHour`). */
  dayStartHour: 6,
  dayEndHour: 22,
  /** Gdy plan nie podaje czasu (np. zawody na dystans). */
  defaultDurationMin: 45,
  comfortMinC: 4,
  comfortMaxC: 18,
  heatC: 27,
  frostC: -8,
  rainProb: 60,
  rainMm: 0.5,
  heavyRainMm: 2,
  windKmh: 30,
  gustKmh: 55,
  smogPm25: 35,
  heavySmogPm25: 55,
  uv: 6,
  /** Okna o ocenie gorszej najwyżej o tyle od najlepszego liczą się jako „równie dobre”. */
  closeEnough: 4,
  /** Ocena okna: do `good` – dobrze, do `ok` – da się, wyżej – kiepsko. */
  good: 12,
  ok: 32,
  /** Tyle godzin podobnie dobrej pogody = „cały dzień”. */
  allDayHours: 9,
} as const;

const R = WEATHER_RULES;

export function conditionOf(code: number): WeatherCondition {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'cloudy';
  if (code === 1 || code === 2) return 'partly';
  return 'clear';
}

/** Marznący deszcz / mżawka albo opad przy temperaturze koło zera – ślisko. */
const isIcy = (h: HourForecast) =>
  [56, 57, 66, 67].includes(h.code) || (h.tempC <= 1 && h.tempC >= -3 && h.precipMm >= 0.3 && conditionOf(h.code) !== 'snow');

const isWet = (h: HourForecast) => h.precipMm >= R.rainMm || ((h.precipProb ?? 0) >= R.rainProb && h.precipMm > 0);

/** Flagi jednej godziny (bez kolejności). */
export function hourFlags(h: HourForecast): WeatherFlag[] {
  const flags: WeatherFlag[] = [];
  if (conditionOf(h.code) === 'storm') flags.push('storm');
  if (isIcy(h)) flags.push('ice');
  if (h.feelsC >= R.heatC) flags.push('heat');
  if (h.feelsC <= R.frostC) flags.push('frost');
  if (h.pm25 !== null && h.pm25 >= R.smogPm25) flags.push('smog');
  if (h.windKmh >= R.windKmh || h.gustKmh >= R.gustKmh) flags.push('wind');
  if (isWet(h)) flags.push('rain');
  if (h.uv !== null && h.uv >= R.uv) flags.push('uv');
  if (!h.isDay) flags.push('dark');
  return flags;
}

/** Godzina, której lepiej unikać – powód albo null. */
function severeReason(h: HourForecast): WeatherFlag | null {
  if (conditionOf(h.code) === 'storm') return 'storm';
  if (isIcy(h)) return 'ice';
  if (h.feelsC >= R.heatC) return 'heat';
  if (h.feelsC <= R.frostC - 4) return 'frost';
  if (h.pm25 !== null && h.pm25 >= R.heavySmogPm25) return 'smog';
  if (h.gustKmh >= R.gustKmh + 10 || h.windKmh >= R.windKmh + 10) return 'wind';
  if (h.precipMm >= R.heavyRainMm) return 'rain';
  return null;
}

/** Kara za godzinę: 0 = idealnie do biegania, im więcej, tym gorzej. */
export function hourPenalty(h: HourForecast): number {
  let p = 0;
  if (h.feelsC > R.comfortMaxC) p += (h.feelsC - R.comfortMaxC) * 3;
  if (h.feelsC < R.comfortMinC) p += (R.comfortMinC - h.feelsC) * 1.2;
  if (h.feelsC >= R.heatC) p += 20;
  if (h.feelsC <= R.frostC) p += 15;
  p += Math.min(40, ((h.precipProb ?? (h.precipMm > 0 ? 80 : 0)) / 100) * 12 + h.precipMm * 10);
  if (conditionOf(h.code) === 'storm') p += 100;
  if (isIcy(h)) p += 60;
  if (h.windKmh > 20) p += h.windKmh - 20;
  if (h.gustKmh >= R.gustKmh) p += 20;
  if (h.pm25 !== null && h.pm25 > 25) p += (h.pm25 - 25) * 0.8;
  if (h.pm25 !== null && h.pm25 >= R.heavySmogPm25) p += 30;
  if (h.uv !== null && h.uv > R.uv) p += (h.uv - R.uv) * 5;
  // Ciemno to tylko drobny minus (mniej niż `closeEnough`): zimą większość biega po pracy, więc zmrok
  // nie może zawężać okna – wystarczy flaga `dark` z przypomnieniem o odblaskach.
  if (!h.isDay) p += 2;
  return p;
}

const hourOf = (time: string) => Number(time.slice(11, 13));
const label = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const round1 = (n: number) => Math.round(n * 10) / 10;

export type SessionWeatherInput = {
  date: string;
  durationMin: number | null;
  /** Prognoza godzinowa (może obejmować inne dni – bierzemy tylko `date`). */
  hours: HourForecast[];
  /** Dla dzisiejszego treningu: bieżąca godzina lokalna – wcześniejsze pory pomijamy. */
  nowHour?: number | null;
};

/**
 * Najlepsze okno i ostrzeżenia dla treningu danego dnia.
 * Null, gdy prognozy na ten dzień nie ma albo dziś nie zostało już okno na trening.
 */
export function assessSession(input: SessionWeatherInput): SessionWeather | null {
  const earliest = Math.max(R.dayStartHour, input.nowHour == null ? 0 : input.nowHour + 1);
  const byHour = new Map<number, HourForecast>();
  for (const h of input.hours) {
    if (!h.time.startsWith(input.date)) continue;
    const hour = hourOf(h.time);
    if (hour >= earliest && hour < R.dayEndHour) byHour.set(hour, h);
  }
  const slots = Math.max(1, Math.ceil((input.durationMin ?? R.defaultDurationMin) / 60));

  // Ocena każdego możliwego startu: średnia kara okna, dociążona najgorszą godziną.
  const starts: { start: number; score: number; hours: HourForecast[] }[] = [];
  for (let start = earliest; start + slots <= R.dayEndHour; start++) {
    const hours: HourForecast[] = [];
    for (let i = 0; i < slots; i++) {
      const h = byHour.get(start + i);
      if (h) hours.push(h);
    }
    if (hours.length < slots) continue;
    const penalties = hours.map(hourPenalty);
    const mean = penalties.reduce((a, b) => a + b, 0) / slots;
    starts.push({ start, score: (mean + Math.max(...penalties)) / 2, hours });
  }
  if (starts.length === 0) return null;

  const best = starts.reduce((a, b) => (b.score < a.score - 0.01 ? b : a));
  // Rozszerzamy okno o sąsiednie starty prawie tak samo dobre – wychodzi pora, a nie jedna godzina.
  const good = (s: number) => {
    const found = starts.find((x) => x.start === s);
    return found !== undefined && found.score <= best.score + R.closeEnough;
  };
  let from = best.start;
  let last = best.start;
  while (good(from - 1)) from--;
  while (good(last + 1)) last++;
  const to = last + slots;

  const windowHours = [...byHour.values()].filter((h) => hourOf(h.time) >= from && hourOf(h.time) < to);
  const flagSet = new Set(best.hours.flatMap(hourFlags));
  const mid = best.hours[Math.floor((best.hours.length - 1) / 2)]!;
  const probs = best.hours.map((h) => h.precipProb).filter((p): p is number => p !== null);
  const pms = best.hours.map((h) => h.pm25).filter((p): p is number => p !== null);

  // Pory do unikania: ciągłe odcinki godzin z poważnym powodem, poza wybranym oknem.
  const avoid: SessionWeather['avoid'] = [];
  let run: { from: number; to: number; reason: WeatherFlag } | null = null;
  const flush = () => {
    if (run) avoid.push({ from: label(run.from), to: label(run.to), reason: run.reason });
    run = null;
  };
  for (let hour = earliest; hour < R.dayEndHour; hour++) {
    const h = byHour.get(hour);
    const reason = h && !windowHours.includes(h) ? severeReason(h) : null;
    if (reason && run && run.reason === reason && run.to === hour) run.to = hour + 1;
    else {
      flush();
      if (reason) run = { from: hour, to: hour + 1, reason };
    }
  }
  flush();
  avoid.sort((a, b) => WEATHER_FLAGS.indexOf(a.reason) - WEATHER_FLAGS.indexOf(b.reason));

  return {
    date: input.date,
    window: { from: label(from), to: label(to) },
    allDay: to - from >= R.allDayHours,
    quality: best.score <= R.good ? 'good' : best.score <= R.ok ? 'ok' : 'poor',
    tempC: Math.round(mid.tempC),
    feelsC: Math.round(mid.feelsC),
    precipProb: probs.length ? Math.max(...probs) : null,
    windKmh: Math.round(Math.max(...best.hours.map((h) => h.windKmh))),
    condition: conditionOf(Math.max(...best.hours.map((h) => h.code))),
    isDay: best.hours.every((h) => h.isDay),
    pm25: pms.length ? round1(Math.max(...pms)) : null,
    flags: WEATHER_FLAGS.filter((f) => flagSet.has(f)),
    avoid: avoid.slice(0, 2),
    day: [...byHour.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, h]) => ({
        hour,
        tempC: Math.round(h.tempC),
        precipProb: h.precipProb,
        condition: conditionOf(h.code),
        isDay: h.isDay,
        severe: severeReason(h),
      })),
  };
}

/**
 * Odcisk wyniku: zmienia się dopiero, gdy zmienia się to, co warto powiedzieć biegaczowi
 * (pora, ocena, ostrzeżenia, wyraźnie inna temperatura). Ten sam odcisk = ta sama porada, bez nowego wywołania AI.
 */
export function weatherKey(w: SessionWeather): string {
  return [
    w.date,
    `${w.window.from}-${w.window.to}`,
    w.allDay ? 'all' : 'part',
    w.quality,
    w.condition,
    Math.round(w.feelsC / 4),
    w.flags.join('+'),
    w.avoid.map((a) => `${a.reason}@${a.from}-${a.to}`).join('+'),
  ].join('|');
}

/** Odpowiedź Open-Meteo (`hourly`) → godziny prognozy. Jakość powietrza osobno, dopasowana po czasie. */
export type OpenMeteoHourly = {
  time: string[];
  temperature_2m: (number | null)[];
  apparent_temperature: (number | null)[];
  precipitation_probability?: (number | null)[];
  precipitation: (number | null)[];
  weather_code: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_gusts_10m: (number | null)[];
  uv_index?: (number | null)[];
  is_day: (number | null)[];
};

export function hoursFromOpenMeteo(
  hourly: OpenMeteoHourly,
  air?: { time: string[]; pm2_5: (number | null)[] } | null,
): HourForecast[] {
  const pm = new Map<string, number>();
  air?.time.forEach((t, i) => {
    const v = air.pm2_5[i];
    if (typeof v === 'number') pm.set(t, v);
  });
  const out: HourForecast[] = [];
  hourly.time.forEach((time, i) => {
    const tempC = hourly.temperature_2m[i];
    const code = hourly.weather_code[i];
    // Godzina bez temperatury albo kodu pogody jest bezużyteczna – pomijamy (okno jej nie obejmie).
    if (typeof tempC !== 'number' || typeof code !== 'number') return;
    out.push({
      time,
      tempC,
      feelsC: hourly.apparent_temperature[i] ?? tempC,
      precipProb: hourly.precipitation_probability?.[i] ?? null,
      precipMm: hourly.precipitation[i] ?? 0,
      windKmh: hourly.wind_speed_10m[i] ?? 0,
      gustKmh: hourly.wind_gusts_10m[i] ?? 0,
      code,
      uv: hourly.uv_index?.[i] ?? null,
      isDay: hourly.is_day[i] !== 0,
      pm25: pm.get(time) ?? null,
    });
  });
  return out;
}
