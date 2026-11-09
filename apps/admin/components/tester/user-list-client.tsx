'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { LEVEL_LABEL } from '@/lib/format';
import type { TesterUserRow } from '@/lib/plan-tester';

export function UserListClient({ users }: { users: TesterUserRow[] }) {
  const params = useParams<{ userId?: string }>();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.email, u.displayName, u.id].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [users, query]);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 flex flex-col gap-2 border-b border-border bg-background p-3">
        <Link
          href="/tester/new"
          className="rounded-button bg-action px-3 py-2 text-center text-sm font-semibold text-text-on-brand hover:bg-action-hover"
        >
          + Nowi użytkownicy testowi
        </Link>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Szukaj (${users.length})…`}
          aria-label="Szukaj użytkownika"
          className="w-full rounded-button border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-action"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto md:max-h-[calc(100vh-7.5rem)]">
        {filtered.map((u) => {
          const active = params.userId === u.id;
          return (
            <li key={u.id}>
              <Link
                href={`/tester/${u.id}`}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col gap-0.5 border-b border-border px-4 py-2.5 text-sm ${
                  active ? 'bg-surface-brand-soft' : 'hover:bg-surface'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate font-semibold">
                  {u.isTest ? (
                    <span className="rounded-pill bg-surface-accent-soft px-1.5 text-[10px] font-bold text-text-accent-strong">TEST</span>
                  ) : null}
                  <span className="truncate">{u.displayName || u.email || u.id}</span>
                </span>
                {u.displayName && u.email ? <span className="truncate text-text-muted">{u.email}</span> : null}
                <span className="flex gap-2 text-xs text-text-muted">
                  {u.onboardingCompletedAt ? (
                    <span>{u.level ? LEVEL_LABEL[u.level] : 'ankieta ✓'}</span>
                  ) : (
                    <span className="text-text-accent-strong">bez ankiety</span>
                  )}
                  <span>·</span>
                  <span>{u.weeks ? `${u.weeks} tyg. w planie` : 'brak planu'}</span>
                </span>
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="p-4 text-sm text-text-muted">Brak wyników.</li> : null}
      </ul>
    </div>
  );
}
