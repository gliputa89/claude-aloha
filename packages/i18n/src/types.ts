import type { pl } from './locales/pl';

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Kształt słownika – wyznacza go wersja PL. */
export type Dictionary = Widen<typeof pl>;

export type Locale = 'pl' | 'en';

type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Klucz tekstu, np. `signIn.title`. */
export type TranslationKey = Paths<Dictionary>;

export type TranslationParams = Record<string, string | number>;
