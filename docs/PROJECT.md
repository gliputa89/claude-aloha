# Aloha Training – opis projektu (MVP)

*Wersja 0.4 · listopad 2026 · dokument roboczy*

---

## 1. Wizja

Większość aplikacji treningowych zakłada, że **plan jest stały, a życie ma się do niego dopasować**.
Amatorzy mają pracę, dzieci, zmęczenie i mało czasu – sztywny plan szybko się rozjeżdża,
a użytkownik czuje, że „zawalił” i porzuca aplikację.

**Aloha Training odwraca tę logikę: plan dopasowuje się do życia.**
Przed każdym treningiem aplikacja pyta *„Jak się dzisiaj czujesz?”* i w kilka sekund
proponuje rozsądną zmianę – z ludzkim uzasadnieniem – którą użytkownik akceptuje jednym tapnięciem.

### Zasady produktu (human first)

1. **Szybkość ponad szczegółowość** – codzienny check-in trwa ≤ 10 sekund.
2. **Bez poczucia winy** – opuszczony trening to normalna sytuacja, nie porażka. Język aplikacji jest wspierający, nie oceniający.
3. **Propozycja, nie rozkaz** – AI proponuje zmianę i wyjaśnia dlaczego; decyzja należy do użytkownika.
4. **Bezpieczeństwo przed ambicją** – przy wątpliwościach plan wybiera wariant łagodniejszy.
5. **Prostota** – tylko to, co pomaga trenować regularnie. Żadnego przeładowania wykresami.

### Ton komunikacji: „trener, ale kumpel” 🤙

Aplikacja mówi jak trener, który jest jednocześnie dobrym kumplem:
- **zna się na rzeczy** – konkretne zalecenia, krótko uzasadnione, bez lania wody,
- **jest po Twojej stronie** – rozumie, że życie bywa ważniejsze niż trening; nigdy nie zawstydza,
- **luźno, ale nie infantylnie** – zwraca się na „Ty”, może zażartować, emoji z umiarem,
- **motywuje bez presji** – docenia regularność bardziej niż pojedyncze rekordy.

| Zamiast… | …mówimy |
|---|---|
| „Nie wykonałeś zaplanowanego treningu.” | „Wczoraj nie wyszło? Spoko, zdarza się. Przesunąłem bieg na czwartek.” |
| „Zalecane obniżenie intensywności.” | „Słabo spałeś – dziś luźne 20 minut, interwały poczekają.” |
| „Gratulacje! Ukończono jednostkę treningową.” | „Jest! Trzeci trening w tym tygodniu – tak się buduje formę 💪” |

---

## 2. Grupa docelowa

| | |
|---|---|
| **Wiek** | 30–40 lat |
| **Sytuacja** | praca etatowa, często dzieci, ograniczony i nieregularny czas |
| **Poziom** | od zupełnie początkujących („wstaję z kanapy”) do średnio zaawansowanych |
| **Górna granica** | ok. 36–37 min na 10 km (dla szybszych biegaczy aplikacja nie jest przeznaczona) |
| **Dyscyplina** | wyłącznie bieganie (MVP) |

### Przykładowe persony

- **Kasia, 34 lata** – mama dwójki dzieci, nie biegała od studiów. Cel: przebiec 5 km bez zatrzymania. Ma 3 × 30 min w tygodniu, najczęściej wieczorem.
- **Tomek, 38 lat** – manager, biega od 3 lat, 10 km w 48 min. Cel: pierwszy półmaraton za 4 miesiące. Do dyspozycji 4 dni, w weekend dłużej.
- **Marta, 31 lat** – biega regularnie, 10 km w 39 min. Cel: maraton poniżej 3 h. Dużo podróży służbowych – plan często się sypie.

> Uwaga: maraton sub 3h odpowiada formie ok. 38–39 min na 10 km – to górny skraj grupy docelowej, nadal w zakresie.

---

## 3. Kluczowy przepływ użytkownika

```
Rejestracja (e-mail)
      │
      ▼
Ankieta startowa ──► Generowanie planu (1–2 tyg. do przodu, cel w tle)
                              │
                              ▼
            ┌──────── Dzień treningowy ─────────┐
            │  Push: „Jak się dzisiaj czujesz?” │
            │            │                       │
            │            ▼                       │
            │  Check-in: suwak + opcj. tekst     │
            │            │                       │
            │            ▼                       │
            │  Ocena wielkości zmiany            │
            │   ├─ brak zmian → trening wg planu │
            │   └─ zmiana → propozycja +         │
            │      uzasadnienie → [Akceptuj]     │
            │                     [Zostaw plan]  │
            │            │                       │
            │            ▼                       │
            │  Realizacja → odhaczenie + ocena   │
            └────────────┬──────────────────────┘
                         ▼
          Co tydzień: generowanie kolejnego tygodnia
          na podstawie realizacji i check-inów
```

---

## 4. Funkcje MVP

### 4.1 Rejestracja i logowanie
- E-mail + hasło (z resetem hasła), logowanie przez Apple na iOS i przez Google na iOS i Androidzie.

### 4.2 Ankieta startowa (onboarding)
Krótka, ok. 1–2 minuty, maksymalnie kilka ekranów:

1. **Cel** – do wyboru:
   - ogólny: „zacznij biegać / 5 km bez zatrzymania”, „popraw formę”, „biegaj regularnie”,
   - konkretny: dystans (5 km / 10 km / półmaraton / maraton) + data zawodów + opcjonalnie docelowy czas.
2. **Obecny poziom**:
   - „nie biegam” / „biegam okazjonalnie” / „biegam regularnie”,
   - opcjonalnie ostatni wynik (np. 5 km lub 10 km i czas) – pozwala wyznaczyć tempa,
   - ile km tygodniowo / ile razy w tygodniu obecnie.
3. **Dostępność**:
   - preferowane dni treningowe (np. wt, czw, sob),
   - maksymalny czas na trening w dzień powszedni i w weekend,
   - liczba treningów w tygodniu.
4. **Zdrowie (bezpieczeństwo)** – czy są kontuzje / przeciwwskazania; komunikat, by przy wątpliwościach skonsultować się z lekarzem.

**Walidacja celu** – jeśli cel jest nierealny (np. maraton sub 3h za 6 tygodni z poziomu 10 km/55 min), aplikacja łagodnie to komunikuje i proponuje realny cel pośredni.

### 4.3 Plan treningowy
- Plan szczegółowy na **1–2 tygodnie do przodu**; dalsza perspektywa (fazy do zawodów) w tle, w uproszczeniu.
- Typy jednostek (MVP): marsz-bieg, bieg spokojny, długi bieg, interwały, tempo, odpoczynek.
- Intensywność podawana w **tempie** (gdy znamy wynik) lub w **odczuciu (RPE / „czy możesz rozmawiać?”)** dla początkujących.
- Widok tygodnia + widok „Dzisiaj”.

### 4.4 Check-in „Jak się dzisiaj czujesz?” ❤️ (rdzeń aplikacji)
- Pojawia się **w dni treningowe** jako push o **porze ustawionej przez użytkownika** (domyślnie np. 7:00, zmiana w ustawieniach) oraz po otwarciu aplikacji.
- **Brak check-inu = trening według planu**, bez zmian i bez upominania.
- **Maksymalnie prosty ekran** – jedno pytanie, kilka sekund:
  1. **Suwak „Jak się dzisiaj czujesz?”** (1–5: Słabo · Tak sobie · W porządku · Dobrze · Świetnie) – jedyny element wymagany.
  2. **Pole otwarte „Co u Ciebie?”** (opcjonalne) – tekst albo dyktowanie głosowe, np. „mam tylko 20 minut”, „dziecko chore, nie spałem”, „lekko boli kolano”.
  3. **Szybkie podpowiedzi** (opcjonalne, jedno tapnięcie): *Mało czasu*, *Mało snu*, *Stres*, *Coś boli*, *Mam energię* – dla tych, którym nie chce się pisać.
- Szczegóły (dostępny czas, sen, stres, ból) **wyciąga AI z tekstu i podpowiedzi** – użytkownik nie wypełnia formularza.
- Jeśli jest „Mało czasu” bez konkretnej liczby minut – propozycja skraca trening do bezpiecznego minimum (np. 20–25 min), a użytkownik może to zmienić na ekranie propozycji.
- Sam suwak bez tekstu: 4–5 → zwykle bez zmian; 1–2 → propozycja łagodniejszej wersji treningu.
- **Pomiń** (oraz ✕ w rogu) – zamyka check-in bez odpowiedzi; trening zostaje według planu. Check-in nie oferuje „odpuszczenia” treningu – to ekran o samopoczuciu, nie o rezygnacji. Niewykonany trening użytkownik oznacza później przy realizacji, a plan przelicza się automatycznie.

### 4.5 Adaptacja planu – skala zmian
System ocenia **wielkość potrzebnej zmiany** i dobiera reakcję proporcjonalną:

| Poziom | Sytuacja (przykład) | Reakcja |
|---|---|---|
| **0 – brak** | czuję się dobrze, mam czas | trening bez zmian |
| **1 – korekta dnia** | mniej czasu, lekkie zmęczenie | skrócenie lub obniżenie intensywności dzisiejszej jednostki |
| **2 – przesunięcie** | dziś nie dam rady, ale w tygodniu są wolne dni | przeniesienie treningu na inny dzień tygodnia, z zachowaniem odstępów |
| **3 – przebudowa tygodnia** | opuszczony kluczowy trening, słaba forma kilka dni | usunięcie jednej jednostki, rebalans tygodnia (np. długi bieg zostaje, interwały wypadają) |
| **4 – przeliczenie w przód** | choroba, wyjazd, tydzień przerwy | przeliczenie kolejnych tygodni, łagodny powrót; ewentualnie korekta oczekiwań co do celu |

Każda zmiana:
- jest **propozycją z krótkim, ludzkim uzasadnieniem** (np. *„Spałeś słabo i masz 20 minut – zróbmy dziś spokojne 20 min zamiast interwałów. Interwały przesunęłam na czwartek.”*),
- wymaga **akceptacji jednym tapnięciem** (lub „zostaw plan bez zmian”),
- zachowuje historię (co było zaplanowane, co zmieniono, dlaczego).

### 4.6 Realizacja treningu
- Odhaczenie: wykonany / częściowo / niewykonany.
- Szybka ocena: jak poszło (skala 1–5) + opcjonalnie dystans i czas wpisane ręcznie.
- Dane z realizacji wpływają na generowanie kolejnego tygodnia.

### 4.6a Rozmowa z trenerem (czat)

- **Keanu Biegała (trener AI)** – czat dostępny z ekranu „Dzisiaj” i z arkusza treningu. Trzy rodzaje rozmów: ogólna,
  **przed treningiem** („jak go pobiec?”, „mam mniej czasu”) i **po treningu** („jak mi poszło?”, „co poprawić?”).
  Trener zna plan, ostatnie treningi i ich oceny; odpowiada od razu, krótko, w tonie „trener, ale kumpel”.
- **Zmiana planu z rozmowy** – trener może zaproponować jedną zmianę (przenieść, skrócić, zmienić rodzaj, odpuścić
  trening). To zawsze propozycja: karta pod wiadomością z „Akceptuj” i „Zostaw plan bez zmian”. Zmianę sprawdzają
  te same reguły co plan od AI; propozycja łamiąca reguły w ogóle nie trafia do biegacza.
- **Prawdziwy trener** – osobny pakiet: czat z przydzielonym trenerem-człowiekiem (lista trenerów w panelu).
  Odpowiedzi nie są natychmiastowe; trener pisze z panelu.
- Bez porad medycznych: przy bólu i chorobie trener zaleca wariant łagodniejszy i kontakt z lekarzem albo fizjoterapeutą.
- **Zdrowie wymaga zgody**: gdy wiadomość porusza temat zdrowia (ból, kontuzja, choroba, leki, ciąża…), a biegacz nie dał
  zgody na dane zdrowotne, wiadomość nie jest zapisywana ani wysyłana dalej – czat pokazuje prośbę o zgodę z jednym
  przyciskiem. Po kliknięciu zgoda trafia do dziennika zgód i wiadomość idzie dalej; pytamy tylko raz.
- Limit: 40 wiadomości do trenera AI na dobę. Treść rozmów nie trafia do analityki i znika z kontem.

### 4.7 Zmiana celu i dostępności

Zasada: **życie się zmienia, plan też może** – bez twardych limitów, ale bez gubienia postępów.

| Zmiana | Co się dzieje |
|---|---|
| **Dostępność** (dni, max czas, liczba treningów) | Możliwa w każdej chwili. Domyślnie obowiązuje **od przyszłego tygodnia**; opcja „od teraz” przebudowuje bieżący tydzień (poziom 3). |
| **Ten sam cel, inna data lub docelowy czas** | Przeliczenie planu w przód (poziom 4), historia i obecna forma zostają. |
| **Nowy cel** (np. z 10 km na półmaraton) | Nowy plan budowany na **aktualnej formie** z historii treningów – nigdy od zera. Stary plan trafia do archiwum. |
| **Częste zmiany celu** (2. zmiana w ciągu 14 dni) | Brak blokady; łagodny komunikat w tonie kumpla: *„Drugi raz zmieniasz cel w 2 tygodnie – wszystko ok? Plan najlepiej działa, gdy dasz mu kilka tygodni.”* |

Ankieta zmiany jest skrócona – pyta tylko o to, co się zmienia.

### 4.8 Wielojęzyczność
- Polski i angielski od pierwszej wersji (interfejs + komunikaty generowane przez AI w języku użytkownika).

---

## 5. Rola AI – model hybrydowy

```
 Check-in / realizacja
          │
          ▼
 ┌──────────────────────┐       ┌──────────────────────┐
 │  Silnik reguł        │ ────► │  Claude (API)        │
 │  (deterministyczny)  │       │  personalizacja,     │
 │  - szkielet planu    │ ◄──── │  przeliczanie zmian, │
 │  - limity obciążenia │       │  uzasadnienie        │
 │  - walidacja zmian   │       │  ludzkim językiem    │
 └──────────────────────┘       └──────────────────────┘
          │
          ▼
 Propozycja dla użytkownika (po walidacji)
```

**Silnik reguł** (kod, bez AI) – odpowiada za bezpieczeństwo i przewidywalność:
- szkielet planu wg sprawdzonych zasad (fazy: baza → budowanie → szczyt → tapering),
- przyrost objętości tygodniowej max ~10%,
- brak dwóch ciężkich jednostek dzień po dniu,
- długi bieg ≤ ~30% objętości tygodniowej,
- łagodny powrót po przerwie / chorobie,
- **walidacja każdej propozycji AI** – propozycja łamiąca reguły jest odrzucana lub korygowana.

**Claude (Claude API, wywoływane z backendu)** – odpowiada za „ludzką” warstwę:
- interpretacja check-inu: suwak + notatka tekstowa + podpowiedzi → ustrukturyzowane dane (czas, sen, stres, ból, czerwone flagi),
- dobór poziomu zmiany (0–4) i konkretnej modyfikacji planu,
- cotygodniowe generowanie kolejnego tygodnia z uwzględnieniem realizacji,
- krótkie, wspierające uzasadnienia w języku użytkownika.

Zasady techniczne:
- AI zwraca **ustrukturyzowany wynik (JSON: lista zmian w planie + uzasadnienie)**, nie wolny tekst.
- Klucz API wyłącznie po stronie backendu – nigdy w aplikacji mobilnej.
- Tryb awaryjny: gdy API nie odpowiada, działa prostsza adaptacja regułowa (suwak + podpowiedzi, bez interpretacji tekstu).
- Czerwone flagi (ból w klatce piersiowej, zawroty głowy, ostry ból stawu) → brak treningu + sugestia konsultacji lekarskiej. Aplikacja **nie udziela porad medycznych**.
- Wybór konkretnego modelu Claude (koszt vs. jakość) – w fazie technicznej.

---

## 6. Prywatność, RODO i bezpieczeństwo

Uwzględniamy od pierwszego dnia projektowania (privacy by design). *Poniższe to założenia projektowe, nie porada prawna – przed publikacją dokumenty sprawdzi prawnik.*

### 6.1 Dane o zdrowiu
- Check-in (samopoczucie, sen, ból), kontuzje i notatki **traktujemy jako dane dotyczące zdrowia** (art. 9 RODO – kategoria szczególna).
- Podstawa przetwarzania: **wyraźna zgoda** – osobny, niezaznaczony domyślnie checkbox w onboardingu (oddzielny od akceptacji regulaminu), z możliwością wycofania w ustawieniach.
- Bez zgody na dane zdrowotne aplikacja działa w trybie podstawowym: plan bez check-inu.

### 6.2 Minimalizacja i przechowywanie
- Zbieramy tylko dane potrzebne do planowania (bez GPS, kontaktów, zdjęć).
- Hosting danych w **UE** (Supabase, region Frankfurt).
- Szyfrowanie w transmisji (TLS) i w spoczynku; Row Level Security w Supabase – użytkownik widzi tylko swoje dane.

### 6.3 AI a dane osobowe
- Do Claude API wysyłamy **wyłącznie dane treningowe pod pseudonimowym ID** – bez e-maila, imienia i innych identyfikatorów.
- Anthropic jako podmiot przetwarzający – umowa powierzenia (DPA); weryfikacja zasad retencji danych i braku trenowania modeli na danych z API.
- Notatki tekstowe użytkownika: przed wysłaniem informacja w polityce prywatności, że są analizowane przez AI.

### 6.3a Lokalizacja (pogoda do treningu)
- Lokalizacja tylko za zgodą systemową „podczas używania aplikacji”; bez zgody aplikacja działa normalnie, tylko bez karty pogody.
- Z telefonu wychodzą współrzędne **zaokrąglone do 0,1° (ok. 10 km)**; tylko takie zapisujemy (`session_weather`) i wysyłamy do dostawcy prognozy (Open-Meteo). Do Claude API lokalizacja nie trafia – model dostaje samą pogodę i rodzaj treningu.
- Do uzupełnienia przed publikacją: wpis w polityce prywatności (cel, odbiorca Open-Meteo) oraz „Przybliżona lokalizacja” w App Privacy / Data safety.

### 6.4 Prawa użytkownika
- **Eksport danych** (JSON) i **usunięcie konta z poziomu aplikacji** – wymagane przez RODO oraz przez App Store i Google Play.
- Polityka prywatności i regulamin w PL i EN, dostępne przed rejestracją i w ustawieniach.

### 6.5 Bezpieczeństwo zdrowotne
- **Disclaimer medyczny** w onboardingu i w regulaminie: aplikacja nie jest wyrobem medycznym i nie zastępuje lekarza.
- Pytanie o przeciwwskazania w ankiecie; przy zgłoszonych problemach zdrowotnych – zalecenie konsultacji przed startem.
- Czerwone flagi w check-inie / notatce → brak treningu + sugestia kontaktu z lekarzem.

### 6.6 Sklepy z aplikacjami
- Formularz **Data safety** (Google Play) i **App Privacy** (App Store) wypełnione zgodnie z faktycznym przetwarzaniem.
- Brak reklam i sprzedaży danych podmiotom trzecim.

---

## 7. Model biznesowy – freemium

**Decyzja na MVP: wszystkie funkcje są darmowe.** Celem MVP jest sprawdzenie, czy podejście human first
działa i czy użytkownicy wracają. Paywall wprowadzimy po zebraniu danych o tym, z czego ludzie
korzystają najbardziej. Architektura od początku przewiduje flagę „premium” przy funkcjach,
żeby późniejsze blokowanie nie wymagało przebudowy.

Ta flaga jest już w kodzie jako **moduły i pakiety**: każda funkcja należy do modułu (`plan`, `plan_ai`, `weather`,
`strava`, `review`, `coach`), a pakiet to lista włączonych modułów. Dziś każdy pakiet ma wszystko; zmiana oferty to zmiana
jednej listy. Opis: [`ARCHITECTURE.md`](ARCHITECTURE.md), sekcja 2a.

Docelowy podział (do weryfikacji po MVP):

| Funkcja | Free | Premium (subskrypcja) |
|---|:---:|:---:|
| Ankieta i plan treningowy | ✅ | ✅ |
| Widok tygodnia, odhaczanie treningów | ✅ | ✅ |
| Check-in „Jak się czujesz?” | ✅ | ✅ |
| Prosta adaptacja regułowa (poziom 1–2: skróć / przesuń) | ✅ | ✅ |
| **Adaptacja AI z uzasadnieniem (poziomy 1–4)** | – | ✅ |
| **Przeliczanie kolejnych tygodni przez AI** | – | ✅ |
| **Notatka tekstowa interpretowana przez AI** | – | ✅ |
| Cele zawodowe (półmaraton / maraton z docelowym czasem) | ? | ✅ |
| Pogoda i pora treningu (moduł `weather`) | ? | ✅ |
| Strava: pobieranie biegów i odhaczanie (moduł `strava`) | ? | ✅ |
| Ocena treningu względem planu (moduł `review`) | ? | ✅ |
| Notki trenera AI po treningu i na dzień wolny (moduł `coach`) | ? | ✅ |
| Rozmowa z trenerem AI – Keanu Biegała (moduł `coach_chat`) | ? | ✅ |
| **Rozmowa z prawdziwym trenerem (moduł `coach_human`)** | – | ✅ (osobny pakiet) |

Pomysł na później: **14-dniowy darmowy okres Premium** po rejestracji – użytkownik od razu doświadcza głównego wyróżnika (adaptacja AI), zanim trafi na paywall.

### Subskrypcja a sklepy (ustalenia z zakładania Google Play, 12.11.2026)

Docelowo Premium to **płatny abonament (SaaS, subskrypcja miesięczna / roczna)**. Na start wszystko jest darmowe.

- **Aplikacja w sklepach jest „bezpłatna” – i ma tak zostać.** „Bezpłatna / płatna” w Google Play (i cena w App Store)
  dotyczy jednorazowej opłaty za pobranie. Subskrypcja to zakup w aplikacji w darmowej apce. Google nie pozwala
  zmienić aplikacji bezpłatnej na płatną, ale do abonamentu nie jest to potrzebne.
- **Płatność tylko przez sklepy**: Google Play Billing i Apple In-App Purchase (cyfrowa usługa w aplikacji) –
  przez RevenueCat. Produkty subskrypcji zakłada się w Play Console (sekcja „Zarabiaj w Google Play”) i App Store Connect.
- **Przy włączaniu paywalla zaktualizować w obu sklepach:**
  - **Dane logowania dla recenzentów** – konto testowe musi mieć aktywne Premium (status nadany po stronie
    serwera), bo recenzent nie może nic kupić. Opis w Play Console już to obiecuje („this account has access to all features,
    including future Premium ones”) – zdanie „There are no in-app purchases yet” trzeba wtedy usunąć.
  - **Bezpieczeństwo danych / App Privacy** – dopisać historię zakupów (dane z RevenueCat i sklepu).
  - **Ocena treści (IARC) w Play Console** – „Czy aplikacja pozwala użytkownikom kupować produkty cyfrowe?” zmienić
    na „Tak” (dziś „Nie”) i wysłać kwestionariusz ponownie.
  - **Karty sklepowe** ([`marketing/sklepy/`](../marketing/sklepy/)) – informacja o cenie i okresie próbnym;
    sklep sam pokaże „Zakupy w aplikacji”.
  - **Regulamin i polityka prywatności** – warunki subskrypcji, odnawianie, anulowanie, RevenueCat jako odbiorca danych.
- Wymagania po stronie kodu: [`ARCHITECTURE.md`](ARCHITECTURE.md), koniec sekcji 2a (blokada `subscription_status`,
  zakup przez RevenueCat, ekran „odblokuj”).

### Płatne kampanie a deklaracje w sklepach (12.11.2026)

Planujemy mocno reklamować aplikację (Meta, Google, TikTok – [`docs/MARKETING.md`](MARKETING.md)).
**Reklamowanie aplikacji na zewnątrz nie zmienia deklaracji** – „Reklamy” w Play Console dotyczą reklam *wyświetlanych
w aplikacji* (u nas: nie ma i nie będzie). Deklaracje zmieniają się dopiero, gdy do aplikacji trafi **SDK do pomiaru
kampanii** (Meta SDK, Firebase/Google Analytics dla Google Ads, TikTok SDK, AppsFlyer/Adjust itp.), bo takie SDK zwykle
odczytuje identyfikator reklamowy i wysyła dane partnerom reklamowym. Wtedy:

- **Play Console → Identyfikator wyświetlania reklam**: zmienić na „Tak” (dziś „Nie”); uprawnienie
  `com.google.android.gms.permission.AD_ID` w manifeście (zwykle dokłada je SDK).
- **iOS**: App Tracking Transparency (pytanie o zgodę na śledzenie) i `NSUserTrackingUsageDescription`, jeśli SDK śledzi.
- **Bezpieczeństwo danych / App Privacy**: identyfikatory urządzenia także w celu „Cele marketingowe” / „Analityka”
  i jako **udostępniane** (partnerzy reklamowi); dopisać zdarzenia (instalacja, rejestracja, zakup).
- **Polityka prywatności**: dziś mówi „nie udostępniamy danych reklamodawcom” – trzeba ją zmienić i dodać zgodę
  marketingową w aplikacji (RODO), zanim SDK zacznie wysyłać dane.
- Alternatywa bez SDK w aplikacji: Google Play Install Referrer / kampanie Google App Campaigns mierzone w Play Console
  i SKAdNetwork po stronie Apple – mniej dokładne, ale nie zmieniają deklaracji o śledzeniu.

---

## 8. Technologia (propozycja)

| Obszar | Wybór | Uzasadnienie |
|---|---|---|
| Aplikacja mobilna | **React Native + Expo (TypeScript)** | jedna baza kodu Android + iOS, szybkie iteracje, dobre dla solo-developera |
| Backend / baza / auth | **Supabase** (Postgres, Auth e-mail, Edge Functions) | auth, baza i funkcje serwerowe w jednym; mało infrastruktury do utrzymania |
| AI | **Claude API** wywoływane z Edge Function | bezpieczny klucz, kontrola kosztów, walidacja wyników |
| Powiadomienia push | Expo Notifications | prosta integracja z Expo |
| Subskrypcje (po MVP) | RevenueCat | obsługa App Store + Google Play w jednym SDK |
| Feature flags | pole w profilu użytkownika / tabela w Supabase | przygotowanie pod późniejszy paywall |
| Tłumaczenia | i18next / react-i18next | PL + EN |
| Zadanie cykliczne (generowanie kolejnego tygodnia) | cron w Supabase (pg_cron / scheduled functions) | bez dodatkowej infrastruktury |

### Wstępny model danych

- **User** – konto, język, strefa czasowa, pora powiadomienia z check-inem, status subskrypcji (w MVP zawsze „free – pełny dostęp”), zgody (regulamin, dane zdrowotne – z datą)
- **Profile** – poziom, ostatni wynik, tygodniowy kilometraż, zdrowie
- **Goal** – typ (ogólny / zawody), dystans, data, docelowy czas
- **Availability** – preferowane dni, max czas (dzień powszedni / weekend), liczba treningów
- **Plan** → **Week** → **Session** – typ, czas/dystans, intensywność, status
- **CheckIn** – data, samopoczucie (1–5), notatka (tekst), podpowiedzi (tagi); pola wyciągnięte przez AI: dostępny czas, sen, stres, ból
- **Adjustment** – poziom zmiany (0–4), diff planu, uzasadnienie, źródło (AI / reguły), zaakceptowano: tak/nie

### Ekrany MVP

1. Rejestracja / logowanie
2. Ankieta startowa (3–5 kroków)
3. **Dzisiaj** – check-in + dzisiejszy trening (ekran główny)
4. Propozycja zmiany (akceptuj / zostaw)
5. Tydzień – lista jednostek
6. Szczegóły i realizacja treningu
7. Cel i postęp
8. Ustawienia (język, pora powiadomienia, dostępność, zgody, eksport danych, usunięcie konta)

---

## 9. Poza zakresem MVP

- Integracje: Garmin, Strava, Apple Health, Health Connect
- Integracja z kalendarzem telefonu
- Logowanie przez Apple na Androidzie i w przeglądarce
- Moduł regeneracji (rozciąganie, oddech, sen)
- Inne dyscypliny (rower, pływanie, siłownia)
- Śledzenie GPS w aplikacji
- Funkcje społecznościowe
- Subskrypcje i paywall (MVP w pełni darmowe)
- Zaawansowani biegacze (< 36 min / 10 km)

---

## 10. Miary sukcesu MVP

- **Retencja**: % użytkowników aktywnych po 4 i 8 tygodniach
- **Odpowiedzi na check-in**: % dni treningowych z wypełnionym check-inem
- **Akceptacja propozycji AI**: % zaakceptowanych zmian (miara trafności)
- **Realizacja planu**: % wykonanych jednostek (także po adaptacji)
- **Najczęściej używane funkcje** – podstawa decyzji, co trafi do Premium

---

## 11. Plan prac (wstępny)

1. **Koncepcja** – ten dokument, makiety kluczowych ekranów (Dzisiaj, check-in, propozycja zmiany)
2. **Silnik reguł** – generowanie szkieletu planu dla 4–5 typowych celów, testy jednostkowe
3. **Szkielet aplikacji** – Expo + Supabase, auth e-mail, onboarding, widok tygodnia
4. **Check-in + adaptacja** – najpierw regułowa, potem warstwa Claude z walidacją
5. **Beta** – TestFlight / Google Play testy wewnętrzne, 10–30 osób z grupy docelowej
6. **Publikacja** w App Store i Google Play (w pełni darmowa)
7. **Monetyzacja** – na podstawie danych z MVP: RevenueCat, trial, paywall

---

## 12. Podjęte decyzje

| Temat | Decyzja |
|---|---|
| Dyscyplina | tylko bieganie |
| Grupa docelowa | 30–40 lat, od początkujących do ~36–37 min / 10 km |
| Moduł regeneracji | nie w MVP |
| Check-in | w dni treningowe, o porze ustawionej przez użytkownika; jeden suwak + opcjonalny tekst i podpowiedzi |
| Brak check-inu | trening według planu, bez zmian |
| Zmiany planu | propozycja z uzasadnieniem + akceptacja; skala 0–4 |
| AI | hybryda: reguły + Claude API z backendu |
| Integracje | po MVP |
| Logowanie | tylko e-mail |
| Języki | polski i angielski |
| Monetyzacja | MVP w pełni darmowe; paywall po MVP |
| Technologia | React Native (Expo), budowane samodzielnie |
| Ton | trener, ale kumpel |
| Nazwa robocza | Aloha Training |
| Zmiana celu / dostępności | bez limitów; dostępność od przyszłego tygodnia (opcja „od teraz”), nowy cel na bazie aktualnej formy |
| Prywatność | privacy by design: zgoda na dane zdrowotne, hosting w UE, pseudonimizacja przed AI, eksport i usunięcie konta |
| Identyfikacja wizualna | osobny wątek (poza tym dokumentem) |

## 13. Otwarte pytania

1. Weryfikacja prawna dokumentów (polityka prywatności, regulamin, zgody) – przed publikacją.
2. Cena i podział free/Premium – po MVP, na podstawie danych.
3. Nazwa docelowa i identyfikacja wizualna – w osobnym wątku.
