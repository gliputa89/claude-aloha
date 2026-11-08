# Aloha Training – opis projektu (MVP)

*Wersja 0.2 · listopad 2026 · dokument roboczy*

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
            │  Check-in (≤10 s)                  │
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
- Tylko e-mail + hasło (z resetem hasła). Logowanie przez Google/Apple – później.

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
- Pytania (każde jednym tapnięciem, skala 1–5 lub emoji):
  - ⚡ energia,
  - 😴 sen,
  - 🤯 stres / zmęczenie,
  - 🦵 ból mięśni,
  - ⏱️ **ile masz dziś czasu?** – 0 / 20 / 45 / 60+ min (najważniejsze pytanie).
- Opcjonalnie: krótka notatka tekstowa (np. „dziecko chore, nie spałem”, „lekki ból kolana”).
- Przycisk „Nie dziś” – szybkie odwołanie treningu bez tłumaczenia się.

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

### 4.7 Wielojęzyczność
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
- interpretacja check-inu, w tym notatki tekstowej,
- dobór poziomu zmiany (0–4) i konkretnej modyfikacji planu,
- cotygodniowe generowanie kolejnego tygodnia z uwzględnieniem realizacji,
- krótkie, wspierające uzasadnienia w języku użytkownika.

Zasady techniczne:
- AI zwraca **ustrukturyzowany wynik (JSON: lista zmian w planie + uzasadnienie)**, nie wolny tekst.
- Klucz API wyłącznie po stronie backendu – nigdy w aplikacji mobilnej.
- Tryb awaryjny: gdy API nie odpowiada, działa prostsza adaptacja regułowa.
- Czerwone flagi (ból w klatce piersiowej, zawroty głowy, ostry ból stawu) → brak treningu + sugestia konsultacji lekarskiej. Aplikacja **nie udziela porad medycznych**.
- Wybór konkretnego modelu Claude (koszt vs. jakość) – w fazie technicznej.

---

## 6. Model biznesowy – freemium

**Decyzja na MVP: wszystkie funkcje są darmowe.** Celem MVP jest sprawdzenie, czy podejście human first
działa i czy użytkownicy wracają. Paywall wprowadzimy po zebraniu danych o tym, z czego ludzie
korzystają najbardziej. Architektura od początku przewiduje flagę „premium” przy funkcjach,
żeby późniejsze blokowanie nie wymagało przebudowy.

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

Pomysł na później: **14-dniowy darmowy okres Premium** po rejestracji – użytkownik od razu doświadcza głównego wyróżnika (adaptacja AI), zanim trafi na paywall.

---

## 7. Technologia (propozycja)

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

- **User** – konto, język, strefa czasowa, pora powiadomienia z check-inem, status subskrypcji (w MVP zawsze „free – pełny dostęp”)
- **Profile** – poziom, ostatni wynik, tygodniowy kilometraż, zdrowie
- **Goal** – typ (ogólny / zawody), dystans, data, docelowy czas
- **Availability** – preferowane dni, max czas (dzień powszedni / weekend), liczba treningów
- **Plan** → **Week** → **Session** – typ, czas/dystans, intensywność, status
- **CheckIn** – data, energia, sen, stres, ból, dostępny czas, notatka
- **Adjustment** – poziom zmiany (0–4), diff planu, uzasadnienie, źródło (AI / reguły), zaakceptowano: tak/nie

### Ekrany MVP

1. Rejestracja / logowanie
2. Ankieta startowa (3–5 kroków)
3. **Dzisiaj** – check-in + dzisiejszy trening (ekran główny)
4. Propozycja zmiany (akceptuj / zostaw)
5. Tydzień – lista jednostek
6. Szczegóły i realizacja treningu
7. Cel i postęp
8. Ustawienia (język, pora powiadomienia, dostępność)

---

## 8. Poza zakresem MVP

- Integracje: Garmin, Strava, Apple Health, Health Connect
- Integracja z kalendarzem telefonu
- Logowanie przez Google / Apple
- Moduł regeneracji (rozciąganie, oddech, sen)
- Inne dyscypliny (rower, pływanie, siłownia)
- Śledzenie GPS w aplikacji
- Funkcje społecznościowe
- Subskrypcje i paywall (MVP w pełni darmowe)
- Zaawansowani biegacze (< 36 min / 10 km)

---

## 9. Miary sukcesu MVP

- **Retencja**: % użytkowników aktywnych po 4 i 8 tygodniach
- **Odpowiedzi na check-in**: % dni treningowych z wypełnionym check-inem
- **Akceptacja propozycji AI**: % zaakceptowanych zmian (miara trafności)
- **Realizacja planu**: % wykonanych jednostek (także po adaptacji)
- **Najczęściej używane funkcje** – podstawa decyzji, co trafi do Premium

---

## 10. Plan prac (wstępny)

1. **Koncepcja** – ten dokument, makiety kluczowych ekranów (Dzisiaj, check-in, propozycja zmiany)
2. **Silnik reguł** – generowanie szkieletu planu dla 4–5 typowych celów, testy jednostkowe
3. **Szkielet aplikacji** – Expo + Supabase, auth e-mail, onboarding, widok tygodnia
4. **Check-in + adaptacja** – najpierw regułowa, potem warstwa Claude z walidacją
5. **Beta** – TestFlight / Google Play testy wewnętrzne, 10–30 osób z grupy docelowej
6. **Publikacja** w App Store i Google Play (w pełni darmowa)
7. **Monetyzacja** – na podstawie danych z MVP: RevenueCat, trial, paywall

---

## 11. Podjęte decyzje

| Temat | Decyzja |
|---|---|
| Dyscyplina | tylko bieganie |
| Grupa docelowa | 30–40 lat, od początkujących do ~36–37 min / 10 km |
| Moduł regeneracji | nie w MVP |
| Check-in | w dni treningowe, o porze ustawionej przez użytkownika |
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

## 12. Otwarte pytania

1. Jak często użytkownik może zmienić cel / dostępność bez „resetu” planu?
2. Wymagania prawne: polityka prywatności, RODO (dane o samopoczuciu i zdrowiu mogą być danymi wrażliwymi), disclaimer medyczny.
3. Identyfikacja wizualna (kolory, logo, nazwa docelowa).
4. Cena i podział free/Premium – po MVP, na podstawie danych.
