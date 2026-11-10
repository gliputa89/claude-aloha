'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import type { ActionResult } from '@/app/tester/actions';
import { connectStrava, disconnectStrava, startStravaOAuth, syncStravaNow } from '@/app/tester/strava-actions';

const button = 'rounded-button px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const secondary = `${button} border border-border-strong bg-surface hover:bg-background`;
const field = 'rounded-button border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-action';

/** Co wróciło ze Stravy w adresie (?strava=…), gdy coś poszło nie tak. */
const RETURNED: Record<string, string> = {
  cancelled: 'Anulowano na ekranie Stravy – nic się nie zmieniło.',
  no_activity_scope: 'Na ekranie Stravy odznaczono dostęp do aktywności – bez niego nie pobiorę biegów. Połącz jeszcze raz.',
  not_configured: 'Funkcja nie ma sekretów STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET.',
  athlete_limit:
    'Strava odmówiła: aplikacja ma już komplet połączonych sportowców (nowa aplikacja obsługuje jednego). Zgoda zapisała się w Stravie i zajmuje miejsce – cofnij ją w Stravie (Ustawienia → Moje aplikacje), zanim spróbujesz innym kontem.',
  rate_limited: 'Strava odmówiła z powodu limitu zapytań – spróbuj za kilkanaście minut.',
  failed: 'Strava nie przyjęła połączenia (kod wygasł albo sekrety funkcji są z innej aplikacji Stravy). Spróbuj jeszcze raz.',
};

/**
 * Łączenie ze Stravą: przez ekran zgody Stravy albo ręcznie (refresh token) – i sprawdzenie na żywo, czy
 * synchronizacja działa. `returned` to wynik powrotu ze Stravy z adresu strony.
 */
export function StravaControls({ userId, connected, returned }: { userId: string; connected: boolean; returned?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const justConnected = returned === 'connected' && connected;
  const [token, setToken] = useState('');
  const [result, setResult] = useState<ActionResult | null>(
    returned && !justConnected ? { ok: false, message: RETURNED[returned] ?? RETURNED.failed! } : null,
  );
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<'connect' | 'oauth' | 'sync' | 'disconnect' | null>(justConnected ? 'sync' : null);

  // Po powrocie ze Stravy: od razu pierwsza synchronizacja (to jest test, czy działa) i czysty adres strony.
  const handled = useRef(false);
  useEffect(() => {
    if (!returned || handled.current) return;
    handled.current = true;
    if (justConnected) start(async () => setResult(await syncStravaNow(userId)));
    router.replace(pathname, { scroll: false });
  }, [returned, justConnected, userId, router, pathname]);

  const oauth = () => {
    setBusy('oauth');
    setResult(null);
    start(async () => {
      const r = await startStravaOAuth(userId);
      if (r.ok) window.location.assign(r.url);
      else setResult(r);
    });
  };

  const run = (kind: NonNullable<typeof busy>, action: () => Promise<ActionResult>) => {
    setBusy(kind);
    setResult(null);
    start(async () => {
      const r = await action();
      setResult(r);
      if (r.ok && kind === 'connect') setToken('');
    });
  };
  const doing = (kind: typeof busy) => pending && busy === kind;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={oauth} className={`${button} bg-action text-text-on-brand hover:bg-action-hover`}>
          {doing('oauth') ? 'Otwieram Stravę…' : connected ? 'Połącz ponownie przez Stravę' : 'Połącz przez Stravę'}
        </button>
        <span className="text-xs text-text-muted">Połączy konto Stravy, na które jest zalogowana ta przeglądarka.</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-text-muted">Ręcznie: wklej refresh token</summary>
      <form
        className="flex flex-wrap items-center gap-2 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          run('connect', () => connectStrava(userId, token));
        }}
      >
        <label className="sr-only" htmlFor="strava-token">
          Refresh token Stravy
        </label>
        <input
          id="strava-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          className={`${field} min-w-0 flex-1 font-mono`}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={connected ? 'nowy refresh token (podmieni obecny)' : 'refresh token Stravy'}
          maxLength={120}
        />
        <button type="submit" disabled={pending || !token.trim()} className={secondary}>
          {doing('connect') ? 'Sprawdzam w Stravie…' : connected ? 'Podmień i sprawdź' : 'Połącz i sprawdź'}
        </button>
      </form>
      </details>

      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} className={secondary} onClick={() => run('sync', () => syncStravaNow(userId))}>
            {doing('sync') ? 'Pobieram biegi…' : 'Sprawdź teraz'}
          </button>
          <button
            type="button"
            disabled={pending}
            className={secondary}
            onClick={() => {
              if (window.confirm('Rozłączyć Stravę? Pobrane biegi zostaną usunięte, odhaczone treningi zostaną.')) {
                run('disconnect', () => disconnectStrava(userId));
              }
            }}
          >
            {doing('disconnect') ? 'Rozłączam…' : 'Rozłącz'}
          </button>
        </div>
      ) : null}

      {result ? (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-sm ${result.ok ? 'bg-surface-brand-soft text-text-brand' : 'bg-surface-accent-soft text-text-accent-strong'}`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
