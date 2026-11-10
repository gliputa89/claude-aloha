import 'server-only';

// Zmienne ustawia integracja Supabase w Vercel (lokalnie: `vercel env pull apps/admin/.env.local`).
function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Brak zmiennej środowiskowej ${name} – patrz apps/admin/.env.example`);
  return value;
}

export const supabaseUrl = () => required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
export const supabaseAnonKey = () =>
  required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
export const serviceRoleKey = () => required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
