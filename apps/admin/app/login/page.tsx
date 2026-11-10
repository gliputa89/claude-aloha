import { Suspense } from 'react';

import { LoginForm } from './login-form';

const ERRORS: Record<string, string> = {
  forbidden: 'To konto nie ma dostępu do panelu.',
};

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-card border border-border bg-surface p-6">
        <header className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Aloha – panel</span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Logowanie</h1>
        </header>
        <Suspense fallback={<LoginForm initialError={null} />}>
          <LoginWithError searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginWithError({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { error } = await searchParams;
  return <LoginForm initialError={typeof error === 'string' ? (ERRORS[error] ?? null) : null} />;
}
