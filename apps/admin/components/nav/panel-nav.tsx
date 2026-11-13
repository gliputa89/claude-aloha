'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Główna nawigacja panelu – jeden pasek dla wszystkich sekcji (powłoka w app/(panel)/layout.tsx).
// Sekcje mają własne podnawigacje (zakładki AI, lista kont w testerze); tutaj jest tylko pierwszy poziom.

const SECTIONS = [
  { href: '/', label: 'Pulpit', exact: true },
  { href: '/tester', label: 'Tester planów' },
  { href: '/ai', label: 'AI' },
  { href: '/coaches', label: 'Trenerzy' },
  { href: '/jak-dziala', label: 'Jak to działa' },
] as const;

export function PanelNav() {
  const path = usePathname();
  return (
    <nav aria-label="Sekcje panelu" className="flex min-w-0 gap-1 overflow-x-auto">
      {SECTIONS.map((s) => {
        const active = 'exact' in s ? path === s.href : path.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-button px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
              active ? 'bg-surface-brand-soft text-text-brand' : 'text-text-muted hover:bg-background hover:text-text'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
