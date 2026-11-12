import { createTranslator, type Locale } from '@aloha/i18n';
import { useMemo } from 'react';

import { useLanguage, useUnits } from '@/lib/locale-preference';

/** Język aplikacji: przy pierwszym uruchomieniu z ustawień telefonu, potem z wyboru w Profilu. */
export function useLocale(): Locale {
  return useLanguage();
}

export function useT() {
  const locale = useLocale();
  // Teksty z dystansem czy temperaturą zależą też od jednostek – nowy `t` po ich zmianie odświeża
  // każdy ekran z tekstami, także te w innych zakładkach i funkcje czytające `getUnits()`.
  const units = useUnits();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createTranslator(locale), [locale, units]);
}
