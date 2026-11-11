-- Rozmowa z trenerem: czat z trenerem AI („Pan Aloha”, moduł coach_chat) i z prawdziwym trenerem (moduł coach_human).
--
--   coaches           – trenerzy: jeden AI i dowolnie wielu ludzi (profil widoczny dla biegaczy),
--   coach_assignments – który trener-człowiek prowadzi biegacza (przydzielany przy pierwszej rozmowie),
--   chat_threads      – wątek biegacz ↔ trener: ogólny (session_id null) albo przy konkretnym treningu
--                       (pytania przed i po),
--   chat_messages     – wiadomości; odpowiedź trenera może nieść propozycję zmiany planu (proposal),
--                       którą biegacz akceptuje albo zostawia plan bez zmian.
-- Pisze tylko funkcja coach-chat i panel (service_role): tam są bramki pakietów, limit wiadomości i walidacja
-- propozycji regułami silnika. Biegacz czyta swoje wątki, trener-człowiek – wątki, w których jest trenerem.
-- Treść rozmów może dotyczyć zdrowia – znika razem z kontem (kaskada) i nie trafia do analityki.

create table public.coaches (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('ai', 'human')),
  -- konto trenera-człowieka (do czytania swoich wątków); AI go nie ma
  user_id      uuid unique references auth.users (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  title        text check (char_length(title) <= 120),
  bio          text check (char_length(bio) <= 1000),
  avatar_url   text check (char_length(avatar_url) <= 500),
  languages    text[] not null default '{pl}',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Dokładnie jeden trener AI.
create unique index coaches_one_ai_idx on public.coaches (kind) where kind = 'ai';

create trigger coaches_updated_at
  before update on public.coaches
  for each row execute function public.set_updated_at();

insert into public.coaches (kind, display_name, title, bio, languages)
values (
  'ai',
  'Pan Aloha',
  'Trener AI',
  'Zna Twój plan i ostatnie treningi. Odpowie od razu, o każdej porze – a gdy trzeba, zaproponuje zmianę w planie.',
  '{pl,en}'
);

create table public.coach_assignments (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  coach_id   uuid not null references public.coaches (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index coach_assignments_coach_idx on public.coach_assignments (coach_id);

create table public.chat_threads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  coach_id        uuid not null references public.coaches (id) on delete cascade,
  -- null = rozmowa ogólna; inaczej wątek przy treningu
  session_id      uuid references public.sessions (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  unique nulls not distinct (user_id, coach_id, session_id)
);

create index chat_threads_coach_idx on public.chat_threads (coach_id, last_message_at desc);

create table public.chat_messages (
  id              bigint generated always as identity primary key,
  thread_id       uuid not null references public.chat_threads (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  sender          text not null check (sender in ('user', 'coach')),
  body            text not null check (char_length(body) between 1 and 4000),
  -- propozycja zmiany planu od trenera: { op, date, toDate, type, durationMin, summary }
  proposal        jsonb,
  proposal_status text check (proposal_status in ('pending', 'accepted', 'declined', 'expired')),
  ai_call_id      bigint,
  created_at      timestamptz not null default now(),
  check ((proposal is null) = (proposal_status is null))
);

create index chat_messages_thread_idx on public.chat_messages (thread_id, id);
create index chat_messages_user_day_idx on public.chat_messages (user_id, created_at) where sender = 'user';

alter table public.coaches           enable row level security;
alter table public.coach_assignments enable row level security;
alter table public.chat_threads      enable row level security;
alter table public.chat_messages     enable row level security;

create policy "coaches: active visible" on public.coaches
  for select to authenticated using (active);

create policy "own coach assignment: select" on public.coach_assignments
  for select to authenticated using (user_id = (select auth.uid()));

-- Czy zalogowany użytkownik jest tym trenerem. Security definer: kolumna coaches.user_id nie jest wystawiona biegaczom.
create or replace function public.coach_is_me(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.coaches c where c.id = p_coach_id and c.user_id = (select auth.uid()));
$$;

revoke all on function public.coach_is_me(uuid) from public, anon;
grant execute on function public.coach_is_me(uuid) to authenticated, service_role;

create policy "chat threads: runner or coach" on public.chat_threads
  for select to authenticated using (user_id = (select auth.uid()) or public.coach_is_me(coach_id));

create policy "chat messages: runner or coach" on public.chat_messages
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.chat_threads t where t.id = thread_id and public.coach_is_me(t.coach_id))
  );

revoke all on public.coaches, public.coach_assignments, public.chat_threads, public.chat_messages from anon, authenticated;
-- Bez user_id trenera: biegacz widzi profil, nie konto.
grant select (id, kind, display_name, title, bio, avatar_url, languages, active) on public.coaches to authenticated;
grant select on public.coach_assignments, public.chat_threads, public.chat_messages to authenticated;
grant all on public.coaches, public.coach_assignments, public.chat_threads, public.chat_messages to service_role;
