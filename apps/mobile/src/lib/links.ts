import type { Locale } from '@aloha/i18n';

/** Adres strony (aloha-web) z regulaminem i polityką prywatności. */
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://aloha-web-eight.vercel.app').replace(/\/$/, '');

const paths: Record<'terms' | 'privacy', Record<Locale, string>> = {
  terms: { pl: '/regulamin', en: '/en/terms' },
  privacy: { pl: '/polityka-prywatnosci', en: '/en/privacy' },
};

export function legalUrl(doc: 'terms' | 'privacy', locale: Locale) {
  return `${SITE_URL}${paths[doc][locale]}`;
}
