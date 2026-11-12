// Strava → podpowiedź do ankiety startowej. Czyste reguły: z biegów z ostatniego półrocza wyliczamy to,
// o co ankieta pyta w krokach „Jak teraz biegasz?” i „Kiedy możesz biegać?”. Biegacz widzi wynik jako propozycję
// i może wszystko zmienić. Pobieranie: supabase/functions/strava-history.
//
// Trzy okna, bo każde pytanie patrzy na inny kawałek historii:
//   * wynik (życiówka z okresu)      – całe 26 tygodni: dobry start sprzed 4 miesięcy nadal mówi, na co biegacza stać,
//   * poziom, dni i czas na trening  – ostatnie 12 tygodni: nawyk, nie pojedynczy zryw,
//   * ile razy w tygodniu, kilometraż – ostatnie 4 tygodnie: to, co dzieje się teraz.

import { addDaysIso, daysBetween, isoWeekday } from '../core/dates.ts';
import { RACE_DISTANCES_M, type Level, type RaceDistanceM } from '../plan/goal.ts';
import { equivalent10kS } from '../plan/levels.ts';
import { isStravaRun, type StravaActivityInput } from './strava.ts';

export const STRAVA_HISTORY_RULES = {
  /** Całe okno analizy (ok. pół roku) – z niego szukamy najlepszego wyniku. */
  weeks: 26,
  /** Okno „formy”: poziom, dni tygodnia i typowy czas biegu. */
  formWeeks: 12,
  /** Bieżąca częstotliwość i kilometraż – ważniejsze jest „teraz” niż „trzy miesiące temu”. */
  recentWeeks: 4,
  /** Krótsze zapisy (przypadkowo włączony zegarek, dobieg do tramwaju) nie liczą się jako bieg. */
  minDistanceM: 1000,
  minMovingTimeS: 5 * 60,
  /** Mniej biegów w oknie formy = za mało, żeby cokolwiek proponować. */
  minRuns: 3,
  /** Bez biegu od tylu tygodni = długa przerwa; dawne biegi nie mówią, jak biegacz biega teraz. */
  breakWeeks: 6,
  /** „Biegam regularnie”: bieg w co najmniej tylu tygodniach z 12 i średnio 2 razy w tygodniu. */
  regularActiveWeeks: 9,
  regularRuns: 24,
  /** Cały bieg liczy się jako wynik na dystansie, gdy ma co najmniej tyle jego długości (GPS bywa o włos za krótki). */
  resultMinRatio: 0.97,
  /** Najszybszy odcinek ze Stravy pasuje do dystansu zawodów z taką tolerancją (np. „5k” = 5000 m). */
  effortTolerance: 0.01,
  /** Zawody: aktywność oznaczona jako start, nie dłuższa od dystansu o więcej niż tyle (dobieg, błąd GPS). */
  raceMaxRatio: 1.05,
  /** Tempo poza tymi granicami (s/km) to raczej błąd zapisu albo marsz niż wynik biegowy. */
  minPaceSPerKm: 150,
  maxPaceSPerKm: 600,
  /** Szczegóły (najszybsze odcinki) to osobne zapytanie do Stravy na bieg – pytamy tylko o tylu kandydatów. */
  maxCandidates: 8,
  candidatesPerDistance: 2,
  candidateRaces: 3,
  candidateWorkouts: 2,
} as const;

export const STRAVA_HISTORY_DAYS = STRAVA_HISTORY_RULES.weeks * 7;

/** Najszybszy ciągły odcinek danej długości wewnątrz biegu (Strava „best efforts”). */
export type StravaBestEffort = { distanceM: number; timeS: number };

export type StravaHistoryActivity = StravaActivityInput & {
  /** Bieg oznaczony w Stravie jako zawody. */
  race?: boolean;
  /** Bieg oznaczony w Stravie jako trening jakościowy (interwały, tempo). */
  workout?: boolean;
  /**
   * Najszybsze odcinki z biegu – gdy pobraliśmy jego szczegóły. Życiówka na 5 km często siedzi w środku dłuższego
   * biegu albo treningu tempowego, a średnie tempo całej aktywności (z rozgrzewką i truchtem) ją zaniża.
   */
  bestEfforts?: StravaBestEffort[];
};

/**
 * Skąd wynik: `race` – czas z zawodów, `effort` – najszybszy odcinek wewnątrz biegu,
 * `run` – szacunek ze średniego tempa całego biegu (gdy nie mamy jego odcinków).
 */
export type StravaResultSource = 'race' | 'effort' | 'run';

export type StravaSurveyProposal = {
  /** Podsumowanie do pokazania biegaczowi. */
  weeks: number;
  /** Biegi w całym oknie. */
  runs: number;
  /** Średni tygodniowy dystans z ostatnich 4 tygodni, metry. */
  weeklyDistanceM: number;
  /** Najdłuższy bieg z ostatnich 12 tygodni, metry. */
  longestRunM: number;
  /** Krok „Jak teraz biegasz?”. */
  level: Level;
  runsPerWeek: number;
  /** Najlepszy wynik z okna (po przeliczeniu na 10 km) – z dniem, żeby biegacz wiedział, o który bieg chodzi. */
  recentResult: { distanceM: RaceDistanceM; timeS: number; source: StravaResultSource; date: string } | null;
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

const paceOk = (distanceM: number, timeS: number) => {
  if (distanceM <= 0) return false;
  const pace = timeS / (distanceM / 1000);
  return pace >= STRAVA_HISTORY_RULES.minPaceSPerKm && pace <= STRAVA_HISTORY_RULES.maxPaceSPerKm;
};

/** Biegi z okna analizy (bez innych dyscyplin i strzępków zapisów), od najnowszych tygodni liczone względem `today`. */
function runsInWindow<T extends StravaHistoryActivity>(activities: T[], today: string): T[] {
  const R = STRAVA_HISTORY_RULES;
  const from = addDaysIso(today, -(STRAVA_HISTORY_DAYS - 1));
  return activities.filter(
    (a) =>
      isStravaRun(a.sportType) &&
      a.localDate >= from &&
      a.localDate <= today &&
      a.distanceM >= R.minDistanceM &&
      a.movingTimeS >= R.minMovingTimeS,
  );
}

const isRaceAt = (run: StravaHistoryActivity, distanceM: number) =>
  run.race === true && run.distanceM <= distanceM * STRAVA_HISTORY_RULES.raceMaxRatio;

/**
 * Które biegi warto obejrzeć dokładniej (pobrać ich najszybsze odcinki): dla każdego dystansu zawodów najszybsze
 * biegi co najmniej tej długości, do tego ostatnie zawody i treningi jakościowe. Zwraca id aktywności, najważniejsze
 * najpierw, najwyżej `maxCandidates`.
 */
export function stravaResultCandidates(activities: StravaHistoryActivity[], today: string): number[] {
  const R = STRAVA_HISTORY_RULES;
  const runs = runsInWindow(activities, today).filter((a) => paceOk(a.distanceM, a.movingTimeS));
  const pace = (a: StravaHistoryActivity) => a.movingTimeS / a.distanceM;
  const newest = (a: StravaHistoryActivity, b: StravaHistoryActivity) => b.startedAt.localeCompare(a.startedAt);
  const long = runs.filter((a) => a.distanceM >= RACE_DISTANCES_M[0] * R.resultMinRatio);

  const picked: number[] = [];
  const add = (list: StravaHistoryActivity[]) => {
    for (const a of list) if (!picked.includes(a.id)) picked.push(a.id);
  };
  add(long.filter((a) => a.race).sort(newest).slice(0, R.candidateRaces));
  for (const distanceM of RACE_DISTANCES_M) {
    add(
      runs
        .filter((a) => a.distanceM >= distanceM * R.resultMinRatio)
        .sort((a, b) => pace(a) - pace(b))
        .slice(0, R.candidatesPerDistance),
    );
  }
  add(long.filter((a) => a.workout).sort(newest).slice(0, R.candidateWorkouts));
  return picked.slice(0, R.maxCandidates);
}

/**
 * Najlepszy wynik: wszystko, co biegacz naprawdę przebiegł na dystansie zawodów –
 *   * najszybszy odcinek wewnątrz biegu (gdy mamy szczegóły aktywności),
 *   * cały bieg co najmniej tej długości, przeliczony średnim tempem (ostrożny szacunek).
 * Między dystansami wygrywa najlepszy odpowiednik na 10 km. Wynik z aktywności oznaczonej jako zawody
 * na tym dystansie dostaje źródło `race`.
 */
function bestResult(runs: StravaHistoryActivity[]): StravaSurveyProposal['recentResult'] {
  const R = STRAVA_HISTORY_RULES;
  let best: { result: NonNullable<StravaSurveyProposal['recentResult']>; equivalentS: number } | null = null;
  const consider = (run: StravaHistoryActivity, distanceM: RaceDistanceM, timeS: number, source: StravaResultSource) => {
    if (!paceOk(distanceM, timeS)) return;
    const equivalentS = equivalent10kS({ distanceM, timeS });
    if (equivalentS === null || (best && equivalentS >= best.equivalentS)) return;
    best = { result: { distanceM, timeS: Math.round(timeS), source: isRaceAt(run, distanceM) ? 'race' : source, date: run.localDate }, equivalentS };
  };
  for (const run of runs) {
    for (const distanceM of RACE_DISTANCES_M) {
      for (const effort of run.bestEfforts ?? []) {
        if (Math.abs(effort.distanceM - distanceM) <= distanceM * R.effortTolerance) consider(run, distanceM, effort.timeS, 'effort');
      }
      if (run.distanceM >= distanceM * R.resultMinRatio) {
        consider(run, distanceM, run.distanceM > distanceM ? (run.movingTimeS * distanceM) / run.distanceM : run.movingTimeS, 'run');
      }
    }
  }
  return (best as { result: StravaSurveyProposal['recentResult'] } | null)?.result ?? null;
}

/**
 * Propozycja odpowiedzi do ankiety z aktywności Stravy. `today` – dzień w czasie lokalnym biegacza (`YYYY-MM-DD`);
 * aktywności spoza okna i inne dyscypliny są pomijane.
 */
export function surveyFromStravaHistory(activities: StravaHistoryActivity[], today: string): StravaSurveyProposal {
  const R = STRAVA_HISTORY_RULES;
  const runs = runsInWindow(activities, today);

  // Tydzień 0 = ostatnie 7 dni, 1 = poprzednie 7 itd.
  const weekOf = (a: StravaHistoryActivity) => Math.floor(daysBetween(a.localDate, today) / 7);
  const form = runs.filter((a) => weekOf(a) < R.formWeeks);
  const recent = runs.filter((a) => weekOf(a) < R.recentWeeks);
  const activeWeeks = new Set(form.map(weekOf)).size;
  const lastRunWeek = Math.min(Number.POSITIVE_INFINITY, ...runs.map(weekOf));
  const sumM = (list: StravaHistoryActivity[]) => list.reduce((n, a) => n + a.distanceM, 0);

  const level: Level =
    form.length < R.minRuns || lastRunWeek >= R.breakWeeks
      ? 'beginner'
      : activeWeeks >= R.regularActiveWeeks && form.length >= R.regularRuns
        ? 'advanced'
        : 'intermediate';
  const perWeek = recent.length > 0 ? recent.length / R.recentWeeks : form.length / R.formWeeks;
  const runsPerWeek = level === 'beginner' ? 0 : Math.min(7, Math.max(1, Math.round(perWeek)));

  const summary = {
    weeks: R.weeks,
    runs: runs.length,
    weeklyDistanceM: Math.round(recent.length > 0 ? sumM(recent) / R.recentWeeks : sumM(form) / R.formWeeks),
    longestRunM: Math.round(Math.max(0, ...form.map((a) => a.distanceM))),
  };
  if (level === 'beginner') return { ...summary, level, runsPerWeek, recentResult: null, availability: null };

  // Dni: te, w które biega najczęściej – tyle, ile razy w tygodniu teraz biega.
  const perWeekday = new Map<number, number>();
  for (const a of form) {
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
      form.filter((a) => isoWeekday(a.localDate) >= 6 === weekend).map((a) => a.movingTimeS / 60),
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
