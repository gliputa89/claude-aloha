'use client';

import { createContext, useContext, useState } from 'react';

// Układanie całego planu trwa (każdy tydzień to osobne wywołanie modelu), a stary plan jest archiwizowany
// od razu po potwierdzeniu. Serwer o tym wie, ale React trzyma poprzedni ekran do końca przejścia – dlatego
// tygodnie chowamy po stronie klienta, żeby przez ten czas nie patrzeć na plan, którego już nie ma.

const PlanRegenContext = createContext<{ busy: boolean; setBusy: (busy: boolean) => void }>({
  busy: false,
  setBusy: () => {},
});

export function PlanRegenProvider({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return <PlanRegenContext.Provider value={{ busy, setBusy }}>{children}</PlanRegenContext.Provider>;
}

export const usePlanRegen = () => useContext(PlanRegenContext);

/** Tygodnie planu – znikają na czas układania nowego. */
export function PlanWeeks({ children }: { children: React.ReactNode }) {
  const { busy } = usePlanRegen();
  return busy ? null : <>{children}</>;
}
