# Aloha Training – opis projektu (MVP)

*Wersja 0.1 · listopad 2026 · dokument roboczy*

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
- Pojawia się **w dni treningowe** (push rano / o porze wybranej przez użytkownika) oraz po otwarciu aplikacji.
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

Propozycja: **14-dniowy darmowy okres Premium** po rejestracji – użytkownik od razu doświadcza głównego wyróżnika (adaptacja AI), zanim trafi na paywall.

---

## 7. Technologia (propozycja)

| Obszar | Wybór | Uzasadnienie |
|---|---|---|
| Aplikacja mobilna | **React Native + Expo (TypeScript)** | jedna baza kodu Android + iOS, szybkie iteracje, dobre dla solo-developera |
| Backend / baza / auth | **Supabase** (Postgres, Auth e-mail, Edge Functions) | auth, baza i funkcje serwerowe w jednym; mało infrastruktury do utrzymania |
| AI | **Claude API** wywoływane z Edge Function | bezpieczny klucz, kontrola kosztów, walidacja wyników |
| Powiadomienia push | Expo Notifications | prosta integracja z Expo |
| Subskrypcje | RevenueCat | obsługa App Store + Google Play w jednym SDK |
| Tłumaczenia | i18next / react-i18next | PL + EN |
| Zadanie cykliczne (generowanie kolejnego tygodnia) | cron w Supabase (pg_cron / scheduled functions) | bez dodatkowej infrastruktury |

### Wstępny model danych

- **User** – konto, język, strefa czasowa, status subskrypcji
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
8. Ustawienia (język, powiadomienia, dostępność, subskrypcja)

---

## 8. Poza zakresem MVP

- Integracje: Garmin, Strava, Apple Health, Health Connect
- Integracja z kalendarzem telefonu
- Logowanie przez Google / Apple
- Moduł regeneracji (rozciąganie, oddech, sen)
- Inne dyscypliny (rower, pływanie, siłownia)
- Śledzenie GPS w aplikacji
- Funkcje społecznościowe
- Zaawansowani biegacze (< 36 min / 10 km)

---

## 9. Miary sukcesu MVP

- **Retencja**: % użytkowników aktywnych po 4 i 8 tygodniach
- **Odpowiedzi na check-in**: % dni treningowych z wypełnionym check-inem
- **Akceptacja propozycji AI**: % zaakceptowanych zmian (miara trafności)
- **Realizacja planu**: % wykonanych jednostek (także po adaptacji)
- **Konwersja** trial → Premium

---

## 10. Plan prac (wstępny)

1. **Koncepcja** – ten dokument, makiety kluczowych ekranów (Dzisiaj, check-in, propozycja zmiany)
2. **Silnik reguł** – generowanie szkieletu planu dla 4–5 typowych celów, testy jednostkowe
3. **Szkielet aplikacji** – Expo + Supabase, auth e-mail, onboarding, widok tygodnia
4. **Check-in + adaptacja** – najpierw regułowa, potem warstwa Claude z walidacją
5. **Subskrypcja** – RevenueCat, trial, paywall
6. **Beta** – TestFlight / Google Play testy wewnętrzne, 10–30 osób z grupy docelowej
7. **Publikacja** w App Store i Google Play

---

## 11. Otwarte pytania

1. Czy cele zawodowe (półmaraton/maraton z czasem) mają być w wersji free, czy tylko Premium?
2. Pora powiadomienia z check-inem – stała (np. 7:00) czy ustawiana przez użytkownika?
3. Co gdy użytkownik nie wypełni check-inu – trening wg planu bez zmian?
4. Jak często użytkownik może zmienić cel / dostępność bez „resetu” planu?
5. Wymagania prawne: polityka prywatności, RODO (dane o samopoczuciu i zdrowiu to dane wrażliwe), disclaimer medyczny.
6. Cena subskrypcji (miesięczna / roczna) i ewentualne różnice PL vs. rynki anglojęzyczne.
7. Identyfikacja wizualna i ton komunikacji (kim jest „głos” aplikacji – trener, kumpel?).
