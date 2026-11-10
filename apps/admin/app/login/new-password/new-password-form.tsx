'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const MIN_PASSWORD_LENGTH = 8;

type Status = 'checking' | 'ready' | 'invalid';

export function NewPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
      ),
    [],
  );
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Tokeny z linku (#access_token=…&refresh_token=…&type=recovery) → sesja w cookies, potem usuwamy je z adresu.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    window.history.replaceState(null, '', window.location.pathname);
    if (!accessToken || !refreshToken) {
      supabase.auth.getSession().then(({ data }) => setStatus(data.session ? 'ready' : 'invalid'));
      return;
    }
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => setStatus(sessionError ? 'invalid' : 'ready'));
  }, [supabase]);

  if (status === 'checking') return <p className="text-sm text-text-muted">Sprawdzam link…</p>;
  if (status === 'invalid') {
    return (
      <p role="alert" className="rounded-md bg-surface-accent-soft px-3 py-2 text-sm text-text-accent-strong">
        Link wygasł albo został już użyty. Poproś o nowy.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < MIN_PASSWORD_LENGTH) {
          setError(`Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);
          return;
        }
        setPending(true);
        setError(null);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setPending(false);
        if (updateError) {
          setError('Nie udało się zmienić hasła. Spróbuj jeszcze raz.');
          return;
        }
        router.replace('/tester');
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nowe hasło
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-button border border-border-strong bg-surface px-3 py-2.5 text-base font-normal outline-none focus:border-action"
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-md bg-surface-accent-soft px-3 py-2 text-sm text-text-accent-strong">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-button bg-action px-4 py-2.5 font-semibold text-text-on-brand transition-colors hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? 'Zapisuję…' : 'Ustaw hasło i wejdź'}
      </button>
    </form>
  );
}
