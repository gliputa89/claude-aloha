-- Profile trenerów: pola do prezentacji w aplikacji i na stronie www oraz publiczny odczyt.
--
--   headline         – jedno zdanie o trenerze (lista, karta na stronie),
--   specialties      – w czym pomaga (np. '5–10 km', 'powrót po przerwie'),
--   experience_years, city – krótkie fakty do profilu,
--   *_en             – wersje angielskie (strona i aplikacja są PL/EN); brak = pokazujemy polską,
--   photo_credit     – źródło zdjęcia (np. licencja banku zdjęć),
--   is_demo          – profil przykładowy (zmyślone dane i zdjęcie ze stocku) – do testów i makiet;
--                      NIE wolno pokazywać go publicznie jako prawdziwego trenera,
--   sort_order       – kolejność na listach.
-- Strona www czyta aktywnych trenerów kluczem anon (bez logowania) – tylko kolumny profilu, bez user_id.

alter table public.coaches
  add column if not exists headline         text check (char_length(headline) <= 200),
  add column if not exists specialties      text[] not null default '{}',
  add column if not exists experience_years smallint check (experience_years between 0 and 60),
  add column if not exists city             text check (char_length(city) <= 80),
  add column if not exists title_en         text check (char_length(title_en) <= 120),
  add column if not exists headline_en      text check (char_length(headline_en) <= 200),
  add column if not exists bio_en           text check (char_length(bio_en) <= 1000),
  add column if not exists specialties_en   text[] not null default '{}',
  add column if not exists photo_credit     text check (char_length(photo_credit) <= 200),
  add column if not exists is_demo          boolean not null default false,
  add column if not exists sort_order       smallint not null default 0;

create policy "coaches: public profiles" on public.coaches
  for select to anon using (active);

grant select (
  id, kind, display_name, title, bio, avatar_url, languages, active,
  headline, specialties, experience_years, city, title_en, headline_en, bio_en, specialties_en,
  photo_credit, is_demo, sort_order
) on public.coaches to anon, authenticated;
