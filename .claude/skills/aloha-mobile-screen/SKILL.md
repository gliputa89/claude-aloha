---
name: aloha-mobile-screen
description: Zasady budowy ekranów i komponentów aplikacji mobilnej Aloha App (apps/mobile, Expo + Expo Router). Użyj przed tworzeniem lub zmianą każdego ekranu, komponentu UI, nawigacji albo tekstu w apps/mobile, np. „zrób ekran Dzisiaj”, „dodaj check-in”, „popraw kartę treningu”, „onboarding”, „ustawienia”, a także przy przeglądzie takich zmian.
---

# Ekrany aplikacji mobilnej Aloha App

Ten skill zbiera decyzje projektu, których nie znają ogólne skille Expo i React Native. Ogólne API Expo (Router, moduły, EAS) bierz z pluginu Expo lub z dokumentacji wersji z `apps/mobile/package.json`, zgodnie z [`apps/mobile/AGENTS.md`](../../../apps/mobile/AGENTS.md). Tu jest to, **jak ma wyglądać i brzmieć** ekran Aloha App.

## Zanim zaczniesz

1. Przeczytaj fragment [`docs/PROJECT.md`](../../../docs/PROJECT.md) dla danego ekranu (rozdział 4: check-in 4.4, skala zmian 4.5, realizacja 4.6, onboarding 4.2) oraz zasady produktu z rozdziału 1.
2. Sprawdź, czy ekran ma makietę w [`design/mockups`](../../../design/mockups/README.md) (Dzisiaj, Check-in, Propozycja, Dzisiaj po zmianie). Makiety pokazują układ i treść; **kolory, font i zaokrąglenia bierz z tokenów, nie z makiet** (makiety mają jeszcze Space Grotesk + Inter).
3. Sprawdź, czy potrzebny komponent już jest w `apps/mobile/src/components`. Nie duplikuj.

## Struktura kodu

- Ekrany tylko w `apps/mobile/src/app/` (każdy plik = trasa, `_layout.tsx` = nawigator). Komponenty, hooki i logika poza `src/app/`.
- Komponenty UI wielokrotnego użytku: `src/components/ui/`, komponenty domenowe (karta treningu, suwak samopoczucia, dymek trenera): `src/components/<obszar>/`.
- Nazwy plików w kebab-case (`workout-card.tsx`), komponenty w PascalCase.
- Szablonowe ekrany Expo (`index`, `explore`, `app-tabs`, `hint-row`, `web-badge`) są tymczasowe. Zastępując je, usuń nieużywane pliki szablonu.
- Zależności dodawaj przez `npx expo install <pakiet>` w `apps/mobile`. Biblioteka z kodem natywnym wymaga nowego development builda (`pnpm ios` / `expo run:ios`), Expo Go nie wystarczy.

## Design system

Jedno źródło prawdy: `@aloha/design-system` (tokeny w `packages/design-system/tokens`, wygenerowane `build/tokens.ts`). W aplikacji importuj przez `@/constants/theme`:

```ts
import { colors, font, radius, space, motion } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
const c = colors[scheme];
```

Twarde zasady:

- **Tylko role kolorów** (`c.surface`, `c.textMuted`, `c.action`, `c.workoutIntervals`…). Nigdy hex w komponencie, nigdy `palette`. Brakuje roli → dodaj ją w `tokens/semantic.json` (light **i** dark) i uruchom `pnpm tokens`, nie obchodź tego lokalnie.
- Każdy ekran działa w trybie jasnym i ciemnym (`userInterfaceStyle: automatic`). Sprawdź oba.
- **Odstępy** tylko ze skali `space` (4, 8, 12, 16, 20, 24, 32, 48). Margines boczny ekranu: `space[5]` (20).
- **Zaokrąglenia**: karta `radius.card` (14), przycisk `radius.button` (10), chipy podpowiedzi `radius.pill`.
- **Typografia**: jeden krój Plus Jakarta Sans. Rozmiary z `font.size`, grubości z `font.weight`. Nagłówek ekranu `3xl`/`4xl` w `extrabold`, tytuł karty `xl` w `bold`, tekst `lg`/`md`, opisy `sm` w `textMuted`.
- Font ładowany przez `@expo-google-fonts/plus-jakarta-sans` w root `_layout.tsx` (splash trzymany do załadowania). Na RN każda grubość to osobny `fontFamily` (np. `PlusJakartaSans_700Bold`), więc mapuj `font.weight` na nazwę rodziny w jednym miejscu (komponent tekstu), a nie w każdym ekranie.
- Stare klucze szablonu (`Colors`, `Fonts`, `Spacing`, `ThemedText` z niebieskim `linkPrimary`) nie są częścią designu Laguna. Nowe ekrany ich nie używają. Przy pierwszej okazji zastąp je komponentem tekstu opartym o tokeny.
- Ruch: czasy z `motion.duration` (150 / 250 / 400 ms), animacje przez Reanimated. Szanuj „Ogranicz ruch” (`useReducedMotion`).

### Ikony i znak

- Ikony: **Phosphor, waga Bold** (`phosphor-react-native`, `weight="bold"`). Nie rysuj własnych, nie mieszaj z SF Symbols / Material w widocznym UI.
- Znak „Słońce nad falą” z `packages/design-system/assets/logo` (`mark.svg` na jasnym, `mark-on-brand.svg` na turkusie / ciemnym).
- Trener w dymkach: awatar = `mark-on-brand.svg` w turkusowym kółku (`c.surfaceBrand`).
- Kolory typów treningu (`workoutEasy`, `workoutLong`, `workoutIntervals`, `workoutTempo`, `workoutWalkRun`, `workoutRest`) tylko jako kropki i znaczniki typu, nie jako tło całych ekranów.

### Motyw hawajski – z umiarem

- Wzór plumerii (`assets/patterns/plumeria.svg`, currentColor, krycie 10–15%) **tylko** na ekranie startowym i w onboardingu. **Nigdy** na ekranach z planem (Dzisiaj, tydzień, check-in, propozycja, realizacja).
- Z hawajskich słów wyłącznie „Aloha” jako powitanie („Aloha, Tomek!”). Bez „Mahalo” i innych.
- Emoji z umiarem (najwyżej jedno w komunikacie), bez własnych ilustracji.

## Teksty i ton

- Wszystkie teksty widoczne dla użytkownika w **PL i EN**, ze słowników (`packages/i18n`). Nie wpisuj stringów na sztywno w JSX. Pakiet jest jeszcze pusty – pierwszy ekran zakłada strukturę słowników i hook tłumaczeń; nazwy treningów, skala samopoczucia i podpowiedzi check-inu idą do wspólnych słowników (używa ich też strona).
- Ton „trener, ale kumpel” (`docs/PROJECT.md`, 1): zwracamy się na „Ty”, krótko i konkretnie, wspierająco, nigdy nie zawstydzamy. Przykład: „Wczoraj nie wyszło? Spoko, zdarza się. Przesunąłem bieg na czwartek.”, a nie „Nie wykonałeś zaplanowanego treningu.”
- Uzasadnienia zmian planu: jedno–dwa zdania, ludzkim językiem, z konkretem (czas, typ treningu, dzień).

## Zasady produktu w UI

- **Check-in ≤ 10 sekund**: jedyny wymagany element to suwak 1–5 (Słabo · Tak sobie · W porządku · Dobrze · Świetnie). Tekst i podpowiedzi (Mało czasu, Mało snu, Stres, Coś boli, Mam energię) są opcjonalne. „Pomiń” i ✕ zamykają bez odpowiedzi = trening wg planu. **Brak opcji „odpuszczam”.**
- **Propozycja, nie rozkaz**: każda zmiana planu to karta z uzasadnieniem i dwoma akcjami – główna „Akceptuj” (jedno tapnięcie), druga „Zostaw plan bez zmian”. Poziom zmiany 0–4 wpływa na treść, nie na straszenie użytkownika.
- **Bez poczucia winy**: opuszczony trening nie jest błędem – żadnych czerwonych ostrzeżeń, liczników porażek ani przekreśleń.
- **Prostota**: bez wykresów i nadmiaru statystyk w MVP.
- Dane zdrowotne (check-in) wymagają zgody `health_data` – ekran check-inu musi obsłużyć brak zgody.

## Jakość i dostępność

- Pola dotykowe ≥ 44×44 pt, tekst skaluje się z ustawieniami systemu (nie blokuj `allowFontScaling`), układ nie łamie się przy dużym foncie.
- Kontrast: tekst na `surfaceBrand` tylko `textOnBrand`, na bursztynie `textOnAccent`. Nie kładź `textMuted` na kolorowym tle.
- `accessibilityRole` i `accessibilityLabel` dla przycisków-ikon, suwak z `accessibilityValue` i etykietą słowną poziomu.
- Bezpieczne obszary przez `react-native-safe-area-context`, listy przez `FlatList`/`FlashList`, obrazy przez `expo-image`.
- Stany: ładowanie, pusty, błąd sieci (tryb awaryjny bez AI – adaptacja regułowa) dla każdego ekranu z danymi.

## Zanim uznasz ekran za gotowy

1. `pnpm --filter @aloha/mobile lint` i `pnpm --filter @aloha/mobile typecheck` przechodzą.
2. Uruchom aplikację w symulatorze iOS i zrób zrzuty ekranu w trybie jasnym i ciemnym; porównaj z makietą (układ, treść) i z tokenami (kolory, font, promienie).
3. Sprawdź w kodzie: brak hexów, brak stringów na sztywno, ikony tylko Phosphor Bold, brak plumerii na ekranach z planem.
4. Teksty PL i EN są w słownikach i brzmią jak „trener, ale kumpel”.
