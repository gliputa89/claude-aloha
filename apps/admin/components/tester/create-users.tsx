'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createTestUsers, type CreateResult } from '@/app/tester/survey-actions';

export function CreateUsersForm({ presets }: { presets: { key: string; label: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([presets[0]?.key ?? '']);
  const [withPlan, setWithPlan] = useState(true);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [pending, start] = useTransition();

  const create = (keys: string[]) =>
    start(async () => {
      const r = await createTestUsers(keys, withPlan);
      setResult(r);
      // Jedno konto → od razu do niego (żeby dopracować ankietę); kilka → zostajemy na liście.
      if (r.userIds.length === 1 && r.ok) router.push(`/tester/${r.userIds[0]}`);
    });

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1 rounded-card border border-border bg-surface p-2">
        <legend className="sr-only">Profile ankiety</legend>
        {presets.map((p) => {
          const on = selected.includes(p.key);
          return (
            <label key={p.key} className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${on ? 'bg-surface-brand-soft' : 'hover:bg-background'}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => setSelected(on ? selected.filter((k) => k !== p.key) : [...selected, p.key])}
                className="size-4 accent-action"
              />
              {p.label}
            </label>
          );
        })}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withPlan} onChange={(e) => setWithPlan(e.target.checked)} className="size-4 accent-action" />
        Od razu ułóż plan (2 tygodnie, jak po ankiecie w aplikacji)
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !selected.length}
          onClick={() => create(selected)}
          className="rounded-button bg-action px-4 py-2 text-sm font-semibold text-text-on-brand hover:bg-action-hover disabled:opacity-60"
        >
          {pending ? 'Tworzę…' : `Utwórz zaznaczone (${selected.length})`}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => create(presets.map((p) => p.key))}
          className="rounded-button border border-border-strong px-4 py-2 text-sm font-semibold hover:bg-background disabled:opacity-60"
        >
          Utwórz po jednym z każdego ({presets.length})
        </button>
      </div>

      {result ? (
        <p role="status" className={`text-sm ${result.ok ? 'text-text-brand' : 'text-text-accent-strong'}`}>
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
