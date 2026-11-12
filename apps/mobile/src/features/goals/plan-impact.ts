import type { GoalRow, GoalSpec } from '@aloha/plan-engine';

/**
 * Czy cel obok zmienia już ułożone tygodnie planu: start B albo sprawdzian z datą do końca planu.
 * Wtedy po dodaniu / usunięciu celu plan układa się od nowa; późniejsze tygodnie uwzględnią go same.
 */
export function touchesPlan(goal: { kind: GoalRow['kind']; priority: GoalRow['priority'] | null; date: string | null }, planEndsOn: string | null) {
  if (!goal.date || !planEndsOn || goal.date > planEndsOn) return false;
  return (goal.kind === 'race' && goal.priority === 'B') || goal.kind === 'performance';
}

export const touchesPlanRow = (g: GoalRow, planEndsOn: string | null) =>
  touchesPlan({ kind: g.kind, priority: g.priority, date: g.kind === 'race' ? g.race_date : g.due_on }, planEndsOn);

export const touchesPlanSpec = (s: GoalSpec, planEndsOn: string | null) =>
  touchesPlan({ kind: s.kind, priority: s.kind === 'race' ? (s.priority ?? 'B') : null, date: s.date ?? null }, planEndsOn);
