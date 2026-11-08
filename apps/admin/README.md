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
