# packages/design-system – wspólny design

Jedno źródło prawdy dla `apps/web`, `apps/admin` i `apps/mobile`.

- `tokens/` – kolory, typografia, odstępy, promienie, cienie, ruch (JSON, format W3C Design Tokens)
- `assets/` – logo (SVG), ikony, fonty, ikona aplikacji, splash
- `build/` – generowane przez `pnpm tokens` (nie edytować ręcznie, ale commitujemy):
  - `theme.css` – zmienne CSS (light/dark) + motyw Tailwind v4 → `@import "@aloha/design-system/theme.css"`
  - `tokens.ts` – obiekt TS dla React Native → `import { colors, space, radius } from "@aloha/design-system"`

Zmiana koloru: edytuj `tokens/color.json` (paleta) lub `tokens/semantic.json` (role) → `pnpm tokens`.
W kodzie używamy tylko ról (`surfaceBrand`, `textMuted`…), nigdy wartości z palety.

Źródła projektowe (makiety, identyfikacja) leżą w [`design/`](../../design/). Szczegóły: [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), sekcja 4.
