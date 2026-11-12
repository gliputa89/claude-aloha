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

**Supabase (hosted):** w Authentication → URL Configuration dodaj `aloha://**` do Redirect URLs, inaczej linki potwierdzenia i resetu hasła nie wrócą do aplikacji. Profil i zgody (regulamin, prywatność) zapisuje trigger `handle_new_user` (migracje `20261108130000_signup_consents.sql` i `20261110120000_drop_adult_confirmation.sql`).

**Logowanie przez Apple (tylko iOS):** natywny arkusz (`expo-apple-authentication`) → `supabase.auth.signInWithIdToken`. Wymaga development builda (nie działa w Expo Go) i włączonego dostawcy Apple w Supabase z Client ID `app.alohatraining` – lokalnie robi to `supabase/config.toml`, na staging i prod trzeba to ustawić w panelu (Authentication → Providers → Apple). Zgody, język i imię dla takich kont dopisuje `completeSocialAccount` w `src/lib/auth.ts`.

**Logowanie przez Google (iOS i Android):** natywny wybór konta (`@react-native-google-signin/google-signin`) → `supabase.auth.signInWithIdToken`. Przycisk pokazuje się dopiero po ustawieniu `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (oraz `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` na iOS) w `.env.local` / zmiennych EAS. Potrzebne w Google Cloud (ekran zgody OAuth + 3 klienty OAuth):
- **Web** – jego ID i sekret idą do Supabase (Authentication → Providers → Google), ID też do `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- **iOS** – bundle ID `app.alohatraining`; ID do `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `app.config.ts` dopisuje z niego schemat URL, więc po zmianie trzeba nowego builda (`expo prebuild` / `pnpm ios`).
- **Android** – pakiet `app.alohatraining` + SHA-1 każdego klucza podpisu (debug, EAS, Google Play App Signing). Jego ID nie wpisujemy nigdzie.

W Supabase w polu Client IDs: Web i iOS client ID po przecinku (Web pierwszy) oraz włączone **Skip nonce checks** (biblioteka nie przekazuje nonce).

**Adresy produkcyjne (strona `apps/web`, domena https://www.alohatraining.app)** – do App Store Connect, Google Play Console i do `EXPO_PUBLIC_SITE_URL`:

| Dokument | PL | EN |
|---|---|---|
| Polityka prywatności | https://www.alohatraining.app/polityka-prywatnosci | https://www.alohatraining.app/en/privacy |
| Regulamin | https://www.alohatraining.app/regulamin | https://www.alohatraining.app/en/terms |
| Usunięcie konta (sekcja polityki) | https://www.alohatraining.app/polityka-prywatnosci#usuniecie | – |

**Konto testowe dla recenzentów sklepów** – `review@alohatraining.app` (imię „App Review”, język EN, zaakceptowany regulamin).
Podajemy je w Google Play Console (Zawartość aplikacji → Dane logowania) i w App Store Connect (App Review Information);
nadaje się też do własnych testów. Hasło jest tylko w `.env.review.local` w katalogu głównym (w `.gitignore`, poza repo).

```bash
pnpm review-user prod            # załóż konto na produkcji (pyta o potwierdzenie)
pnpm review-user prod --reset    # nowe hasło – potem zaktualizuj je w obu sklepach
pnpm review-user staging         # to samo na stagingu
```

Skrypt (`scripts/create-review-user.mjs`) pobiera klucz Supabase z Vercel jak `db:push`, więc wymaga `vercel login`.
Po wprowadzeniu Premium konto musi mieć aktywny pakiet – recenzent nie może nic kupić (`docs/PROJECT.md`, §7).

**EAS:** `npx eas-cli@latest init` (połączenie z kontem Expo), potem `eas build --profile preview`.
Przed pierwszym buildem do sklepów: `ios.bundleIdentifier` i `android.package` w `app.json` (zależą od domeny/nazwy).
