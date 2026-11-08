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
- Ton: trener, ale kumpel. Identyfikacja wizualna – osobny wątek.
- Monorepo (pnpm + Turborepo): `apps/web` (Next.js, Vercel), `apps/mobile` (Expo), `apps/admin` (Next.js, Vercel), `packages/` (design-system, plan-engine, db, i18n, config), `supabase/`.
- Baza: jeden projekt Supabase na środowisko (local / staging / prod) dla wszystkich aplikacji; podział na schematy `public` / `marketing` / `ops` / `analytics`.
- Design: tokeny w `packages/design-system` → CSS/Tailwind (web, admin) + TS (mobile).

## Otwarte tematy

1. Sekcja 5 w `BUSINESS.md`: ryzyka i ich ograniczanie.
2. Tempo budowy MVP → dopasowanie dat w planie marketingowym (plan zakłada betę pod koniec stycznia 2027).
3. Weryfikacja u źródła: ceny Runna w PL, język polski w Runna / Daptiv, oferta chceByc.fit, ceny Supabase / Expo.
4. Weryfikacja prawna dokumentów przed publikacją.
5. Decyzje techniczne z `ARCHITECTURE.md`, sekcja 6 (Edge Functions vs Vercel dla AI, styling mobile, e-maile, analityka, domena).

## Proponowane kolejne kroki

1. Szkielet monorepo + `packages/design-system` (tokeny z makiet) – wg `ARCHITECTURE.md`, sekcja 7.
2. Strona z listą oczekujących (`apps/web` + schemat `marketing`) – pierwsze zadanie z planu marketingowego.
3. Panel: logowanie admina + widok listy oczekujących.
4. Scenariusz rozmowy z użytkownikiem do testu makiety.
5. Zasady planowania (silnik reguł) + przykładowy plan dla jednego celu.
6. Makiety ankiety startowej i widoku tygodnia.
7. Szkielet aplikacji (Expo + Supabase).
