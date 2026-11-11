-- Notka trenera AI na dzień bez treningu (ekran „Dzisiaj”): jedna na użytkownika i dzień.
-- Pisze ją funkcja day-note (Claude, funkcja AI 'day-note'); aplikacja tylko czyta.

create table public.day_notes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  text       text not null check (char_length(text) between 1 and 400),
  locale     text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.day_notes enable row level security;

create policy "own day notes: select" on public.day_notes
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.day_notes from anon, authenticated;
grant select on public.day_notes to authenticated;
grant all on public.day_notes to service_role;
