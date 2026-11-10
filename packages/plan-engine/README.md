# packages/plan-engine – silnik reguł i warstwa AI planu

Czysty TypeScript bez zależności. Używany w Edge Functions (kopia przez `scripts/sync-plan-engine.sh`), aplikacji mobilnej i panelu.
Reguły: [`docs/PROJECT.md`](../../docs/PROJECT.md), sekcja 5.

| Plik | Co robi |
|---|---|
| `plan.ts` | szkic tygodni planu (deterministyczny, tryb awaryjny) |
| `params.ts` | parametry silnika z twardymi granicami – edytowane w panelu (`ops.engine_configs`), opis logiki w kodzie |
| `ai-ops.ts` | operacje AI na szkicu (`set_duration`, `set_type`, `move`, `remove`, `add`), walidacja planu, nakładanie z cofaniem operacji łamiących reguły |
| `ai-prompt.ts` | prompt wbudowany, blok reguł z parametrów, wiadomość z danymi biegacza (bez identyfikatorów) |
| `ai-run.ts` | pętla szkic → Claude → walidacja → ponowienie → wynik; wywołanie modelu i log wstrzykuje środowisko |
| `ai-pricing.ts` | cennik modeli i koszt wywołania z `usage` |
| `ai-config.ts` | wiersze z bazy (`get_ai_prompt`, `get_engine_config`) → konfiguracja; brak / błąd = wartości wbudowane |

Wariant B (docs/PROJECT.md 5): silnik robi szkic, Claude zwraca listę operacji (structured outputs), silnik przyjmuje tylko te,
które nie wprowadzają nowego naruszenia reguł. Każda próba trafia do `ops.ai_calls` (koszt, tokeny, model, wersje)
i `ops.ai_call_payloads` (pełne wejście / wyjście; prawdziwi użytkownicy 30 dni, konta testowe bez limitu).

```bash
pnpm --filter @aloha/plan-engine test
```
