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

## Edge Functions planu

- `generate-plan` – pierwsze 2 tygodnie po ankiecie; ustawia poziom startowy (1–5) z ankiety.
- `generate-next-week` – kolejny tydzień + przegląd poziomu zaawansowania (awans / spadek o jeden, historia w `training_level_changes`).
  Generuje tydzień, gdy ostatni kończy się w ciągu 2 dni; drugi raz tego samego tygodnia nie dopisze.

Przed `supabase functions serve` / deployem: `scripts/sync-plan-engine.sh` (kopia `packages/plan-engine`).

### Cron dla `generate-next-week` (raz na środowisko)

Codziennie rano – funkcja sama wybiera użytkowników z terminem. W SQL Editorze projektu (staging, potem prod):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- adres projektu i klucz service_role w Vault (nie w kodzie)
select vault.create_secret('https://<projekt>.supabase.co', 'project_url');
select vault.create_secret('<service_role key>', 'service_role_key');

select cron.schedule(
  'generate-next-week',
  '0 4 * * *',  -- 04:00 UTC
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-next-week',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Ręcznie dla jednego użytkownika: tester w panelu → „Kolejny tydzień z przeglądem poziomu” (ta sama logika, bez AI).
