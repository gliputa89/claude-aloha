import { AI_MODELS, costUsd, modelPrice, type AiUsage } from '@aloha/plan-engine';

// Symulator kosztu AI na jedną osobę (panel → AI → Symulator). Czysty model – bez bazy, działa w przeglądarce.
//
// Koszt = Σ (liczba wywołań funkcji w miesiącu × koszt jednego wywołania).
//   * koszt jednego wywołania – średnie tokeny z prawdziwych wywołań (ops.ai_calls) × cennik wybranego modelu,
//   * liczba wywołań – z zachowania osoby (treningi, otwarcia aplikacji, rozmowy, przebudowy planu); to założenia,
//     bo testy pokazują koszt wywołania, a nie to, jak często prawdziwy użytkownik je wyzwala.

export const WEEKS_PER_MONTH = 52 / 12;

/** Pozycje kosztu – funkcje AI; `plan-weeks` rozbite na pierwszy plan (2 tygodnie) i kolejny tydzień. */
export const SIM_ITEMS = ['plan-first', 'plan-week', 'workout-review', 'coach-chat', 'weather-advice', 'day-note'] as const;
export type SimItem = (typeof SIM_ITEMS)[number];

export const SIM_ITEM_INFO: Record<SimItem, { label: string; fn: string; trigger: string; defaultModel: string }> = {
  'plan-first': {
    label: 'Pierwszy plan po ankiecie',
    fn: 'plan-weeks',
    trigger: 'raz, w pierwszym miesiącu (szkic 2 tygodni)',
    defaultModel: 'claude-opus-5-5',
  },
  'plan-week': {
    label: 'Kolejny tydzień planu i przebudowy',
    fn: 'plan-weeks',
    trigger: 'co tydzień + każda przebudowa planu + ponowienia po walidacji',
    defaultModel: 'claude-opus-5-5',
  },
  'workout-review': {
    label: 'Notka trenera po treningu',
    fn: 'workout-review',
    trigger: 'każdy wykonany trening zsynchronizowany ze Stravą',
    defaultModel: 'claude-sonnet-5-5',
  },
  'coach-chat': {
    label: 'Rozmowa z trenerem AI',
    fn: 'coach-chat',
    trigger: 'każda wiadomość biegacza (limit 40 na dobę)',
    defaultModel: 'claude-sonnet-5-5',
  },
  'weather-advice': {
    label: 'Porada pogodowa',
    fn: 'weather-advice',
    trigger: 'otwarcie aplikacji, gdy prognoza do treningów się zmieniła',
    defaultModel: 'claude-haiku-5-5',
  },
  'day-note': {
    label: 'Notka na dzień bez treningu',
    fn: 'day-note',
    trigger: 'otwarcie aplikacji w dzień bez biegu (raz na dzień)',
    defaultModel: 'claude-haiku-5-5',
  },
};

/** Średnie z prawdziwych wywołań jednej pozycji na jednym modelu. */
export type UnitStat = {
  item: SimItem;
  model: string;
  /** liczba wywołań w próbie */
  n: number;
  /** średnie tokeny na wywołanie */
  usage: AiUsage;
  /** średni zapisany koszt wywołania (USD) */
  avgCostUsd: number;
};

export type UnitStats = {
  stats: UnitStat[];
  /** udział ponowień po walidacji w plan-weeks (2. próba / 1. próba); null = brak danych */
  planRetryRate: number | null;
  calls: number;
  from: string | null;
  to: string | null;
};

/** Pomiary z bazy testowej z 9–11.11.2026 (108 wywołań) – używane, gdy dla pozycji nie ma jeszcze żadnego wywołania. */
export const FALLBACK_STATS: UnitStat[] = [
  { item: 'plan-first', model: 'claude-opus-5-5', n: 0, avgCostUsd: 0.0644, usage: { inputTokens: 1357, outputTokens: 1542, cacheReadTokens: 0, cacheWriteTokens: 5622 } },
  { item: 'plan-week', model: 'claude-opus-5-5', n: 0, avgCostUsd: 0.0569, usage: { inputTokens: 1880, outputTokens: 1459, cacheReadTokens: 0, cacheWriteTokens: 4035 } },
  { item: 'workout-review', model: 'claude-sonnet-5-5', n: 0, avgCostUsd: 0.0036, usage: { inputTokens: 754, outputTokens: 146, cacheReadTokens: 2116, cacheWriteTokens: 96 } },
  { item: 'coach-chat', model: 'claude-sonnet-5-5', n: 0, avgCostUsd: 0.0107, usage: { inputTokens: 679, outputTokens: 222, cacheReadTokens: 0, cacheWriteTokens: 2842 } },
  { item: 'weather-advice', model: 'claude-haiku-5-5', n: 0, avgCostUsd: 0.0004, usage: { inputTokens: 451, outputTokens: 484, cacheReadTokens: 321, cacheWriteTokens: 856 } },
  { item: 'day-note', model: 'claude-haiku-5-5', n: 0, avgCostUsd: 0.00017, usage: { inputTokens: 113, outputTokens: 84, cacheReadTokens: 0, cacheWriteTokens: 960 } },
];

export type UnitCost = {
  usd: number;
  /** ile wywołań stoi za tą liczbą (0 = wartość zapasowa z kodu) */
  n: number;
  /** 'measured' – zmierzone na tym modelu; 'repriced' – tokeny z innego modelu × cennik tego; 'fallback' – z kodu */
  basis: 'measured' | 'repriced' | 'fallback';
  /** model, z którego pochodzą tokeny */
  sourceModel: string;
};

/** Koszt jednego wywołania pozycji na wybranym modelu. */
export function unitCost(item: SimItem, model: string, stats: UnitStat[]): UnitCost {
  const own = stats.filter((s) => s.item === item && s.n > 0);
  const exact = own.find((s) => s.model === model);
  if (exact) return { usd: exact.avgCostUsd, n: exact.n, basis: 'measured', sourceModel: model };
  // Brak pomiaru na tym modelu: tokeny z modelu o największej próbie, wycenione nowym cennikiem.
  // To przybliżenie – modele różnią się długością odpowiedzi i myślenia.
  const best = [...own].sort((a, b) => b.n - a.n)[0];
  const source = best ?? FALLBACK_STATS.find((s) => s.item === item)!;
  const basis = best ? 'repriced' : 'fallback';
  if (source.model === model) return { usd: source.avgCostUsd, n: source.n, basis, sourceModel: model };
  return { usd: costUsd(source.usage, modelPrice(model)) ?? source.avgCostUsd, n: source.n, basis, sourceModel: source.model };
}

/** Zachowanie jednej osoby w miesiącu. */
export type Behavior = {
  /** zaplanowane treningi w tygodniu */
  runsPerWeek: number;
  /** jaka część treningów jest wykonana i trafia ze Stravy (0–1) */
  completion: number;
  /** dni w tygodniu, w które osoba otwiera aplikację */
  activeDaysPerWeek: number;
  /** wiadomości do trenera AI w tygodniu */
  chatPerWeek: number;
  /** przebudowy planu w miesiącu (zmiana dostępności, celu, tydzień od nowa) */
  rebuildsPerMonth: number;
  /** pierwszy miesiąc – dochodzi plan po ankiecie */
  firstMonth: boolean;
};

/** Założenia techniczne (nie zależą od osoby). */
export type Assumptions = {
  /** ponowienia plan-weeks po walidacji, jako ułamek wywołań (0–1) */
  planRetryRate: number;
  /** wywołania porady pogodowej na jeden dzień z otwarciem aplikacji */
  weatherPerActiveDay: number;
  /** zapas na błędy, dłuższe konteksty i wzrost promptów (0–1) */
  buffer: number;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = { planRetryRate: 0.1, weatherPerActiveDay: 0.7, buffer: 0.2 };

export const CHAT_DAILY_LIMIT_SIM = 40;

export type Preset = { id: string; label: string; hint: string; behavior: Behavior; share: number };

/** Typowe profile zaangażowania. `share` – domyślny udział w bazie płacących (do średniej ważonej). */
export const PRESETS: Preset[] = [
  {
    id: 'light',
    label: 'Okazjonalny',
    hint: '2 treningi, połowa wykonana, rzadko pisze',
    share: 0.3,
    behavior: { runsPerWeek: 2, completion: 0.5, activeDaysPerWeek: 2, chatPerWeek: 1, rebuildsPerMonth: 0, firstMonth: false },
  },
  {
    id: 'regular',
    label: 'Regularny',
    hint: '3 treningi, większość wykonana, kilka pytań w tygodniu',
    share: 0.5,
    behavior: { runsPerWeek: 3, completion: 0.8, activeDaysPerWeek: 4, chatPerWeek: 5, rebuildsPerMonth: 1, firstMonth: false },
  },
  {
    id: 'engaged',
    label: 'Zaangażowany',
    hint: '5 treningów, codziennie w aplikacji, dużo rozmawia',
    share: 0.17,
    behavior: { runsPerWeek: 5, completion: 0.9, activeDaysPerWeek: 7, chatPerWeek: 25, rebuildsPerMonth: 2, firstMonth: false },
  },
  {
    id: 'heavy',
    label: 'Bardzo intensywny',
    hint: '6 treningów, ok. 15 wiadomości dziennie, częste zmiany planu',
    share: 0.03,
    behavior: { runsPerWeek: 6, completion: 1, activeDaysPerWeek: 7, chatPerWeek: 105, rebuildsPerMonth: 4, firstMonth: false },
  },
];

/** Sufit: wszystko na maksimum, czat do dziennego limitu każdego dnia. */
export const CEILING_BEHAVIOR: Behavior = {
  runsPerWeek: 7,
  completion: 1,
  activeDaysPerWeek: 7,
  chatPerWeek: CHAT_DAILY_LIMIT_SIM * 7,
  rebuildsPerMonth: 8,
  firstMonth: true,
};

/** Liczba wywołań każdej pozycji w miesiącu. */
export function monthlyCalls(b: Behavior, a: Assumptions): Record<SimItem, number> {
  const retries = 1 + a.planRetryRate;
  // Pierwszy miesiąc: plan po ankiecie pokrywa 2 tygodnie, więc kolejnych tygodni jest o 2 mniej.
  const weeklyPlans = b.firstMonth ? Math.max(0, WEEKS_PER_MONTH - 2) : WEEKS_PER_MONTH;
  const doneRunsPerWeek = b.runsPerWeek * b.completion;
  // Notka dnia: tylko w dni bez treningu, w które osoba otworzyła aplikację.
  const restShare = Math.max(0, 1 - b.runsPerWeek / 7);
  return {
    'plan-first': b.firstMonth ? retries : 0,
    'plan-week': (weeklyPlans + b.rebuildsPerMonth) * retries,
    'workout-review': doneRunsPerWeek * WEEKS_PER_MONTH,
    'coach-chat': Math.min(b.chatPerWeek, CHAT_DAILY_LIMIT_SIM * 7) * WEEKS_PER_MONTH,
    'weather-advice': b.runsPerWeek > 0 ? b.activeDaysPerWeek * a.weatherPerActiveDay * WEEKS_PER_MONTH : 0,
    'day-note': b.activeDaysPerWeek * restShare * WEEKS_PER_MONTH,
  };
}

export type SimLine = { item: SimItem; calls: number; unit: UnitCost; usd: number };
export type SimResult = { lines: SimLine[]; baseUsd: number; totalUsd: number };

export type ModelChoice = Record<SimItem, string>;

export const defaultModels = (): ModelChoice =>
  Object.fromEntries(SIM_ITEMS.map((i) => [i, SIM_ITEM_INFO[i].defaultModel])) as ModelChoice;

/** Miesięczny koszt AI jednej osoby. `overrides` – ręcznie wpisany koszt wywołania (USD) zamiast zmierzonego. */
export function simulate(
  b: Behavior,
  a: Assumptions,
  models: ModelChoice,
  stats: UnitStat[],
  overrides: Partial<Record<SimItem, number>> = {},
): SimResult {
  const calls = monthlyCalls(b, a);
  const lines = SIM_ITEMS.map((item) => {
    const measured = unitCost(item, models[item], stats);
    const manual = overrides[item];
    const unit = manual !== undefined && Number.isFinite(manual) && manual >= 0 ? { ...measured, usd: manual } : measured;
    return { item, calls: calls[item], unit, usd: calls[item] * unit.usd };
  });
  const baseUsd = lines.reduce((sum, l) => sum + l.usd, 0);
  return { lines, baseUsd, totalUsd: baseUsd * (1 + a.buffer) };
}

/** Parametry ceny – wszystko, co stoi między ceną w sklepie a marżą. Kwoty w walucie rynku. */
export type Pricing = {
  currency: 'PLN' | 'USD';
  /** cena miesięczna w sklepie (w Polsce brutto) */
  price: number;
  /** cena planu rocznego w sklepie */
  annualPrice: number;
  /** jaka część płacących jest na planie rocznym (0–1) */
  annualShare: number;
  /** VAT zawarty w cenie (0–1); w USA podatek doliczany jest ponad cenę, więc 0 */
  vat: number;
  /** prowizja sklepu od ceny netto (0–1): 0,15 w programie dla małych firm, inaczej 0,30 */
  storeFee: number;
  /** kurs USD → waluta rynku (dla USD zawsze 1) */
  usdRate: number;
  /** pozostałe koszty na płacącego użytkownika w miesiącu: serwery, pogoda, narzędzia */
  other: number;
};

export const MARKETS: { id: string; label: string; pricing: Pricing }[] = [
  { id: 'pl', label: 'Polska', pricing: { currency: 'PLN', price: 29.99, annualPrice: 199.99, annualShare: 0.6, vat: 0.23, storeFee: 0.15, usdRate: 4, other: 1 } },
  { id: 'us', label: 'USA', pricing: { currency: 'USD', price: 11.99, annualPrice: 79.99, annualShare: 0.6, vat: 0, storeFee: 0.15, usdRate: 1, other: 0.25 } },
];

export const DEFAULT_PRICING: Pricing = MARKETS[0]!.pricing;

export type Margin = { net: number; aiCost: number; profit: number; marginShare: number };

export function margin(aiUsd: number, p: Pricing): Margin {
  const net = (p.price / (1 + p.vat)) * (1 - p.storeFee);
  const aiCost = aiUsd * p.usdRate;
  const profit = net - aiCost - p.other;
  return { net, aiCost, profit, marginShare: net > 0 ? profit / net : 0 };
}

/** Najniższa cena brutto (PLN), przy której po AI i pozostałych kosztach zostaje `target` (0–1) przychodu netto. */
export function priceForMargin(aiUsd: number, p: Pricing, target: number): number | null {
  if (target >= 1 || p.storeFee >= 1) return null;
  const netNeeded = (aiUsd * p.usdRate + p.other) / (1 - target);
  return (netNeeded / (1 - p.storeFee)) * (1 + p.vat);
}

export const MODEL_OPTIONS = AI_MODELS.map((m) => ({ id: m.id, label: m.label }));

// ───────────────────────── pakiet darmowy, okres próbny, plan roczny ─────────────────────────

/** Lejek: kto poza płacącymi generuje koszt AI. */
export type Funnel = {
  /** pozycje AI dostępne w pakiecie darmowym */
  freeItems: SimItem[];
  /** aktywni użytkownicy darmowi przypadający na jednego płacącego */
  freePerPaying: number;
  /** długość okresu próbnego z pełnym Premium (dni); 0 = brak */
  trialDays: number;
  /** jaka część osób po okresie próbnym zaczyna płacić (0–1) */
  trialConversion: number;
  /** ile miesięcy przeciętny płacący zostaje – na tyle rozkłada się koszt okresów próbnych */
  lifetimeMonths: number;
};

export const DEFAULT_FUNNEL: Funnel = {
  freeItems: ['weather-advice', 'day-note'],
  freePerPaying: 5,
  trialDays: 14,
  trialConversion: 0.05,
  lifetimeMonths: 6,
};

const DAYS_PER_MONTH = 365 / 12;

type SimArgs = { assumptions: Assumptions; models: ModelChoice; stats: UnitStat[]; overrides?: Partial<Record<SimItem, number>> };

/** Miesięczny koszt AI osoby, która ma tylko wybrane pozycje (pakiet darmowy). */
export function costOfItems(b: Behavior, items: SimItem[], s: SimArgs): number {
  const lines = simulate({ ...b, firstMonth: false }, s.assumptions, s.models, s.stats, s.overrides).lines;
  return lines.filter((l) => items.includes(l.item)).reduce((sum, l) => sum + l.usd, 0) * (1 + s.assumptions.buffer);
}

/** Koszt AI jednego okresu próbnego: plan po ankiecie + zwykłe użycie przez `days` dni. */
export function trialCost(b: Behavior, days: number, s: SimArgs): number {
  if (days <= 0) return 0;
  const frac = days / DAYS_PER_MONTH;
  const retries = 1 + s.assumptions.planRetryRate;
  const month = simulate({ ...b, firstMonth: false }, s.assumptions, s.models, s.stats, s.overrides).lines;
  const usd = month.reduce((sum, l) => {
    // Plan po ankiecie pokrywa 2 tygodnie; kolejne tygodnie dochodzą dopiero przy dłuższym okresie próbnym.
    if (l.item === 'plan-first') return sum + retries * l.unit.usd;
    if (l.item === 'plan-week') return sum + (Math.max(0, days / 7 - 2) + b.rebuildsPerMonth * frac) * retries * l.unit.usd;
    return sum + l.usd * frac;
  }, 0);
  return usd * (1 + s.assumptions.buffer);
}

/** Przychód netto z jednego płacącego na miesiąc – mieszanka planu miesięcznego i rocznego. */
export function netRevenue(p: Pricing): { monthly: number; annual: number; mixed: number } {
  const net = (gross: number) => (gross / (1 + p.vat)) * (1 - p.storeFee);
  const monthly = net(p.price);
  const annual = net(p.annualPrice) / 12;
  return { monthly, annual, mixed: monthly * (1 - p.annualShare) + annual * p.annualShare };
}

export type Economics = {
  revenue: number;
  payingAi: number;
  freeAi: number;
  trialAi: number;
  other: number;
  profit: number;
  profitShare: number;
};

/** Rachunek na jednego płacącego w miesiącu (waluta rynku). Koszty AI podane w USD. */
export function economics(p: Pricing, f: Funnel, usd: { paying: number; free: number; trial: number }): Economics {
  const revenue = netRevenue(p).mixed;
  const payingAi = usd.paying * p.usdRate;
  const freeAi = usd.free * f.freePerPaying * p.usdRate;
  // Na jednego płacącego przypada 1 / konwersja okresów próbnych; koszt rozłożony na miesiące, przez które płaci.
  const trialAi =
    f.trialDays > 0 && f.trialConversion > 0 && f.lifetimeMonths > 0 ? ((usd.trial / f.trialConversion) * p.usdRate) / f.lifetimeMonths : 0;
  const profit = revenue - payingAi - freeAi - trialAi - p.other;
  return { revenue, payingAi, freeAi, trialAi, other: p.other, profit, profitShare: revenue > 0 ? profit / revenue : 0 };
}
