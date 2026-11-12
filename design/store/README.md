# design/store – materiały do sklepów

Zrzuty ekranów z hasłami, grafiki App Store / Google Play, teksty ASO.
Teksty kart sklepowych: [`marketing/sklepy/`](../../marketing/sklepy/).

## Google Play (`google-play/`)

| Plik | Wymóg Google Play | Skąd |
|---|---|---|
| `aloha-icon-512.png` | ikona aplikacji, 512 × 512 PNG, do 1 MB | `apps/mobile/assets/images/icon.png` zmniejszona (`sips -z 512 512`) |
| `aloha-feature-graphic-pl.png` | grafika główna, 1024 × 500 PNG/JPG, do 15 MB | render z `feature-graphic.html` |
| `aloha-feature-graphic-en-us.png` | grafika główna dla wersji US (en-US) | render z `feature-graphic-en-US.html` |

Grafika główna: tło marki (Laguna), tonalny wzór „Plumerie”, znak „Słońce nad falą”, hasło
„Plan biegowy, który wie, że masz życie” (scenariusz z `marketing/sklepy/2026-11-10-karty-sklepowe-pl.md`).
Bez zrzutu ekranu – dopóki nie ma finalnych ekranów, grafika nie pokazuje funkcji.

Ponowny render po zmianie HTML (z tego folderu):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 --window-size=1024,500 --screenshot="$PWD/google-play/aloha-feature-graphic-pl.png" "file://$PWD/google-play/feature-graphic.html"
```

## Zrzuty ekranu (`screens/`)

- `raw/<lang>/` – surowe zrzuty z symulatora iPhone 17 Pro (1206 × 2622): pasek statusu 9:41
  (`xcrun simctl status_bar … override`), dev build uruchomiony bez przycisku narzędzi
  (`exp+aloha-training://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081&__expo_disable_fab=1`),
  konto demo po ankiecie ze startem planu „dziś”, żeby był check-in i propozycja zmiany.
- `out/<lang>/aloha-<pl|en-us>-01–06.png` – plansze (nazwy z językiem – Play Console odrzuca jako duplikaty pliki o tych samych nazwach w dwóch językach) do Google Play, 1080 × 1920 (9:16): hasło + ekran w ramce. Hasła i kolejność
  w `screens/build.mjs`; render: `node design/store/screens/build.mjs [pl|en]`.
- Teksty od AI (notki trenera, czat) są w języku profilu z rejestracji – wersja EN wymaga osobnego konta założonego
  na symulatorze ustawionym na angielski.

Uwagi z sesji zdjęciowej (12.11.2026) – do poprawy w aplikacji przed finalnymi zrzutami:
- ekran „Plan gotowy!” ucina notkę trenera wielokropkiem,
- dysklejmer zdrowotny w ankiecie mówi „Aloha App”, a apka w sklepie to „Aloha Training”,
- w wersji EN daty są w formacie brytyjskim („Thursday 12 November”) – na rynek US lepiej „Thursday, November 12”,
- imię konta demo pojawia się na zrzutach („Aloha, Greg!”),
- wersja EN: trener AI nadal nazywa się „Keanu Biegała” – gra słów działa tylko po polsku; na rynek US warto
  rozważyć angielski wariant imienia,
- wersja EN: mile, °F i mph działają (region US, 12.11.2026) – ale opisy celów w ankiecie nadal mówią „5 km” (stałe teksty),
  a godziny w karcie pogody są w formacie 24h („07:00–13:00”) zamiast „7 AM–1 PM”,
- ankieta EN: przy „I run regularly” wpisywanie w pole „Miles per week” gubi znaki, a błąd walidacji cofa ekran na górę;
  do zrzutów użyto „I run now and then”,
- język treści od AI zależy od `profiles.locale` (ustawiany przy rejestracji, w aplikacji nie da się go zmienić);
  do zrzutów EN zmieniony ręcznie w Supabase,
- plansza EN 01 ma w pasku statusu strzałkę lokalizacji (apka pobierała pogodę) – do ponownego zrzutu, jeśli przeszkadza.
