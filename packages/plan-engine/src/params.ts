// Parametry silnika reguł – edytowalne w panelu (wersje w ops.engine_configs), z twardymi granicami w kodzie.
//
// Panel zmienia tylko liczby z tej listy i nigdy nie wyjdzie poza [min, max]. Logika (jak rozkładać treningi,
// kiedy dawać mocniejszą jednostkę, czerwone flagi) zostaje w kodzie – zmienia się ją commitem i testami.

export type EngineParams = {
  baseEasyBeginner: number;
  baseEasyIntermediate: number;
  baseEasyAdvanced: number;
  weeklyGrowthPct: number;
  longFactor: number;
  minSessionMin: number;
  qualityMinMin: number;
  gentleReductionPct: number;
  defaultMaxWeekdayMin: number;
  defaultMaxWeekendMin: number;
  maxHardPerWeek: number;
  minDaysHardToLong: number;
  raceEasyDaysBefore: number;
  maxHardSharePct: number;
  aiMaxIncreasePct: number;
};

export type EngineParamKey = keyof EngineParams;

export type EngineParamSpec = {
  key: EngineParamKey;
  group: 'volume' | 'structure' | 'safety' | 'ai';
  label: string;
  description: string;
  unit: string;
  default: number;
  min: number;
  max: number;
  step: number;
};

export const ENGINE_PARAM_GROUPS: Record<EngineParamSpec['group'], string> = {
  volume: 'Objętość i przyrost',
  structure: 'Struktura tygodnia',
  safety: 'Bezpieczeństwo',
  ai: 'Granice dla AI',
};

export const ENGINE_PARAM_SPECS: readonly EngineParamSpec[] = [
  {
    key: 'baseEasyBeginner',
    group: 'volume',
    label: 'Bazowy trening – nie biega',
    description: 'Długość marszobiegu w 1. tygodniu dla osoby, która nie biega.',
    unit: 'min',
    default: 25,
    min: 15,
    max: 45,
    step: 5,
  },
  {
    key: 'baseEasyIntermediate',
    group: 'volume',
    label: 'Bazowy trening – okazjonalnie',
    description: 'Długość spokojnego biegu w 1. tygodniu dla osoby biegającej okazjonalnie.',
    unit: 'min',
    default: 30,
    min: 15,
    max: 60,
    step: 5,
  },
  {
    key: 'baseEasyAdvanced',
    group: 'volume',
    label: 'Bazowy trening – regularnie',
    description: 'Długość spokojnego biegu w 1. tygodniu dla osoby biegającej regularnie.',
    unit: 'min',
    default: 40,
    min: 20,
    max: 75,
    step: 5,
  },
  {
    key: 'weeklyGrowthPct',
    group: 'volume',
    label: 'Przyrost tygodniowy',
    description: 'O ile dłuższe są treningi z tygodnia na tydzień i twardy limit sumy minut pełnego tygodnia.',
    unit: '%',
    default: 10,
    min: 0,
    max: 15,
    step: 1,
  },
  {
    key: 'longFactor',
    group: 'structure',
    label: 'Długi bieg × spokojny',
    description: 'Ile razy dłuższy od spokojnego biegu jest długi bieg (weekend).',
    unit: '×',
    default: 1.4,
    min: 1,
    max: 1.8,
    step: 0.1,
  },
  {
    key: 'minSessionMin',
    group: 'structure',
    label: 'Najkrótszy trening',
    description: 'Żaden trening nie jest krótszy (także po skróceniu przez AI).',
    unit: 'min',
    default: 15,
    min: 10,
    max: 30,
    step: 5,
  },
  {
    key: 'qualityMinMin',
    group: 'structure',
    label: 'Najkrótsza mocna jednostka',
    description: 'Minimalna długość interwałów / tempa (z rozgrzewką i schłodzeniem).',
    unit: 'min',
    default: 25,
    min: 20,
    max: 40,
    step: 5,
  },
  {
    key: 'defaultMaxWeekdayMin',
    group: 'structure',
    label: 'Domyślny limit – dzień roboczy',
    description: 'Gdy w ankiecie nie podano limitu czasu na dzień roboczy.',
    unit: 'min',
    default: 45,
    min: 20,
    max: 120,
    step: 5,
  },
  {
    key: 'defaultMaxWeekendMin',
    group: 'structure',
    label: 'Domyślny limit – weekend',
    description: 'Gdy w ankiecie nie podano limitu czasu na weekend.',
    unit: 'min',
    default: 60,
    min: 20,
    max: 180,
    step: 5,
  },
  {
    key: 'maxHardPerWeek',
    group: 'safety',
    label: 'Mocne jednostki w tygodniu',
    description: 'Najwięcej interwałów / tempa w tygodniu. Silnik stawia najwyżej 1, AI może dołożyć do limitu. 0 = bez mocnych.',
    unit: 'szt.',
    default: 1,
    min: 0,
    max: 2,
    step: 1,
  },
  {
    key: 'minDaysHardToLong',
    group: 'safety',
    label: 'Odstęp mocnej jednostki',
    description: 'Ile dni co najmniej między mocną jednostką a długim biegiem lub inną mocną (2 = nigdy dzień po dniu).',
    unit: 'dni',
    default: 2,
    min: 2,
    max: 4,
    step: 1,
  },
  {
    key: 'gentleReductionPct',
    group: 'safety',
    label: 'Skrócenie przy przeciwwskazaniach',
    description: 'O ile krótsze są treningi, gdy w ankiecie zaznaczono przeciwwskazania (wtedy też tylko spokojne).',
    unit: '%',
    default: 20,
    min: 0,
    max: 50,
    step: 5,
  },
  {
    key: 'raceEasyDaysBefore',
    group: 'safety',
    label: 'Spokojne dni przed zawodami',
    description: 'Ile dni przed startem tylko spokojne, krótkie biegi (dzień przed i po – wolne).',
    unit: 'dni',
    default: 3,
    min: 2,
    max: 7,
    step: 1,
  },
  {
    key: 'maxHardSharePct',
    group: 'safety',
    label: 'Mocne minuty w treningu',
    description: 'Najwyżej tyle procent treningu w strefach tempo / interwał / przebieżka (gdy AI układa część główną).',
    unit: '%',
    default: 35,
    min: 20,
    max: 50,
    step: 5,
  },
  {
    key: 'aiMaxIncreasePct',
    group: 'ai',
    label: 'Wydłużenie przez AI',
    description: 'O ile AI może wydłużyć tydzień względem szkicu silnika (skracać może zawsze, do minimum).',
    unit: '%',
    default: 10,
    min: 0,
    max: 25,
    step: 5,
  },
];

export const DEFAULT_ENGINE_PARAMS: EngineParams = Object.fromEntries(
  ENGINE_PARAM_SPECS.map((s) => [s.key, s.default]),
) as EngineParams;

export type ParamsValidation =
  | { ok: true; params: EngineParams }
  | { ok: false; errors: { key: string; message: string }[] };

/**
 * Sprawdza parametry z bazy / formularza. Brakujące klucze → wartość domyślna (nowe parametry po aktualizacji kodu),
 * nieznane klucze są pomijane, wartości spoza granic → błąd (nigdy nie przycinamy po cichu).
 */
export function validateEngineParams(raw: unknown): ParamsValidation {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const errors: { key: string; message: string }[] = [];
  const params = { ...DEFAULT_ENGINE_PARAMS };
  for (const spec of ENGINE_PARAM_SPECS) {
    const value = source[spec.key];
    if (value === undefined || value === null || value === '') continue;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) {
      errors.push({ key: spec.key, message: `${spec.label}: to nie jest liczba.` });
      continue;
    }
    if (n < spec.min || n > spec.max) {
      errors.push({ key: spec.key, message: `${spec.label}: dozwolone ${spec.min}–${spec.max} ${spec.unit}.` });
      continue;
    }
    if (spec.step >= 1 && !Number.isInteger(n)) {
      errors.push({ key: spec.key, message: `${spec.label}: musi być liczbą całkowitą.` });
      continue;
    }
    params[spec.key] = n;
  }
  return errors.length ? { ok: false, errors } : { ok: true, params };
}

/** Parametry do użycia w obliczeniach: poprawne z bazy albo – przy błędzie – wartości wbudowane (bezpieczny tryb). */
export function resolveEngineParams(raw: unknown): EngineParams {
  const checked = validateEngineParams(raw);
  return checked.ok ? checked.params : { ...DEFAULT_ENGINE_PARAMS };
}

/** Zasady, które są logiką w kodzie (do pokazania w panelu obok parametrów). */
export const ENGINE_RULES: readonly { title: string; detail: string }[] = [
  { title: 'Kalendarz', detail: 'Plan od dnia startu; tydzień 0 trwa do najbliższej niedzieli, kolejne pon–nd. Pusty niepełny tydzień 0 → start od poniedziałku.' },
  { title: 'Dni treningowe', detail: 'Tylko w preferowane dni z ankiety, rozłożone możliwie równo; najwyżej jeden trening dziennie.' },
  { title: 'Liczba treningów', detail: 'Tyle, ile w ankiecie; w niepełnym tygodniu proporcjonalnie mniej (co najmniej 1).' },
  { title: 'Marszobieg', detail: '„Nie biegam” → tylko marszobieg (bez długiego biegu i mocnych jednostek).' },
  { title: 'Długi bieg', detail: 'Przy 2+ treningach: ostatni dzień weekendowy (albo ostatni w tygodniu).' },
  { title: 'Mocne jednostki', detail: 'Interwały (tempo przy półmaratonie i maratonie) od 2. tygodnia, od 1. dla biegających regularnie; tylko przy celu „popraw formę” albo zawodach i przy 3+ treningach.' },
  { title: 'Limit czasu', detail: 'Każdy trening ≤ limit z ankiety na ten dzień (dzień roboczy / weekend).' },
  { title: 'Przyrost', detail: 'Pełny tydzień ≤ poprzedni pełny × (1 + przyrost); nadmiar przycinany po 5 min z najdłuższych treningów.' },
  { title: 'Przeciwwskazania', detail: 'Tylko spokojne jednostki, krótsze o ustawiony procent.' },
  { title: 'Zawody', detail: 'Start w dniu zawodów, dzień przed i po – wolne, ostatnie dni przed startem tylko spokojnie i krótko.' },
  { title: 'Struktura treningu', detail: 'Każdy trening to odcinki: rozgrzewka → część główna → schłodzenie; suma = długość treningu. Domyślną część główną liczy silnik z typu (marszobieg, spokojny, interwały, tempo).' },
  { title: 'Część główna od AI', detail: 'AI może ułożyć część główną z serii (powtórzenia × odcinek + przerwa, różne strefy). Rozgrzewkę i schłodzenie dokłada silnik; strefy muszą pasować do typu treningu, a mocne minuty mieszczą się w limicie.' },
  { title: 'Tempo odcinków', detail: 'Z ostatniego wyniku z ankiety (przeliczenie na 10 km); bez wyniku – tylko strefa wysiłku.' },
];
