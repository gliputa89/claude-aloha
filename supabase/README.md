# supabase – backend jako kod

- `migrations/` – schemat bazy i RLS (jedyne źródło zmian w bazie)
- `functions/` – Edge Functions: interpretacja check-inu, plan tygodnia (Claude API), eksport/usunięcie konta
- `seed.sql` – dane testowe dla środowiska lokalnego

## Wdrażanie migracji

- **staging** – automatycznie: GitHub Actions (`.github/workflows/db-migrations.yml`) wgrywa nowe migracje po pushu/merge do głównej gałęzi.
- **produkcja** – ręcznie: GitHub → Actions → „Migracje bazy” → Run workflow → `production`.
- Jednorazowo (i po zmianie hasła bazy): `pnpm db:ci-setup` – zapisuje adresy baz z Vercel jako sekret `DB_URL` w środowiskach GitHub `staging` i `production`.
- Awaryjnie z komputera: `pnpm db:push:staging` / `pnpm db:push:prod` (dodaj `--dry-run`, żeby tylko podejrzeć).

Jeden projekt Supabase na środowisko (local / staging / prod), schematy: `public`, `marketing`, `ops`, `analytics`.
Szczegóły: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md), sekcja 3.

## Moduły i pakiety

Każda funkcja należy do modułu produktu (`plan`, `plan_ai`, `weather`, `strava`, `review`, `coach`) i na wejściu sprawdza,
czy pakiet użytkownika ma ten moduł: `_shared/modules.ts` → `userModules(db, userId)`. Lista modułów i pakietów:
`packages/plan-engine/src/core/modules.ts`; opis i tabela „moduł → funkcje → tabele”: `docs/ARCHITECTURE.md`, sekcja 2a.
W MVP każdy pakiet ma wszystkie moduły, więc bramki niczego nie blokują.

## Edge Functions planu

- `generate-plan` – pierwsze 2 tygodnie po ankiecie; ustawia poziom startowy (1–5) z ankiety.
- `generate-next-week` – kolejny tydzień + przegląd poziomu zaawansowania (awans / spadek o jeden, historia w `training_level_changes`).
  Generuje tydzień, gdy ostatni kończy się w ciągu 2 dni; drugi raz tego samego tygodnia nie dopisze.

## Edge Function pogody

- `session-weather` – pogoda do treningów z najbliższych 7 dni dla zakładki „Dzisiaj” i szczegółów treningu.
  Aplikacja podaje przybliżoną lokalizację (zaokrągloną do 0,1°), funkcja pobiera prognozę godzinową i jakość powietrza
  z Open-Meteo, reguły z `packages/plan-engine/src/weather/weather.ts` wybierają najlepsze okno i ostrzeżenia, a Claude
  (funkcja AI `weather-advice`, domyślnie Haiku) pisze 1–2 zdania porady. Wynik trafia do `public.session_weather`
  (świeży przez 3 h, dla dzisiejszego treningu 1 h); AI jest wołane tylko, gdy wynik reguł się zmienił.
- **Licencja Open-Meteo**: darmowe API jest tylko do użytku niekomercyjnego (aplikacja z subskrypcją lub reklamami to już
  użytek komercyjny) i wymaga podpisu źródła – aplikacja pokazuje „Dane pogodowe: Open-Meteo”. Przed płatnym wydaniem:
  wykup plan i ustaw `supabase secrets set OPEN_METEO_API_KEY=…` – funkcja sama przełączy się na adresy dla klientów.

## Notka na dzień bez treningu

`day-note` – ekran „Dzisiaj”, gdy dziś nie ma biegu: Claude (funkcja AI `day-note`, Haiku) pisze 1–2 zdania z kontekstu
planu (ostatni i następny trening, regularność). Jedna notka na użytkownika i dzień, zapisana w `day_notes`.
Bez klucza `ANTHROPIC_API_KEY` albo przy błędzie modelu aplikacja pokazuje tekst ze słownika.

## Strava

- `strava-sync` – pobiera biegi ze Stravy (od startu planu, najwyżej 30 dni wstecz), dopasowuje je do treningów z tego
  samego dnia (`packages/plan-engine/src/strava/strava.ts`) i zapisuje w treningu status, dystans i czas. Aplikacja woła ją po
  otwarciu i przy pociągnięciu w dół; z kluczem `service_role` (cron) synchronizuje wszystkich połączonych.
- **Konto Stravy dla Aloha**: login `gliputa+aloha@gmail.com` (hasło poza repo). Na tym koncie zakładamy aplikację API
  Aloha – osobną, żeby nie dzielić kluczy, limitów ani refresh tokenów z innymi projektami.
- Sekrety (raz na środowisko) – dane aplikacji z https://www.strava.com/settings/api:
  `supabase secrets set STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=… --project-ref <ref>`.
- Trening zrobiony w inny dzień (do 2 dni obok, podobny czas lub dystans): reguły zapisują tylko propozycję
  (`strava_activities.suggested_session_id`), aplikacja pyta „To był ten trening?” (Dzisiaj i szczegóły treningu),
  a odpowiedź idzie do `strava-sync` jako `{ answer: { activityId, accept } }`.
- Ocena treningu: dla biegów przy treningach `strava-sync` pobiera raz przebieg tempa (strumienie `time`, `distance`
  – tętno tylko przy zgodzie `health_data`; najwyżej 5 biegów na synchronizację) i zapisuje werdykt w `session_reviews`
  (reguły: `packages/plan-engine/src/review/review.ts`). Aplikacja pokazuje go w karcie „Zrobione” w szczegółach treningu.
- Notka trenera AI: do świeżych ocen (do 10 dni wstecz, najwyżej 2 na synchronizację) `strava-sync` dopisuje 2–3
  zdania od Claude (funkcja AI `workout-review`, prompt edytowany w panelu jak pozostałe; sekret `ANTHROPIC_API_KEY`).
  Model dostaje ocenę z reguł, poprzednie notki i regularność – bez danych osobowych. Bez klucza zostaje sama ocena.
- Testowanie oceny: `packages/plan-engine/src/review/review-sim.ts` generuje sztuczne biegi (idealne, trochę inne, zupełnie
  inne; z tętnem i bez) i trzyma macierz scenariuszy z oczekiwanym werdyktem – sprawdzają ją testy silnika.
  Te same scenariusze przez prawdziwy prompt notki puszcza panel: AI → „Test ocen” (nic nie zapisuje użytkownikom).
- Ręczne pobranie: Profil → Strava → „Pobierz biegi z 3 dni” wywołuje `strava-sync` z `{ manual: true }` – od razu,
  okno 3 dni, najwyżej raz na 3 godziny na użytkownika (`strava_connections.last_manual_sync_at`).
- `strava-oauth` – „Połącz przez Stravę” w aplikacji (Profil → Strava) i w panelu (tester → użytkownik → karta
  „Strava”): otwiera ekran zgody Stravy, po powrocie wymienia kod na tokeny i zapisuje połączenie; tokeny nie
  przechodzą przez telefon ani przeglądarkę. Obsługuje też rozłączenie (cofa dostęp w Stravie, usuwa pobrane biegi).
  Prosimy o zakres `activity:read_all`, żeby liczyły się też biegi ustawione jako prywatne.
- **W ustawieniach aplikacji Stravy** pole „Authorization Callback Domain” musi mieć host projektu Supabase,
  np. `<ref>.supabase.co` (bez `https://`). Strava przyjmuje jedną domenę na aplikację, więc staging i produkcja
  potrzebują osobnych aplikacji Stravy albo wspólnej własnej domeny dla funkcji.
- Konto Stravy należy do jednego użytkownika naraz – nowe połączenie zabiera je poprzedniemu (razem z jego biegami).
- Awaryjnie, bez ekranu zgody: w karcie „Strava” w panelu → „Ręcznie: wklej refresh token” (token z tej samej
  aplikacji Stravy co sekrety, z zakresem `activity:read`). Funkcja zapisuje zawsze najnowszy refresh token.
- Przed wydaniem: akceptacja aplikacji przez Stravę (nowe mają limit jednego sportowca),
  oznaczenia wymagane przez Stravę (przycisk „Connect with Strava”) oraz sprawdzenie jej zasad API
  (m.in. dane Stravy a AI – dziś biegi ze Stravy nie trafiają do Claude API).

Przed `supabase functions serve` / deployem: `scripts/sync-plan-engine.sh` (kopia `packages/plan-engine`).

### Cron dla `generate-next-week` (raz na środowisko)

Codziennie rano – funkcja sama wybiera użytkowników z terminem. W SQL Editorze projektu (staging, potem prod):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- adres projektu i klucz service_role w Vault (nie w kodzie)
select vault.create_secret('https://<projekt>.supabase.co', 'project_url');
select vault.create_secret('<service_role key>', 'service_role_key');

select cron.schedule(
  'generate-next-week',
  '0 4 * * *',  -- 04:00 UTC
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-next-week',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Ręcznie dla jednego użytkownika: tester w panelu → „Kolejny tydzień z przeglądem poziomu” (ta sama logika, bez AI).
