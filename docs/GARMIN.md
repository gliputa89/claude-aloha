# Aloha Training – integracja z Garmin

*Wersja 0.1 · 13 listopada 2026 · dokument roboczy*

Stan programu Garmin Connect Developer po zmianach z października 2026 i plan, jak podpiąć Garmina do Aloha.
Powiązane: [`ARCHITECTURE.md`](ARCHITECTURE.md) (moduły `strava` i `health`), [`BUSINESS.md`](BUSINESS.md) (Garmin Coach jako konkurencja).

> **Uwaga o źródłach.** Garmin publicznie opisuje tylko poziomy dostępu i listę API. Dokumentacja techniczna
> (endpointy, schematy, limity) jest dostępna dopiero po zatwierdzeniu w Developer Portal. Ceny i limity
> poniżej pochodzą z prasy branżowej i od firm integrujących Garmina (DC Rainmaker, Sahha, Open Wearables, Terra) –
> trzeba je potwierdzić u Garmina na piśmie.

---

## 1. Co się zmieniło (2026)

| Data | Zdarzenie |
|---|---|
| marzec 2026 | Garmin po cichu zamyka program dla nowych firm (zalew wniosków, dużo „aplikacji AI”). Nowa umowa deweloperska Rev. B. |
| 6 października 2026 | Z plików FIT wysyłanych do aplikacji zewnętrznych znikają m.in. VO2max, czas regeneracji, performance condition. |
| **21 października 2026** | **Program otwarty ponownie, z trzema poziomami dostępu: Personal, Starter, Enterprise.** |
| 1 kwietnia 2027 | Dotychczasowi partnerzy (przeniesieni do Enterprise) zaczynają płacić za aktywnego użytkownika. |

## 2. Poziomy dostępu

| | **Personal** | **Starter** (firmy) | **Enterprise** (firmy) |
|---|---|---|---|
| Dla kogo | jedna osoba, własne dane | firmy budujące integrację | firmy na dużą skalę |
| Jak dostać | klucz w Garmin Connect, bez wniosku | formularz wniosku | prośba w Developer Portal (po Starterze) |
| API | Activity, Health, Women's Health (tylko odczyt) | **Activity, Health, Women's Health, Training, Courses** | jak Starter + Golf |
| Dostarczanie danych | tylko pull | **tylko push (webhook)** | push albo ping/pull |
| Dane historyczne | – | **brak** (tylko od chwili połączenia) | 1 miesiąc i więcej (backfill) |
| Liczba użytkowników | własne konto | **ograniczona, wg prasy ok. 1000** | bez limitu |
| Wsparcie techniczne | nie | nie | tak |
| Koszt | 0 | **0** | 1000 USD opłaty wstępnej (zaliczanej na poczet faktur) + opłata miesięczna za aktywnego użytkownika, stawka negocjowana |

Dodatkowo przy Starterze:
- Aplikacja ma etykietę **„unverified”**, dopóki Garmin jej nie sprawdzi; w tym czasie liczba nowych połączeń może być ograniczona.
- Wymagana **publiczna strona www i opublikowana polityka prywatności** (mamy: `apps/web`, `/legal`).
- We wniosku trzeba wymienić **wszystkie podmioty przetwarzające dane** (u nas: Supabase, Anthropic, Vercel, ewentualnie dostawca e-maili).
- Personal **nie nadaje się dla nas** – Garmin wprost zastrzega, że nie jest dla aplikacji obsługujących innych ludzi, i nie ma Training API.

**Wniosek: składamy wniosek o Starter.** Jest darmowy i ma wszystko, czego potrzebujemy, włącznie z Training API.
Enterprise dopiero wtedy, gdy zbliżymy się do limitu użytkowników albo bardzo będziemy potrzebować historii przy onboardingu.

## 3. Co daje każde API – z perspektywy Aloha

| API | Kierunek | Co daje | Do czego u nas |
|---|---|---|---|
| **Training API** | Aloha → Garmin | publikuje treningi strukturalne (kroki, cele tempa i tętna) i harmonogram do kalendarza Garmin Connect; zegarek pobiera je przy synchronizacji | **najważniejsze**: odpowiednik „Wyślij na Apple Watch” dla Garmina – biegacz widzi trening Aloha na zegarku i biegnie z prowadzeniem krok po kroku |
| **Activity API** | Garmin → Aloha | podsumowania aktywności (JSON) i pliki FIT/GPX/TCX; okrążenia, próbki, tętno, kadencja, dynamika biegu | odhaczanie treningów i ocena biegu (`review`) bez pośrednictwa Stravy, z dokładniejszymi danymi (okrążenia → ocena interwałów) |
| **Health API** | Garmin → Aloha | dzienne podsumowania: sen, HRV, tętno spoczynkowe, stres, Body Battery, kroki, VO2max (jako osobne pole) | podpowiedź do porannego check-inu („spałeś 5 h, HRV niżej niż zwykle – lżej dziś?”) – pasuje do naszego pozycjonowania „gorszego dnia” |
| Women's Health API | Garmin → Aloha | cykl miesiączkowy, ciąża | na później, wymaga osobnej decyzji produktowej i zgód |
| Courses API | Aloha → Garmin | trasy z punktami na zegarek | nie teraz |

Techniczne szczegóły znane z publicznych źródeł (do potwierdzenia w dokumentacji po zatwierdzeniu):
- **Logowanie: OAuth 2.0** (wg integratorów z PKCE). Klient dostaje własne `client_id` i `client_secret`.
- **Webhook push**: jeden adres na wszystkie typy danych; trzeba szybko odpowiedzieć 200 i przetwarzać asynchronicznie.
  Garmin ponawia wysyłkę przy błędzie, więc zapis musi być idempotentny (upsert po ID aktywności).
- **Dane przychodzą dopiero po synchronizacji zegarka** z Garmin Connect (zwykle przez telefon biegacza).
- Limit zapytań wg integratorów: ok. 100/min.
- Środowisko testowe Health API generuje sztuczne dane; do prawdziwych danych potrzebny fizyczny zegarek Garmin.
- **Training API nie ma sygnału „trening wykonany”** i aktywność nie niesie ID zaplanowanego treningu. Dopasowanie robimy
  sami: po użytkowniku, dacie i sporcie (to już robi `matchStravaActivities`) plus nasz znacznik w nazwie treningu.
- Zmiana treści treningu = usunięcie i utworzenie od nowa; przesunięcie na inny dzień = nowy harmonogram.
  Usuwanie wymaga pary `workoutId` + `scheduleId`. Treningi są związane z połączeniem, które je utworzyło – po
  ponownym połączeniu konta stare ID już nie działają, więc trzeba je sprzątać przy rozłączaniu.

## 4. Warunki umowy, które nas dotyczą

| Punkt umowy (Rev. B) | Co mówi | Co to znaczy dla nas |
|---|---|---|
| **15.10 – AI** | przetwarzanie danych użytkownika przez AI wymaga **wyraźnego oświadczenia o AI** i **osobnej, wycofywalnej zgody** użytkownika; nie wolno trenować własnych modeli na danych z Garmina | notki trenera, ocena biegu i czat (Claude) mogą korzystać z danych z Garmina tylko po osobnej zgodzie. Potrzebny ekran zgody przy łączeniu konta + tekst w polityce prywatności. Bez zgody: odhaczanie z reguł działa, AI pomija dane z Garmina |
| 5.2(o) – podmioty trzecie | każdy podmiot w łańcuchu przetwarzania musi być zgłoszony; nie wolno udostępniać danych dalej | wymienić Supabase, Anthropic, Vercel we wniosku; nie budować na Garminie własnego API dla partnerów |
| 5.2(e) – dochód | nie wolno sprzedawać dostępu do API ani zarabiać na samym API bez zgody Garmina | płatna subskrypcja Aloha jest w porządku (sprzedajemy plan, nie dane), ale warto to potwierdzić przy wniosku |
| 6.4 – oznaczenie źródła | każde wyświetlenie danych z Garmina (także wyliczonych z nich ocen) wymaga oznaczenia wg wytycznych marki Garmin | znaczek/nazwa „Garmin” przy biegu i ocenie, analogicznie do „Zobacz w Stravie” |
| 9.2 – wypowiedzenie | Garmin może zakończyć umowę z 30-dniowym wyprzedzeniem | Garmin nie może być jedyną drogą danych – Apple Zdrowie / Health Connect / Strava zostają jako zapas |

> Przy okazji: Sahha zestawia te zasady z umową Stravy, która ma **jeszcze ostrzejsze** zasady co do AI.
> Nasze notki trenera korzystają dziś z danych ze Stravy – warto osobno sprawdzić umowę Stravy pod tym kątem.

## 5. Co działa już dziś, bez API Garmina

Garmin Connect potrafi zapisywać treningi do **Apple Zdrowie** (i do Health Connect na Androidzie), jeśli biegacz włączy to
w Garmin Connect → Połączone aplikacje. Nasz moduł `health` (`modules/aloha-health`) pobiera z HealthKit wszystkie biegi
i spacery **bez filtrowania po źródle**, więc bieg z Garmina zapisany w Apple Zdrowie powinien już dziś odhaczać trening.
Podobnie bieg wysłany z Garmina do Stravy trafia do nas przez moduł `strava`.

Ograniczenia tej drogi: brak trasy GPS i okrążeń, brak HRV i Body Battery, nie da się wysłać treningu na zegarek.

**Do sprawdzenia na prawdziwym zegarku Garmin** (przed wnioskiem): czy bieg trafia do Apple Zdrowie z dystansem
i tętnem, po jakim czasie, i czy reguła duplikatów (`strava/duplicates.ts`) poprawnie łączy kopię Garmin→Apple Zdrowie
z kopią Garmin→Strava.

## 6. Plan integracji

### Etap 0 – teraz (bez Garmina, ~1 dzień)
- Test na prawdziwym zegarku Garmin (sekcja 5). Jeśli działa – dopisać w aplikacji podpowiedź dla posiadaczy Garmina:
  „Włącz w Garmin Connect zapis do Apple Zdrowie albo do Stravy”.
- Przygotować dokumenty do wniosku: polityka prywatności z sekcją o Garmin (PL/EN, `apps/web/lib/legal/`),
  oświadczenie o AI, lista podmiotów przetwarzających.

### Etap 1 – wniosek o Starter
- Złożyć wniosek (formularz „Starter Garmin Connect Developer Access”). Opis: aplikacja do planów biegowych, która
  wysyła treningi na zegarek (Training API) i odhacza je po biegu (Activity API); Health API opcjonalnie do check-inu.
- Zapytać Garmina na piśmie: dokładny limit użytkowników Startera, definicja „aktywnego użytkownika” i orientacyjna stawka Enterprise,
  czas weryfikacji (zniknięcie etykiety „unverified”), czy płatna subskrypcja jest zgodna z 5.2(e).

### Etap 2 – moduł `garmin` (po zatwierdzeniu)
Budujemy na wzór modułów `strava` i `health`:

| Warstwa | Co | Wzór w repo |
|---|---|---|
| Moduł | nowy `garmin` w `packages/plan-engine/src/core/modules.ts` (+ `MODULE_REQUIRES`) | `strava` |
| Baza | `garmin_connections` (tokeny, `garmin_user_id`, zgody, zgoda AI); `strava_activities.source` += `'garmin'`; `garmin_workouts` (`session_id`, `workout_id`, `schedule_id`, `pushed_at`, hash treści) | migracja `20261113160000_apple_health.sql` |
| `garmin-oauth` | OAuth 2.0 (PKCE), zapis tokenów, odświeżanie, rozłączanie (usunięcie treningów z kalendarza Garmin + tokenów) | `supabase/functions/strava-oauth` |
| `garmin-webhook` | jeden publiczny endpoint push: aktywności → `_shared/activities.ts` (dopasowanie, ocena, notka); usunięcie konta / zmiana zgód → wyłączenie połączenia; odpowiedź 200 od razu, przetwarzanie w tle; upsert po ID | `strava-sync` + `health-sync` |
| `garmin-workouts` | Training API: zamiana treningu na workout Garmina, harmonogram na dzień z planu, aktualizacja przy zmianie planu (check-in, przesunięcie, nowy tydzień), usuwanie odwołanych | `features/watch/apple-watch.ts` (używa `toWatchWorkout` z `plan-engine`) |
| Zamiana treningu | `toGarminWorkout()` w `plan-engine` obok `toWatchWorkout()`: rozgrzewka / bloki z powtórzeniami / schłodzenie, cel = przedział tempa z naszych stref | `packages/plan-engine/src/core/workout.ts` |
| Duplikaty | rozszerzyć `duplicates.ts` o trzecie źródło. **Decyzja do podjęcia:** który bieg zostaje – Garmin (najpełniejsze dane, okrążenia) czy Strava (link „Zobacz w Stravie”) | `strava/duplicates.ts` |
| Aplikacja | Profil → „Połącz z Garmin” (ekran zgody: dane + osobna zgoda AI); na treningu przycisk/status „Na zegarku Garmin”; oznaczenie źródła wg wytycznych marki | `components/strava`, `components/watch/apple-watch-button.tsx` |
| Panel | w `apps/admin/tester` status połączenia Garmin i wysłanych treningów | `strava-controls.tsx` |

Różnica względem Apple Watch: wysyłka na Garmina idzie **z serwera**, więc nie musi być ręczna. Proponuję automatycznie
trzymać w kalendarzu Garmin najbliższe 7 dni planu i aktualizować je przy każdej zmianie planu.

Pierwsza wersja bez Health API (sen, HRV) – to osobna funkcja z osobną zgodą; wchodzi, gdy zobaczymy, że Garmin się przyjmuje.

### Etap 3 – Enterprise (gdy zbliżymy się do limitu Startera)
- Policzyć koszt: każde 0,10 USD za aktywnego użytkownika miesięcznie to 1,20 USD rocznie na użytkownika – przy
  cenie Aloha ok. 70–120 USD/rok to mało, ale definicja „aktywnego” (każdy, kto synchronizuje, czy tylko korzystający z Aloha) robi dużą różnicę.
- Zyski: brak limitu, backfill ~30 dni (prognoza w onboardingu z biegów z Garmina, jak dziś `strava-history`),
  ping/pull (możemy dociągnąć brakujące dni po awarii webhooka).

## 7. Ryzyka

- **Starter bez historii** – nowy użytkownik z Garminem zaczyna od zera; prognoza w onboardingu (`race-forecast`) musi dalej korzystać ze Stravy / Apple Zdrowie albo z ankiety.
- **Tylko push** – jeśli webhook nie przyjmie danych, nie dociągniemy ich (Garmin ponawia, ale nie w nieskończoność). Webhook musi być prosty i bardzo niezawodny.
- **Garmin usuwa pola z plików FIT** – opierać się na udokumentowanych podsumowaniach (JSON), nie na niezadokumentowanych polach FIT.
- **Zgoda AI** – bez osobnej zgody notki trenera nie mogą używać danych z Garmina; trzeba to rozdzielić w `_shared/activities.ts`.
- **Wypowiedzenie z 30-dniowym wyprzedzeniem** – Apple Zdrowie / Health Connect / Strava zostają jako zapasowe źródła.
- **Weryfikacja** może potrwać; do tego czasu mało nowych połączeń – nie zapowiadać Garmina w marketingu przed zdjęciem etykiety „unverified”.

## 8. Źródła

- [Garmin Developers – Connect Developer Program, Overview](https://developer.garmin.com/gc-developer-program/overview/)
- [Sahha – Garmin API Access in 2026: New Tiers, Fees and Terms](https://sahha.ai/blog/garmin-connect-api-reopened-fees/)
- [Sahha – What Garmin Data Syncs to Apple Health and Health Connect?](https://sahha.ai/blog/garmin-developer-program-paused/)
- [the5krunner – Garmin Personal API Key 2026](https://the5krunner.com/2026/10/22/garmin-personal-api/)
- [iDevice – Garmin reopens its Connect API](https://idevice.com/garmin-reopens-its-connect-api-with-free-personal-keys-and-a-fee-for-big-apps)
- [Open Wearables – Garmin Connect Developer Program reopened](https://openwearables.io/blog/garmin-connect-developer-program-reopened)
- [Open Wearables – Garmin Connect API developer guide](https://openwearables.io/blog/garmin-connect-api-developer-guide-activities-health-metrics.md)
- [Terra – Garmin planned workout lifecycle](https://docs.tryterra.co/faq/help-topics/data-api-sdk/extra-features-scores-graphs-teams-nutrition-cgm/garmin-planned-workout-lifecycle)
- [AI Fitness API – Garmin API (2026)](https://aifitnessapi.com/integrate/garmin-api)
