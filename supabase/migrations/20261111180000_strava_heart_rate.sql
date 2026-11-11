-- Strava: tętno w ocenie treningu. To dane o zdrowiu (art. 9 RODO) – funkcja strava-sync pobiera je i zapisuje
-- wyłącznie przy aktywnej zgodzie 'health_data'; bez zgody kolumny zostają puste, a ocena liczy się z samego tempa.
--   avg_hr / max_hr – średnie i najwyższe tętno aktywności (z listy aktywności Stravy),
--   przebieg tętna  – w pace_buckets.hr (średnie tętno w tych samych kubełkach co tempo).
-- Najwyższe max_hr z zapisanych biegów jest punktem odniesienia dla „spokojnie / za mocno”.

alter table public.strava_activities
  add column if not exists avg_hr smallint check (avg_hr between 30 and 240),
  add column if not exists max_hr smallint check (max_hr between 30 and 240);

-- Przebiegi pobrane przed tą zmianą nie mają tętna – pobieramy je jeszcze raz (najwyżej 5 biegów na synchronizację).
update public.strava_activities set pace_fetched_at = null where pace_fetched_at is not null;
