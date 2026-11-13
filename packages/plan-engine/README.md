# packages/plan-engine – silnik reguł, warstwa AI i moduły produktu

Czysty TypeScript bez zależności. Używany w Edge Functions (kopia przez `scripts/sync-plan-engine.sh`), aplikacji mobilnej i panelu.
Reguły: [`docs/PROJECT.md`](../../docs/PROJECT.md), sekcja 5. Podział na moduły i pakiety: [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), sekcja 2a.

Kod leży w folderach modułów. Wszystko jest eksportowane przez `src/index.ts`, więc aplikacje importują z `@aloha/plan-engine` jak dotąd.

| Folder | Moduł | Co zawiera |
|---|---|---|
| `core/` | wspólne | `modules.ts` – lista modułów i pakietów, `hasModule`; `dates.ts`; `workout.ts` – odcinki treningu i strefy tempa |
| `plan/` | `plan` | `plan.ts` – szkic tygodni (deterministyczny, tryb awaryjny); `params.ts` – parametry silnika z twardymi granicami; `levels.ts`, `level-review.ts`, `goal.ts`, `survey.ts`, `rows.ts`, `next-week.ts` |
| `ai/` | `plan_ai` + warstwa AI | `ai-ops.ts` – operacje AI na szkicu i walidacja; `ai-run.ts` – pętla szkic → Claude → walidacja → ponowienie; `ai-prompt.ts` – rejestr funkcji AI (`AI_FUNCTIONS`, każda z polem `module`) i prompt planu; `ai-pricing.ts`, `ai-config.ts` |
| `weather/` | `weather` | `weather.ts` – okno pogodowe i ostrzeżenia z reguł; `weather-advice.ts` – porada słowna od AI; `prompt.ts` |
| `strava/` | `strava` | `strava.ts` – dopasowanie biegów do treningów, propozycja „to był ten trening?” |
| `review/` | `review` | `review.ts` – werdykt, osie i fakty (tempo, tętno); `review-sim.ts` – symulator biegów i macierz scenariuszy |
| `chat/` | `coach_chat`, `coach_human` | `chat.ts` – kontekst rozmowy, odpowiedź z opcjonalną propozycją zmiany planu, walidacja i zapis zmiany; `prompt.ts` – Pan Aloha |
| `coach/` | `coach` | `review-note.ts` – notka po treningu (z jedną automatyczną poprawką) i flagi jakości; `day-note.ts` – notka na dzień bez biegu; `prompts.ts` |

Zasady podziału:

- Moduł nie importuje z innego modułu funkcjonalnego, poza tym, czego wymaga (`review` i `coach` czytają typy z `review/`, wszystko może czytać `core/` i warstwę AI z `ai/`).
- Prompt wbudowany modułu leży w jego folderze; rejestr w `ai/ai-prompt.ts` tylko je zbiera.
- Nowa funkcja produktu = nowy folder + wpis w `core/modules.ts` (etykieta, funkcje serwera, tabele) + przypisanie do pakietów w `PACKAGES`.

Wariant B planu (docs/PROJECT.md 5): silnik robi szkic, Claude zwraca listę operacji (structured outputs), silnik przyjmuje tylko te,
które nie wprowadzają nowego naruszenia reguł. Każda próba trafia do `ops.ai_calls` (koszt, tokeny, model, wersje)
i `ops.ai_call_payloads` (pełne wejście / wyjście; prawdziwi użytkownicy 30 dni, konta testowe bez limitu).

```bash
pnpm --filter @aloha/plan-engine test
```
