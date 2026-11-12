/** Właściciel aplikacji i administrator danych. Jedno miejsce – zmiana tutaj trafia do stopki i dokumentów. */
export const operator = {
  name: "Posadzimy.pl sp. z o.o.",
  street: "ul. Świeradowska 51, lok. 57",
  city: "50-559 Wrocław",
  country: { pl: "Polska", en: "Poland" },
  krs: "0000880990",
  nip: "8992893866",
  regon: "388226019",
  /** Adres do spraw prywatności i reklamacji. */
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "biuro@posadzimy.pl",
} as const;

/** Data, od której obowiązują bieżące wersje dokumentów (zgodna z TERMS_VERSION w aplikacji: 2026-11). */
export const legalEffective = { pl: "12 listopada 2026 r.", en: "12 November 2026" } as const;
