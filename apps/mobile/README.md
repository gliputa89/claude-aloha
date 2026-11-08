# apps/mobile – aplikacja

Aplikacja Android / iOS: onboarding, „Dzisiaj”, check-in, propozycja zmiany, tydzień, cel, ustawienia.

- Expo SDK 58 / React Native (TypeScript, Expo Router – ekrany w `src/app/`) → EAS Build / EAS Update
- Kolory, fonty, odstępy z [`@aloha/design-system`](../../packages/design-system/) przez `src/constants/theme.ts`
- Teksty PL/EN ze słowników [`@aloha/i18n`](../../packages/i18n/) przez hook `useT()`
- Logowanie: Supabase Auth (e-mail + hasło, PKCE). Klient w `src/lib/supabase.ts` (sesja w `expo-sqlite` localStorage), akcje w `src/lib/auth.ts`, sesja w `AuthProvider`. Trasy `(auth)/*` widać tylko bez sesji, `(app)/*` tylko z sesją (`Stack.Protected`). Linki z e-maili trafiają na `aloha://auth/callback`.
- Plan: [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), produkt: [`docs/PROJECT.md`](../../docs/PROJECT.md)

```bash
pnpm dev:mobile       # z katalogu głównego; zeskanuj QR w Expo Go
npx expo install <pakiet>   # dodawanie zależności (dobiera wersje zgodne z SDK)
cp .env.example .env.local   # URL i klucz anon z projektu Supabase (staging do dev)
```

**Supabase (hosted):** w Authentication → URL Configuration dodaj `aloha://**` do Redirect URLs, inaczej linki potwierdzenia i resetu hasła nie wrócą do aplikacji. Profil i zgody (regulamin, prywatność, 18+) zapisuje trigger `handle_new_user` (migracja `20261108130000_signup_consents.sql`).

**EAS:** `npx eas-cli@latest init` (połączenie z kontem Expo), potem `eas build --profile preview`.
Przed pierwszym buildem do sklepów: `ios.bundleIdentifier` i `android.package` w `app.json` (zależą od domeny/nazwy).
