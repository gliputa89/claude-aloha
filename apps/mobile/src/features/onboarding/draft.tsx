import type { Level, RaceDistanceM } from '@aloha/plan-engine';
import { createContext, use, useState, type PropsWithChildren } from 'react';

import { addDays, parseDuration, toIsoDate } from './time';

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
  /** Od kiedy plan, `YYYY-MM-DD`. */
  planStartDate: string;
  level: LevelChoice | null;
  runsPerWeek: number;
  recentDistanceM: RecentDistance;
  recentTime: string;
  days: number[];
  sessionsPerWeek: number;
  maxWeekday: number;
  maxWeekend: number;
  contraindications: boolean | null;
  healthConsent: boolean;
};

const initialDraft = (): OnboardingDraft => ({
  goal: null,
  raceDistanceM: 10000,
  raceDate: null,
  targetTime: '',
  // Domyślnie od jutra – dziś zwykle już za późno na pierwszy trening.
  planStartDate: toIsoDate(addDays(new Date(), 1)),
  level: null,
  runsPerWeek: 2,
  recentDistanceM: 5000,
  recentTime: '',
  days: [],
  sessionsPerWeek: 3,
  maxWeekday: 45,
  maxWeekend: 60,
  contraindications: null,
  // Zgoda na dane zdrowotne – domyślnie NIEzaznaczona (RODO art. 9, docs/PROJECT.md 6.1).
  healthConsent: false,
});

export const LEVEL_TO_DB: Record<LevelChoice, Level> = {
  none: 'beginner',
  occasional: 'intermediate',
  regular: 'advanced',
};

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
  if (!draft.targetTime.trim()) return null;
  return parseDuration(draft.targetTime) ?? undefined;
}

export function recentTimeS(draft: OnboardingDraft) {
  if (draft.level === 'none' || !draft.recentTime.trim()) return null;
  return parseDuration(draft.recentTime) ?? undefined;
}

/** Start planu musi być przed datą zawodów. */
export function startBeforeRace(draft: OnboardingDraft) {
  return draft.goal !== 'race' || !draft.raceDate || draft.planStartDate < draft.raceDate;
}
