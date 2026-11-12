// Moduły produktu i pakiety. Każda funkcja aplikacji należy do jednego modułu, a pakiet (dziś: status
// subskrypcji z profiles.subscription_status) to lista modułów, które ma włączone.
//
// W MVP wszystkie pakiety mają wszystko – ale bramki już stoją: Edge Functions i aplikacja pytają
// `hasModule(...)`, więc zmiana oferty to edycja `PACKAGES`, a nie przebudowa kodu.
// Kod modułu: packages/plan-engine/src/<folder>, funkcje serwera i tabele – patrz pola poniżej i docs/ARCHITECTURE.md.

export const MODULES = {
  plan: {
    label: 'Plan treningowy',
    description: 'Ankieta, plan z reguł, widok tygodnia i treningu, odhaczanie. Podstawa – zawsze włączona.',
    core: true,
    folder: 'plan',
    functions: ['generate-plan', 'generate-next-week'],
    tables: ['plans', 'weeks', 'sessions'],
  },
  plan_ai: {
    label: 'Plan dopasowany przez AI',
    description: 'Claude poprawia szkic tygodnia z silnika i pisze rady trenera do treningów. Bez modułu: sam plan z reguł.',
    core: false,
    folder: 'ai',
    functions: ['generate-plan', 'generate-next-week', 'race-forecast'],
    tables: [],
  },
  weather: {
    label: 'Pogoda i pora treningu',
    description: 'Prognoza do najbliższych treningów, najlepsza pora i ostrzeżenia, porada słowna od AI.',
    core: false,
    folder: 'weather',
    functions: ['session-weather'],
    tables: ['session_weather'],
  },
  strava: {
    label: 'Strava',
    description: 'Połączenie konta, pobieranie biegów, automatyczne odhaczanie treningów i pytanie o przesunięty dzień.',
    core: false,
    folder: 'strava',
    functions: ['strava-oauth', 'strava-sync', 'strava-history'],
    tables: ['strava_connections', 'strava_activities'],
  },
  review: {
    label: 'Ocena treningu',
    description: 'Porównanie biegu z planem: werdykt, objętość, intensywność, fakty z liczbami (tempo, tętno). Wymaga Stravy.',
    core: false,
    folder: 'review',
    functions: ['strava-sync'],
    tables: ['session_reviews'],
  },
  coach: {
    label: 'Notki trenera AI',
    description: 'Notka po ocenionym treningu i notka na dzień bez biegu. Notka po treningu wymaga oceny.',
    core: false,
    folder: 'coach',
    functions: ['strava-sync', 'day-note'],
    tables: ['session_reviews', 'day_notes'],
  },
  coach_chat: {
    label: 'Rozmowa z trenerem AI',
    description: 'Czat z trenerem AI (Keanu Biegała): pytania ogólne oraz przed i po treningu; trener może zaproponować zmianę w planie.',
    core: false,
    folder: 'chat',
    functions: ['coach-chat'],
    tables: ['coaches', 'chat_threads', 'chat_messages'],
  },
  coach_human: {
    label: 'Rozmowa z prawdziwym trenerem',
    description: 'Czat z trenerem-człowiekiem przydzielonym do biegacza. Osobny pakiet – odpowiedzi nie są natychmiastowe.',
    core: false,
    folder: 'chat',
    functions: ['coach-chat'],
    tables: ['coaches', 'coach_assignments', 'chat_threads', 'chat_messages'],
  },
} as const;

export type ModuleId = keyof typeof MODULES;
export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

/** Moduły, bez których ten moduł nie ma sensu – wyłączenie jednego wyłącza zależne. */
export const MODULE_REQUIRES: Partial<Record<ModuleId, ModuleId[]>> = {
  review: ['strava'],
  coach: [],
};

/** Pakiet = status subskrypcji z profilu. */
export type PackageId = 'free' | 'trial' | 'paid';

/** Moduły, które od początku są osobnym, płatnym pakietem (kosztują czas człowieka). */
const PAID_ONLY: readonly ModuleId[] = ['coach_human'];

/**
 * Co jest w którym pakiecie. MVP: wszystko poza rozmową z prawdziwym trenerem jest w każdym pakiecie
 * (decyzja z docs/PROJECT.md, rozdz. 7). Żeby coś przenieść do płatnego pakietu, wystarczy usunąć moduł z listy `free`.
 */
export const PACKAGES: Record<PackageId, readonly ModuleId[]> = {
  free: MODULE_IDS.filter((id) => !PAID_ONLY.includes(id)),
  trial: MODULE_IDS,
  paid: MODULE_IDS,
};

const isPackage = (value: unknown): value is PackageId => value === 'free' || value === 'trial' || value === 'paid';

/** Moduły włączone dla statusu subskrypcji (nieznany status = pakiet darmowy), z uwzględnieniem zależności. */
export function modulesFor(subscriptionStatus: unknown): ModuleId[] {
  const listed = new Set<ModuleId>(PACKAGES[isPackage(subscriptionStatus) ? subscriptionStatus : 'free']);
  for (const id of MODULE_IDS) if (MODULES[id].core) listed.add(id);
  return MODULE_IDS.filter((id) => listed.has(id) && (MODULE_REQUIRES[id] ?? []).every((need) => listed.has(need)));
}

export const hasModule = (subscriptionStatus: unknown, id: ModuleId) => modulesFor(subscriptionStatus).includes(id);
