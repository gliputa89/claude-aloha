-- Strava: ręczne „Pobierz biegi” z Profilu – wymusza pobranie aktywności z ostatnich 3 dni, najwyżej raz na 3 godziny.
-- Kolumna trzyma czas ostatniego takiego pobrania; limit sprawdza funkcja strava-sync, aplikacja tylko go pokazuje.

alter table public.strava_connections add column if not exists last_manual_sync_at timestamptz;

grant select (last_manual_sync_at) on public.strava_connections to authenticated;
