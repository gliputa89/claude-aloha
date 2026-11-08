-- Schemat public: dane aplikacji mobilnej (docs/PROJECT.md, „Wstępny model danych”).
--
-- Zasady:
--   * RLS na każdej tabeli – użytkownik widzi i zmienia tylko swoje wiersze.
--   * Plan, tygodnie i treningi generuje backend (Edge Functions, service_role);
--     użytkownik może je tylko czytać i odhaczać realizację.
--   * Check-in (dane o zdrowiu, art. 9 RODO) można zapisać tylko z aktywną zgodą 'health_data'.
--   * Usunięcie konta (auth.users) usuwa kaskadowo wszystkie dane z tego schematu.

-- ───────────────────────── profil ─────────────────────────

create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  display_name             text check (char_length(display_name) <= 80),
  locale                   text not null default 'pl' check (locale in ('pl', 'en')),
  timezone                 text not null default 'Europe/Warsaw',
  -- pora powiadomienia z check-inem w dni treningowe (czas lokalny użytkownika)
  checkin_time             time not null default '07:30',
  level                    text check (level in ('beginner', 'intermediate', 'advanced')),
  -- ostatni wynik, np. 10 km w 52:30 → 10000 / 3150
  recent_result_distance_m integer check (recent_result_distance_m > 0),
  recent_result_time_s     integer check (recent_result_time_s > 0),
  weekly_km                numeric(5, 1) check (weekly_km >= 0),
  -- odpowiedź z ankiety: zgłoszone przeciwwskazania → zalecenie konsultacji
  has_contraindications    boolean,
  adult_confirmed_at       timestamptz,   -- deklaracja 18+
  onboarding_completed_at  timestamptz,
  -- w MVP zawsze 'free' (pełny dostęp); paywall po MVP
  subscription_status      text not null default 'free' check (subscription_status in ('free', 'trial', 'paid')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profil zakładany automatycznie przy rejestracji.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, locale)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'pl' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── zgody ─────────────────────────
-- Dziennik zgód (tylko dopisywanie). Aktualny stan = ostatni wpis danego rodzaju.

create table public.consents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('terms', 'privacy', 'health_data', 'marketing')),
  granted     boolean not null,
  -- wersja dokumentu / treści zgody, np. '2026-11-pl'
  version     text not null,
  created_at  timestamptz not null default now()
);

create index consents_user_kind_idx on public.consents (user_id, kind, created_at desc);

create or replace function public.has_consent(uid uuid, consent_kind text)
returns boolean
language sql
stable
-- security invoker: RLS na consents sprawia, że użytkownik sprawdzi tylko własne zgody
set search_path = ''
as $$
  select coalesce((
    select c.granted
    from public.consents c
    where c.user_id = uid and c.kind = consent_kind
    order by c.created_at desc, c.id desc
    limit 1
  ), false);
$$;

-- ───────────────────────── cel i dostępność ─────────────────────────

create table public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  type           text not null check (type in ('general', 'race')),
  distance_m     integer check (distance_m > 0),
  race_date      date,
  target_time_s  integer check (target_time_s > 0),
  status         text not null default 'active' check (status in ('active', 'achieved', 'abandoned')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint race_goal_has_distance check (type <> 'race' or distance_m is not null)
);

-- najwyżej jeden aktywny cel na użytkownika
create unique index goals_one_active_idx on public.goals (user_id) where status = 'active';

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create table public.availability (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  -- preferowane dni treningowe, ISO: 1 = poniedziałek … 7 = niedziela
  preferred_days       smallint[] not null default '{}'
                         check (preferred_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  max_minutes_weekday  smallint check (max_minutes_weekday between 10 and 300),
  max_minutes_weekend  smallint check (max_minutes_weekend between 10 and 300),
  sessions_per_week    smallint not null default 3 check (sessions_per_week between 1 and 7),
  updated_at           timestamptz not null default now()
);

create trigger availability_updated_at
  before update on public.availability
  for each row execute function public.set_updated_at();

-- ───────────────────────── plan → tydzień → trening ─────────────────────────

create table public.plans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  goal_id          uuid references public.goals (id) on delete set null,
  status           text not null default 'active' check (status in ('active', 'archived')),
  starts_on        date not null,
  ends_on          date,
  -- wersja reguł z packages/plan-engine, którą wygenerowano plan
  engine_version   text,
  created_at       timestamptz not null default now()
);

create unique index plans_one_active_idx on public.plans (user_id) where status = 'active';

create table public.weeks (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  week_index  smallint not null check (week_index >= 0),
  starts_on   date not null,
  focus       text,               -- np. 'base', 'build', 'taper', 'recovery'
  created_at  timestamptz not null default now(),

  unique (plan_id, week_index)
);

create index weeks_user_idx on public.weeks (user_id, starts_on);

create table public.sessions (
  id                 uuid primary key default gen_random_uuid(),
  week_id            uuid not null references public.weeks (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  scheduled_on       date not null,
  type               text not null
                       check (type in ('easy', 'long', 'intervals', 'tempo', 'recovery', 'race', 'rest')),
  duration_min       smallint check (duration_min > 0),
  distance_m         integer check (distance_m > 0),
  intensity          text check (intensity in ('easy', 'moderate', 'hard')),
  -- szczegóły jednostki (rozgrzewka, powtórzenia, przerwy) – struktura z plan-engine
  structure          jsonb not null default '{}'::jsonb,
  status             text not null default 'planned'
                       check (status in ('planned', 'done', 'partial', 'missed')),
  rating             smallint check (rating between 1 and 5),
  actual_distance_m  integer check (actual_distance_m > 0),
  actual_duration_s  integer check (actual_duration_s > 0),
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index sessions_user_date_idx on public.sessions (user_id, scheduled_on);
create index sessions_week_idx on public.sessions (week_id);

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- Użytkownik może zmienić tylko pola realizacji treningu; resztę zmienia backend.
create or replace function public.sessions_guard_user_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and (
       new.week_id      is distinct from old.week_id
    or new.user_id      is distinct from old.user_id
    or new.scheduled_on is distinct from old.scheduled_on
    or new.type         is distinct from old.type
    or new.duration_min is distinct from old.duration_min
    or new.distance_m   is distinct from old.distance_m
    or new.intensity    is distinct from old.intensity
    or new.structure    is distinct from old.structure
  ) then
    raise exception 'Only completion fields of a session can be changed by the user'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger sessions_guard_user_update
  before update on public.sessions
  for each row execute function public.sessions_guard_user_update();

-- ───────────────────────── check-in i zmiany planu ─────────────────────────

create table public.check_ins (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  session_id            uuid references public.sessions (id) on delete set null,
  day                   date not null,
  -- „Pomiń” = trening wg planu, bez danych o samopoczuciu
  skipped               boolean not null default false,
  wellbeing             smallint check (wellbeing between 1 and 5),
  note                  text check (char_length(note) <= 1000),
  tags                  text[] not null default '{}',
  -- pola wyciągnięte przez AI z notatki i podpowiedzi
  ai_available_minutes  smallint check (ai_available_minutes >= 0),
  ai_sleep              smallint check (ai_sleep between 1 and 5),
  ai_stress             smallint check (ai_stress between 1 and 5),
  ai_pain               boolean,
  ai_red_flag           boolean not null default false,
  created_at            timestamptz not null default now(),

  unique (user_id, day),
  constraint skipped_has_no_data check (not skipped or (wellbeing is null and note is null))
);

create table public.adjustments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  check_in_id  uuid references public.check_ins (id) on delete set null,
  -- skala zmian 0–4 (PROJECT.md 4.5)
  level        smallint not null check (level between 0 and 4),
  -- co było zaplanowane → co proponujemy (historia zmian)
  diff         jsonb not null default '{}'::jsonb,
  rationale    text not null,
  source       text not null check (source in ('ai', 'rules')),
  status       text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index adjustments_user_idx on public.adjustments (user_id, created_at desc);

-- Użytkownik może tylko zaakceptować / odrzucić propozycję.
create or replace function public.adjustments_guard_user_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if new.user_id     is distinct from old.user_id
    or new.check_in_id is distinct from old.check_in_id
    or new.level       is distinct from old.level
    or new.diff        is distinct from old.diff
    or new.rationale   is distinct from old.rationale
    or new.source      is distinct from old.source
    or old.status <> 'proposed'
    or new.status not in ('accepted', 'rejected') then
      raise exception 'Only a pending proposal can be accepted or rejected'
        using errcode = '42501';
    end if;
    new.decided_at = now();
  end if;
  return new;
end;
$$;

create trigger adjustments_guard_user_update
  before update on public.adjustments
  for each row execute function public.adjustments_guard_user_update();

-- ───────────────────────── RLS ─────────────────────────

alter table public.profiles     enable row level security;
alter table public.consents     enable row level security;
alter table public.goals        enable row level security;
alter table public.availability enable row level security;
alter table public.plans        enable row level security;
alter table public.weeks        enable row level security;
alter table public.sessions     enable row level security;
alter table public.check_ins    enable row level security;
alter table public.adjustments  enable row level security;

-- profil: odczyt i edycja własnego (zakłada go trigger)
create policy "own profile: select" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- zgody: odczyt i dopisywanie (bez edycji i usuwania – to dziennik)
create policy "own consents: select" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own consents: insert" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

-- cel i dostępność: pełna obsługa własnych wierszy
create policy "own goals: all" on public.goals
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own availability: all" on public.availability
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- plan i tygodnie: tylko odczyt (generuje backend)
create policy "own plans: select" on public.plans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own weeks: select" on public.weeks
  for select to authenticated using (user_id = (select auth.uid()));

-- treningi: odczyt + odhaczanie realizacji (pilnuje trigger)
create policy "own sessions: select" on public.sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own sessions: update" on public.sessions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- check-in: wymaga aktywnej zgody na przetwarzanie danych o zdrowiu
create policy "own check-ins: select" on public.check_ins
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own check-ins: insert with health consent" on public.check_ins
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (skipped or public.has_consent((select auth.uid()), 'health_data'))
  );
create policy "own check-ins: update with health consent" on public.check_ins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (skipped or public.has_consent((select auth.uid()), 'health_data'))
  );
create policy "own check-ins: delete" on public.check_ins
  for delete to authenticated using (user_id = (select auth.uid()));

-- propozycje zmian: odczyt + akceptacja / odrzucenie (pilnuje trigger)
create policy "own adjustments: select" on public.adjustments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own adjustments: update" on public.adjustments
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Bez dostępu dla niezalogowanych (anon) do danych aplikacji.
revoke all on all tables in schema public from anon;
revoke execute on function public.has_consent(uuid, text) from public, anon;
grant execute on function public.has_consent(uuid, text) to authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
