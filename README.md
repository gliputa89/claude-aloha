# Aloha Training

> Plan biegowy, który dopasowuje się do Twojego życia – a nie odwrotnie.

Aplikacja mobilna (Android / iOS) do planowania i realizacji treningów biegowych dla amatorów.
Wyróżnik: podejście **human first** – w centrum aplikacji jest pytanie *„Jak się dzisiaj czujesz?”*,
a plan na bieżąco reaguje na zmęczenie, brak snu, chore dziecko czy nadgodziny w pracy.

- 📄 Opis produktu (MVP): [`docs/PROJECT.md`](docs/PROJECT.md)
- 💼 Opis biznesowy: [`docs/BUSINESS.md`](docs/BUSINESS.md)
- 📣 Plan marketingowy: [`docs/MARKETING.md`](docs/MARKETING.md)
- 🏗️ Architektura i struktura repo: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 🎨 Makiety MVP: [`design/mockups/`](design/mockups/)
- 📌 Stan prac i kolejne kroki: [`docs/STATUS.md`](docs/STATUS.md)
- Status: faza koncepcji (MVP)
- Nazwa robocza: **Aloha Training**

## Struktura repozytorium

```
apps/web        strona www – Next.js → Vercel
apps/mobile     aplikacja – Expo / React Native → EAS
apps/admin      panel zarządzania – Next.js → Vercel
packages/       wspólne: design-system, plan-engine, db, i18n, config
supabase/       baza (migracje, RLS) i Edge Functions
design/         makiety, identyfikacja, grafiki marketingowe i do sklepów
docs/           dokumentacja
```

## Uruchomienie

Wymagania: Node 22+, pnpm 10 (`corepack enable`), do lokalnej bazy – Docker.

```bash
pnpm install
pnpm dev:web       # strona      → http://localhost:3000
pnpm dev:admin     # panel       → http://localhost:3001
pnpm dev:mobile    # aplikacja   → Expo Go (QR)
pnpm db:start      # lokalny Supabase (Docker)
pnpm tokens        # przebudowanie tokenów designu po zmianie packages/design-system/tokens
pnpm lint && pnpm typecheck && pnpm build
```
