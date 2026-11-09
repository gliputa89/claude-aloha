import Link from 'next/link';

import { AI_STATUS_LABEL, AI_STATUS_TONE } from '@/lib/format';

// Drobne elementy wspólne dla widoków AI (bez stanu – działają w komponentach serwera i klienta).

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-text-muted">–</span>;
  return (
    <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${AI_STATUS_TONE[status] ?? 'bg-background'}`}>
      {AI_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function TestBadge() {
  return (
    <span className="rounded-pill bg-surface-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-text-accent-strong">TEST</span>
  );
}

export function Card({
  title,
  children,
  actions,
  className = '',
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-5 ${className}`}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="font-semibold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="font-display text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </div>
  );
}

export function JsonBlock({ value, maxHeight = 'max-h-[28rem]' }: { value: unknown; maxHeight?: string }) {
  return (
    <pre className={`${maxHeight} overflow-auto rounded-md bg-background p-3 text-xs leading-relaxed break-words whitespace-pre-wrap`}>
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-text-brand underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

export const inputClass =
  'rounded-button border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-action disabled:opacity-60';

export const buttonClass =
  'rounded-button px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
export const primaryButton = `${buttonClass} bg-action text-text-on-brand hover:bg-action-hover`;
export const secondaryButton = `${buttonClass} border border-border-strong hover:bg-background`;
