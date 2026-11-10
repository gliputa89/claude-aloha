import Link from 'next/link';
import { Suspense } from 'react';

import { UserList } from '@/components/tester/user-list';
import { signOut } from '@/app/login/actions';

export default function TesterLayout({ children }: LayoutProps<'/tester'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-baseline gap-3">
          <Link href="/tester" className="font-display text-lg font-semibold tracking-tight">
            Tester planów
          </Link>
          <span className="hidden text-sm text-text-muted sm:inline">silnik reguł · generowanie tygodni</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/ai" className="text-text-muted hover:text-text">
            AI
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
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-border md:w-80 md:shrink-0 md:border-r md:border-b-0">
          <Suspense fallback={<p className="p-4 text-sm text-text-muted">Wczytuję użytkowników…</p>}>
            <UserList />
          </Suspense>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
