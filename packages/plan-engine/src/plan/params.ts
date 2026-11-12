// Parametry silnika reguł – edytowalne w panelu (wersje w ops.engine_configs), z twardymi granicami w kodzie.
//
// Panel zmienia tylko liczby z tej listy i nigdy nie wyjdzie poza [min, max]. Logika (jak rozkładać treningi,
// kiedy dawać mocniejszą jednostkę, czerwone flagi) zostaje w kodzie – zmienia się ją commitem i testami.
//
// Każda metryka ma osobną wartość dla każdego poziomu zaawansowania 1–5 (levels.ts).
// Zapis w bazie: płaskie klucze `${metryka}L${poziom}` (EngineParams). Silnik bierze kolumnę poziomu
// biegacza (LevelParams, `paramsForLevel`) – logika czyta zwykłe `p.minSessionMin` itd.

import { TRAINING_LEVELS, type TrainingLevel } from './levels.ts';

/** Parametry dla jednego poziomu – tego używa logika silnika. */
export type LevelParams = {
  baseEasyMin: number;
  weeklyGrowthPct: number;
  deloadEveryWeeks: number;
  deloadReductionPct: number;
  longFactor: number;
  minSessionMin: number;
  qualityMinMin: number;
  defaultMaxWeekdayMin: number;
  defaultMaxWeekendMin: number;
  maxHardPerWeek: number;
  minDaysHardToLong: number;
  gentleReductionPct: number;
  raceEasyDaysBefore: number;
  maxHardSharePct: number;
  maxTempoSharePct: number;
  aiMaxIncreasePct: number;
  levelUpMinWeeks: number;
  levelUpMinDonePct: number;
  levelDownMaxDonePct: number;
  levelBreakDays: number;
};

export type ParamMetric = keyof LevelParams;

/** Komplet parametrów (wszystkie poziomy) – tak jest zapisany w wersji. */
export type EngineParams = { [K in ParamMetric as `${K}L${TrainingLevel}`]: number };
export type EngineParamKey = keyof EngineParams;

export type ParamGroup = 'volume' | 'structure' | 'safety' | 'level' | 'ai';

export const ENGINE_PARAM_GROUPS: Record<ParamGroup, string> = {
  volume: 'Objętość i przyrost',
  structure: 'Struktura tygodnia',
  safety: 'Bezpieczeństwo',
  level: 'Zmiana poziomu (co tydzień)',
  ai: 'Granice dla AI',
};

/** Metryka (wiersz tabeli w panelu) z wartością domyślną dla każdego poziomu. */
export type MetricSpec = {
  metric: ParamMetric;
  group: ParamGroup;
  label: string;
  description: string;
  unit: string;
  defaults: Record<TrainingLevel, number>;
  min: number;
  max: number;
  step: number;
};

const same = (v: number): Record<TrainingLevel, number> => ({ 1: v, 2: v, 3: v, 4: v, 5: v });

export const METRIC_SPECS: readonly MetricSpec[] = [
  {
    metric: 'baseEasyMin',
    group: 'volume',
    label: 'Bazowy trening',
    description: 'Długość spokojnego biegu (na poziomie 1 – marszobiegu) w 1. tygodniu. Od niego liczone są długi bieg i mocna jednostka.',
    unit: 'min',
    defaults: { 1: 25, 2: 30, 3: 35, 4: 40, 5: 50 },
    min: 15,
    max: 75,
    step: 5,
  },
  {
    metric: 'weeklyGrowthPct',
    group: 'volume',
    label: 'Przyrost tygodniowy',
    description: 'O ile dłuższe są treningi z tygodnia na tydzień i twardy limit sumy minut pełnego tygodnia.',
    unit: '%',
    defaults: same(10),
    min: 0,
    max: 15,
    step: 1,
  },
  {
    metric: 'deloadEveryWeeks',
    group: 'volume',
    label: 'Cykl z lżejszym tygodniem',
    description: 'Długość cyklu obciążenia: np. 4 = trzy tygodnie rosnące, czwarty lżejszy. 0 = bez lżejszych tygodni (wartości 1–2 też wyłączają).',
    unit: 'tyg.',
    defaults: { 1: 0, 2: 0, 3: 0, 4: 4, 5: 4 },
    min: 0,
    max: 6,
    step: 1,
  },
  {
    metric: 'deloadReductionPct',
    group: 'volume',
    label: 'Lżejszy tydzień – mniej o',
    description: 'O ile krótsze są treningi w lżejszym tygodniu cyklu względem poprzedniego tygodnia.',
    unit: '%',
    defaults: same(25),
    min: 10,
    max: 40,
    step: 5,
  },
  {
    metric: 'longFactor',
    group: 'structure',
    label: 'Długi bieg × spokojny',
    description: 'Ile razy dłuższy od spokojnego biegu jest długi bieg (weekend). Na poziomie 1 nie ma długiego biegu.',
    unit: '×',
    defaults: same(1.4),
    min: 1,
    max: 1.8,
    step: 0.1,
  },
  {
    metric: 'minSessionMin',
    group: 'structure',
    label: 'Najkrótszy trening',
    description: 'Żaden trening nie jest krótszy (także po skróceniu przez AI).',
    unit: 'min',
    defaults: same(15),
    min: 10,
    max: 30,
    step: 5,
  },
  {
    metric: 'qualityMinMin',
    group: 'structure',
    label: 'Najkrótsza mocna jednostka',
    description: 'Minimalna długość interwałów / tempa (z rozgrzewką i schłodzeniem).',
    unit: 'min',
    defaults: same(25),
    min: 20,
    max: 40,
    step: 5,
  },
  {
    metric: 'defaultMaxWeekdayMin',
    group: 'structure',
    label: 'Domyślny limit – dzień roboczy',
    description: 'Gdy w ankiecie nie podano limitu czasu na dzień roboczy.',
    unit: 'min',
    defaults: same(45),
    min: 20,
    max: 120,
    step: 5,
  },
  {
    metric: 'defaultMaxWeekendMin',
    group: 'structure',
    label: 'Domyślny limit – weekend',
    description: 'Gdy w ankiecie nie podano limitu czasu na weekend.',
    unit: 'min',
    defaults: same(60),
    min: 20,
    max: 180,
    step: 5,
  },
  {
    metric: 'maxHardPerWeek',
    group: 'safety',
    label: 'Mocne jednostki w tygodniu',
    description: 'Najwięcej interwałów / tempa w tygodniu. Silnik stawia najwyżej 1, AI może dołożyć do limitu. 0 = bez mocnych. Poziom 1 nigdy nie dostaje mocnych.',
    unit: 'szt.',
    defaults: same(1),
    min: 0,
    max: 2,
    step: 1,
  },
  {
    metric: 'minDaysHardToLong',
    group: 'safety',
    label: 'Odstęp mocnej jednostki',
    description: 'Ile dni co najmniej między mocną jednostką a długim biegiem lub inną mocną (2 = nigdy dzień po dniu).',
    unit: 'dni',
    defaults: same(2),
    min: 2,
    max: 4,
    step: 1,
  },
  {
    metric: 'gentleReductionPct',
    group: 'safety',
    label: 'Skrócenie przy przeciwwskazaniach',
    description: 'O ile krótsze są treningi, gdy w ankiecie zaznaczono przeciwwskazania (wtedy też tylko spokojne).',
    unit: '%',
    defaults: same(20),
    min: 0,
    max: 50,
    step: 5,
  },
  {
    metric: 'raceEasyDaysBefore',
    group: 'safety',
    label: 'Spokojne dni przed zawodami',
    description: 'Ile dni przed startem tylko spokojne, krótkie biegi (dzień przed i po – wolne).',
    unit: 'dni',
    defaults: same(3),
    min: 2,
    max: 7,
    step: 1,
  },
  {
    metric: 'maxHardSharePct',
    group: 'safety',
    label: 'Bardzo mocne minuty w treningu',
    description: 'Najwyżej tyle procent treningu w strefach interwał / przebieżka (gdy AI układa część główną).',
    unit: '%',
    defaults: same(35),
    min: 20,
    max: 50,
    step: 5,
  },
  {
    metric: 'maxTempoSharePct',
    group: 'safety',
    label: 'Mocne minuty razem z tempem',
    description:
      'Najwyżej tyle procent treningu w strefach tempo + interwał + przebieżka. Wyższy niż limit bardzo mocnych minut, żeby zmieścił się trening progowy (3×10, 2×15 min); ogranicza też drabinkę progową silnika.',
    unit: '%',
    defaults: same(55),
    min: 35,
    max: 65,
    step: 5,
  },
  {
    metric: 'levelUpMinWeeks',
    group: 'level',
    label: 'Awans – tygodnie na poziomie',
    description: 'Najkrócej tyle tygodni na obecnym poziomie przed awansem o jeden (poziom 5 nie awansuje).',
    unit: 'tyg.',
    defaults: same(4),
    min: 2,
    max: 12,
    step: 1,
  },
  {
    metric: 'levelUpMinDonePct',
    group: 'level',
    label: 'Awans – wykonane treningi',
    description: 'Awans, gdy w ostatnich 3 pełnych tygodniach wykonano co najmniej tyle procent treningów i nie było bólu ani czerwonych flag (28 dni).',
    unit: '%',
    defaults: same(85),
    min: 50,
    max: 100,
    step: 5,
  },
  {
    metric: 'levelDownMaxDonePct',
    group: 'level',
    label: 'Spadek – wykonane treningi',
    description: 'Spadek o jeden, gdy w każdym z 2 ostatnich pełnych tygodni wykonano mniej niż tyle procent treningów. Ból lub czerwona flaga w check-inie (14 dni) – spadek od razu (poziom 1 nie spada).',
    unit: '%',
    defaults: same(50),
    min: 0,
    max: 80,
    step: 5,
  },
  {
    metric: 'levelBreakDays',
    group: 'level',
    label: 'Spadek – przerwa',
    description: 'Spadek o jeden, gdy przez tyle dni nie wykonano żadnego zaplanowanego treningu.',
    unit: 'dni',
    defaults: same(14),
    min: 7,
    max: 42,
    step: 1,
  },
  {
    metric: 'aiMaxIncreasePct',
    group: 'ai',
    label: 'Wydłużenie przez AI',
    description: 'O ile AI może wydłużyć tydzień względem szkicu silnika (skracać może zawsze, do minimum).',
    unit: '%',
    defaults: same(10),
    min: 0,
    max: 25,
    step: 5,
  },
];

export const paramKey = (metric: ParamMetric, level: TrainingLevel) => `${metric}L${level}` as EngineParamKey;

/** Pojedyncza liczba do walidacji: metryka × poziom. */
export type EngineParamSpec = Omit<MetricSpec, 'defaults'> & { key: EngineParamKey; level: TrainingLevel; default: number };

export const ENGINE_PARAM_SPECS: readonly EngineParamSpec[] = METRIC_SPECS.flatMap(({ defaults, ...m }) =>
  TRAINING_LEVELS.map((level) => ({
    ...m,
    key: paramKey(m.metric, level),
    level,
    label: `${m.label} – poziom ${level}`,
    default: defaults[level],
  })),
);

export const DEFAULT_ENGINE_PARAMS: EngineParams = Object.fromEntries(
  ENGINE_PARAM_SPECS.map((s) => [s.key, s.default]),
) as EngineParams;

/** Kolumna jednego poziomu – parametry, którymi liczy silnik dla danego biegacza. */
export function paramsForLevel(p: EngineParams, level: TrainingLevel): LevelParams {
  return Object.fromEntries(METRIC_SPECS.map((m) => [m.metric, p[paramKey(m.metric, level)]])) as LevelParams;
}

export type ParamsValidation =
  | { ok: true; params: EngineParams }
  | { ok: false; errors: { key: string; message: string }[] };

/**
 * Sprawdza parametry z bazy / formularza. Brakujące klucze → wartość domyślna (nowe parametry po aktualizacji kodu),
 * nieznane klucze są pomijane, wartości spoza granic → błąd (nigdy nie przycinamy po cichu).
 */
export function validateEngineParams(raw: unknown): ParamsValidation {
  const source = withLegacyKeys(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
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

/**
 * Wersje sprzed poziomów miały jedną wartość na metrykę (bez sufiksu `L1`…`L5`) – trafia ona do wszystkich poziomów.
 * Wyjątek: 3 bazowe czasy (nie biega → 1, okazjonalnie → 2, regularnie → 4). Klucze z sufiksem mają pierwszeństwo.
 */
function withLegacyKeys(source: Record<string, unknown>): Record<string, unknown> {
  const out = { ...source };
  const legacy: [string, ParamMetric, readonly TrainingLevel[]][] = [
    ['baseEasyBeginner', 'baseEasyMin', [1]],
    ['baseEasyIntermediate', 'baseEasyMin', [2]],
    ['baseEasyAdvanced', 'baseEasyMin', [4]],
    ...METRIC_SPECS.map((m): [string, ParamMetric, readonly TrainingLevel[]] => [m.metric, m.metric, TRAINING_LEVELS]),
  ];
  for (const [old, metric, levels] of legacy) {
    if (source[old] === undefined) continue;
    for (const level of levels) {
      const key = paramKey(metric, level);
      if (out[key] === undefined) out[key] = source[old];
    }
    delete out[old];
  }
  return out;
}

/** Parametry do użycia w obliczeniach: poprawne z bazy albo – przy błędzie – wartości wbudowane (bezpieczny tryb). */
export function resolveEngineParams(raw: unknown): EngineParams {
  const checked = validateEngineParams(raw);
  return checked.ok ? checked.params : { ...DEFAULT_ENGINE_PARAMS };
}

/** Zasady, które są logiką w kodzie (do pokazania w panelu obok parametrów). */
export const ENGINE_RULES: readonly { title: string; detail: string }[] = [
  { title: 'Poziom zaawansowania', detail: '1–5 z ankiety: „nie biegam” → 1; okazjonalnie → 2 (3 przy 10 km ≤ 55 min); regularnie → 4 (3 przy 10 km > 55 min, 5 przy < 45 min). Wynik przeliczany na 10 km. Od poziomu zależą wszystkie parametry (osobna kolumna w panelu).' },
  { title: 'Kalendarz', detail: 'Plan od dnia startu; tydzień 0 trwa do najbliższej niedzieli, kolejne pon–nd. Pusty niepełny tydzień 0 → start od poniedziałku.' },
  { title: 'Dni treningowe', detail: 'Tylko w preferowane dni z ankiety, rozłożone możliwie równo; najwyżej jeden trening dziennie.' },
  { title: 'Liczba treningów', detail: 'Tyle, ile w ankiecie; w niepełnym tygodniu proporcjonalnie mniej (co najmniej 1).' },
  { title: 'Marszobieg', detail: 'Poziom 1 → tylko marszobieg (bez długiego biegu i mocnych jednostek).' },
  { title: 'Długi bieg', detail: 'Przy 2+ treningach: ostatni dzień weekendowy (albo ostatni w tygodniu).' },
  { title: 'Mocne jednostki', detail: 'Od poziomu 2, od 2. tygodnia (od 1. na poziomie 4–5); tylko przy celu „popraw formę” albo zawodach i przy 3+ treningach. Półmaraton i maraton: co tydzień tempo ciągłe. Pozostałe cele: poziom 2 – interwały; od poziomu 3 na zmianę interwały i trening progowy.' },
  { title: 'Cykl obciążenia', detail: 'Na poziomach z ustawionym cyklem (domyślnie 4–5: co 4. tydzień) ostatni tydzień cyklu jest lżejszy: treningi krótsze o ustawiony procent, mocna jednostka to krótkie interwały z ok. 60% powtórzeń. Objętość i drabinka progowa w tym tygodniu nie rosną; tydzień po nim wraca na poziom sprzed lżejszego plus przyrost.' },
  { title: 'Trening progowy', detail: 'Odcinki w strefie tempo wydłużają się z każdym kolejnym treningiem progowym: 3×6 → 3×8 → 3×10 → 2×15 → 20 → 25 min ciągiem (poziomy 4–5 zaczynają od 3×8). Etap, który nie mieści się w długości treningu albo w limicie mocnych minut, jest zastępowany niższym.' },
  { title: 'Limit czasu', detail: 'Każdy trening ≤ limit z ankiety na ten dzień (dzień roboczy / weekend).' },
  { title: 'Zmiana poziomu', detail: 'Co tydzień przy generowaniu kolejnego tygodnia: najpierw spadek (ból / czerwona flaga, przerwa, mało wykonanych treningów), potem nowa ankieta lub wynik (o jeden w stronę poziomu z ankiety), potem awans. Zawsze o jeden poziom; obowiązuje od nowego tygodnia.' },
  { title: 'Objętość po zmianie poziomu', detail: 'Kolejny tydzień liczony od bazy poprzedniego tygodnia × przyrost nowego poziomu – bez skoku do bazowego treningu nowego poziomu. Po spadku: bez przyrostu, najwyżej bazowy trening nowego poziomu.' },
  { title: 'Przyrost', detail: 'Pełny tydzień ≤ poprzedni pełny × (1 + przyrost dla poziomu); nadmiar przycinany po 5 min z najdłuższych treningów.' },
  { title: 'Przeciwwskazania', detail: 'Tylko spokojne jednostki, krótsze o ustawiony procent.' },
  { title: 'Zawody', detail: 'Start w dniu zawodów, dzień przed i po – wolne, ostatnie dni przed startem tylko spokojnie i krótko.' },
  { title: 'Struktura treningu', detail: 'Każdy trening to odcinki: rozgrzewka → część główna → schłodzenie; suma = długość treningu. Domyślną część główną liczy silnik z typu (marszobieg, spokojny, interwały, tempo).' },
  { title: 'Część główna od AI', detail: 'AI może ułożyć część główną z serii (powtórzenia × odcinek + przerwa, różne strefy). Rozgrzewkę i schłodzenie dokłada silnik; strefy muszą pasować do typu treningu, a mocne minuty mieszczą się w limitach (osobno interwał / przebieżka, osobno razem z tempem).' },
  { title: 'Tempo odcinków', detail: 'Z ostatniego wyniku z ankiety (przeliczenie na 10 km); bez wyniku – tylko strefa wysiłku.' },
];
