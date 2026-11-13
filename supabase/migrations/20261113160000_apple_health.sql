-- Apple Zdrowie: biegi z HealthKit (np. z Apple Watch) odhaczają treningi tak samo jak biegi ze Stravy.
--
--   * public.health_connections – biegacz włączył pobieranie biegów z Apple Zdrowie (zgodę na odczyt daje iOS,
--                                 ale aplikacja nie może jej sprawdzić – dlatego trzymamy własny znacznik).
--                                 Wiersz wstawia i usuwa sam biegacz; czas synchronizacji zapisuje funkcja health-sync.
--   * public.strava_activities  – wspólna tabela biegów ze wszystkich źródeł: `source` = 'strava' | 'apple_health'.
--                                 Biegi z Apple Zdrowie mają `external_id` (UUID treningu w HealthKit) i ujemne `id`
--                                 z osobnej sekwencji, żeby nie zderzały się z identyfikatorami Stravy.
--                                 Dopasowanie, ocena i notka trenera działają bez zmian (funkcje strava-sync, health-sync).
-- Tętno z Apple Zdrowie zapisujemy tylko przy zgodzie 'health_data' – tak jak ze Stravy.

alter table public.strava_activities
  add column if not exists source text not null default 'strava' check (source in ('strava', 'apple_health')),
  add column if not exists external_id text check (char_length(external_id) <= 64);

alter table public.strava_activities
  add constraint strava_activities_source_external_key unique (user_id, source, external_id);

create sequence if not exists public.health_activity_id_seq
  as bigint increment by -1 minvalue -9223372036854775807 maxvalue -1 start with -1;

-- Strava zawsze podaje własne id; domyślne (ujemne) dostają tylko biegi z Apple Zdrowie.
alter table public.strava_activities alter column id set default nextval('public.health_activity_id_seq');
grant usage on sequence public.health_activity_id_seq to service_role;

create table public.health_connections (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  source         text not null default 'apple_health' check (source in ('apple_health')),
  connected_at   timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error     text
);

alter table public.health_connections enable row level security;

create policy "own health connection: select" on public.health_connections
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own health connection: insert" on public.health_connections
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own health connection: delete" on public.health_connections
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.health_connections from anon, authenticated;
grant select, delete on public.health_connections to authenticated;
-- Biegacz wstawia tylko sam znacznik połączenia – czasy synchronizacji ustawia funkcja.
grant insert (user_id, source) on public.health_connections to authenticated;
grant all on public.health_connections to service_role;
