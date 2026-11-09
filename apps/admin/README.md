# apps/admin – panel zarządzania

Dashboard KPI, użytkownicy, lista oczekujących i beta, marketing (UTM, konwersja), koszty i jakość AI, flagi funkcji.

- Next.js 16 (App Router, TypeScript, Tailwind v4) → Vercel, `admin.<domena>`
- Dostęp tylko dla kont z `ops.admins`; zapytania wyłącznie po stronie serwera
- Plan: [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)

```bash
pnpm dev:admin        # z katalogu głównego → http://localhost:3001
cp .env.example .env.local
```

**Vercel:** drugi projekt z tego samego repo, *Root Directory* = `apps/admin`.

## Dostęp i tester planów

Panel wymaga logowania (Supabase Auth, e-mail + hasło) i wpisu w `ops.admins`. Pierwszego admina dodaj w SQL Editorze Supabase:

```sql
insert into ops.admins (user_id, role)
select id, 'owner' from auth.users where email = 'twoj@email.pl';
```

**`/tester`** – tester silnika planów: lista kont, odpowiedzi z ankiety, dokładne wejście silnika (`planInputFromSurvey`),
aktywny plan z tygodniami. Można wygenerować dowolny tydzień (`generatePlanWeek` z `packages/plan-engine`, podmienia
istniejący o tym numerze) i usunąć dowolny tydzień. Zapis przez `public.admin_save_plan_week` / `admin_delete_plan_week`
(tylko `service_role`), każda zmiana i każdy wgląd w ankietę trafia do `ops.admin_audit_log`.
