import { Suspense } from 'react';

import { CostSimulator } from '@/components/ai/cost-simulator';
import { getAiUnitStats } from '@/lib/ai/data';
import { requireAdmin } from '@/lib/auth';

export default function AiSimulatorPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję pomiary z wywołań…</p>}>
      <Simulator />
    </Suspense>
  );
}

async function Simulator() {
  await requireAdmin();
  const stats = await getAiUnitStats();
  return <CostSimulator data={stats} />;
}
