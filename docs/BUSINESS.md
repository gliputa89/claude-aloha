# Aloha Training – opis biznesowy

*Wersja 0.3 · listopad 2026 · dokument roboczy*

Uzupełnienie [`PROJECT.md`](PROJECT.md) (produkt i MVP) o część biznesową.

| Sekcja | Status |
|---|---|
| 1. Analiza konkurencji | ✅ wersja 1 |
| 2. Propozycja wartości i pozycjonowanie | ✅ wersja 1 |
| 3. Koszty (AI + infrastruktura na użytkownika) | ✅ wersja 1 |
| 4. Wejście na rynek i plan marketingowy (PL → EN) | ✅ wersja 1 |
| 5. Ryzyka i ich ograniczanie | ⏳ następna |

---

## 1. Analiza konkurencji

> **Zastrzeżenie:** dane zebrane w listopadzie 2026, głównie ze stron trzecich (recenzje, porównywarki, opisy w sklepach). Wiele porównań piszą sami producenci aplikacji. Ceny i funkcje należy potwierdzić u źródła przed podejmowaniem decyzji cenowych. Pola „?” = brak wiarygodnych danych.

### 1.1 Przegląd

| Aplikacja | Model i cena (USD) | Jak adaptuje plan | Reakcja na „gorszy dzień” / brak czasu | Wymaga zegarka |
|---|---|---|---|---|
| **Runna** (należy do Strava) | Premium ok. 19,99/mies. lub 119,99/rok; pakiet Strava + Runna 149,99/rok; darmowa wersja ograniczona (źródła niespójne) | plany układane przez trenerów + korekty temp i obciążenia na podstawie realizacji | ręczne przesunięcie treningu (tylko w obrębie ±1 tygodnia i tylko na pusty dzień); „Plan Realignment” dopiero po kilku opuszczonych treningach | nie |
| **Garmin Coach** | darmowy z kontem Garmin; Connect+ (6,99/mies. lub 69,99/rok) dodaje treści i analizy | dane z zegarka: realizacja, regeneracja, gotowość | adaptacja zachowawcza; wg użytkowników opuszczone treningi nie są przenoszone | tak (Garmin) |
| **adidas Running** | plany treningowe i adaptacyjne w Premium; cena ? | plany, w tym „Walk to Run” dla początkujących | ? | nie |
| **Nike Run Club** | biegi z lektorem darmowe; status planów niejasny (źródła sprzeczne) | głównie gotowe plany | ? | nie |
| **TrainAsONE** | ok. 10/mies. | najbardziej agresywna adaptacja – każda jednostka przeliczana; uwzględnia subiektywny feedback po biegu | automatyczna, ale interfejs oceniany jako przestarzały | nie (ale korzysta z danych) |
| **COROS AI Trainer** | darmowy z zegarkiem COROS | dane z zegarka | wg recenzji lepszy w monitorowaniu niż w planowaniu | tak (COROS) |
| **Coopah** | ? | plany + wskaźnik gotowości do startu | ? | ? |
| **Daptiv** (nowa aplikacja) | ? | AI coach; użytkownik mówi, jak się czuł po biegu; plan dopasowuje się codziennie i co tydzień | ocena **po** treningu | ? |
| **chceByc.fit** (Polska) | ? | AI coach dopasowuje plan co tydzień + marketplace planów od polskich trenerów + społeczność | ? | ? |

### 1.2 Najbliżsi konkurenci w naszym koncepcie

1. **Runna** – lider „ładnych” planów, silna marka i dystrybucja przez Stravę. Ruchy w planie są głównie **ręczne i ograniczone** (przeciąganie, sztywne reguły). To dla nas główny punkt odniesienia w UX i cenie.
2. **Daptiv** – koncepcyjnie najbliżej nas (subiektywne samopoczucie → zmiana planu). Różnica: pyta **po** biegu, my **przed** treningiem i o życie (czas, sen, stres), a nie tylko o sam bieg. Warto ją obserwować.
3. **Garmin Coach** – darmowy dla posiadaczy zegarków Garmin. Dla średnio zaawansowanych (którzy często mają Garmina) to mocna, darmowa alternatywa.
4. **chceByc.fit** – jedyny zauważony lokalny gracz z AI; inny akcent (marketplace trenerów i społeczność).

### 1.3 Wnioski dla Aloha Training

**Co już jest standardem (nie wyróżnia):**
- „Adaptacyjny plan z AI” to dziś hasło niemal każdej aplikacji. **Nie możemy komunikować się samym „AI planem”.**
- Ceny odniesienia: ok. **10–20 USD/mies.** lub **70–120 USD/rok**. Garmin Coach i COROS – za darmo dla posiadaczy zegarków.

**Luka, w którą celujemy:**

| Konkurencja | Aloha Training |
|---|---|
| adaptacja na podstawie **danych** (tempo, tętno, zegarek) albo oceny **po** biegu | pytanie **przed** treningiem: „Jak się dziś czujesz?” + życie (czas, sen, stres, dzieci) |
| zmiany ręczne (przeciągnij i upuść, ograniczenia) albo ciche, automatyczne | **propozycja z ludzkim uzasadnieniem**, akceptowana jednym tapnięciem |
| najlepsza adaptacja często wymaga zegarka | działa **bez sprzętu** – ważne dla początkujących |
| język wyników: tempa, VO2max, gotowość | język **życia**: bez poczucia winy, „trener, ale kumpel” |
| głównie po angielsku | **polski od pierwszego dnia** + angielski |

**Zagrożenia:**
- Strava/Runna lub Garmin mogą stosunkowo łatwo dodać przedtreningowy check-in. Nasza przewaga musi wynikać z **całego doświadczenia** (szybkość, ton, uzasadnienia, skupienie na zapracowanych amatorach), a nie z pojedynczej funkcji.
- Średnio zaawansowani z zegarkiem Garmin mają darmową alternatywę → **integracja z Garmin / Health Connect / Apple Health po MVP jest ważna**, żeby nie konkurować z danymi, tylko z nich korzystać.
- Nowe aplikacje AI pojawiają się co miesiąc – liczy się tempo wejścia na rynek i społeczność.

### 1.4 Polski rynek – skala

- Wg CBOS (2022) kilka razy w miesiącu biega **10–12% dorosłych Polaków (ok. 2,9–3,5 mln)**, a kilka razy w tygodniu **5–6% (ok. 1,45–1,75 mln)**.
- Nowszych, reprezentatywnych danych o liczbie biegaczy nie znaleziono – warto sprawdzić pełny raport „Poziom aktywności fizycznej Polaków 2025” Ministerstwa Sportu i Turystyki.
- Lokalnej konkurencji z polskim językiem i AI jest niewiele (zauważona: chceByc.fit).

### 1.5 Rekomendowane kolejne kroki

1. **Test „gorszego dnia”**: zainstaluj Runna, Garmin Coach (jeśli masz zegarek) i Daptiv; przez tydzień symuluj sytuacje typu „mam 20 minut” / „nie spałem” i zanotuj, ile kroków i czasu zajmuje dostosowanie planu. To da twardy argument do pozycjonowania.
2. Sprawdzić u źródła: aktualne ceny Runna w PL, czy Runna i Daptiv są po polsku, ofertę chceByc.fit.
3. Wnioski przenieść do sekcji 2 (propozycja wartości).

---

## 2. Propozycja wartości i pozycjonowanie

### 2.1 Jednym zdaniem

> 🇵🇱 **Plan biegowy, który pyta, jak się czujesz – i dopasowuje trening do Twojego dnia, a nie odwrotnie.**
>
> 🇬🇧 **The running plan that asks how you feel – and fits your day, not the other way around.**

### 2.2 Pozycjonowanie

**Dla** biegaczy-amatorów w wieku 30–40 lat, którzy łączą bieganie z pracą i rodziną,
**Aloha Training** to aplikacja treningowa, która **przed każdym treningiem pyta o samopoczucie
i w kilka sekund proponuje rozsądną zmianę planu**.
**W przeciwieństwie do** aplikacji reagujących na dane z zegarka albo wymagających ręcznego przesuwania treningów,
**Aloha reaguje na życie** – bez zegarka, bez poczucia winy, z ludzkim uzasadnieniem każdej zmiany.

### 2.3 Filary wartości

| Filar | Co to znaczy dla użytkownika | Jak to dowodzimy |
|---|---|---|
| **Szybko** | check-in w kilka sekund, zmiana jednym tapnięciem | mierzony czas check-inu (cel: mediana < 10 s) |
| **Po ludzku** | „trener, ale kumpel”: rozumie zmęczenie, dzieci, nadgodziny; nie zawstydza | % zaakceptowanych propozycji, opinie z bety |
| **Bezpiecznie** | AI nie zaplanuje niczego ryzykownego – pilnują tego zasady treningowe | silnik reguł waliduje każdą zmianę |
| **Bez sprzętu** | wystarczy telefon; zegarek opcjonalny (integracje po MVP) | działa od pierwszego dnia bez parowania |

### 2.4 Zadania, które użytkownik „wynajmuje” aplikacji (jobs to be done)

1. *„Chcę biegać regularnie, mimo że mój tydzień jest nieprzewidywalny.”*
2. *„Chcę wiedzieć, co zrobić **dziś**, kiedy mam mniej czasu albo sił – bez szukania w internecie.”*
3. *„Chcę dobiec do celu (5 km, półmaraton) bez kontuzji i bez poczucia, że ciągle zawalam plan.”*

### 2.5 Kluczowe komunikaty (do testów w kampaniach)

- „Gorszy dzień to nie porażka. To zmiana planu.”
- „Masz dziś 20 minut? Wystarczy.”
- „Plan, który wie, że masz życie.”
- „Jedno pytanie rano. Reszta po naszej stronie.”
- EN: *„Bad day? Your plan gets it.”* · *„20 minutes? That counts.”*

### 2.6 Czym NIE jesteśmy (antypozycjonowanie)

- Nie jesteśmy aplikacją dla zaawansowanych (szybciej niż ~36–37 min / 10 km) ani dla danych-maniaków.
- Nie konkurujemy liczbą wykresów i metryk – konkurujemy tym, jak mało wysiłku wymaga trzymanie się planu.
- Nie zastępujemy lekarza ani fizjoterapeuty.

---

## 3. Koszty

> **Zastrzeżenie:** szacunki na podstawie cennika Claude API (stan: październik 2026) i założeń o długości zapytań. Rzeczywiste koszty zmierzymy w becie. Ceny infrastruktury podane orientacyjnie – do potwierdzenia u dostawców.

### 3.1 Cennik Claude API (USD za 1 mln tokenów)

| Model | Wejście | Wyjście | Uwagi |
|---|---|---|---|
| Claude Haiku 5.5 | 0,10 | 0,50 | najtańszy, szybki |
| Claude Sonnet 5.5 | 2,00 | 10,00 | odczyt z cache 0,20 |
| Claude Opus 5.5 | 4,00 | 20,00 | odczyt z cache 0,20; najwyższa jakość |

Dodatkowe oszczędności:
- **Prompt caching** – stała część zapytania (zasady treningowe, instrukcje, ton) jest cache'owana i rozliczana po stawce odczytu z cache.
- **Batch API (−50%)** – dla zadań bez pośpiechu, np. nocne generowanie kolejnego tygodnia.
- **Reguły przed AI** – check-in „czuję się dobrze, bez notatki” (poziom 0) obsługuje silnik reguł bez wywołania AI.

### 3.2 Założenia dla aktywnego użytkownika (miesiąc)

| Wywołanie | Liczba / mies. | Wejście (tokeny) | Wyjście (tokeny, z „myśleniem”) |
|---|---|---|---|
| Check-in → propozycja zmiany | ~17 (4 treningi/tydz.; założenie pesymistyczne – każdy check-in idzie do AI) | ~3 000 (w tym ~2 000 z cache) | ~1 500 |
| Generowanie kolejnego tygodnia | ~4,3 | ~5 000 (w tym ~2 000 z cache) | ~3 000 |

### 3.3 Koszt AI na aktywnego użytkownika miesięcznie

| Model (ten sam do obu zadań) | Check-iny | Plan tygodniowy | **Razem / mies.** | Z buforem ×2 |
|---|---|---|---|---|
| Haiku 5.5 | ~0,02 USD | ~0,01 USD | **~0,03 USD** | < 0,10 USD |
| Sonnet 5.5 | ~0,30 USD | ~0,16 USD | **~0,45 USD** | ~1 USD |
| Opus 5.5 | ~0,59 USD | ~0,31 USD | **~0,90 USD** | ~2 USD |

Wnioski:
- **Koszt AI jest niski w stosunku do ceny subskrypcji** (konkurencja: 10–20 USD/mies.). Nawet przy najdroższym modelu to kilka–kilkanaście procent przychodu z płacącego użytkownika.
- Decyzję o modelu podejmiemy **na podstawie jakości, nie ceny**: przygotujemy zestaw 20–30 realistycznych scenariuszy check-inu („mało snu + 20 min”, „boli kolano”, „chore dziecko, 3 dni przerwy”) i porównamy odpowiedzi modeli. Możliwy wariant mieszany: tańszy model do interpretacji check-inu, mocniejszy do przeliczania planu.
- **MVP jest darmowe**, więc koszt AI ponosimy w całości. Przykład: 1 000 aktywnych użytkowników × Sonnet 5.5 ≈ **450 USD/mies.** (Haiku ≈ 30 USD, Opus ≈ 900 USD). Zabezpieczenia: reguły przed AI, miesięczny limit wywołań AI na użytkownika, Batch API dla planów tygodniowych, alert kosztowy.

### 3.4 Koszty stałe (orientacyjnie)

| Pozycja | Koszt | Uwagi |
|---|---|---|
| Apple Developer Program | 99 USD / rok | wymagane do App Store |
| Google Play Console | 25 USD jednorazowo | wymagane do Google Play |
| Supabase (baza, auth, funkcje) | od 0 (plan darmowy) do ok. 25 USD / mies. (plan płatny) | na start wystarczy darmowy; płatny przed publikacją – do potwierdzenia |
| Expo / EAS (budowanie aplikacji) | plan darmowy na start | płatny plan przy częstych buildach – do potwierdzenia |
| Powiadomienia push (Expo) | 0 | |
| Domena, e-mail, strona | ~20–50 USD / rok | |
| Prawnik (polityka prywatności, regulamin) | jednorazowo, do wyceny | przed publikacją |

**Szacunek na start (beta, do ~100 użytkowników): poniżej 100 USD miesięcznie** + jednorazowe opłaty sklepowe i prawne.

### 3.5 Wpływ na przyszłą cenę Premium

- Prowizja sklepów: zwykle **15%** dla małych deweloperów i subskrypcji (programy Apple Small Business i Google Play) – do potwierdzenia przy publikacji; do tego VAT.
- Punkt odniesienia rynku: Runna ok. 19,99 USD/mies. lub 119,99 USD/rok.
- Wstępna hipoteza do testów: **ok. 29–39 zł / mies. lub 149–199 zł / rok** w Polsce – wyraźnie taniej niż Runna, przy koszcie AI na poziomie 2–8 zł na płacącego użytkownika. Ostateczną cenę ustalimy po MVP.

---

## 4. Wejście na rynek i plan marketingowy

### 4.1 Założenia

- **Jedna osoba, mały budżet** → marketing oparty na społecznościach, treściach i poleceniach, a nie na płatnych reklamach. Reklamy dopiero wtedy, gdy wiemy, że użytkownicy zostają (retencja).
- **Najpierw Polska**, angielski po sprawdzeniu, że produkt działa.
- **Marketing startuje teraz, nie po napisaniu kodu.** Budowa MVP potrwa kilka miesięcy – w tym czasie zbieramy listę oczekujących i rozmawiamy z przyszłymi użytkownikami.
- **Sezonowość działa na naszą korzyść:**
  - **styczeń** – szczyt postanowień noworocznych („zacznę biegać”) → lista oczekujących musi działać przed Nowym Rokiem,
  - **marzec–czerwiec** – wiosenny sezon startowy (półmaratony, 10 km) → ludzie szukają planów **12–16 tygodni przed startem**, czyli od stycznia–lutego,
  - **wrzesień–październik** – jesienne maratony i druga fala „powrotu do formy”.

### 4.2 Fazy i cele

| Faza | Kiedy (orientacyjnie) | Co robimy | Cel |
|---|---|---|---|
| **0. Lista oczekujących** | XI 2026 – I 2027 | strona z zapisami, treści w social media, rozmowy z użytkownikami, test makiety | **300–500 zapisów**, 10–15 rozmów |
| **1. Zamknięta beta** | II – III 2027 | 50–100 osób z listy, TestFlight + testy w Google Play, grupa na WhatsApp/Discord | retencja po 4 tygodniach ≥ 40%, check-in w ≥ 60% dni treningowych |
| **2. Publikacja PL (darmowa)** | IV 2027 (przed wiosennymi startami) | App Store + Google Play, społeczności, influencerzy, PR | **1 000–3 000 aktywnych**, ocena w sklepach ≥ 4,5 |
| **3. Angielski + monetyzacja** | po zebraniu danych z fazy 2 | wersja EN, paywall, pierwsze płatne kampanie | konwersja do Premium, koszt pozyskania < przychód |

*Terminy zależą od tempa budowy MVP – do aktualizacji.*

### 4.3 Kanały – gdzie są nasi użytkownicy

**A. Społeczności biegowe (najważniejszy kanał na start, koszt ≈ 0)**
- **parkrun Polska** – cotygodniowe, darmowe biegi na 5 km w kilkudziesięciu miastach (wg danych z 2022 r. ok. 80 lokalizacji – do weryfikacji). Idealna grupa: amatorzy, często rodzice. Działanie: obecność jako uczestnik/wolontariusz, rozmowy po biegu, ulotka z QR (po uzgodnieniu z organizatorami – parkrun ma własne zasady dot. promocji).
- **Grupy biegowe na Facebooku i kluby Strava** (ogólnopolskie i lokalne, np. „Biegacze [miasto]”, grupy dla biegających rodziców) – wartościowe posty, nie spam: darmowe porady, ankiety, zaproszenie do bety.
- **Kluby i grupy treningowe** (w tym bezpłatne treningi typu „Biegam Bo Lubię”) – rozmowy z trenerami; trener może polecić aplikację podopiecznym na dni bez wspólnego treningu.

**B. Duże biegi i biegi firmowe**
- Duże polskie imprezy gromadzą dziesiątki tysięcy osób – np. Nocny Wrocław Półmaraton 2026 miał ponad 26 tys. zgłoszeń, a Poland Business Run ponad 21 tys. zgłoszonych kilka dni po otwarciu zapisów.
- **Kampania „Twój pierwszy półmaraton / 10 km”** startująca 12–16 tygodni przed dużym biegiem: treści + plan w aplikacji pod konkretną datę startu.
- **Biegi firmowe (np. Poland Business Run)** to dokładnie nasza grupa: pracujący 30–40-latkowie. Pomysł na później: współpraca z firmami i benefit pracowniczy (patrz 4.9).
- Stoiska na expo są drogie – na start wystarczy obecność „od strony uczestnika” i materiały z QR, jeśli organizator pozwoli.

**C. Treści (content marketing)**
- **Instagram / TikTok / YouTube Shorts – krótkie formy**, seria w tonie „trener, ale kumpel”:
  - „Masz dziś 20 minut? Oto co zrobić.”
  - „Gorszy dzień – i co teraz?” (prawdziwe sytuacje: chore dziecko, nadgodziny, brak snu),
  - „Plan vs. życie” – humorystyczne porównania,
  - mini-porady dla początkujących (tempo rozmowy, marsz-bieg, pierwsze 5 km).
- **LinkedIn** – trafia do pracujących 30–40-latków; historia budowania aplikacji z AI przez jedną osobę („building in public”) jest dla tej grupy ciekawa sama w sobie.
- **Blog / SEO po polsku** – mniejsza konkurencja niż po angielsku. Tematy: „plan treningowy 5 km dla początkujących”, „jak biegać, gdy masz mało czasu”, „plan na pierwszy półmaraton”, „bieganie po porodzie / z dziećmi”, „co zrobić, gdy opuścisz trening”. Każdy artykuł kończy się zaproszeniem do aplikacji.
- **Podcasty biegowe i parentingowe** – występy gościnne z historią projektu.

**D. Influencerzy**
- **Mikroinfluencerzy (ok. 5–50 tys. obserwujących)** – biegający rodzice, amatorzy w trakcie przygotowań do pierwszego startu. Wiarygodniejsi i tańsi niż duże konta.
- Model na start: **barter** (wczesny dostęp, dożywotnie Premium „członka założyciela”), później program poleceń z prowizją.
- Najlepszy format: **influencer realnie trenuje z aplikacją 8–12 tygodni do startu** i pokazuje także gorsze dni.

**E. Wzrost wbudowany w produkt**
- **Karta do udostępnienia**: „Tydzień zrobiony – mimo wszystko 💪” (Instagram Stories).
- **„Biegaj z kumplem”** – zaproszenie znajomego; w becie: miejsce na liście wyżej za każde polecenie.
- **Prośba o ocenę w sklepie** w dobrym momencie (np. po 3. zrealizowanym tygodniu, nie po opuszczonym treningu).

**F. Sklepy z aplikacjami (ASO)**
- Słowa kluczowe PL: *plan treningowy bieganie, bieganie dla początkujących, plan na 5 km / 10 km / półmaraton, trener biegowy*.
- Zrzuty ekranu z hasłami („Masz 20 minut? Wystarczy.”) zamiast samych widoków aplikacji.

**G. Płatne reklamy (dopiero w fazie 2–3)**
- Małe testy (Meta / TikTok) po potwierdzeniu retencji; mierzymy koszt instalacji i koszt aktywnego użytkownika, nie same kliknięcia.

### 4.4 Strona z listą oczekujących (do zrobienia jako pierwsza)

- Hasło: *„Plan biegowy, który pyta, jak się czujesz.”* + 3 filary + makiety ekranów.
- Formularz: e-mail + **2 pytania badawcze**: „Jaki masz cel?” i „Co najczęściej psuje Ci plan treningowy?” – odpowiedzi to darmowe badanie rynku.
- Zgoda na komunikację marketingową zgodna z RODO (osobny checkbox).
- „Przesuń się w kolejce” za polecenie znajomym.
- Cel konwersji odwiedzający → zapis: ok. 15–30%.

### 4.5 Program bety

- Rekrutacja z listy oczekujących **według persony** (30–40 lat, praca, ograniczony czas; mieszanka początkujących i średnio zaawansowanych).
- Status **„Członek założyciel”**: dożywotnie Premium + wpływ na rozwój aplikacji.
- Wspólna grupa (WhatsApp/Discord) z twórcą, cotygodniowe 3 pytania, jedna rozmowa wideo na początku i na końcu.
- Zbieramy: retencję, % wypełnionych check-inów, % zaakceptowanych propozycji, cytaty do materiałów marketingowych (za zgodą).

### 4.6 Plan na najbliższe 12 tygodni (faza 0 → start bety)

| Tydzień | Działania |
|---|---|
| 1 | Nazwa robocza, profile w social media (IG, TikTok, LinkedIn), strona z listą oczekujących |
| 2 | Pierwszy post „buduję aplikację dla zapracowanych biegaczy” (LinkedIn + IG); dołączenie do 10–15 grup biegowych |
| 3 | 5 rozmów z użytkownikami na podstawie makiety (scenariusz rozmowy) |
| 4 | Seria treści „Gorszy dzień – i co teraz?” (3 krótkie filmy/posty); pierwszy artykuł SEO |
| 5 | Kolejne 5–10 rozmów; analiza odpowiedzi z formularza → korekta komunikatów |
| 6 | Kontakt z 10 mikroinfluencerami (propozycja „członka założyciela”) |
| 7 | **Kampania noworoczna**: „Zacznij biegać w 2027 – bez wyrzutów sumienia” |
| 8 | Obecność na parkrunie / treningach grupowych w swoim mieście; drugi artykuł SEO |
| 9 | Ogłoszenie daty bety, akcja poleceń („przesuń się w kolejce”) |
| 10 | Wybór 50–100 beta testerów, zaproszenia |
| 11 | Start bety; content „za kulisami” |
| 12 | Pierwsze wnioski z bety; publiczne podsumowanie (building in public) |

**Rytm stały:** 3 posty krótkie / tydzień, 1 post na LinkedIn / tydzień, 1 artykuł / 2 tygodnie, 2–3 rozmowy z użytkownikami / tydzień.

### 4.7 Budżet

| Faza | Budżet | Na co |
|---|---|---|
| 0–1 (lista + beta) | **0–1 500 zł** | domena, narzędzie do formularza/e-maili, ulotki z QR, drobne nagrody dla testerów |
| 2 (publikacja PL) | **2 000–5 000 zł** | testy reklam, upominki dla influencerów, materiały na biegi |
| 3 (EN + monetyzacja) | wg danych | skalowanie kanałów, które działają |

### 4.8 Wskaźniki marketingowe

| Etap lejka | Wskaźnik | Cel (wstępny) |
|---|---|---|
| Świadomość | zasięg treści, wejścia na stronę | rośnie tydzień do tygodnia |
| Zainteresowanie | zapisy na listę, konwersja strony | 300–500 przed betą; 15–30% |
| Aktywacja | ukończony onboarding, pierwszy check-in | ≥ 70% / ≥ 60% zainstalowanych |
| Retencja | aktywni po 4 i 8 tygodniach | ≥ 40% / ≥ 30% |
| Polecenia | % użytkowników zapraszających znajomych, oceny w sklepie | ≥ 10%; ocena ≥ 4,5 |

### 4.9 Pomysły na później (B2B)

- **Benefit pracowniczy** – pakiet dla firm (np. przed biegami firmowymi): pracownicy dostają Premium, firma – anonimowe statystyki zaangażowania.
- **Kluby i trenerzy** – trener widzi realizację planów podopiecznych między wspólnymi treningami.

### 4.10 Zasady komunikacji

- Ton **„trener, ale kumpel”** – jak w produkcie.
- **Prawdziwe historie > hasła o AI.** AI to „jak”, a nie „co” – nie zaczynamy komunikatu od „AI”.
- **Nie obiecujemy efektów zdrowotnych** ani wyników („schudniesz”, „pobijesz rekord”).
- Treści influencerów **oznaczone jako reklama/współpraca** zgodnie z wytycznymi UOKiK.
- E-mail marketing tylko za **wyraźną zgodą** (RODO).

### Źródła

- Cennik Claude API – dokumentacja Anthropic (stan: październik 2026)

- [Runna – pricing (the5krunner, X 2026)](https://the5krunner.com/2026/10/14/is-runna-free/)
- [Runna – ceny zakupów w aplikacji (App Pricing Lab)](https://www.apppricinglab.com/iap/apple/1594204443)
- [Strava + Runna – wspólna subskrypcja (Wareable)](https://www.wareable.com/sport/strava-runna-combined-subscription-announcement-price)
- [Runna – jak pominąć trening](https://support.runna.com/en/articles/15012850-how-and-when-to-skip-a-run-managing-missed-sessions-in-your-training-plan)
- [Runna – Plan Realignment](https://support.runna.com/en/articles/10026375-how-to-use-the-plan-realignment-feature)
- [Runna – kalendarz treningowy](https://support.runna.com/en/articles/10137793-how-to-use-and-manage-your-training-calendar)
- [Garmin – Adaptive Training Plans (instrukcja)](https://www8.garmin.com/manuals/webhelp/GUID-2DA54DF8-8084-40ED-954F-EDA09C13B47F/EN-US/GUID-71798B16-A9A9-4D0F-BF64-50DD65AFC0D5.html)
- [Garmin Connect+ – cena (Tom's Guide)](https://www.tomsguide.com/wellness/smartwatches/garmin-launches-a-paywall-here-are-all-the-premium-connect-features-that-will-cost-you-usd6-99-a-month)
- [Garmin Connect+ – koszt w 2026 (TrackerVs)](https://trackervs.com/pricing/garmin-subscription-cost/)
- [Forum Garmin – przenoszenie opuszczonych treningów](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/214040/reschedule-missed-workout-on-a-training-plan/1744216)
- [Best AI Running Coach Apps 2026 (The Running Genie)](https://therunninggenie.com/blog/best-ai-running-coach-apps)
- [Best AI Marathon Training Apps 2026 (SensAI)](http://www.sensai.fit/blog/best-ai-marathon-training-apps-2026)
- [Best AI Running Coaches 2026 (Runner's Picks)](https://www.runnerspicks.com/blog/best-ai-running-coaches-2026)
- [Best Running App for Busy Parents 2026 (Edge)](https://www.findyouredge.app/news/best-running-app-for-busy-parents-2026-uk)
- [adidas Running – App Store](https://apps.apple.com/kh/app/id336599882?l=en-gb)
- [Nike – Running Training Plans](https://www.nike.com/running/training-plans)
- [Daptiv – App Store](https://apps.apple.com/us/app/daptiv/id6751173422)
- [chceByc.fit – App Store](https://apps.apple.com/pl/app/id6767924382)
- [CBOS 2022 o bieganiu (OKO.press)](https://oko.press/sezon-na-bieganie-czy-maraton-moze-zaszkodzic)
- [parkrun Polska – liczba lokalizacji, 2022 (Nord Anglia)](https://www.nordangliaeducation.com/tbsw-warsaw/news/parkrun-polska)
- [Nocny Wrocław Półmaraton 2026 (wroclaw.pl)](https://www.wroclaw.pl/sport/nocny-wroclaw-polmaraton-2026-zdjecia-uczestnikow)
- [Poland Business Run – liczba zgłoszeń (RMF24)](https://www.rmf24.pl/polecamy-rmf24/news-juz-ponad-21-tysiecy-biegaczy-zgloszonych-do-jubileuszowego-,nId,8087710)
