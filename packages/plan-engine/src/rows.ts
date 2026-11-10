// Wiersze z bazy (weeks + sessions) → tydzień silnika. Jedno miejsce dla Edge Functions i panelu.

import { addDaysIso, isoWeekday } from './dates.ts';
import type { Intensity, PlannedWeek, SessionStructure, SessionType } from './plan.ts';

export type WeekRow = {
  week_index: number;
  starts_on: string;
  focus: string | null;
  base_easy_min?: number | string | null;
  sessions: {
    scheduled_on: string;
    type: string;
    duration_min: number | null;
    distance_m: number | null;
    intensity: string | null;
    structure: unknown;
  }[];
};

/** Tydzień z bazy → tydzień silnika (do walidacji przyrostu, odstępów i generowania kolejnego tygodnia). */
export function plannedWeekFromRow(w: WeekRow): PlannedWeek {
  const base = w.base_easy_min === null || w.base_easy_min === undefined ? null : Number(w.base_easy_min);
  return {
    weekIndex: w.week_index,
    startsOn: w.starts_on,
    endsOn: addDaysIso(w.starts_on, 7 - isoWeekday(w.starts_on)),
    focus: (w.focus ?? 'build') as PlannedWeek['focus'],
    ...(base && Number.isFinite(base) ? { baseEasyMin: base } : {}),
    sessions: w.sessions
      .filter((s) => s.type !== 'rest')
      .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on))
      .map((s) => ({
        scheduledOn: s.scheduled_on,
        type: s.type as SessionType,
        durationMin: s.duration_min,
        distanceM: s.distance_m,
        intensity: (s.intensity ?? 'easy') as Intensity,
        structure: s.structure as SessionStructure,
      })),
  };
}
