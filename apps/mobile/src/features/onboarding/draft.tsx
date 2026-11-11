import type { Level, RaceDistanceM, StravaSurveyProposal } from '@aloha/plan-engine';
import { createContext, use, useState, type PropsWithChildren } from 'react';

import { addDays, formatDuration, parseDuration, toIsoDate } from './time';

export type GoalChoice = 'start_running' | 'improve_fitness' | 'run_regularly' | 'race';
export type LevelChoice = 'none' | 'occasional' | 'regular';
/** Dystans ostatniego wyniku – te same co dystanse zawodów. */
export type RecentDistance = RaceDistanceM;

/** Odpowiedzi z ankiety, trzymane w pamięci do kroku podsumowania. */
export type OnboardingDraft = {
  goal: GoalChoice | null;
  raceDistanceM: RaceDistanceM;
  raceDate: string | null;
  targetTime: string;
  /** „Nie wiem – podpowiedz mi”: biegacz nie podaje czasu, a podsumowanie proponuje wyliczony. */
  targetSuggest: boolean;
  /** Od kiedy plan, `YYYY-MM-DD`. */
  planStartDate: string;
  level: LevelChoice | null;
  runsPerWeek: number;
  recentDistanceM: RecentDistance;
  recentTime: string;
  /** Obecny kilometraż tygodniowy – wpisany albo ze Stravy; pusty, gdy biegacz go nie zna. */
  weeklyKm: string;
  days: number[];
  sessionsPerWeek: number;
  maxWeekday: number;
  maxWeekend: number;
  contraindications: boolean | null;
  healthConsent: boolean;
  /** Propozycja z biegów w Stravie, którą uzupełniliśmy odpowiedzi (`null` – ankieta wypełniana ręcznie). */
  strava: StravaSurveyProposal | null;
};

/** Do wyboru w kroku „Kiedy możesz biegać?”. */
export const WEEKDAY_MINUTES = [30, 45, 60, 75, 90] as const;
export const WEEKEND_MINUTES = [30, 45, 60, 90, 120] as const;

const initialDraft = (): OnboardingDraft => ({
  goal: null,
  raceDistanceM: 10000,
  raceDate: null,
  targetTime: '',
  targetSuggest: false,
  // Domyślnie od jutra – dziś zwykle już za późno na pierwszy trening.
  planStartDate: toIsoDate(addDays(new Date(), 1)),
  level: null,
  runsPerWeek: 2,
  recentDistanceM: 5000,
  recentTime: '',
  weeklyKm: '',
  days: [],
  sessionsPerWeek: 3,
  maxWeekday: 45,
  maxWeekend: 60,
  contraindications: null,
  // Zgoda na dane zdrowotne – domyślnie NIEzaznaczona (RODO art. 9, docs/PROJECT.md 6.1).
  healthConsent: false,
  strava: null,
});

export const LEVEL_TO_DB: Record<LevelChoice, Level> = {
  none: 'beginner',
  occasional: 'intermediate',
  regular: 'advanced',
};

const LEVEL_FROM_DB: Record<Level, LevelChoice> = { beginner: 'none', intermediate: 'occasional', advanced: 'regular' };

/** Najkrótszy czas z listy, w którym mieści się typowy bieg; dłuższy niż wszystkie → najdłuższy z listy. */
const fitMinutes = (options: readonly number[], minutes: number) => options.find((m) => m >= minutes) ?? options[options.length - 1]!;

/**
 * Odpowiedzi ankiety z propozycji ze Stravy. Przy zbyt małej liczbie biegów (poziom „nie biegam”) niczego nie
 * zaznaczamy – brak biegów w Stravie nie znaczy, że ktoś nie biega, więc o to pytamy wprost.
 */
export function draftFromStrava(proposal: StravaSurveyProposal, draft: OnboardingDraft): Partial<OnboardingDraft> {
  if (proposal.level === 'beginner') return { strava: proposal };
  const { recentResult, availability } = proposal;
  return {
    strava: proposal,
    level: LEVEL_FROM_DB[proposal.level],
    runsPerWeek: proposal.runsPerWeek,
    weeklyKm: String(Math.round(proposal.weeklyDistanceM / 1000)),
    ...(recentResult ? { recentDistanceM: recentResult.distanceM, recentTime: formatDuration(recentResult.timeS) } : {}),
    ...(availability && availability.preferredDays.length > 0
      ? {
          days: availability.preferredDays,
          sessionsPerWeek: availability.sessionsPerWeek,
          maxWeekday: availability.typicalMinutesWeekday ? fitMinutes(WEEKDAY_MINUTES, availability.typicalMinutesWeekday) : draft.maxWeekday,
          maxWeekend: availability.typicalMinutesWeekend ? fitMinutes(WEEKEND_MINUTES, availability.typicalMinutesWeekend) : draft.maxWeekend,
        }
      : {}),
  };
}

type DraftContextValue = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function OnboardingDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(initialDraft);
  const update = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }));
  return <DraftContext value={{ draft, update }}>{children}</DraftContext>;
}

export function useOnboardingDraft() {
  const ctx = use(DraftContext);
  if (!ctx) throw new Error('useOnboardingDraft poza OnboardingDraftProvider');
  return ctx;
}

/** Docelowy czas w sekundach: `null` gdy puste, `undefined` gdy wpis jest błędny. */
export function targetTimeS(draft: OnboardingDraft) {
  if (draft.targetSuggest || !draft.targetTime.trim()) return null;
  return parseDuration(draft.targetTime) ?? undefined;
}

export function recentTimeS(draft: OnboardingDraft) {
  if (draft.level === 'none' || !draft.recentTime.trim()) return null;
  return parseDuration(draft.recentTime) ?? undefined;
}

/** Kilometraż tygodniowy: `null` gdy pusty (albo „nie biegam”), `undefined` gdy wpis jest błędny. */
export function weeklyKmOf(draft: OnboardingDraft) {
  const text = draft.weeklyKm.trim().replace(',', '.');
  if (draft.level === 'none' || text === '') return null;
  const km = Number(text);
  return Number.isFinite(km) && km >= 0 && km <= 300 ? Math.round(km * 10) / 10 : undefined;
}

/** Start planu musi być przed datą zawodów. */
export function startBeforeRace(draft: OnboardingDraft) {
  return draft.goal !== 'race' || !draft.raceDate || draft.planStartDate < draft.raceDate;
}
