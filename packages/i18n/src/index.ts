import { en } from './locales/en';
import { pl } from './locales/pl';
import type { Dictionary, Locale, TranslationKey, TranslationParams } from './types';

export type { Dictionary, Locale, TranslationKey, TranslationParams } from './types';

export const dictionaries: Record<Locale, Dictionary> = { pl, en };

export const defaultLocale: Locale = 'pl';

/** Mapuje kod języka (np. z ustawień systemu) na obsługiwany język. Wszystko poza EN → PL. */
export function resolveLocale(languageCode: string | null | undefined): Locale {
  return languageCode?.toLowerCase().startsWith('en') ? 'en' : 'pl';
}

function lookup(dictionary: Dictionary, key: TranslationKey): string | undefined {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Tekst dla klucza; `{name}` w tekście zastępuje `params.name`. Brak w EN → wersja PL. */
export function translate(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const text = lookup(dictionaries[locale], key) ?? lookup(dictionaries[defaultLocale], key) ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params);
}

export type Translator = ReturnType<typeof createTranslator>;
