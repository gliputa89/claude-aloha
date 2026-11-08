# Aloha Training – architektura i struktura projektu

*Wersja 0.1 · listopad 2026 · dokument roboczy*

Plan repozytorium, aplikacji, bazy danych i miejsca na design. Powiązane dokumenty:
- [`PROJECT.md`](PROJECT.md) – produkt i MVP (sekcja 8: technologia, model danych)
- [`MARKETING.md`](MARKETING.md) – lista oczekujących, beta, KPI
- [`BUSINESS.md`](BUSINESS.md) – koszty AI i infrastruktury

---

## 1. Co budujemy – trzy aplikacje, jeden backend

| # | Aplikacja | Technologia | Hosting | Adres (roboczo) | Dla kogo |
|---|---|---|---|---|---|
| 1 | **Strona www** – landing, lista oczekujących, blog SEO, strony prawne | Next.js (App Router, TypeScript) | Vercel Pro | `<domena>` | odwiedzający, przyszli użytkownicy |
| 2 | **Aplikacja mobilna** | Expo / React Native (TypeScript) | EAS Build + EAS Update → App Store / Google Play | – | biegacze |
| 3 | **Panel zarządzania** – użytkownicy, statystyki, lista oczekujących, beta, marketing, koszty AI | Next.js (App Router, TypeScript) | Vercel Pro | `admin.<domena>` | tylko zespół (na start: Ty) |
| – | **Backend** – baza, logowanie, funkcje serwerowe (AI, cron) | Supabase (Postgres, Auth, Edge Functions, pg_cron) | Supabase, region Frankfurt (UE) | – | wszystkie trzy aplikacje |

Wszystko w **jednym repozytorium (monorepo)** – jedna osoba, wspólne typy, wspólny design, jedna historia zmian.

```
                    ┌────────────────────────────────────┐
                    │         packages/ (wspólne)         │
                    │ design-system · plan-engine · db ·  │
                    │ i18n · config                       │
                    └───────┬──────────────┬──────────────┘
                            │              │
          ┌─────────────────┼──────────────┼─────────────────┐
          ▼                 ▼              ▼                 │
   apps/web (Vercel)  apps/mobile (EAS)  apps/admin (Vercel)  │
          │                 │              │                 │
          │  zapis na listę │  anon key    │  service role   │
          │  (server action)│  + RLS       │  (tylko serwer) │
          ▼                 ▼              ▼                 ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ Supabase (UE)  —  jeden projekt na środowisko                 │
   │  auth · public (dane aplikacji) · marketing · ops · analytics │
   │  Edge Functions: interpretacja check-inu, plan tygodnia (AI)  │
   └──────────────────────────────┬───────────────────────────────┘
                                  ▼
                            Claude API
```

---

## 2. Struktura folderów

```
claude-aloha/
├── apps/
│   ├── web/                    # 1. Strona www (Next.js → Vercel)
│   │   ├── app/
│   │   │   ├── (marketing)/    # landing, „jak to działa”, FAQ
│   │   │   ├── blog/           # artykuły SEO (MDX)
│   │   │   ├── legal/          # polityka prywatności, regulamin (PL/EN)
│   │   │   ├── account/        # reset hasła, potwierdzenie e-maila, usunięcie konta (wymóg Google Play)
│   │   │   └── api/            # webhooki (np. e-mail), jeśli potrzebne
│   │   ├── content/            # treści MDX: blog, strony prawne
│   │   └── public/
│   │
│   ├── mobile/                 # 2. Aplikacja (Expo → EAS)
│   │   ├── app/                # Expo Router: (auth), (onboarding), (tabs)/today, week, goal, settings
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/       # checkin/, plan/, session/, onboarding/
│   │   │   ├── lib/            # klient Supabase, powiadomienia, i18n
│   │   │   └── theme/          # mapowanie tokenów z design-system na RN
│   │   ├── assets/             # ikona aplikacji, splash (generowane z design-system)
│   │   ├── app.config.ts
│   │   └── eas.json
│   │
│   └── admin/                  # 3. Panel zarządzania (Next.js → Vercel)
│       └── app/
│           ├── (dashboard)/    # KPI: aktywni, retencja, % check-inów, % akceptacji propozycji
│           ├── users/          # lista, szczegóły konta (bez treści notatek zdrowotnych)
│           ├── waitlist/       # zapisy, odpowiedzi z ankiety, polecenia, zaproszenia do bety
│           ├── marketing/      # źródła ruchu (UTM), konwersja strony, kampanie
│           ├── ai/             # liczba wywołań, koszt, błędy, czas odpowiedzi, model
│           └── settings/       # flagi funkcji, limity AI, administratorzy
│
├── packages/
│   ├── design-system/          # ★ wspólny design dla web, admin i mobile (patrz sekcja 4)
│   │   ├── tokens/             # źródło prawdy: kolory, typografia, odstępy, promienie, cienie (JSON)
│   │   ├── assets/             # logo (SVG), ikony, fonty
│   │   └── build/              # generowane: CSS variables + motyw Tailwind (web), obiekt TS (RN)
│   │
│   ├── plan-engine/            # silnik reguł planu (czysty TS, bez zależności, testy jednostkowe)
│   │                           #   szkielet planu, limity obciążenia, walidacja propozycji AI, skala 0–4
│   ├── db/                     # typy generowane z Supabase, typowany klient, wspólne zapytania
│   ├── i18n/                   # wspólne słowniki PL/EN: nazwy treningów, skala samopoczucia, podpowiedzi
│   └── config/                 # wspólne tsconfig, ESLint, Prettier
│
├── supabase/                   # backend jako kod
│   ├── migrations/             # schemat bazy (SQL), RLS – jedyne źródło zmian w bazie
│   ├── functions/              # Edge Functions (Deno): checkin-interpret, plan-next-week, account-export…
│   ├── seed.sql                # dane testowe do lokalnego środowiska
│   └── config.toml
│
├── design/                     # pracownia projektowa – źródła dla ludzi, nie kod
│   ├── mockups/                # makiety (istniejące 4 ekrany)
│   ├── brand/                  # identyfikacja wizualna: logo (źródła), paleta, moodboard
│   ├── marketing/              # grafiki do social media, zrzuty do sklepów, ulotki z QR
│   └── store/                  # materiały App Store / Google Play
│
├── docs/                       # dokumentacja (istniejąca + ten plik)
├── .github/workflows/          # CI: lint, typy, testy; migracje Supabase na produkcję
├── package.json                # workspace root (pnpm + Turborepo)
├── pnpm-workspace.yaml
└── turbo.json
```

### Dlaczego tak

- **`apps/` vs `packages/`** – w `apps/` jest to, co się wdraża; w `packages/` to, co współdzielone. Aplikacje nie importują się nawzajem, tylko z `packages/`.
- **Osobny panel (`apps/admin`) zamiast podstrony w `apps/web`** – inny poziom bezpieczeństwa (panel korzysta z klucza `service_role`), osobny deploy i domena, landing zostaje lekki i szybki. Koszt: drugi projekt w Vercel – w ramach Twojego planu Pro.
- **`plan-engine` jako osobny pakiet** – reguły treningowe są sercem produktu i muszą działać identycznie w Edge Functions (walidacja AI), w aplikacji (podgląd, tryb awaryjny) i w panelu (podgląd planu użytkownika). Czysty TypeScript, łatwy do testowania.
- **`supabase/` w repo** – migracje SQL i funkcje wersjonowane razem z kodem aplikacji; zmiana schematu = commit.
- **`design/` vs `packages/design-system/`** – `design/` to źródła (makiety, eksporty, grafiki marketingowe), `design-system` to to, co faktycznie trafia do kodu.

### Narzędzia monorepo

| Narzędzie | Po co |
|---|---|
| **pnpm workspaces** | jedna instalacja zależności, pakiety lokalne jako `workspace:*`; Expo wspiera pnpm w monorepo |
| **Turborepo** | `turbo run build/lint/test` tylko dla tego, co się zmieniło; zdalny cache na Vercel |
| **turbo-ignore** w Vercel | zmiana tylko w `apps/mobile` nie przebudowuje strony ani panelu |

---

## 3. Baza danych – rekomendacja: **jedna baza (jeden projekt Supabase) na całość**, osobno dla każdego środowiska

### Rekomendacja

**Jeden projekt Supabase obsługuje stronę, aplikację i panel**, a porządek zapewniają **schematy Postgresa + RLS + role**, nie osobne bazy.
Osobne projekty tworzymy **per środowisko**, nie per aplikację:

| Środowisko | Gdzie | Używane przez |
|---|---|---|
| **local** | Supabase CLI (Docker) na komputerze | development wszystkich aplikacji |
| **staging** | projekt `aloha-staging` (UE) | Vercel Preview, buildy testowe aplikacji (EAS preview), beta testy funkcji |
| **production** | projekt `aloha-prod` (UE, Frankfurt) | strona, panel, aplikacja ze sklepów |

### Dlaczego nie osobna baza dla strony i aplikacji

| Kryterium | Jedna baza | Osobne bazy (strona / aplikacja / panel) |
|---|---|---|
| Lista oczekujących → beta → konto w aplikacji | ten sam e-mail, jedno zapytanie (`waitlist` ↔ `auth.users`) | synchronizacja między bazami, duplikaty |
| Panel: lejek zapis → instalacja → aktywny po 4 tyg. | zwykły JOIN / widok SQL | ręczne łączenie danych z kilku źródeł |
| RODO: eksport i usunięcie danych osoby | jedno miejsce, jedna funkcja | trzeba pamiętać o każdej bazie |
| Logowanie (Supabase Auth) | jedno konto użytkownika | kilka systemów kont |
| Koszt i utrzymanie | 1 projekt × 2 środowiska | 3 projekty × 2 środowiska |
| Izolacja | schematy + RLS + role (wystarczające) | pełna fizyczna izolacja (niepotrzebna na tym etapie) |

Osobną bazę rozważymy dopiero, gdy pojawi się realna potrzeba (np. hurtownia danych do ciężkiej analityki albo B2B z wymaganiem izolacji danych firmy).

### Podział na schematy

| Schemat | Zawartość | Kto ma dostęp |
|---|---|---|
| `auth` | konta (Supabase Auth) | Supabase |
| `public` | dane aplikacji: `profiles`, `goals`, `availability`, `plans`, `weeks`, `sessions`, `check_ins`, `adjustments`, `consents` | aplikacja mobilna przez API, **RLS: użytkownik widzi tylko swoje wiersze** |
| `marketing` | `waitlist_signups` (e-mail, cel, „co psuje plan”, zgoda marketingowa z datą, UTM, kod polecający), `referrals`, `beta_invites` | **niewystawiony w API**; zapis ze strony przez Server Action (serwer Next.js), odczyt tylko panel |
| `ops` | `ai_calls` (model, tokeny, koszt, czas, wynik walidacji, błąd – **bez treści notatek**), `feature_flags`, `admins`, log działań administratora | Edge Functions i panel |
| `analytics` | **widoki** (lub widoki zmaterializowane odświeżane przez pg_cron): aktywni dziennie/tygodniowo, kohorty retencji, % check-inów, % akceptacji propozycji, konwersja listy | tylko panel |

### Zasady dostępu

- **Aplikacja mobilna** – klucz publiczny (`anon`) + sesja użytkownika; wszystko chronione RLS. Klucz Claude API tylko w Edge Functions.
- **Strona www** – nie potrzebuje logowania; zapis na listę wykonuje serwer Next.js (Server Action z kluczem `service_role` w zmiennych środowiskowych Vercel), z limitem zapytań i ochroną przed botami.
- **Panel** – logowanie przez Supabase Auth + sprawdzenie, czy konto jest w `ops.admins`; zapytania wyłącznie po stronie serwera (Server Components / Server Actions), klucz `service_role` nigdy nie trafia do przeglądarki.
- **Dane zdrowotne w panelu** – panel pokazuje **agregaty i statusy** (np. „check-in: tak, poziom zmiany: 2”), a nie treść notatek i samopoczucie konkretnej osoby. Wgląd w szczegóły tylko na wyraźną prośbę użytkownika (wsparcie), z wpisem do logu. Zgodne z zasadą minimalizacji z `PROJECT.md` (sekcja 6).

### Analityka – co z bazy, co z narzędzia

| Rodzaj danych | Źródło | Przykład |
|---|---|---|
| **KPI produktu** (retencja, check-iny, akceptacja propozycji, realizacja planu) | baza → schemat `analytics` → panel | „aktywni po 4 tyg.: 42%” |
| **Lejek marketingowy** (zapisy, źródła, polecenia) | baza → schemat `marketing` → panel | „zapisy z grupy FB: 37” |
| **Ruch na stronie** (odsłony, źródła, Core Web Vitals) | Vercel Web Analytics / Speed Insights (w planie Pro) | „konwersja landingu: 22%” |
| **Zdarzenia w aplikacji** (ekrany, kliknięcia, lejek onboardingu) | opcjonalnie PostHog (chmura UE) – decyzja przed betą | „porzucenie na kroku 3 ankiety” |

### Zarządzanie projektem

Zadania, roadmapę i błędy **nie budujemy w panelu** – to gotowe narzędzia: **GitHub Issues + GitHub Projects** (darmowe, przy kodzie). Panel skupia się na danych: użytkownicy, lista, marketing, AI. Kalendarz treści marketingowych na start w GitHub Projects (widok tablicy/kalendarza), ewentualnie później moduł w panelu.

---

## 4. Design – wspólny dla aplikacji i strony

Jedno źródło prawdy: **tokeny w `packages/design-system/tokens/`**, z których generujemy formaty dla każdej platformy.

```
design/brand/  (ludzie: logo, paleta, typografia – wynik wątku o identyfikacji wizualnej)
      │  decyzje przepisane do tokenów
      ▼
packages/design-system/tokens/*.json   ← jedyne źródło prawdy (format zbliżony do W3C Design Tokens)
      │  build: scripts/build.mjs (`pnpm tokens`)
      ├──► build/theme.css   → CSS variables (light/dark) + motyw Tailwind v4 → apps/web, apps/admin
      ├──► build/tokens.ts   → obiekt TS (kolory, fonty, spacing)             → apps/mobile
      └──► assets/                  → logo, ikony, fonty, ikona aplikacji, splash, favicon, OG image
```

### Co jest w tokenach

| Grupa | Przykład | Uwagi |
|---|---|---|
| `color` | `brand.primary` = `#0E6E66`, `brand.accent` = `#FFB547`, `surface`, `text`, `border` | dwa poziomy: **paleta bazowa** (`teal.600`) i **role semantyczne** (`action.primary`); aplikacje używają tylko ról → zmiana identyfikacji = zmiana jednego pliku |
| `font` | `display` = Space Grotesk, `body` = Inter; rozmiary, wagi, interlinia | fonty jako pliki w `assets/fonts` (web: `next/font/local`, mobile: `expo-font`) |
| `space`, `radius`, `shadow` | `radius.card` = 24, `radius.button` = 14 | wartości z makiet |
| `motion` | czas i krzywe animacji | wspólny „charakter” ruchu |
| tryb ciemny | ten sam zestaw ról dla `light` / `dark` | od początku w strukturze, nawet jeśli wdrożymy później |

Obecne kolory i fonty z makiet są **tymczasowe** (`design/mockups/README.md`) – trafią do tokenów jako punkt startowy i zostaną podmienione po wątku o identyfikacji wizualnej, bez zmian w kodzie aplikacji.

### Co współdzielimy, a czego nie

- **Wspólne:** tokeny, logo, ikony, fonty, ilustracje, słowniki tekstów (`packages/i18n`) i ton komunikacji.
- **Osobne:** komponenty. Landing (marketing, SEO, animacje) i aplikacja natywna mają inne potrzeby – wspólne komponenty przez `react-native-web` dawałyby więcej problemów niż korzyści. Strona i panel mogą dzielić komponenty webowe (`packages/ui-web`) – wydzielimy je dopiero, gdy faktycznie się powtórzą. Panel może korzystać z gotowej biblioteki komponentów (np. shadcn/ui) zasilonej tymi samymi tokenami.
- **Styling w aplikacji mobilnej** (NativeWind vs. `StyleSheet` + motyw z tokenów) – decyzja przy szkielecie aplikacji; tokeny działają w obu wariantach.

---

## 5. Wdrożenia i środowiska

| Element | Produkcja | Podgląd / testy |
|---|---|---|
| `apps/web` | projekt Vercel, Root Directory `apps/web`, gałąź `main` → `<domena>` | Preview Deployment dla każdego PR → baza `staging` |
| `apps/admin` | projekt Vercel, Root Directory `apps/admin` → `admin.<domena>` | Preview → `staging` |
| `apps/mobile` | EAS Build (profil `production`) → sklepy; EAS Update dla poprawek JS | profil `preview` → TestFlight / testy wewnętrzne Google Play → `staging` |
| `supabase/` | GitHub Actions: `supabase db push` + deploy funkcji po merge do `main` | lokalnie `supabase start`; staging przy merge do gałęzi `staging` lub ręcznie |

Region funkcji Vercel: **Frankfurt (`fra1`)** – blisko bazy w UE.
Sekrety (klucz `service_role`, klucz Claude API) tylko w zmiennych środowiskowych Vercel / sekretach Supabase – nigdy w repo ani w aplikacji mobilnej.

---

## 6. Decyzje do potwierdzenia

| Temat | Propozycja | Kiedy |
|---|---|---|
| Monorepo | pnpm + Turborepo, jedno repo | ✅ wdrożone |
| Baza | jeden projekt Supabase na środowisko (local / staging / prod), podział na schematy | teraz |
| Panel | osobna aplikacja Next.js pod `admin.<domena>` | teraz |
| Design | tokeny JSON → własny skrypt (bez zależności) → CSS/Tailwind + TS; pliki w `build/` commitowane, żeby Expo/EAS i Vercel nie wymagały dodatkowego kroku | ✅ wdrożone |
| Logika AI | Supabase Edge Functions (zgodnie z `PROJECT.md`); `plan-engine` importowany z monorepo. **Do sprawdzenia przy szkielecie:** import pakietu workspace w Deno. Plan B: endpointy AI jako funkcje Next.js na Vercel (`fra1`) | szkielet |
| Styling mobile | NativeWind albo `StyleSheet` + motyw | szkielet aplikacji |
| E-maile (potwierdzenie zapisu, zaproszenia do bety) | dostawca z wysyłką z UE (np. Resend – do weryfikacji regionu) | strona z listą |
| Analityka zdarzeń w aplikacji | PostHog (chmura UE) lub tylko dane z bazy | przed betą |
| Domena | do wyboru razem z nazwą docelową | przed publikacją strony |

## 7. Kolejność budowy

1. ✅ **Szkielet monorepo** – pnpm + Turborepo, `packages/config`; zainstalowane `apps/web`, `apps/admin` (Next.js 16), `apps/mobile` (Expo SDK 58).
2. ✅ **`packages/design-system`** – tokeny z obecnych makiet + build do CSS i TS, podpięte we wszystkich trzech aplikacjach.
3. **`supabase/`** – ✅ `config.toml`; do zrobienia: pierwsza migracja – schematy i `marketing` (lista oczekujących).
4. **`apps/web`** – landing z listą oczekujących, polityka prywatności → Vercel (pierwsze zadanie z planu marketingowego; cel: przed Nowym Rokiem).
5. **`apps/admin`** – logowanie admina + widok listy oczekujących i podstawowe liczby.
6. **`packages/plan-engine`** – silnik reguł z testami.
7. **`apps/mobile`** – Expo: auth, onboarding, „Dzisiaj”, check-in; migracje schematu `public` z RLS.
8. **Edge Functions** – interpretacja check-inu i plan tygodnia (Claude API) + log w `ops.ai_calls`; widoki `analytics` w panelu.
