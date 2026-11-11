-- Pogoda do treningu (zakładka „Dzisiaj” i szczegóły treningu).
--
--   * public.session_weather – pamięć podręczna na trening: wynik reguł pogodowych (packages/plan-engine/weather.ts)
--                              i porada od AI (funkcja 'weather-advice'). Zapisuje ją Edge Function session-weather,
--                              aplikacja tylko czyta (przez funkcję; RLS pozwala też czytać własne wiersze).
--
-- Lokalizacja: zapisujemy wyłącznie współrzędne zaokrąglone do 0,1° (ok. 10 km) – tyle, ile trzeba,
-- żeby wiedzieć, czy prognoza jest dla tego samego miejsca. Dokładnej pozycji nie przechowujemy nigdzie.
-- Wiersz znika razem z treningiem albo kontem (kaskada).

create table public.session_weather (
  session_id     uuid primary key references public.sessions (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- wynik reguł: okno, ocena, warunki w oknie, ostrzeżenia, pory do unikania (typ SessionWeather)
  forecast       jsonb not null,
  -- odcisk wyniku (weatherKey): ten sam odcisk i język = ta sama porada, bez nowego wywołania AI
  forecast_key   text not null,
  advice         text check (advice is null or length(advice) between 1 and 300),
  advice_locale  text check (advice_locale in ('pl', 'en')),
  advice_key     text,
  lat_grid       numeric(4, 1) not null check (lat_grid between -90 and 90),
  lon_grid       numeric(5, 1) not null check (lon_grid between -180 and 180),
  fetched_at     timestamptz not null default now()
);

create index session_weather_user_idx on public.session_weather (user_id);

alter table public.session_weather enable row level security;

-- Czyta właściciel; zapisuje tylko service_role (Edge Function), więc brak polityk insert / update / delete.
create policy "own session weather: select" on public.session_weather
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.session_weather from anon, authenticated;
grant select on public.session_weather to authenticated;
grant all on public.session_weather to service_role;
