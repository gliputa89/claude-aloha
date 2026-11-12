import { goalProgress, sortGoals, type GoalProgress, type GoalRow } from '@aloha/plan-engine';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { fetchGoals, type GoalsData } from '@/features/goals/api';
import { usePlan } from '@/features/plan/plan-provider';

export type GoalsState = { kind: 'loading' } | { kind: 'ready'; data: GoalsData } | { kind: 'failed' };

type GoalsContextValue = {
  state: GoalsState;
  /** Aktywny cel prowadzący (może go chwilowo nie być – np. po zawodach, zanim biegacz wybierze następny). */
  primary: GoalRow | null;
  /** Aktywne cele obok, od najbliższej daty. */
  secondary: GoalRow[];
  progressOf: (goal: GoalRow) => GoalProgress | null;
  reload: () => Promise<void>;
  /**
   * Po zmianie celów: wczytaj je od nowa, a gdy zmiana dotyczy planu (nowy cel prowadzący, start kontrolny w już
   * ułożonym tygodniu) – ułóż plan od nowa od obecnej formy (w tle, bez czekania).
   */
  changed: (options?: { rebuildPlan?: boolean }) => Promise<void>;
};

const GoalsContext = createContext<GoalsContextValue>({
  state: { kind: 'loading' },
  primary: null,
  secondary: [],
  progressOf: () => null,
  reload: async () => {},
  changed: async () => {},
});

/** Cele biegacza, wspólne dla zakładki „Cele” i arkuszy (nowy cel, wynik). Odświeżane razem z planem. */
export function GoalsProvider({ children }: PropsWithChildren) {
  const plan = usePlan();
  const [state, setState] = useState<GoalsState>({ kind: 'loading' });

  const reload = useCallback(async () => {
    try {
      setState({ kind: 'ready', data: await fetchGoals() });
    } catch {
      setState((s) => (s.kind === 'ready' ? s : { kind: 'failed' }));
    }
  }, []);

  // Nowy stan planu (odhaczone treningi, biegi ze Stravy, nowy plan) = nowy postęp celów.
  const planRef = plan.state.kind === 'ready' ? plan.state.plan : null;
  useEffect(() => {
    // Stan zmieniamy dopiero w callbacku zapytania (bez synchronicznego setState w efekcie).
    let active = true;
    fetchGoals()
      .then((data) => active && setState({ kind: 'ready', data }))
      .catch(() => active && setState((s) => (s.kind === 'ready' ? s : { kind: 'failed' })));
    return () => {
      active = false;
    };
  }, [planRef]);

  const { generate } = plan;
  const changed = useCallback(
    async (options: { rebuildPlan?: boolean } = {}) => {
      await reload();
      // Plan układa się w tle (kilkanaście sekund z AI) – „Dzisiaj” i „Plan” pokazują wtedy ekran układania.
      if (options.rebuildPlan) void generate({ keepLevel: true });
    },
    [reload, generate],
  );

  const value = useMemo<GoalsContextValue>(() => {
    const data = state.kind === 'ready' ? state.data : null;
    const active = data?.active ?? [];
    const cache = new Map<string, GoalProgress>();
    return {
      state,
      primary: active.find((g) => g.role === 'primary') ?? null,
      secondary: sortGoals(active.filter((g) => g.role === 'secondary')),
      progressOf: (goal) => {
        if (!data) return null;
        let p = cache.get(goal.id);
        if (!p) {
          p = goalProgress(goal, data.context);
          cache.set(goal.id, p);
        }
        return p;
      },
      reload,
      changed,
    };
  }, [state, reload, changed]);

  return <GoalsContext value={value}>{children}</GoalsContext>;
}

export function useGoals() {
  return use(GoalsContext);
}
