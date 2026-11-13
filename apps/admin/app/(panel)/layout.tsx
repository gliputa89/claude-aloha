import Link from 'next/link';
import { Suspense } from 'react';

import { signOut } from '@/app/login/actions';
import { PanelNav } from '@/components/nav/panel-nav';
import { requireAdmin } from '@/lib/auth';

// Powłoka całego panelu: jeden pasek nawigacji nad każdą sekcją (pulpit, tester, AI, trenerzy, opis systemu).
// Poza grupą zostaje tylko logowanie. Sekcje dokładają własne podnawigacje i własny układ treści.

export default function PanelLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-3 print:hidden">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight whitespace-nowrap">
            Aloha <span className="text-text-muted">panel</span>
          </Link>
          {/* usePathname – w Suspense, żeby nie blokować prerenderu tras dynamicznych */}
          <Suspense fallback={<div className="h-8 w-96" />}>
            <PanelNav />
          </Suspense>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Suspense fallback={null}>
            <AdminEmail />
          </Suspense>
          <form action={signOut}>
            <button type="submit" className="text-text-muted hover:text-text">
              Wyloguj
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}

async function AdminEmail() {
  const admin = await requireAdmin();
  return admin.email ? <span className="hidden truncate text-text-muted sm:inline">{admin.email}</span> : null;
}
