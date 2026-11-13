import { Suspense } from 'react';

import { AiNav } from '@/components/ai/ai-nav';

export default function AiLayout({ children }: LayoutProps<'/ai'>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border bg-surface px-4 py-2">
        {/* usePathname w nawigacji – w Suspense, żeby nie blokować prerenderu tras dynamicznych */}
        <Suspense fallback={<div className="h-8 w-80" />}>
          <AiNav />
        </Suspense>
      </div>
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
