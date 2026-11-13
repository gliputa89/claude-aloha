import { Suspense } from 'react';

import { UserList } from '@/components/tester/user-list';

export default function TesterLayout({ children }: LayoutProps<'/tester'>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="border-b border-border md:w-80 md:shrink-0 md:border-r md:border-b-0">
        <Suspense fallback={<p className="p-4 text-sm text-text-muted">Wczytuję użytkowników…</p>}>
          <UserList />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
