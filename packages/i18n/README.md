# packages/i18n – wspólne teksty PL/EN

Słowniki współdzielone przez stronę i aplikację: nazwy treningów, skala samopoczucia, podpowiedzi check-inu, ton „trener, ale kumpel”.

- `src/locales/pl.ts` – źródło kształtu słownika; `en.ts` musi mieć te same klucze (pilnuje tego typ `Dictionary`).
- Teksty pogrupowane wg ekranu / obszaru (`signIn`, `signUp`, `authErrors`…). Wspólne dla strony i aplikacji (treningi, skala, podpowiedzi) trafiają do osobnych grup.
- Parametry w klamrach: `'Aloha, {name}!'` → `t('home.greeting', { name })`.

```ts
import { createTranslator, resolveLocale } from '@aloha/i18n';

const t = createTranslator(resolveLocale('en-US'));
t('signIn.title'); // „Welcome back”
```

W aplikacji mobilnej: hook `useT()` z `apps/mobile/src/hooks/use-t.ts` (język z ustawień systemu).
