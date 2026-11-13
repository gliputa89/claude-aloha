'use client';

import { forecastRace, RACE_DISTANCES_M, type Level, type RaceDistanceM } from '@aloha/plan-engine';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import { runForecastSimulation, type ForecastSimInput, type ForecastSimResult } from '@/app/(panel)/ai/forecast-test/actions';
import { Card, StatusBadge } from '@/components/ai/ui';

const DISTANCE_LABEL: Record<number, string> = { 5000: '5 km', 10000: '10 km', 21097: 'Półmaraton', 42195: 'Maraton' };
const SOURCE_LABEL = {
  race: 'zawody',
  effort: 'najszybszy odcinek w treningu',
  run: 'szacunek z całego biegu',
  manual: 'wpisany ręcznie',
} as const;
const LEVEL_LABEL: Record<Level, string> = { beginner: 'nie biega', intermediate: 'okazjonalnie', advanced: 'regularnie' };
const CONFIDENCE: Record<string, string> = { low: 'niska', medium: 'średnia', high: 'wysoka' };

const field = 'rounded-button border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-action';

/** `mm:ss` albo `h:mm:ss` → sekundy; błędny wpis → null. */
function parseTime(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const [h, m, s] = (parts.length === 3 ? parts : ['0', ...parts]).map(Number) as [number, number, number];
  if (m > 59 || s > 59) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

function formatTime(totalS: number | null | undefined) {
  if (totalS === null || totalS === undefined) return '–';
  const s = Math.round(totalS);
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** Liczba z pola; puste → null (np. nieznany kilometraż). */
const optional = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')));

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

/**
 * Symulator prognozy czasu na zawody: te same dane, które aplikacja zna po ankiecie, i wynik dla czterech dystansów.
 * Kolumny „z reguł” liczą się od razu w przeglądarce (tabele Danielsa, objętość, poprawa); „Opus” – po kliknięciu,
 * prawdziwym promptem, w widełkach z reguł.
 */
export function ForecastSimulator() {
  const [distance, setDistance] = useState('5000');
  const [time, setTime] = useState('18:53');
  const [source, setSource] = useState<ForecastSimInput['resultSource']>('run');
  const [daysAgo, setDaysAgo] = useState('74');
  const [level, setLevel] = useState<Level>('advanced');
  const [weeklyKm, setWeeklyKm] = useState('18');
  const [longestRunKm, setLongestRunKm] = useState('20');
  const [runsPerWeek, setRunsPerWeek] = useState('3');
  const [weeks, setWeeks] = useState('24');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('4');
  const [maxWeekday, setMaxWeekday] = useState('90');
  const [maxWeekend, setMaxWeekend] = useState('120');
  const [locale, setLocale] = useState<'pl' | 'en'>('pl');
  const [result, setResult] = useState<{ key: string; data: ForecastSimResult } | null>(null);
  const [pending, start] = useTransition();

  const input = useMemo((): ForecastSimInput | null => {
    const recentTimeS = parseTime(time);
    const numbers = [Number(distance), Number(runsPerWeek), Number(weeks), Number(sessionsPerWeek), Number(maxWeekday), Number(maxWeekend)];
    const optionals = [optional(weeklyKm), optional(longestRunKm), optional(daysAgo)];
    if (recentTimeS === null || numbers.some((n) => !Number.isFinite(n)) || optionals.some((n) => n !== null && !Number.isFinite(n))) return null;
    return {
      recentDistanceM: Number(distance),
      recentTimeS,
      resultSource: source,
      resultDaysAgo: optionals[2] as number | null,
      level,
      weeklyKm: optionals[0] as number | null,
      longestRunKm: optionals[1] as number | null,
      runsPerWeek: Number(runsPerWeek),
      weeks: Number(weeks),
      sessionsPerWeek: Number(sessionsPerWeek),
      maxMinutesWeekday: Number(maxWeekday),
      maxMinutesWeekend: Number(maxWeekend),
      locale,
    };
  }, [distance, time, source, daysAgo, level, weeklyKm, longestRunKm, runsPerWeek, weeks, sessionsPerWeek, maxWeekday, maxWeekend, locale]);

  const key = JSON.stringify(input);
  const rules = useMemo(
    () =>
      input
        ? RACE_DISTANCES_M.map((distanceM) => ({
            distanceM,
            forecast: forecastRace({
              distanceM,
              weeks: input.weeks,
              level: input.level,
              recent: { distanceM: input.recentDistanceM, timeS: input.recentTimeS },
              weeklyKm: input.weeklyKm,
              longestRunKm: input.longestRunKm,
              runsPerWeek: input.runsPerWeek,
              weeklyMinutesCap: Math.max(0, input.sessionsPerWeek - 1) * input.maxMinutesWeekday + input.maxMinutesWeekend,
            }),
          }))
        : [],
    [input],
  );
  // Wynik Opusa pokazujemy tylko dla danych, dla których był liczony – zmiana pola go chowa.
  const ai = result?.key === key && result.data.ok ? result.data : null;
  const aiError = result?.key === key && !result.data.ok ? result.data.message : null;
  const aiRow = (distanceM: RaceDistanceM) => ai?.rows.find((r) => r.distanceM === distanceM) ?? null;
  const vdot = rules[0]?.forecast?.vdot ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Card title="Biegacz">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Ostatni wynik – dystans (m)" hint="np. 5000, 10000, 21097">
            <input className={field} inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </Field>
          <Field label="Ostatni wynik – czas" hint="mm:ss albo h:mm:ss">
            <input className={field} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Skąd wynik">
            <select className={field} value={source} onChange={(e) => setSource(e.target.value as ForecastSimInput['resultSource'])}>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ile dni temu" hint="puste = nie wiadomo">
            <input className={field} inputMode="numeric" value={daysAgo} onChange={(e) => setDaysAgo(e.target.value)} />
          </Field>
          <Field label="Kilometraż tygodniowy (km)" hint="ostatnie 4 tygodnie; puste = z liczby biegów">
            <input className={field} inputMode="decimal" value={weeklyKm} onChange={(e) => setWeeklyKm(e.target.value)} />
          </Field>
          <Field label="Najdłuższy bieg (km)" hint="z ostatnich 12 tygodni; puste = nie wiadomo">
            <input className={field} inputMode="decimal" value={longestRunKm} onChange={(e) => setLongestRunKm(e.target.value)} />
          </Field>
          <Field label="Biegów w tygodniu teraz">
            <input className={field} inputMode="numeric" value={runsPerWeek} onChange={(e) => setRunsPerWeek(e.target.value)} />
          </Field>
          <Field label="Poziom z ankiety">
            <select className={field} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tygodni do startu">
            <input className={field} inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
          </Field>
          <Field label="Treningów w tygodniu (plan)">
            <input className={field} inputMode="numeric" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} />
          </Field>
          <Field label="Maks. minut w dzień powszedni">
            <input className={field} inputMode="numeric" value={maxWeekday} onChange={(e) => setMaxWeekday(e.target.value)} />
          </Field>
          <Field label="Maks. minut w weekend">
            <input className={field} inputMode="numeric" value={maxWeekend} onChange={(e) => setMaxWeekend(e.target.value)} />
          </Field>
        </div>
        {!input ? <p className="text-sm text-text-accent-strong">Popraw dane – czas w formacie mm:ss albo h:mm:ss, reszta to liczby.</p> : null}
      </Card>

      <Card
        title={vdot ? `Prognoza · VDOT ${vdot.toLocaleString('pl-PL')}` : 'Prognoza'}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              Język notki
              <select className={`${field} py-1.5`} value={locale} onChange={(e) => setLocale(e.target.value as 'pl' | 'en')}>
                <option value="pl">polski</option>
                <option value="en">angielski</option>
              </select>
            </label>
            <button
              type="button"
              disabled={pending || !input}
              onClick={() => input && start(async () => setResult({ key, data: await runForecastSimulation(input) }))}
              className="rounded-button bg-action px-3 py-2 text-sm font-semibold text-text-on-brand transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Opus liczy 4 dystanse…' : 'Policz z Opus (4 płatne wywołania)'}
            </button>
          </div>
        }
      >
        {aiError ? <p className="text-sm text-text-accent-strong">{aiError}</p> : null}
        {rules.length && rules.every((r) => r.forecast === null) ? (
          <p className="text-sm text-text-accent-strong">Z tego wyniku nie da się policzyć VDOT (nierealny czas albo dystans poniżej 1 km).</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Dystans</th>
                <th className="py-2 font-medium" title="Ten sam VDOT na docelowym dystansie – bez żadnych poprawek">Tabele Danielsa</th>
                <th className="py-2 font-medium" title="Tabele + kara za obecny kilometraż">Reguły: dziś</th>
                <th className="py-2 font-medium" title="Poprawa VDOT z cyklu + kilometraż, do którego zdąży dojść">Reguły: na start</th>
                <th className="py-2 font-medium" title="Poza te granice model nie wyjdzie">Widełki</th>
                <th className="py-2 font-medium" title="teraz → na start / potrzebne">Kilometraż</th>
                <th className="py-2 font-medium">Opus: dziś</th>
                <th className="py-2 font-medium">Opus: na start</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(({ distanceM, forecast: f }) => {
                const row = aiRow(distanceM);
                const fromAi = row?.forecast?.source === 'ai' ? row.forecast : null;
                return (
                  <tr key={distanceM} className="border-b border-border align-top last:border-b-0">
                    <td className="py-3 font-semibold">{DISTANCE_LABEL[distanceM]}</td>
                    <td className="py-3 tabular-nums">{formatTime(f?.danielsS)}</td>
                    <td className="py-3 tabular-nums">{formatTime(f?.todayS)}</td>
                    <td className="py-3 font-semibold tabular-nums">{formatTime(f?.raceDayS)}</td>
                    <td className="py-3 text-xs text-text-muted tabular-nums">
                      {f ? `${formatTime(f.fastestS)} – ${formatTime(f.slowestS)}` : '–'}
                    </td>
                    <td className="py-3 text-xs text-text-muted tabular-nums">
                      {f ? `${f.volume.currentKm} → ${f.volume.projectedKm} / ${f.volume.neededKm} km` : '–'}
                      {f && !f.volume.known ? <span className="block">szacunek z liczby biegów</span> : null}
                    </td>
                    <td className="py-3 tabular-nums">{fromAi ? formatTime(fromAi.todayS) : row ? '–' : ''}</td>
                    <td className="py-3">
                      {row ? (
                        <div className="flex max-w-md flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <b className="tabular-nums">{fromAi ? formatTime(fromAi.raceDayS) : '–'}</b>
                            <StatusBadge status={row.status} />
                            {fromAi?.confidence ? <span className="text-xs text-text-muted">pewność: {CONFIDENCE[fromAi.confidence]}</span> : null}
                            {row.callId ? (
                              <Link href={`/ai/calls/${row.callId}`} className="text-xs text-text-brand hover:underline">
                                wywołanie #{row.callId}
                              </Link>
                            ) : null}
                          </span>
                          {fromAi?.note ? <span className="text-xs text-text-muted">{fromAi.note}</span> : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {ai ? <p className="text-xs text-text-muted">Model: {ai.model}. Status „poprawione” = czas spoza widełek dociągnięty do granicy.</p> : null}
      </Card>
    </div>
  );
}
