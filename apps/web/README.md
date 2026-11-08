# apps/web – strona www

Landing, lista oczekujących, blog SEO, strony prawne (PL/EN), strony kont (reset hasła, usunięcie konta).

- Next.js 16 (App Router, TypeScript, Tailwind v4) → Vercel, `<domena>`
- Kolory, fonty i promienie z [`@aloha/design-system`](../../packages/design-system/) (klasy np. `bg-surface-brand`, `text-text-muted`, `rounded-card`, `font-display`)
- Plan: [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)

```bash
pnpm dev:web          # z katalogu głównego → http://localhost:3000
cp .env.example .env.local
```

**Vercel:** nowy projekt z tego repo, *Root Directory* = `apps/web`, framework Next.js. `vercel.json` ustawia region `fra1` i pomija build, gdy zmiany nie dotyczą strony (`turbo-ignore`).
