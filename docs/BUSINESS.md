# Aloha Training – opis biznesowy

*Wersja 0.1 · listopad 2026 · dokument roboczy*

Uzupełnienie [`PROJECT.md`](PROJECT.md) (produkt i MVP) o część biznesową.

| Sekcja | Status |
|---|---|
| 1. Analiza konkurencji | ✅ wersja 1 |
| 2. Propozycja wartości i pozycjonowanie | ⏳ następna |
| 3. Koszty (AI + infrastruktura na użytkownika) | ⏳ |
| 4. Wejście na rynek (PL → EN) | ⏳ |
| 5. Ryzyka i ich ograniczanie | ⏳ |

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

### Źródła

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
