-- Schematy i uprawnienia bazowe (docs/ARCHITECTURE.md, sekcja 3).
--
--   public     – dane aplikacji, wystawione w API, chronione RLS
--   marketing  – lista oczekujących, polecenia, zaproszenia do bety (NIE w API)
--   ops        – administratorzy, log działań, wywołania AI, feature flags (NIE w API)
--   analytics  – widoki KPI dla panelu (NIE w API)
--
-- Schematy spoza `public` są dostępne wyłącznie dla roli `service_role`
-- (serwer Next.js, Edge Functions). `anon` i `authenticated` nie mają do nich dostępu.

create extension if not exists citext with schema extensions;

create schema if not exists marketing;
create schema if not exists ops;
create schema if not exists analytics;

do $$
declare s text;
begin
  foreach s in array array['marketing', 'ops', 'analytics'] loop
    execute format('revoke all on schema %I from public, anon, authenticated', s);
    execute format('grant usage on schema %I to service_role', s);
    execute format('alter default privileges in schema %I grant all on tables to service_role', s);
    execute format('alter default privileges in schema %I grant all on sequences to service_role', s);
    execute format('alter default privileges in schema %I grant execute on functions to service_role', s);
  end loop;
end $$;

-- Wspólny trigger aktualizujący kolumnę updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
