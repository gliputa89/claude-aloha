import type { ActivePlan } from '@/features/plan/api';
import { allSessions } from '@/features/plan/plan-provider';

/** Treningi, z których składa się ekran „Dzisiaj”. `plan: null` – jeszcze go nie ma. */
export function todaySessions(plan: ActivePlan | null, today: string) {
  const sessions = plan ? allSessions(plan) : [];
  const todays = sessions.filter((s) => s.scheduled_on === today);
  const todayRuns = todays.filter((s) => s.type !== 'rest');
  const next = sessions.find((s) => s.scheduled_on > today && s.type !== 'rest');
  // Ostatni zrobiony trening (dzisiejszy jest już wyżej) – tapnięcie otwiera jego ocenę.
  const last = sessions.filter((s) => s.scheduled_on < today && (s.status === 'done' || s.status === 'partial')).at(-1);
  return { todays, todayRuns, next, last, shown: [...todayRuns, ...(next ? [next] : [])] };
}
