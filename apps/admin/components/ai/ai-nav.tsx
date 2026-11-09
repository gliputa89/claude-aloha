'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/ai', label: 'Koszty', exact: true },
  { href: '/ai/calls', label: 'Wywołania' },
  { href: '/ai/prompts', label: 'Prompty' },
  { href: '/ai/rules', label: 'Ramy planu' },
] as const;

export function AiNav() {
  const path = usePathname();
  return (
    <nav aria-label="Sekcje AI" className="flex gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const active = 'exact' in t ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-button px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
              active ? 'bg-surface-brand-soft text-text-brand' : 'text-text-muted hover:bg-background hover:text-text'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
