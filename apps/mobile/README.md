# apps/mobile – aplikacja

Aplikacja Android / iOS: onboarding, „Dzisiaj”, check-in, propozycja zmiany, tydzień, cel, ustawienia.

- Expo SDK 58 / React Native (TypeScript, Expo Router – ekrany w `src/app/`) → EAS Build / EAS Update
- Kolory, fonty, odstępy z [`@aloha/design-system`](../../packages/design-system/) przez `src/constants/theme.ts`
- Ekrany demo z szablonu Expo (`index`, `explore`) są tymczasowe – zastąpią je ekrany z makiet
- Plan: [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), produkt: [`docs/PROJECT.md`](../../docs/PROJECT.md)

```bash
pnpm dev:mobile       # z katalogu głównego; zeskanuj QR w Expo Go
npx expo install <pakiet>   # dodawanie zależności (dobiera wersje zgodne z SDK)
cp .env.example .env.local
```

**EAS:** `npx eas-cli@latest init` (połączenie z kontem Expo), potem `eas build --profile preview`.
Przed pierwszym buildem do sklepów: `ios.bundleIdentifier` i `android.package` w `app.json` (zależą od domeny/nazwy).
