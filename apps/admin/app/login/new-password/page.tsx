import { NewPasswordForm } from './new-password-form';

// Cel linku „reset hasła” z maila (Supabase, przepływ implicit: tokeny w #hash adresu).
export default function NewPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-card border border-border bg-surface p-6">
        <header className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Aloha – panel</span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Nowe hasło</h1>
        </header>
        <NewPasswordForm />
      </div>
    </main>
  );
}
