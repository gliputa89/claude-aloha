import { Suspense } from 'react';

import { ForecastSimulator } from '@/components/ai/forecast-simulator';
import { requireAdmin } from '@/lib/auth';

export default function ForecastTestPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję symulator…</p>}>
      <ForecastTest />
    </Suspense>
  );
}

async function ForecastTest() {
  await requireAdmin();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Symulator prognozy startu</h1>
        <p className="max-w-3xl text-sm text-text-muted">
          Jaki czas na 5 km, 10 km, półmaraton i maraton aplikacja uzna za realny dla biegacza o podanych danych. Kolumny
          „z reguł” liczą się na bieżąco: tabele Danielsa (VDOT), kilometraż potrzebny na dystans i malejąca poprawa formy.
          Przycisk puszcza te same dane przez prawdziwy prompt prognozy (Opus) – model ustala czas w widełkach z reguł.
          Nic nie zapisuje się użytkownikom, zostaje tylko log wywołań AI.
        </p>
      </div>
      <ForecastSimulator />
    </>
  );
}
