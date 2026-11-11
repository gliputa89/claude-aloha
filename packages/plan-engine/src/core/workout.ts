// Struktura treningu jako lista odcinków: rozgrzewka → część główna (odcinki, powtórzenia, przerwy) → schłodzenie.
//
// Każdy odcinek ma czas, strefę wysiłku i (gdy znamy ostatni wynik biegacza) zakres tempa w s/km.
// Powtórzenia zapisujemy jak w zegarkach (Garmin, Runna): { kind: 'repeat', times, steps }.
// Zapis: sessions.structure.steps (jsonb). Stare treningi bez `steps` dostają odcinki wyliczone w locie.

export type PaceZone = 'walk' | 'recovery' | 'easy' | 'steady' | 'tempo' | 'interval' | 'sprint';
export type StepKind = 'warmup' | 'work' | 'recovery' | 'cooldown';

export type PaceRange = { fastS: number; slowS: number };

export type WorkoutStep = {
  kind: StepKind;
  zone: PaceZone;
  durationS: number;
  /** Zakres tempa (s/km); null = bez znanego wyniku albo marsz – wtedy liczy się strefa wysiłku. */
  pace: PaceRange | null;
};

export type WorkoutRepeat = { kind: 'repeat'; times: number; steps: WorkoutStep[] };
export type WorkoutItem = WorkoutStep | WorkoutRepeat;

export const PACE_ZONES: readonly PaceZone[] = ['walk', 'recovery', 'easy', 'steady', 'tempo', 'interval', 'sprint'];

/** Wysokość słupka na wykresie (1–6) i opis strefy. */
export const ZONE_INFO: Record<PaceZone, { level: number; label: string; effort: string }> = {
  walk: { level: 1, label: 'marsz', effort: 'marsz' },
  recovery: { level: 2, label: 'trucht', effort: 'bardzo lekko' },
  easy: { level: 3, label: 'spokojnie', effort: 'w tempie rozmowy' },
  steady: { level: 4, label: 'umiarkowanie', effort: 'równo, rozmowa urywana' },
  tempo: { level: 5, label: 'tempo', effort: 'mocno, ale pod kontrolą' },
  interval: { level: 6, label: 'interwał', effort: 'bardzo mocno' },
  sprint: { level: 7, label: 'przebieżka', effort: 'szybko i luźno' },
};

/** Strefy liczone jako „mocne” (do limitu mocnych minut). */
export const HARD_ZONES: readonly PaceZone[] = ['tempo', 'interval', 'sprint'];

const RIEGEL = 1.06;

/** Mnożniki tempa 10 km dla stref (wolniejsze = większe). */
const ZONE_FACTORS: Record<Exclude<PaceZone, 'walk'>, [number, number]> = {
  recovery: [1.3, 1.45],
  easy: [1.18, 1.3],
  steady: [1.08, 1.16],
  tempo: [1.02, 1.06],
  interval: [0.95, 0.99],
  sprint: [0.85, 0.92],
};

export type PaceZones = Record<PaceZone, PaceRange | null>;

/** Strefy tempa z ostatniego wyniku (przeliczenie Riegela na 10 km). Brak / nierealny wynik → null. */
export function paceZonesFrom(result: { distanceM: number; timeS: number | null } | null | undefined): PaceZones | null {
  if (!result?.timeS || result.distanceM < 1000) return null;
  const t10 = result.timeS * (10000 / result.distanceM) ** RIEGEL;
  const p10 = t10 / 10; // s/km
  if (p10 < 150 || p10 > 600) return null; // 2:30–10:00 min/km – poza tym to raczej błąd danych
  const zones = { walk: null } as PaceZones;
  for (const [zone, [fast, slow]] of Object.entries(ZONE_FACTORS) as [Exclude<PaceZone, 'walk'>, [number, number]][]) {
    zones[zone] = { fastS: Math.round((p10 * fast) / 5) * 5, slowS: Math.round((p10 * slow) / 5) * 5 };
  }
  return zones;
}

export const isRepeat = (i: WorkoutItem): i is WorkoutRepeat => i.kind === 'repeat';

/** Odcinki po rozwinięciu powtórzeń (do wykresu i sumy czasu). */
export function flattenSteps(items: WorkoutItem[]): WorkoutStep[] {
  return items.flatMap((i) => (isRepeat(i) ? Array.from({ length: i.times }, () => i.steps).flat() : [i]));
}

export const stepsTotalS = (items: WorkoutItem[]) => flattenSteps(items).reduce((n, s) => n + s.durationS, 0);

export const hardSeconds = (items: WorkoutItem[]) =>
  flattenSteps(items)
    .filter((s) => HARD_ZONES.includes(s.zone))
    .reduce((n, s) => n + s.durationS, 0);

export const zoneSeconds = (items: WorkoutItem[], zone: PaceZone) =>
  flattenSteps(items)
    .filter((s) => s.zone === zone)
    .reduce((n, s) => n + s.durationS, 0);

/** Tempo marszu do szacowania dystansu (ok. 5,5 km/h). */
const WALK_PACE_S = 655;

/** Strefy dla biegacza bez znanego wyniku – ok. 65 min na 10 km (rekreacyjnie). Tylko do szacowania dystansu. */
const DEFAULT_PACES = paceZonesFrom({ distanceM: 10000, timeS: 65 * 60 }) as PaceZones;

/**
 * Przybliżony dystans treningu (m): czas odcinka ÷ środek zakresu tempa. Tempo z odcinka, potem ze stref biegacza,
 * a bez wyniku – z typowych stref rekreacyjnych. Tylko do pokazania sumy „ok. X km”, nie do planowania.
 */
export function estimateDistanceM(items: WorkoutItem[], paces: PaceZones | null = null): number {
  return flattenSteps(items).reduce((m, s) => {
    const range = s.pace ?? paces?.[s.zone] ?? DEFAULT_PACES[s.zone];
    const paceS = range ? (range.fastS + range.slowS) / 2 : WALK_PACE_S;
    return m + (s.durationS / paceS) * 1000;
  }, 0);
}

const step = (kind: StepKind, zone: PaceZone, minutes: number, paces: PaceZones | null): WorkoutStep => ({
  kind,
  zone,
  durationS: Math.round(minutes * 60),
  pace: paces?.[zone] ?? null,
});

const stepS = (kind: StepKind, zone: PaceZone, seconds: number, paces: PaceZones | null): WorkoutStep => ({
  kind,
  zone,
  durationS: Math.round(seconds),
  pace: paces?.[zone] ?? null,
});

/** Rozgrzewka / schłodzenie dla spokojnych biegów: ok. 15% / 10% czasu, 3–10 min / 2–10 min. */
function easyBookends(totalMin: number) {
  const warm = Math.min(10, Math.max(3, Math.round(totalMin * 0.15)));
  const cool = Math.min(10, Math.max(2, Math.round(totalMin * 0.1)));
  return { warm, cool, main: Math.max(1, totalMin - warm - cool) };
}

type LegacyStructure = { kind?: string; [k: string]: unknown };

/**
 * Odcinki dla treningu z typu, długości i dotychczasowej struktury (marszobieg, interwały, tempo, spokojny).
 * Suma czasu = długość treningu (reszta po powtórzeniach trafia do schłodzenia).
 */
export function stepsFromStructure(
  type: string,
  durationMin: number | null,
  structure: LegacyStructure | null | undefined,
  paces: PaceZones | null,
): WorkoutItem[] {
  const s = structure ?? {};
  const total = durationMin ?? 0;
  if (type === 'race' || s.kind === 'race' || total <= 0) return [];
  const num = (k: string, fallback: number) => (typeof s[k] === 'number' ? (s[k] as number) : fallback);

  if (s.kind === 'walk_run' || type === 'walk_run') {
    const warm = num('warmupWalkMin', 5);
    const run = num('runMin', 1);
    const walk = num('walkMin', 2);
    // Zawsze co najmniej 2 min marszu na schłodzenie.
    const times = Math.max(1, Math.min(num('repeats', 3), Math.floor((total - warm - 2) / (run + walk))));
    const cool = Math.max(1, total - warm - times * (run + walk));
    return [
      step('warmup', 'walk', warm, paces),
      { kind: 'repeat', times, steps: [step('work', 'easy', run, paces), step('recovery', 'walk', walk, paces)] },
      step('cooldown', 'walk', cool, paces),
    ];
  }
  if (s.kind === 'intervals' || type === 'intervals') {
    const warm = num('warmupMin', 10);
    const work = num('workMin', 2);
    const rec = num('recoveryMin', 2);
    const times = Math.max(1, num('repeats', 4));
    const cool = Math.max(num('cooldownMin', 5), total - warm - times * (work + rec));
    return [
      step('warmup', 'easy', warm, paces),
      { kind: 'repeat', times, steps: [step('work', 'interval', work, paces), step('recovery', 'recovery', rec, paces)] },
      step('cooldown', 'easy', cool, paces),
    ];
  }
  if (s.kind === 'tempo' || type === 'tempo') {
    const warm = num('warmupMin', 10);
    const work = num('workMin', 15);
    const times = Math.max(1, num('repeats', 1));
    if (times > 1) {
      // Trening progowy w odcinkach: po każdym odcinku trucht, reszta czasu idzie do schłodzenia.
      const rec = num('recoveryMin', 2);
      const cool = Math.max(num('cooldownMin', 5), total - warm - times * (work + rec));
      return [
        step('warmup', 'easy', warm, paces),
        { kind: 'repeat', times, steps: [step('work', 'tempo', work, paces), step('recovery', 'recovery', rec, paces)] },
        step('cooldown', 'easy', cool, paces),
      ];
    }
    const cool = Math.max(num('cooldownMin', 5), total - warm - work);
    return [step('warmup', 'easy', warm, paces), step('work', 'tempo', work, paces), step('cooldown', 'easy', cool, paces)];
  }
  const { warm, cool, main } = easyBookends(total);
  const zone: PaceZone = type === 'recovery' ? 'recovery' : 'easy';
  return [step('warmup', 'recovery', warm, paces), step('work', zone, main, paces), step('cooldown', 'recovery', cool, paces)];
}

/** Odcinki treningu: zapisane w strukturze albo – dla starszych treningów – wyliczone. */
export function stepsOf(
  session: { type: string; durationMin?: number | null; duration_min?: number | null; structure?: unknown },
  paces: PaceZones | null = null,
): WorkoutItem[] {
  const structure = (session.structure ?? {}) as LegacyStructure & { steps?: WorkoutItem[] };
  if (Array.isArray(structure.steps)) return structure.steps;
  return stepsFromStructure(session.type, session.durationMin ?? session.duration_min ?? null, structure, paces);
}

// ───────────────────────── część główna od AI ─────────────────────────

/** Seria w części głównej: `repeat` × (praca + opcjonalna przerwa). Pojedynczy odcinek = repeat 1 bez przerwy. */
export type MainSet = {
  repeat: number;
  workS: number;
  workZone: PaceZone;
  recoveryS: number | null;
  recoveryZone: PaceZone | null;
};

export type MainRules = {
  type: string;
  durationMin: number;
  /** Poziom 1 (nie biega) – tylko marszobieg. */
  walkRunOnly: boolean;
  gentle: boolean;
  /** Najwyżej tyle procent treningu w strefach bardzo mocnych (interwał, przebieżka). */
  maxHardSharePct: number;
  /**
   * Najwyżej tyle procent treningu w strefach mocnych łącznie ze strefą tempo. Tempo (próg) znosi się dłużej niż
   * interwał, stąd osobny, wyższy limit – inaczej nie zmieściłoby się 3×10 czy 2×15 min. Brak = jak `maxHardSharePct`.
   */
  maxTempoSharePct?: number;
};

const ALLOWED_ZONES: Record<string, readonly PaceZone[]> = {
  walk_run: ['walk', 'recovery', 'easy'],
  easy: ['walk', 'recovery', 'easy', 'steady', 'sprint'],
  recovery: ['walk', 'recovery', 'easy'],
  long: ['walk', 'recovery', 'easy', 'steady', 'tempo', 'sprint'],
  intervals: PACE_ZONES,
  tempo: PACE_ZONES,
};

/**
 * Buduje trening z części głównej od AI: silnik dokłada rozgrzewkę i schłodzenie (dzieląc resztę czasu 60/40)
 * i sprawdza reguły. Błąd → komunikat (operacja odrzucona).
 */
export function buildFromMainSets(
  sets: MainSet[],
  rules: MainRules,
  paces: PaceZones | null,
): { ok: true; steps: WorkoutItem[] } | { ok: false; error: string } {
  if (!sets.length || sets.length > 12) return { ok: false, error: 'część główna musi mieć 1–12 serii' };
  const allowed = ALLOWED_ZONES[rules.type];
  if (!allowed) return { ok: false, error: `nie można ułożyć części głównej dla typu ${rules.type}` };
  if (rules.walkRunOnly && rules.type !== 'walk_run') return { ok: false, error: 'osoba nie biega – tylko marszobieg' };

  const main: WorkoutItem[] = [];
  for (const [i, s] of sets.entries()) {
    const n = i + 1;
    if (!Number.isInteger(s.repeat) || s.repeat < 1 || s.repeat > 30) return { ok: false, error: `seria ${n}: repeat 1–30` };
    if (!(s.workS >= 10 && s.workS <= 3600)) return { ok: false, error: `seria ${n}: odcinek 10 s – 60 min` };
    const zones = [s.workZone, ...(s.recoveryZone ? [s.recoveryZone] : [])];
    const bad = zones.find((z) => !allowed.includes(z));
    if (bad) return { ok: false, error: `seria ${n}: strefa ${bad} niedozwolona w treningu ${rules.type}` };
    if (rules.gentle && zones.some((z) => ZONE_INFO[z].level > ZONE_INFO.steady.level)) {
      return { ok: false, error: `seria ${n}: przeciwwskazania – najwyżej strefa umiarkowana` };
    }
    if (s.workZone === 'sprint' && s.workS > 30) return { ok: false, error: `seria ${n}: przebieżka najwyżej 30 s` };
    const hasRec = s.recoveryS !== null && s.recoveryS > 0 && s.recoveryZone !== null;
    if (hasRec && !((s.recoveryS as number) >= 10 && (s.recoveryS as number) <= 900)) {
      return { ok: false, error: `seria ${n}: przerwa 10 s – 15 min` };
    }
    const work = stepS('work', s.workZone, s.workS, paces);
    const rec = hasRec ? stepS('recovery', s.recoveryZone as PaceZone, s.recoveryS as number, paces) : null;
    if (s.repeat === 1 && !rec) main.push(work);
    else main.push({ kind: 'repeat', times: s.repeat, steps: rec ? [work, rec] : [work] });
  }

  const totalS = rules.durationMin * 60;
  const mainS = stepsTotalS(main);
  const quality = rules.type === 'intervals' || rules.type === 'tempo';
  const minBookendsS = (quality ? 15 : rules.type === 'walk_run' ? 5 : 5) * 60;
  const rest = totalS - mainS;
  if (rest < minBookendsS) {
    return { ok: false, error: `część główna za długa: na rozgrzewkę i schłodzenie zostaje ${Math.round(rest / 60)} min (min. ${minBookendsS / 60})` };
  }
  const hard = hardSeconds(main);
  const veryHard = hard - zoneSeconds(main, 'tempo');
  const capMin = (pct: number) => Math.floor((rules.durationMin * pct) / 100);
  if (veryHard > (totalS * rules.maxHardSharePct) / 100) {
    return { ok: false, error: `za dużo minut w strefach interval / sprint: ${Math.round(veryHard / 60)} > ${capMin(rules.maxHardSharePct)} min` };
  }
  const tempoPct = Math.max(rules.maxHardSharePct, rules.maxTempoSharePct ?? rules.maxHardSharePct);
  if (hard > (totalS * tempoPct) / 100) {
    return { ok: false, error: `za dużo mocnych minut (tempo + interval + sprint): ${Math.round(hard / 60)} > ${capMin(tempoPct)} min` };
  }
  if (!quality && hard > 3 * 60) return { ok: false, error: 'w spokojnym treningu najwyżej 3 min mocno (przebieżki)' };

  const warmS = Math.round((rest * 0.6) / 30) * 30;
  const bookendZone: PaceZone = rules.type === 'walk_run' ? 'walk' : quality ? 'easy' : 'recovery';
  return {
    ok: true,
    steps: [stepS('warmup', bookendZone, warmS, paces), ...main, stepS('cooldown', bookendZone, rest - warmS, paces)],
  };
}

// ───────────────────────── opis ─────────────────────────

export function formatPace(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

/** Przybliżony dystans do sumy, np. „ok. 6,5 km” (co 0,5 km; poniżej 1 km – z jedną cyfrą po przecinku). */
export function formatApproxKm(m: number, locale: 'pl' | 'en' = 'pl') {
  const km = m < 1000 ? Math.round(m / 100) / 10 : Math.round(m / 500) / 2;
  const n = km.toLocaleString(locale === 'en' ? 'en-GB' : 'pl-PL', { maximumFractionDigits: 1 });
  return locale === 'en' ? `~${n} km` : `ok. ${n} km`;
}

export function formatStepDuration(s: number) {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}:${String(rest).padStart(2, '0')} min` : `${m} min`;
}

/** Krótki opis po polsku, np. „10′ rozgrzewki · 6× (3′ interwał / 2′ trucht) · 10′ schłodzenia”. */
export function describeSteps(items: WorkoutItem[]): string {
  const short = (s: WorkoutStep) =>
    `${s.durationS % 60 ? formatStepDuration(s.durationS) : `${s.durationS / 60}′`} ${ZONE_INFO[s.zone].label}`;
  return items
    .map((i) => {
      if (isRepeat(i)) return `${i.times}× (${i.steps.map(short).join(' / ')})`;
      if (i.kind === 'warmup') return `${short(i).split(' ')[0]} rozgrzewki`;
      if (i.kind === 'cooldown') return `${short(i).split(' ')[0]} schłodzenia`;
      return short(i);
    })
    .join(' · ');
}
