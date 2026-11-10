-- Strava: połączenie konta i zaimportowane biegi (realizacja treningów z planu).
--
--   * public.strava_connections – jedno konto Stravy na użytkownika, z tokenami. Tokeny czyta i zapisuje wyłącznie
--                                 service_role (Edge Function strava-sync). Aplikacja widzi tylko kolumny stanu
--                                 (uprawnienia na kolumnach) – tokenów nie da się odczytać z telefonu.
--   * public.strava_activities  – biegi pobrane ze Stravy; session_id wskazuje trening z planu z tego samego dnia
--                                 (null – bieg poza planem). Zapisuje Edge Function, aplikacja tylko czyta własne.
--
-- Na razie wiersz połączenia wstawiamy ręcznie (supabase/README.md, „Strava”); logowanie do Stravy z aplikacji – później.
-- Tętna nie pobieramy (dane o zdrowiu wymagałyby zgody 'health_data'). Wszystko znika razem z kontem (kaskada).

create table public.strava_connections (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  athlete_id               bigint not null unique,
  athlete_name             text check (char_length(athlete_name) <= 120),
  refresh_token            text not null,
  access_token             text,
  access_token_expires_at  timestamptz,
  scope                    text,
  last_synced_at           timestamptz,
  -- 'reauthorize' – Strava odrzuciła token (dostęp cofnięty albo token nieaktualny)
  last_error               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger strava_connections_updated_at
  before update on public.strava_connections
  for each row execute function public.set_updated_at();

create table public.strava_activities (
  -- id aktywności w Stravie
  id               bigint primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  session_id       uuid references public.sessions (id) on delete set null,
  sport_type       text not null,
  name             text check (char_length(name) <= 300),
  started_at       timestamptz not null,
  -- dzień w czasie lokalnym biegacza (start_date_local) – po nim dopasowujemy do treningu
  local_date       date not null,
  distance_m       integer not null check (distance_m >= 0),
  moving_time_s    integer not null check (moving_time_s >= 0),
  elapsed_time_s   integer not null check (elapsed_time_s >= 0),
  elevation_gain_m integer,
  created_at       timestamptz not null default now()
);

create index strava_activities_user_idx on public.strava_activities (user_id, started_at desc);
create index strava_activities_session_idx on public.strava_activities (session_id);

alter table public.strava_connections enable row level security;
alter table public.strava_activities  enable row level security;

create policy "own strava connection: select" on public.strava_connections
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own strava activities: select" on public.strava_activities
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.strava_connections, public.strava_activities from anon, authenticated;
-- Bez kolumn z tokenami: zapytanie o nie z aplikacji kończy się błędem uprawnień.
grant select (user_id, athlete_id, athlete_name, last_synced_at, last_error, created_at)
  on public.strava_connections to authenticated;
grant select on public.strava_activities to authenticated;
grant all on public.strava_connections, public.strava_activities to service_role;
