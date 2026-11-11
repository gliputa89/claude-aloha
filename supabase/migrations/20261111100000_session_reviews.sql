-- Porównanie wykonanego biegu z planem i werdykt (reguły: packages/plan-engine/review.ts; liczy funkcja strava-sync).
--
-- strava_activities.pace_buckets – przebieg tempa: metry w kolejnych kubełkach czasu ({ bucketS, m: [...] }),
--   policzone raz ze strumieni Stravy (time, distance). Bez tętna. pace_fetched_at – kiedy pytaliśmy Stravę
--   (także gdy aktywność nie ma przebiegu, np. wpisana ręcznie – żeby nie pytać w kółko).
-- session_reviews – ocena treningu: werdykt słowny, dwie osie i nazwane obserwacje z liczbami,
--   notka trenera AI (note; note_key = ocena, do której powstała) i seen_at – kiedy biegacz pierwszy raz
--   otworzył ocenę (animacja świętowania gra tylko raz). Aplikacja może zmienić wyłącznie seen_at.

alter table public.strava_activities
  add column if not exists pace_buckets jsonb,
  add column if not exists pace_fetched_at timestamptz;

create table public.session_reviews (
  session_id     uuid primary key references public.sessions (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  verdict        text not null check (verdict in ('spot_on', 'good', 'passed_but', 'different')),
  volume         text not null check (volume in ('low', 'ok', 'high')),
  intensity      text check (intensity in ('low', 'ok', 'high')),
  facts          jsonb not null default '[]'::jsonb,
  engine_version smallint not null,
  note           text check (char_length(note) <= 600),
  note_key       text,
  seen_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index session_reviews_user_idx on public.session_reviews (user_id);

create trigger session_reviews_updated_at
  before update on public.session_reviews
  for each row execute function public.set_updated_at();

alter table public.session_reviews enable row level security;

create policy "own session reviews: select" on public.session_reviews
  for select to authenticated using (user_id = (select auth.uid()));

create policy "own session reviews: mark seen" on public.session_reviews
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.session_reviews from anon, authenticated;
grant select on public.session_reviews to authenticated;
grant update (seen_at) on public.session_reviews to authenticated;
grant all on public.session_reviews to service_role;
