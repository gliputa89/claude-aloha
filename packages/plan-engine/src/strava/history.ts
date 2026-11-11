// Strava → podpowiedź do ankiety startowej. Czyste reguły: z biegów z ostatnich 8 tygodni wyliczamy to,
// o co ankieta pyta w krokach „Jak teraz biegasz?” i „Kiedy możesz biegać?”. Biegacz widzi wynik jako propozycję
// i może wszystko zmienić. Pobieranie: supabase/functions/strava-history.

import { addDaysIso, daysBetween, isoWeekday } from '../core/dates.ts';
import { RACE_DISTANCES_M, type Level, type RaceDistanceM } from '../plan/goal.ts';
import { equivalent10kS } from '../plan/levels.ts';
import { isStravaRun, type StravaActivityInput } from './strava.ts';

export const STRAVA_HISTORY_RULES = {
  /** Okno analizy: 8 pełnych tygodni (ok. 2 miesiące) – łatwo liczyć „ile razy w tygodniu”. */
  weeks: 8,
  /** Krótsze zapisy (przypadkowo włączony zegarek, dobieg do tramwaju) nie liczą się jako bieg. */
  minDistanceM: 1000,
  minMovingTimeS: 5 * 60,
  /** Mniej biegów w całym oknie = „nie biegam” (start od zera albo po długiej przerwie). */
  minRuns: 3,
  /** „Biegam regularnie”: bieg w co najmniej tylu tygodniach z 8 i średnio 2 razy w tygodniu. */
  regularActiveWeeks: 6,
  regularRuns: 16,
  /** Bieżąca częstotliwość liczona z ostatnich tygodni – ważniejsze jest „teraz” niż „dwa miesiące temu”. */
  recentWeeks: 4,
  /** Bieg liczy się do wyniku na dystansie, gdy ma co najmniej tyle jego długości (GPS bywa o włos za krótki). */
  resultMinRatio: 0.97,
  /** Tempo poza tymi granicami (s/km) to raczej błąd zapisu albo marsz niż wynik biegowy. */
  minPaceSPerKm: 150,
  maxPaceSPerKm: 600,
} as const;

export const STRAVA_HISTORY_DAYS = STRAVA_HISTORY_RULES.weeks * 7;

export type StravaHistoryActivity = StravaActivityInput & {
  /** Bieg oznaczony w Stravie jako zawody – jego czas to prawdziwy wynik, nie szacunek z treningu. */
  race?: boolean;
};

export type StravaSurveyProposal = {
  /** Podsumowanie do pokazania biegaczowi. */
  weeks: number;
  runs: number;
  /** Średni tygodniowy dystans w oknie, metry. */
  weeklyDistanceM: number;
  longestRunM: number;
  /** Krok „Jak teraz biegasz?”. */
  level: Level;
  runsPerWeek: number;
  /** Najlepszy wynik z okna; `fromRace` – z zawodów, inaczej szacunek z najszybszego biegu na tym dystansie. */
  recentResult: { distanceM: RaceDistanceM; timeS: number; fromRace: boolean } | null;
  /**
   * Krok „Kiedy możesz biegać?” – `null`, gdy biegów jest za mało, żeby coś z nich wyczytać.
   * Minuty to typowy (75. percentyl) czas biegu w dni powszednie / w weekend; `null`, gdy w te dni nie biegał.
   */
  availability: {
    preferredDays: number[];
    sessionsPerWeek: number;
    typicalMinutesWeekday: number | null;
    typicalMinutesWeekend: number | null;
  } | null;
};

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;
};

/**
 * Najlepszy wynik: dla każdego dystansu zawodów bierzemy biegi co najmniej tej długości i przeliczamy czas
 * średnim tempem (dłuższy bieg daje ostrożny szacunek – na krótszym dystansie biegacz pobiegłby szybciej).
 * Zawody mają pierwszeństwo przed treningami; między dystansami wygrywa najlepszy odpowiednik na 10 km.
 */
function bestResult(runs: StravaHistoryActivity[]): StravaSurveyProposal['recentResult'] {
  const R = STRAVA_HISTORY_RULES;
  let best: { result: NonNullable<StravaSurveyProposal['recentResult']>; equivalentS: number } | null = null;
  for (const distanceM of RACE_DISTANCES_M) {
    for (const run of runs) {
      if (run.distanceM < distanceM * R.resultMinRatio) continue;
      const paceSPerKm = run.movingTimeS / (run.distanceM / 1000);
      if (paceSPerKm < R.minPaceSPerKm || paceSPerKm > R.maxPaceSPerKm) continue;
      // Zawody liczą się tylko na swoim dystansie – półmaraton w zawodach nie jest „wynikiem z zawodów na 5 km”.
      const fromRace = run.race === true && run.distanceM <= distanceM * 1.05;
      const timeS = Math.round(run.distanceM > distanceM ? (run.movingTimeS * distanceM) / run.distanceM : run.movingTimeS);
      const equivalentS = equivalent10kS({ distanceM, timeS });
      if (equivalentS === null) continue;
      const better =
        !best || (fromRace !== best.result.fromRace ? fromRace : equivalentS < best.equivalentS);
      if (better) best = { result: { distanceM, timeS, fromRace }, equivalentS };
    }
  }
  return best?.result ?? null;
}

/**
 * Propozycja odpowiedzi do ankiety z aktywności Stravy. `today` – dzień w czasie lokalnym biegacza (`YYYY-MM-DD`);
 * aktywności spoza okna 8 tygodni i inne dyscypliny są pomijane.
 */
export function surveyFromStravaHistory(activities: StravaHistoryActivity[], today: string): StravaSurveyProposal {
  const R = STRAVA_HISTORY_RULES;
  const from = addDaysIso(today, -(STRAVA_HISTORY_DAYS - 1));
  const runs = activities.filter(
    (a) =>
      isStravaRun(a.sportType) &&
      a.localDate >= from &&
      a.localDate <= today &&
      a.distanceM >= R.minDistanceM &&
      a.movingTimeS >= R.minMovingTimeS,
  );

  // Tydzień 0 = ostatnie 7 dni, 1 = poprzednie 7 itd.
  const weekOf = (a: StravaHistoryActivity) => Math.floor(daysBetween(a.localDate, today) / 7);
  const activeWeeks = new Set(runs.map(weekOf)).size;
  const recentRuns = runs.filter((a) => weekOf(a) < R.recentWeeks).length;
  const totalM = runs.reduce((n, a) => n + a.distanceM, 0);

  const level: Level =
    runs.length < R.minRuns
      ? 'beginner'
      : activeWeeks >= R.regularActiveWeeks && runs.length >= R.regularRuns
        ? 'advanced'
        : 'intermediate';
  const perWeek = recentRuns > 0 ? recentRuns / R.recentWeeks : runs.length / R.weeks;
  const runsPerWeek = level === 'beginner' ? 0 : Math.min(7, Math.max(1, Math.round(perWeek)));

  const summary = {
    weeks: R.weeks,
    runs: runs.length,
    weeklyDistanceM: Math.round(totalM / R.weeks),
    longestRunM: Math.round(Math.max(0, ...runs.map((a) => a.distanceM))),
  };
  if (level === 'beginner') return { ...summary, level, runsPerWeek, recentResult: null, availability: null };

  // Dni: te, w które biega najczęściej – tyle, ile razy w tygodniu teraz biega.
  const perWeekday = new Map<number, number>();
  for (const a of runs) {
    const day = isoWeekday(a.localDate);
    perWeekday.set(day, (perWeekday.get(day) ?? 0) + 1);
  }
  const preferredDays = [...perWeekday.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, runsPerWeek)
    .map(([day]) => day)
    .sort((a, b) => a - b);
  const minutes = (weekend: boolean) => {
    const value = percentile(
      runs.filter((a) => isoWeekday(a.localDate) >= 6 === weekend).map((a) => a.movingTimeS / 60),
      0.75,
    );
    return value === null ? null : Math.round(value);
  };

  return {
    ...summary,
    level,
    runsPerWeek,
    recentResult: bestResult(runs),
    availability: {
      preferredDays,
      sessionsPerWeek: preferredDays.length,
      typicalMinutesWeekday: minutes(false),
      typicalMinutesWeekend: minutes(true),
    },
  };
}
