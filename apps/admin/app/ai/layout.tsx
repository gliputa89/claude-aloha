import Link from 'next/link';
import { Suspense } from 'react';

import { signOut } from '@/app/login/actions';
import { AiNav } from '@/components/ai/ai-nav';

export default function AiLayout({ children }: LayoutProps<'/ai'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/ai" className="font-display text-lg font-semibold tracking-tight">
            AI
          </Link>
          {/* usePathname w nawigacji – w Suspense, żeby nie blokować prerenderu dynamicznych tras */}
          <Suspense fallback={<div className="h-8 w-80" />}>
            <AiNav />
          </Suspense>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/tester" className="text-text-muted hover:text-text">
            Tester planów
          </Link>
          <Link href="/jak-dziala" className="text-text-muted hover:text-text">
            Jak to działa
          </Link>
          <Link href="/" className="text-text-muted hover:text-text">
            Panel
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-text-muted hover:text-text">
              Wyloguj
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
