-- Strava: trening zrobiony w inny dzień niż w planie (np. środowy w czwartek).
-- Reguły (packages/plan-engine/strava.ts) tylko proponują parę; przypisuje ją dopiero odpowiedź biegacza.
--   suggested_session_id – trening, o który pytamy („to był ten trening?”),
--   match_confirmed      – biegacz potwierdził przypisanie (session_id zostaje mimo innej daty),
--   match_declined       – biegacz odpowiedział „nie” – drugi raz o ten bieg nie pytamy.
-- Zapis tylko przez funkcję strava-sync (service_role); aplikacja czyta (grant select na całą tabelę już jest).

alter table public.strava_activities
  add column if not exists suggested_session_id uuid references public.sessions (id) on delete set null,
  add column if not exists match_confirmed boolean not null default false,
  add column if not exists match_declined boolean not null default false;

create index if not exists strava_activities_suggested_idx
  on public.strava_activities (user_id) where suggested_session_id is not null;
