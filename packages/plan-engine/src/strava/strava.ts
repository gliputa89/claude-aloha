// Strava → realizacja treningów. Czyste reguły: która aktywność należy do którego treningu z planu
// i czy trening jest zrobiony w całości, czy częściowo. Pobieranie i zapis: supabase/functions/strava-sync.

export const STRAVA_RULES = {
  /** Od tylu procent planu (czas albo dystans) trening liczy się jako zrobiony w całości. */
  doneRatio: 0.75,
  /** Rodzaje aktywności Stravy liczone jako bieg. */
  runTypes: ['Run', 'TrailRun', 'VirtualRun'],
  /** Marsz liczymy tylko do treningów marszobiegowych. */
  walkTypes: ['Walk', 'Hike'],
  /** Trening zrobiony w inny dzień: szukamy niezrobionego treningu najwyżej tyle dni obok biegu (ten sam tydzień planu). */
  shiftDays: 2,
  /** …i tylko gdy bieg jest do niego podobny: czas albo dystans w tych granicach planu. */
  shiftMinRatio: 0.6,
  shiftMaxRatio: 1.5,
} as const;

export type StravaActivityInput = {
  id: number;
  sportType: string;
  /** Dzień aktywności w czasie lokalnym biegacza (`start_date_local` ze Stravy), `YYYY-MM-DD`. */
  localDate: string;
  /** Początek aktywności (UTC, ISO). */
  startedAt: string;
  distanceM: number;
  movingTimeS: number;
  elapsedTimeS: number;
};

export type StravaMatchSession = {
  id: string;
  scheduled_on: string;
  type: string;
  duration_min: number | null;
  distance_m: number | null;
  status: string;
  /** Tydzień planu (id albo numer) – przesunięty trening proponujemy tylko w obrębie tego samego tygodnia. */
  week?: string | number | null;
};

/** Odpowiedzi biegacza na pytanie „to był ten trening?” – mają pierwszeństwo przed regułami. */
export type StravaMatchAnswers = {
  /** id aktywności → id treningu potwierdzonego przez biegacza (także z innego dnia). */
  confirmed?: ReadonlyMap<number, string>;
  /** Aktywności, o które już pytaliśmy i padło „nie” – drugi raz nie pytamy. */
  declined?: ReadonlySet<number>;
};

export type SessionCompletion = {
  sessionId: string;
  status: 'done' | 'partial';
  actualDistanceM: number | null;
  actualDurationS: number | null;
  completedAt: string;
};

const includes = (list: readonly string[], value: string) => list.includes(value);

export const isStravaRun = (sportType: string) => includes(STRAVA_RULES.runTypes, sportType);
export const isStravaWalk = (sportType: string) => includes(STRAVA_RULES.walkTypes, sportType);

/**
 * Dopasowuje aktywności do treningów z planu po dniu.
 *
 *   * bieg trafia do treningu z tego samego dnia (bez dni odpoczynku); marsz tylko do marszobiegu,
 *   * kilka aktywności jednego dnia (np. rozgrzewka zapisana osobno) sumuje się w jednym treningu,
 *   * dwa treningi jednego dnia → aktywność idzie do tego o najbliższym planowanym czasie,
 *   * status tylko w górę: zrobiony trening nie wraca do „częściowo”,
 *   * bieg bez pary w swoim dniu, podobny do niezrobionego treningu z sąsiedniego dnia (np. środowy trening
 *     zrobiony w czwartek) → tylko propozycja w `suggestions`; przypisuje go dopiero odpowiedź biegacza.
 *
 * `links`: id aktywności → id treningu (albo null – bieg poza planem, zostaje bez pary).
 * `suggestions`: id aktywności → id treningu, o który warto zapytać („to był ten trening?”).
 */
export function matchStravaActivities(
  sessions: StravaMatchSession[],
  activities: StravaActivityInput[],
  answers: StravaMatchAnswers = {},
): { links: Map<number, string | null>; suggestions: Map<number, string>; completions: SessionCompletion[] } {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const byDate = new Map<string, StravaMatchSession[]>();
  for (const s of sessions) {
    if (s.type === 'rest') continue;
    const list = byDate.get(s.scheduled_on);
    if (list) list.push(s);
    else byDate.set(s.scheduled_on, [s]);
  }

  const links = new Map<number, string | null>();
  const grouped = new Map<string, StravaActivityInput[]>();
  for (const a of [...activities].sort((x, y) => x.startedAt.localeCompare(y.startedAt))) {
    const run = isStravaRun(a.sportType);
    const walk = isStravaWalk(a.sportType);
    const candidates = (run || walk ? byDate.get(a.localDate) ?? [] : []).filter((s) => run || s.type === 'walk_run');
    const plannedGap = (s: StravaMatchSession) =>
      s.duration_min ? Math.abs(s.duration_min * 60 - a.movingTimeS) : Number.MAX_SAFE_INTEGER;
    const confirmedId = answers.confirmed?.get(a.id);
    const confirmed = confirmedId ? sessionById.get(confirmedId) : undefined;
    const session =
      (confirmed && confirmed.type !== 'rest' ? confirmed : null) ?? [...candidates].sort((x, y) => plannedGap(x) - plannedGap(y))[0] ?? null;
    links.set(a.id, session?.id ?? null);
    if (!session) continue;
    const list = grouped.get(session.id);
    if (list) list.push(a);
    else grouped.set(session.id, [a]);
  }

  // Przesunięte treningi: biegi bez pary × niezrobione treningi bez biegu, najbliższe planowi najpierw.
  const suggestions = new Map<number, string>();
  const pairs: { activity: number; session: string; gap: number; days: number }[] = [];
  for (const a of activities) {
    if (links.get(a.id) || answers.declined?.has(a.id)) continue;
    const run = isStravaRun(a.sportType);
    if (!run && !isStravaWalk(a.sportType)) continue;
    for (const s of sessions) {
      if (s.type === 'rest' || s.status === 'done' || s.status === 'partial' || grouped.has(s.id)) continue;
      if (!run && s.type !== 'walk_run') continue;
      const days = Math.abs(Math.round((Date.parse(a.localDate) - Date.parse(s.scheduled_on)) / 86_400_000));
      if (days < 1 || days > STRAVA_RULES.shiftDays) continue;
      const day = byDate.get(a.localDate)?.[0];
      // Tydzień biegu znamy po treningu z tego dnia; gdy to dzień bez treningu, wystarcza sama odległość w dniach.
      if (day && day.week != null && s.week != null && day.week !== s.week) continue;
      const ratios = [
        s.duration_min ? a.movingTimeS / (s.duration_min * 60) : null,
        s.distance_m ? a.distanceM / s.distance_m : null,
      ].filter((r): r is number => r !== null);
      const fit = ratios.filter((r) => r >= STRAVA_RULES.shiftMinRatio && r <= STRAVA_RULES.shiftMaxRatio);
      if (fit.length === 0) continue;
      pairs.push({ activity: a.id, session: s.id, gap: Math.min(...fit.map((r) => Math.abs(1 - r))), days });
    }
  }
  const asked = new Set<string>();
  for (const p of pairs.sort((x, y) => x.gap - y.gap || x.days - y.days)) {
    if (suggestions.has(p.activity) || asked.has(p.session)) continue;
    suggestions.set(p.activity, p.session);
    asked.add(p.session);
  }

  const completions: SessionCompletion[] = [];
  for (const s of sessions) {
    const own = grouped.get(s.id);
    if (!own) continue;
    const distanceM = Math.round(own.reduce((n, a) => n + a.distanceM, 0));
    const durationS = Math.round(own.reduce((n, a) => n + a.movingTimeS, 0));
    const ratios = [
      s.duration_min ? durationS / (s.duration_min * 60) : null,
      s.distance_m ? distanceM / s.distance_m : null,
    ].filter((r): r is number => r !== null);
    // Bez planowanego czasu i dystansu nie ma do czego porównać – sam bieg wystarczy.
    const ratio = ratios.length > 0 ? Math.max(...ratios) : 1;
    const end = Math.max(...own.map((a) => Date.parse(a.startedAt) + a.elapsedTimeS * 1000));
    completions.push({
      sessionId: s.id,
      status: s.status === 'done' || ratio >= STRAVA_RULES.doneRatio ? 'done' : 'partial',
      actualDistanceM: distanceM > 0 ? distanceM : null,
      actualDurationS: durationS > 0 ? durationS : null,
      completedAt: new Date(end).toISOString(),
    });
  }
  return { links, suggestions, completions };
}
