# Aloha Training – stan prac i kolejne kroki

*Ostatnia aktualizacja: 8 listopada 2026*

Plik do wznowienia pracy w nowej sesji.

## Dokumenty

| Plik | Zawartość | Status |
|---|---|---|
| [`PROJECT.md`](PROJECT.md) | produkt i MVP: wizja, persony, przepływ, check-in, skala zmian 0–4, rola AI, RODO, technologia, decyzje | v0.4 |
| [`BUSINESS.md`](BUSINESS.md) | konkurencja, propozycja wartości i pozycjonowanie, koszty AI i infrastruktury | v0.4 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | monorepo, 3 aplikacje (web / mobile / admin), baza (jeden Supabase na środowisko, schematy), wspólny design (tokeny), wdrożenia, kolejność budowy | v0.1 |
| [`MARKETING.md`](MARKETING.md) | wejście na rynek, kanały, lista oczekujących, beta, plan 12 tygodni, budżet, KPI | v1.0 |
| [`../design/mockups/`](../design/mockups/) | źródła makiet 4 ekranów (Dzisiaj → Check-in → Propozycja → Dzisiaj po zmianie) | zaakceptowane |

Prototyp online: https://claude.ai/artifact/9fNTK4T8hFSpaJyb1RdYCB

## Kluczowe decyzje (skrót)

- Tylko bieganie; 30–40 lat; od początkujących do ~36–37 min / 10 km.
- Check-in w dni treningowe o porze ustawionej przez użytkownika: **jeden suwak + opcjonalny tekst i podpowiedzi**; „Pomiń” = trening wg planu (bez opcji „odpuszczam”).
- Zmiany planu: propozycja z uzasadnieniem + akceptacja jednym tapnięciem; skala 0–4.
- AI hybrydowo: silnik reguł + Claude API z backendu; model wybierany na podstawie testu jakości.
- MVP w pełni darmowe; paywall po MVP. PL + EN. Logowanie e-mail. React Native (Expo) + Supabase. Integracje po MVP.
- Ton: trener, ale kumpel. Nazwa: **Aloha App**. Kierunek wizualny „Laguna” (turkus + bursztyn, Plus Jakarta Sans, karta 14px), znak „Słońce nad falą”, motyw hawajski z umiarem (wzór plumerii, powitanie „Aloha”), ikony Phosphor Bold – zatwierdzone 8.11.2026, w tokenach i `packages/design-system/assets` ([`design/brand`](../design/brand/README.md)).
- Monorepo (pnpm + Turborepo): `apps/web` (Next.js, Vercel), `apps/mobile` (Expo), `apps/admin` (Next.js, Vercel), `packages/` (design-system, plan-engine, db, i18n, config), `supabase/`.
- Baza: jeden projekt Supabase na środowisko (local / staging / prod) dla wszystkich aplikacji; podział na schematy `public` / `marketing` / `ops` / `analytics`.
- Design: tokeny w `packages/design-system` → CSS/Tailwind (web, admin) + TS (mobile).

## Stan kodu

- Zainstalowane: `apps/web` i `apps/admin` (Next.js 16, Tailwind v4), `apps/mobile` (Expo SDK 58, Expo Router), `packages/design-system` (tokeny z makiet → CSS + TS), `packages/config`, `supabase/config.toml`.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` przechodzą; bundle Androida (Metro) buduje się z tokenami ze wspólnego pakietu.
- **Vercel** (zespół `grzegorzliputas-projects`, Pro): projekty `aloha-web` (Root `apps/web`) i `aloha-admin` (Root `apps/admin`), podpięte do GitHuba, region funkcji `fra1`, Node 22, pomijanie buildów bez zmian. Gałąź produkcyjna: `claude/gracious-clarke-cc1clg` (domyślna w GitHubie) – zmienić na `main`, gdy powstanie. Domeny jeszcze nieprzypięte.
- **Supabase** przez Vercel Marketplace (plan Free, Frankfurt): `aloha-prod` → Production obu projektów, `aloha-staging` → Preview + Development. Zmienne (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*`, `POSTGRES_*`) ustawia integracja. Przed publiczną premierą → plan Pro (Free usypia bazę po tygodniu bez ruchu).
- **Baza**: 5 migracji w `supabase/migrations` (schematy `marketing` / `ops` / `analytics`, tabele aplikacji z RLS, zgoda `health_data` wymagana do check-inu, widoki KPI) – wgrane na staging i prod (`npx supabase db push --db-url …`), sprawdzone testem RLS.
- **Do decyzji przy liście oczekujących**: schematy `marketing` / `ops` / `analytics` nie są wystawione w API Supabase, więc `supabase-js` ich nie widzi. Albo serwer łączy się bezpośrednio z Postgresem (`POSTGRES_URL`), albo wystawiamy je w API (uprawnienia i tak ma tylko `service_role`).
- Do zrobienia ręcznie: `eas init` w `apps/mobile`.
- Mobile nie ładuje jeszcze fontu ani nowej ikony – przy pierwszych ekranach: `@expo-google-fonts/plus-jakarta-sans`, `phosphor-react-native`, PNG ikon z `assets/logo/app-icon.svg`.

## Otwarte tematy

1. Sekcja 5 w `BUSINESS.md`: ryzyka i ich ograniczanie.
2. Tempo budowy MVP → dopasowanie dat w planie marketingowym (plan zakłada betę pod koniec stycznia 2027).
3. Weryfikacja u źródła: ceny Runna w PL, język polski w Runna / Daptiv, oferta chceByc.fit, ceny Supabase / Expo.
4. Weryfikacja prawna dokumentów przed publikacją.
5. Decyzje techniczne z `ARCHITECTURE.md`, sekcja 6 (Edge Functions vs Vercel dla AI, styling mobile, e-maile, analityka, domena).

## Proponowane kolejne kroki

1. Strona z listą oczekujących (`apps/web` + schemat `marketing`) – pierwsze zadanie z planu marketingowego.
2. Panel: logowanie admina + widok listy oczekujących.
3. Scenariusz rozmowy z użytkownikiem do testu makiety.
4. Zasady planowania (silnik reguł) + przykładowy plan dla jednego celu.
5. Makiety ankiety startowej i widoku tygodnia.
6. Aplikacja: ekrany z makiet zamiast demo Expo, połączenie z Supabase.
