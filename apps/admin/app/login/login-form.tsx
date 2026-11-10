'use client';

import { useActionState } from 'react';

import { signIn, type LoginState } from './actions';

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: initialError });
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-mail
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-button border border-border-strong bg-surface px-3 py-2.5 text-base font-normal outline-none focus:border-action"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Hasło
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-button border border-border-strong bg-surface px-3 py-2.5 text-base font-normal outline-none focus:border-action"
        />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-md bg-surface-accent-soft px-3 py-2 text-sm text-text-accent-strong">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-button bg-action px-4 py-2.5 font-semibold text-text-on-brand transition-colors hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? 'Loguję…' : 'Zaloguj'}
      </button>
    </form>
  );
}
