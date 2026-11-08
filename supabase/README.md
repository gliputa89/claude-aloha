# supabase – backend jako kod

- `migrations/` – schemat bazy i RLS (jedyne źródło zmian w bazie)
- `functions/` – Edge Functions: interpretacja check-inu, plan tygodnia (Claude API), eksport/usunięcie konta
- `seed.sql` – dane testowe dla środowiska lokalnego

## Wdrażanie migracji

- **staging** – automatycznie: GitHub Actions (`.github/workflows/db-migrations.yml`) wgrywa nowe migracje po pushu/merge do głównej gałęzi.
- **produkcja** – ręcznie: GitHub → Actions → „Migracje bazy” → Run workflow → `production`.
- Jednorazowo (i po zmianie hasła bazy): `pnpm db:ci-setup` – zapisuje adresy baz z Vercel jako sekret `DB_URL` w środowiskach GitHub `staging` i `production`.
- Awaryjnie z komputera: `pnpm db:push:staging` / `pnpm db:push:prod` (dodaj `--dry-run`, żeby tylko podejrzeć).

Jeden projekt Supabase na środowisko (local / staging / prod), schematy: `public`, `marketing`, `ops`, `analytics`.
Szczegóły: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md), sekcja 3.
