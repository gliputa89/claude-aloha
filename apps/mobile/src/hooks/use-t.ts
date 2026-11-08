import { createTranslator, resolveLocale, type Locale } from '@aloha/i18n';
import { useLocales } from 'expo-localization';
import { useMemo } from 'react';

/** Język aplikacji z ustawień systemu (PL domyślnie, EN dla systemu po angielsku). */
export function useLocale(): Locale {
  const locales = useLocales();
  return resolveLocale(locales[0]?.languageCode);
}

export function useT() {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}
