# Aloha Training – plan premiery i reklamy (iOS + Android)

*10 listopada 2026 · wersja 2 · autor: marketing*

**Decyzje założyciela (10.11.2026):**
- bez listy oczekujących i bez zamkniętej bety – od razu sklepy z gotowym produktem,
- nazwa: **Aloha Training**,
- tylko bieganie.

Zastępuje harmonogram z `docs/MARKETING.md` (fazy 0–1 wypadają). Pozycjonowanie, ton i zasady
komunikacji z tamtego dokumentu i z `docs/BUSINESS.md` zostają.

---

## 1. Co reklamujemy

Jedna scena, we wszystkich materiałach: **zły dzień → jedno pytanie → nowy, wykonalny trening.**

- Hasło główne: *„Gorszy dzień to nie porażka. To zmiana planu.”*
- Hasła do testów: *„Masz dziś 20 minut? Wystarczy.”* · *„Plan biegowy, który wie, że masz życie.”* ·
  *„Jedno pytanie rano. Reszta po naszej stronie.”*
- Nie zaczynamy od „AI”. Nie obiecujemy wyników ani zdrowia.
- Adresat: zapracowany amator 30–40 lat. Styczeń – „zaczynam / wracam do biegania”.
  Luty–kwiecień – „pierwsze 10 km lub półmaraton wiosną”.

## 2. Nazwa w sklepach

Marka: **Aloha Training**. Tytuł w obu sklepach (limit 30 znaków):
**„Aloha Training: plan biegowy”** (28 znaków) – nazwa zostaje, a fraza „plan biegowy” pracuje
w wyszukiwarce sklepu.

- App Store, podtytuł (30): „Trening dopasowany do dnia”
- Google Play, krótki opis (80): „Plan biegowy, który pyta, jak się czujesz, i dopasowuje trening do Twojego dnia.”

## 3. Co musi być gotowe przed wysłaniem do sklepów

Bez bety te rzeczy nie mają już bufora – każda blokuje premierę albo reklamę.

| # | Rzecz | Dlaczego |
|---|---|---|
| 1 | **Check-in i propozycja zmiany planu** | to jest cała obietnica reklamy; nie znalazłem tego ekranu w kodzie |
| 2 | Działający build na **Androidzie** | większość telefonów w Polsce; dziś aplikacja chodzi jako build iOS |
| 3 | Polityka prywatności, regulamin, zgoda na dane o zdrowiu, usuwanie konta w aplikacji | wymóg przeglądu w obu sklepach |
| 4 | **Wymóg testów Google Play** – wg mojej wiedzy nowe konto *osobiste* musi przejść test zamknięty (12 osób, 14 dni) przed publikacją; konto *firmowe* nie. **Do sprawdzenia u źródła.** | to jedyna „beta”, której możemy nie ominąć; konto firmowe rozwiązuje sprawę |
| 5 | Zdarzenia w aplikacji: instalacja, ukończona ankieta, pierwszy check-in, wykonany trening | bez nich nie da się ocenić żadnej reklamy |
| 6 | Pomiar reklam: SDK Meta i Google (Firebase), na iOS zgoda na śledzenie i SKAdNetwork | bez tego kampanie instalacyjne nie optymalizują się |
| 7 | Prośba o ocenę po 3. zrealizowanym tygodniu, karta do udostępnienia | darmowy zasięg i oceny |
| 8 | Strona: hasło, 4 ekrany, dwa przyciski do sklepów; domena | cel dla linków z treści i od influencerów |
| 9 | Monitoring błędów | bez bety pierwsi użytkownicy są testerami; trzeba widzieć awarie tego samego dnia |

## 4. Harmonogram

| Etap | Kiedy | Co |
|---|---|---|
| **A. Przygotowanie** | teraz → wysłanie do przeglądu | punkty z sekcji 3, karty sklepowe, 10 filmów i grafik na zapas, profile IG / TikTok / LinkedIn |
| **B. Cicha premiera** | pierwsze 10–14 dni w sklepach | aplikacja jest publiczna, ale bez płatnej reklamy; ruch tylko z własnych profili i znajomych. Łapiemy awarie, zbieramy pierwsze 20–30 ocen |
| **C. Głośna premiera** | **od 2 stycznia 2027** | kampania „Zacznij biegać w 2027 – bez wyrzutów sumienia”: reklamy, influencerzy, społeczności, PR |
| **D. Fala wiosenna** | luty–kwiecień | „Twój pierwszy półmaraton / 10 km” pod daty polskich biegów |
| **E. Skalowanie** | po danych z C i D | większe budżety tylko w kanałach z dobrą retencją; wersja angielska; paywall |

Cicha premiera to nie beta – to dwa tygodnie w sklepie bez wydawania pieniędzy. Pomijanie jej oznacza
płacenie za instalacje wersji, której nikt poza nami nie używał.

Żeby zdążyć na styczeń, aplikacja powinna trafić do przeglądu **najpóźniej w połowie grudnia**
(przeglądy przed świętami zwalniają). Jeśli nie zdąży – głośna premiera przesuwa się na falę wiosenną
(połowa lutego), a nie rusza z niedokończonym produktem.

## 5. Jak reklamujemy aplikację

### 5.1 Karty sklepowe (koszt 0, robią największą różnicę)

- Słowa kluczowe: *plan treningowy bieganie, bieganie dla początkujących, plan 5 km, plan 10 km,
  półmaraton plan, trener biegowy, jak zacząć biegać*.
- 5 zrzutów ekranu z hasłami, w kolejności sceny: „Jak się dziś czujesz?” → „Masz 20 minut?
  Wystarczy.” → propozycja z uzasadnieniem → tydzień po zmianie → „Bez zegarka.”
- Krótkie wideo podglądu (15–20 s) – ta sama scena.
- Od pierwszego dnia: odpowiadamy na każdą opinię w sklepie.

### 5.2 Treści własne (koszt 0, czas)

- **Instagram Reels + TikTok** (ten sam film): 3 tygodniowo. Formaty:
  1. „Gorszy dzień – i co teraz?” – prawdziwa sytuacja i nagranie ekranu z propozycją zmiany,
  2. „Plan vs. życie” – humor,
  3. mini-porada dla początkujących (tempo rozmowy, marsz-bieg).
- **LinkedIn założyciela**: 1 post tygodniowo – historia budowy aplikacji w pojedynkę. To dokładnie
  nasza grupa: pracujący 30–40-latkowie.
- Filmy, które organicznie niosą się najlepiej, stają się reklamami płatnymi (5.3).

### 5.3 Reklama płatna

Aplikacja jest darmowa, więc każda złotówka reklamy to na razie koszt bez zwrotu. Dlatego: małe
testy, twarde zasady zatrzymania, większe budżety dopiero przy znanej retencji.

| Kanał | Platforma | Po co | Budżet testowy / mies. |
|---|---|---|---|
| **Meta (Instagram + Facebook)** – kampania na instalacje, Reels i Stories | iOS + Android | główny kanał; nasza grupa wiekowa jest na Instagramie i Facebooku | 1 500 zł |
| **Google App Campaigns** – wyszukiwarka, YouTube, Google Play | Android | najtańsze instalacje na Androidzie; łapie osoby szukające „plan treningowy bieganie” | 1 000 zł |
| **Apple Search Ads** – reklama w wyszukiwarce App Store | iOS | osoby z gotową intencją, wpisujące „plan biegowy”, „Runna” itp. Dostępność i stawki w Polsce – do sprawdzenia | 500 zł |
| **TikTok** – promowanie własnych filmów, które już się niosą | iOS + Android | dopiero gdy któryś film organicznie się wybije | 0 na start |

**Razem na start: ok. 3 000 zł miesięcznie** (górna połowa widełek z dotychczasowego planu).

Kreacje do pierwszego testu (5 wariantów, wideo 10–15 s, pionowe):
1. **20 minut** – „Miały być interwały. Masz 20 minut. Aloha: zróbmy spokojne 20, interwały w czwartek.”
2. **Nieprzespana noc** – rodzic, chore dziecko, suwak na „Słabo”, propozycja luźnego biegu.
3. **Bez wyrzutów** – „Opuściłeś trening? Twoja apka robi ci wyrzuty. Nasza przestawia plan.”
4. **Bez zegarka** – „Nie masz Garmina? Nie potrzebujesz.”
5. **Pierwsze 5 km** – dla początkujących, marsz-bieg, „zacznij w styczniu, bez spiny”.

Zasady:
- Oceniamy **koszt aktywowanego użytkownika** (ukończona ankieta + pierwszy trening), nie koszt instalacji.
- Każda kreacja dostaje ok. 150–200 zł; te bez wyniku wyłączamy, budżet idzie na 1–2 najlepsze.
- Co 2 tygodnie nowe warianty zwycięzcy.
- **Stop:** jeśli po 4 tygodniach retencja użytkowników z reklam jest poniżej 25%, wyłączamy płatne
  i naprawiamy produkt albo komunikat.
- **Skalowanie:** retencja po 4 tygodniach ≥ 40% → podwajamy budżet w najlepszym kanale.

### 5.4 Mikroinfluencerzy

- 5–10 kont po 5–50 tys. obserwujących: biegający rodzice, amatorzy przed pierwszym startem.
- Format: realnie trenują z aplikacją 8–12 tygodni do wiosennego biegu i pokazują także gorsze dni.
- Rozliczenie: barter (dożywotnie Premium „członka założyciela”) + drobny upominek; treści oznaczone
  jako współpraca (UOKiK).
- Start rozmów: teraz, żeby pierwsze publikacje wypadły w styczniu.

### 5.5 Społeczności i biegi

- Grupy biegowe na Facebooku i kluby na Stravie: najpierw pomagamy, potem pokazujemy aplikację.
  Bez spamu – jedna dobra odpowiedź z linkiem działa lepiej niż ogłoszenie.
- parkrun i bezpłatne treningi grupowe: obecność jako uczestnik, ulotka z kodem QR po uzgodnieniu
  z organizatorem.
- Wiosenne biegi (10 km, półmaratony): treści i plan w aplikacji pod konkretną datę startu.

### 5.6 PR

Historia: „jedna osoba zbudowała aplikację biegową, która nie robi wyrzutów sumienia”. Media biegowe,
parentingowe i technologiczne, podcasty biegowe. Wysyłka w tygodniu głośnej premiery.

### 5.7 Wzrost z produktu

Karta „Tydzień zrobiony – mimo wszystko” do Stories, zaproszenie znajomego, prośba o ocenę
w dobrym momencie.

## 6. Pomiar

**Miara nadrzędna:** użytkownicy, którzy w danym tygodniu zrobili co najmniej 2 treningi.

| Etap | Wskaźnik | Cel |
|---|---|---|
| Karta sklepowa | wyświetlenie → instalacja | punkt odniesienia z cichej premiery, potem poprawa |
| Aktywacja | ukończona ankieta / pierwszy check-in | ≥ 70% / ≥ 60% |
| Nawyk | check-in w dni treningowe | ≥ 60% |
| Retencja | aktywni po 4 / 8 tygodniach | ≥ 40% / ≥ 30% |
| Sklepy | średnia ocena | ≥ 4,5 |
| Reklama | koszt aktywowanego użytkownika, osobno iOS i Android, osobno każdy kanał | punkt odniesienia po 2 tygodniach |

Cel na 60 dni od głośnej premiery: **1 000–3 000 aktywnych**.
Raport co tydzień w `marketing/analizy/`.

## 7. Ryzyka wejścia bez bety

| Ryzyko | Zabezpieczenie |
|---|---|
| Błędy pierwszej wersji → oceny 1★, których nie da się cofnąć | cicha premiera, monitoring błędów, odpowiedź na każdą opinię, szybkie poprawki |
| Nie znamy retencji, a płacimy za instalacje | małe budżety i zasada „stop” z 5.3 |
| Koszt AI rośnie z każdym użytkownikiem darmowej aplikacji | limit wywołań na użytkownika i alert kosztowy (są w `docs/BUSINESS.md`) |
| Android opóźniony przez wymóg testów Google | sprawdzić dziś; w razie czego konto firmowe |
| Check-in nie zdąży na grudzień | głośna premiera przechodzi na falę wiosenną |

## 8. Najbliższe 14 dni (marketing)

1. Głos marki i dwie persony w `marketing/strategia/`.
2. Teksty kart sklepowych (PL) dla App Store i Google Play + scenariusz 5 zrzutów ekranu.
3. Scenariusze 5 kreacji reklamowych z sekcji 5.3 w `marketing/reklamy/`.
4. Kalendarz treści na 4 tygodnie i pierwsze 6 postów w `marketing/posty/`.
5. Lista 20 mikroinfluencerów i wzór wiadomości.
6. Opis strony docelowej (sekcje i teksty) do wdrożenia.

Po stronie założyciela: konta w sklepach (i sprawdzenie wymogu Google), rezerwacja profili
pod nazwą Aloha Training, decyzja o budżecie reklamowym.
