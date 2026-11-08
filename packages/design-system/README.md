# packages/design-system – wspólny design

Jedno źródło prawdy dla `apps/web`, `apps/admin` i `apps/mobile`.

- `tokens/` – kolory, typografia, odstępy, promienie, cienie, ruch (JSON, format W3C Design Tokens)
- `assets/logo/` – znak „Słońce nad falą”: `mark.svg` (jasne tło), `mark-on-brand.svg` (tło marki / ciemne), `mark-mono.svg` (currentColor), `app-icon.svg` (1024, do sklepów), `favicon.svg` (skopiowana do `apps/*/app/icon.svg`)
- `assets/patterns/plumeria.svg` – kafelek wzoru (currentColor, krycie 10–15%), tylko ekran startowy, onboarding i strona
- `build/` – generowane przez `pnpm tokens` (nie edytować ręcznie, ale commitujemy):
  - `theme.css` – zmienne CSS (light/dark) + motyw Tailwind v4 → `@import "@aloha/design-system/theme.css"`
  - `tokens.ts` – obiekt TS dla React Native → `import { colors, space, radius } from "@aloha/design-system"`

Zmiana koloru: edytuj `tokens/color.json` (paleta) lub `tokens/semantic.json` (role) → `pnpm tokens`.
W kodzie używamy tylko ról (`surfaceBrand`, `textMuted`…), nigdy wartości z palety.

Źródła projektowe (makiety, identyfikacja) leżą w [`design/`](../../design/). Szczegóły: [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), sekcja 4.

## Zasady użycia

- Ikony: Phosphor, waga Bold – `@phosphor-icons/react` (web, admin), `phosphor-react-native` (apka). Nie rysujemy własnych.
- Kolory typów treningu: role `workout*` (kropki w tygodniu, znaczniki na kartach).
- Hawajskie akcenty: wzór plumerii tylko poza ekranami z planem; w tekstach wyłącznie „Aloha” jako powitanie.
- Trener w dymkach: awatar = `mark-on-brand.svg` w turkusowym kółku.
