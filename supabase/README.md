# supabase – backend jako kod

- `migrations/` – schemat bazy i RLS (jedyne źródło zmian w bazie)
- `functions/` – Edge Functions: interpretacja check-inu, plan tygodnia (Claude API), eksport/usunięcie konta
- `seed.sql` – dane testowe dla środowiska lokalnego

Jeden projekt Supabase na środowisko (local / staging / prod), schematy: `public`, `marketing`, `ops`, `analytics`.
Szczegóły: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md), sekcja 3.
