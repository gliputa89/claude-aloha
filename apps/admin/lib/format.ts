// Formatowanie dla panelu (po polsku, daty `YYYY-MM-DD` liczone w UTC jak w plan-engine).

const DAY_SHORT = ['', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'] as const;

export const weekdayShort = (isoDay: number) => DAY_SHORT[isoDay] ?? '?';

export function isoWeekdayOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return ((new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay() + 6) % 7) + 1;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '–';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatShortDate(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d}.${String(m).padStart(2, '0')}`;
}

export function formatDuration(totalS: number | null | undefined) {
  if (!totalS) return '–';
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDistance(m: number | null | undefined) {
  if (!m) return '–';
  if (m === 21097) return 'półmaraton';
  if (m === 42195) return 'maraton';
  return `${(m / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} km`;
}

export const LEVEL_LABEL: Record<string, string> = {
  beginner: 'nie biega',
  intermediate: 'okazjonalnie',
  advanced: 'regularnie',
};

export const FOCUS_LABEL: Record<string, string> = {
  start_running: 'zacznij biegać',
  improve_fitness: 'popraw formę',
  run_regularly: 'biegaj regularnie',
};

export const WEEK_FOCUS_LABEL: Record<string, string> = {
  base: 'baza',
  build: 'budowa',
  race: 'zawody',
  taper: 'tapering',
  recovery: 'regeneracja',
};

export const SESSION_LABEL: Record<string, string> = {
  walk_run: 'Marsz-bieg',
  easy: 'Bieg spokojny',
  long: 'Długi bieg',
  intervals: 'Interwały',
  tempo: 'Bieg w tempie',
  recovery: 'Rozbieganie',
  race: 'Zawody',
  rest: 'Odpoczynek',
};

export const SESSION_COLOR: Record<string, string> = {
  walk_run: 'bg-workout-walk-run',
  easy: 'bg-workout-easy',
  recovery: 'bg-workout-easy',
  long: 'bg-workout-long',
  intervals: 'bg-workout-intervals',
  tempo: 'bg-workout-tempo',
  race: 'bg-accent',
  rest: 'bg-workout-rest',
};

export const INTENSITY_LABEL: Record<string, string> = { easy: 'spokojnie', moderate: 'umiarkowanie', hard: 'mocno' };

export const STATUS_LABEL: Record<string, string> = {
  planned: 'zaplanowany',
  done: 'zrobiony',
  partial: 'częściowo',
  missed: 'pominięty',
};

type Structure = { kind?: string; [k: string]: unknown };

/** Opis struktury jednostki, np. „5′ marszu + 8× (1′ bieg / 2′ marsz)”. */
export function describeStructure(structure: Structure | null | undefined) {
  const s = structure ?? {};
  switch (s.kind) {
    case 'walk_run':
      return `${s.warmupWalkMin}′ marszu + ${s.repeats}× (${s.runMin}′ bieg / ${s.walkMin}′ marsz)`;
    case 'intervals':
      return `${s.warmupMin}′ rozgrzewki + ${s.repeats}× (${s.workMin}′ mocno / ${s.recoveryMin}′ trucht) + ${s.cooldownMin}′ schłodzenia`;
    case 'tempo':
      return `${s.warmupMin}′ rozgrzewki + ${s.workMin}′ w tempie + ${s.cooldownMin}′ schłodzenia`;
    case 'race':
      return `start: ${formatDistance(s.distanceM as number)}`;
    case 'steady':
      return 'w tempie rozmowy';
    default:
      return '';
  }
}
