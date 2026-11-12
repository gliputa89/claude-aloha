import { planFocusOf, suggestGoals, type GoalSpec, type SuggestedGoals } from '@aloha/plan-engine';

import { LEVEL_TO_DB, raceNameOf, recentTimeS, targetTimeS, weeklyKmOf, type OnboardingDraft } from './draft';
import { parseDuration } from './time';

/** Propozycje celów z odpowiedzi w ankiecie (krok „Twoje cele”); `null`, gdy brakuje kierunku albo poziomu. */
export function suggestedGoalsOf(draft: OnboardingDraft): SuggestedGoals | null {
  if (!draft.goal || !draft.level) return null;
  const recent = recentTimeS(draft);
  return suggestGoals({
    direction: draft.goal,
    level: LEVEL_TO_DB[draft.level],
    recent: recent ? { distanceM: draft.recentDistanceM, timeS: recent } : null,
    weeklyKm: weeklyKmOf(draft) ?? null,
    runsPerWeek: draft.level === 'none' ? 0 : draft.runsPerWeek,
    sessionsPerWeek: draft.sessionsPerWeek,
    // Tak samo jak w prognozie zawodów: jeden trening w weekend, reszta w tygodniu.
    weeklyMinutesCap: Math.max(0, draft.sessionsPerWeek - 1) * draft.maxWeekday + draft.maxWeekend,
    planStartDate: draft.planStartDate,
    race:
      draft.goal === 'race' && draft.raceDate
        ? { distanceM: draft.raceDistanceM, date: draft.raceDate, name: raceNameOf(draft), targetTimeS: targetTimeS(draft) ?? null }
        : null,
    furtherDistanceM: draft.furtherDistanceM,
  });
}

/** Czy propozycja obok jest zaznaczona (wybór biegacza albo domyślny). */
export const isGoalChecked = (draft: OnboardingDraft, index: number, byDefault: boolean) => draft.goalChecks[index] ?? byDefault;

/** Czas celu „szybciej”: wpisany albo z propozycji. `undefined` – wpis jest błędny. */
export function performanceTargetS(draft: OnboardingDraft, suggested: number | null | undefined): number | null | undefined {
  if (draft.performanceTime === null) return suggested ?? null;
  if (!draft.performanceTime.trim()) return null;
  return parseDuration(draft.performanceTime) ?? undefined;
}

/** Cele do zapisu: prowadzący i zaznaczone obok. `null` – krok celów nie jest kompletny (np. brak czasu celu „szybciej”). */
export function goalsToSave(draft: OnboardingDraft): { primary: GoalSpec; secondary: GoalSpec[] } | null {
  const suggested = suggestedGoalsOf(draft);
  if (!suggested) return null;
  let primary = suggested.primary;
  if (primary.kind === 'performance') {
    const target = performanceTargetS(draft, primary.targetTimeS);
    if (!target) return null;
    primary = { ...primary, targetTimeS: target };
  }
  if (primary.kind === 'race') {
    // Czas przyjęty w podsumowaniu (prognoza) jest już w odpowiedziach – bierzemy aktualny.
    primary = { ...primary, targetTimeS: targetTimeS(draft) ?? null, name: raceNameOf(draft) };
  }
  primary = { ...primary, focus: planFocusOf(primary) };
  const secondary = suggested.secondary.filter((g, i) => isGoalChecked(draft, i, g.checked)).map((g) => g.spec);
  return { primary, secondary };
}
