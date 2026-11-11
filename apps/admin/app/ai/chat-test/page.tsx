import { AI_MODELS } from '@aloha/plan-engine';
import { Suspense } from 'react';

import { ChatTestRunner } from '@/components/ai/chat-test-runner';
import { requireAdmin } from '@/lib/auth';

export default function ChatTestPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Wczytuję…</p>}>
      <ChatTest />
    </Suspense>
  );
}

async function ChatTest() {
  await requireAdmin();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Test rozmowy z trenerem</h1>
        <p className="max-w-3xl text-sm text-text-muted">
          Kilkanaście wiadomości biegacza (pytania, prośby o zmianę planu, zdrowie, próby obejścia zasad) idzie przez prawdziwy
          prompt trenera AI (Keanu) na planie wskazanego użytkownika. Propozycje sprawdzają reguły silnika – jak w aplikacji. Nic się nie
          zapisuje: ani wiadomości, ani zmiany w planie.
        </p>
      </div>
      <ChatTestRunner models={AI_MODELS.map((m) => ({ id: m.id, label: m.label }))} />
    </>
  );
}
