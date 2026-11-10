// Ankieta w panelu: wartości formularza, walidacja i gotowe profile kont testowych.
// Bez sekretów – używane i na serwerze (akcje), i w formularzu po stronie klienta.

import { addDaysIso, RACE_DISTANCES_M, type Level, type RaceDistanceM } from '@aloha/plan-engine';

export type GeneralFocus = 'start_running' | 'improve_fitness' | 'run_regularly';

/** Wartości formularza (czasy jako tekst `h:mm:ss` / `mm:ss`, puste pola = brak). */
export type SurveyValues = {
  displayName: string;
  goalType: 'general' | 'race';
  generalFocus: GeneralFocus;
  distanceM: RaceDistanceM;
  raceDate: string;
  targetTime: string;
  planStartsOn: string;
  level: Level;
  recentDistanceM: number | null;
  recentTime: string;
  currentRunsPerWeek: number;
  preferredDays: number[];
  sessionsPerWeek: number;
  maxMinutesWeekday: number | null;
  maxMinutesWeekend: number | null;
  hasContraindications: boolean;
  timezone: string;
};

/** Format zapisu – argument `p_survey` funkcji public.admin_save_survey. */
export type SurveyPayload = {
  displayName: string | null;
  goalType: 'general' | 'race';
  generalFocus: GeneralFocus | null;
  distanceM: number | null;
  raceDate: string | null;
  targetTimeS: number | null;
  planStartsOn: string | null;
  level: Level;
  recentDistanceM: number | null;
  recentTimeS: number | null;
  currentRunsPerWeek: number;
  preferredDays: number[];
  sessionsPerWeek: number;
  maxMinutesWeekday: number | null;
  maxMinutesWeekend: number | null;
  hasContraindications: boolean;
  timezone: string;
};

export type SurveyErrors = Partial<Record<keyof SurveyValues, string>>;

export function parseTime(text: string): number | null {
  const parts = text.trim().split(':').map((p) => p.trim());
  if (!text.trim() || parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const [a, b, c] = parts.map(Number) as [number, number, number?];
  const seconds = c === undefined ? a * 60 + b : a * 3600 + b * 60 + c;
  return seconds > 0 ? seconds : null;
}

export function formatTime(totalS: number | null | undefined) {
  if (!totalS) return '';
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const inRange = (n: number | null, min: number, max: number) => n === null || (Number.isInteger(n) && n >= min && n <= max);

/** Walidacja zgodna z ograniczeniami w bazie (public.goals, availability, profiles). */
export function validateSurvey(v: SurveyValues): { ok: true; payload: SurveyPayload } | { ok: false; errors: SurveyErrors } {
  const errors: SurveyErrors = {};
  const race = v.goalType === 'race';
  const targetTimeS = race && v.targetTime.trim() ? parseTime(v.targetTime) : null;
  const recentTimeS = v.recentDistanceM && v.recentTime.trim() ? parseTime(v.recentTime) : null;

  if (race) {
    if (!RACE_DISTANCES_M.includes(v.distanceM)) errors.distanceM = 'Wybierz dystans.';
    if (!isDate(v.raceDate)) errors.raceDate = 'Podaj datę zawodów.';
    if (v.targetTime.trim() && !targetTimeS) errors.targetTime = 'Czas jako 1:55:00 albo 28:30.';
    if (v.planStartsOn && isDate(v.raceDate) && v.planStartsOn >= v.raceDate) {
      errors.planStartsOn = 'Start planu musi być przed zawodami.';
    }
  }
  if (v.planStartsOn && !isDate(v.planStartsOn)) errors.planStartsOn = 'Nieprawidłowa data.';
  if (v.recentDistanceM && v.recentTime.trim() && !recentTimeS) errors.recentTime = 'Czas jako 52:30 albo 1:45:00.';
  if (!v.preferredDays.length) errors.preferredDays = 'Wybierz co najmniej jeden dzień.';
  if (!inRange(v.sessionsPerWeek, 1, 7)) errors.sessionsPerWeek = 'Od 1 do 7.';
  if (!inRange(v.currentRunsPerWeek, 0, 14)) errors.currentRunsPerWeek = 'Od 0 do 14.';
  if (!inRange(v.maxMinutesWeekday, 10, 300)) errors.maxMinutesWeekday = 'Od 10 do 300 min.';
  if (!inRange(v.maxMinutesWeekend, 10, 300)) errors.maxMinutesWeekend = 'Od 10 do 300 min.';
  try {
    new Intl.DateTimeFormat('en', { timeZone: v.timezone || 'Europe/Warsaw' });
  } catch {
    errors.timezone = 'Nieznana strefa, np. Europe/Warsaw.';
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      displayName: v.displayName.trim() || null,
      goalType: v.goalType,
      generalFocus: race ? null : v.generalFocus,
      distanceM: race ? v.distanceM : null,
      raceDate: race ? v.raceDate : null,
      targetTimeS,
      planStartsOn: v.planStartsOn || null,
      level: v.level,
      recentDistanceM: recentTimeS ? v.recentDistanceM : null,
      recentTimeS,
      currentRunsPerWeek: v.currentRunsPerWeek,
      preferredDays: [...new Set(v.preferredDays)].sort((a, b) => a - b),
      sessionsPerWeek: v.sessionsPerWeek,
      maxMinutesWeekday: v.maxMinutesWeekday,
      maxMinutesWeekend: v.maxMinutesWeekend,
      hasContraindications: v.hasContraindications,
      timezone: v.timezone || 'Europe/Warsaw',
    },
  };
}

// ───────────────────────── profile kont testowych ─────────────────────────

export type SurveyPreset = { key: string; label: string; build: (today: string) => SurveyValues };

const base = (today: string): SurveyValues => ({
  displayName: '',
  goalType: 'general',
  generalFocus: 'run_regularly',
  distanceM: 10000,
  raceDate: addDaysIso(today, 70),
  targetTime: '',
  planStartsOn: today,
  level: 'intermediate',
  recentDistanceM: null,
  recentTime: '',
  currentRunsPerWeek: 1,
  preferredDays: [2, 4, 6],
  sessionsPerWeek: 3,
  maxMinutesWeekday: 45,
  maxMinutesWeekend: 60,
  hasContraindications: false,
  timezone: 'Europe/Warsaw',
});

export const SURVEY_PRESETS: SurveyPreset[] = [
  {
    key: 'beginner',
    label: 'Początkujący – zacznij biegać (3×, wt/czw/sb)',
    build: (t) => ({ ...base(t), displayName: 'Ania (start)', level: 'beginner', generalFocus: 'start_running', currentRunsPerWeek: 0, maxMinutesWeekday: 30, maxMinutesWeekend: 45 }),
  },
  {
    key: 'fitness',
    label: 'Okazjonalny – popraw formę (3×, 5 km w 30:00)',
    build: (t) => ({ ...base(t), displayName: 'Bartek (forma)', generalFocus: 'improve_fitness', preferredDays: [2, 4, 7], recentDistanceM: 5000, recentTime: '30:00', maxMinutesWeekend: 75 }),
  },
  {
    key: 'busy',
    label: 'Mało czasu – biegaj regularnie (2×, śr/nd, 30/45 min)',
    build: (t) => ({ ...base(t), displayName: 'Celina (2×)', preferredDays: [3, 7], sessionsPerWeek: 2, maxMinutesWeekday: 30, maxMinutesWeekend: 45 }),
  },
  {
    key: 'ten_k',
    label: 'Regularny – 10 km za 10 tygodni, cel 45:00',
    build: (t) => ({ ...base(t), displayName: 'Darek (10 km)', level: 'advanced', goalType: 'race', distanceM: 10000, raceDate: addDaysIso(t, 70), targetTime: '45:00', recentDistanceM: 10000, recentTime: '48:00', currentRunsPerWeek: 3, preferredDays: [1, 3, 5, 7], sessionsPerWeek: 4, maxMinutesWeekday: 60, maxMinutesWeekend: 90 }),
  },
  {
    key: 'half_gentle',
    label: 'Półmaraton za 16 tygodni, przeciwwskazania',
    build: (t) => ({ ...base(t), displayName: 'Ewa (półmaraton, łagodnie)', goalType: 'race', distanceM: 21097, raceDate: addDaysIso(t, 112), currentRunsPerWeek: 2, maxMinutesWeekend: 90, hasContraindications: true }),
  },
  {
    key: 'marathon',
    label: 'Zaawansowany – maraton za 20 tygodni, cel 3:30:00',
    build: (t) => ({ ...base(t), displayName: 'Filip (maraton)', level: 'advanced', goalType: 'race', distanceM: 42195, raceDate: addDaysIso(t, 140), targetTime: '3:30:00', recentDistanceM: 21097, recentTime: '1:40:00', currentRunsPerWeek: 4, preferredDays: [1, 2, 4, 6, 7], sessionsPerWeek: 5, maxMinutesWeekday: 75, maxMinutesWeekend: 150 }),
  },
  {
    key: 'race_soon',
    label: 'Zawody za 2 tygodnie (5 km) – tydzień startowy od razu',
    build: (t) => ({ ...base(t), displayName: 'Gosia (5 km za 2 tyg.)', goalType: 'race', distanceM: 5000, raceDate: addDaysIso(t, 13), recentDistanceM: 5000, recentTime: '27:00', currentRunsPerWeek: 3 }),
  },
];

export const presetByKey = (key: string) => SURVEY_PRESETS.find((p) => p.key === key);

/** Ankieta z bazy → wartości formularza (brakujące pola uzupełnione domyślnymi). */
export function surveyValuesFromRows(
  rows: {
    displayName: string | null;
    profile: {
      level: Level | null;
      recent_result_distance_m: number | null;
      recent_result_time_s: number | null;
      current_runs_per_week: number | null;
      has_contraindications: boolean | null;
      timezone: string;
    } | null;
    goal: {
      type: 'general' | 'race';
      general_focus: GeneralFocus | null;
      distance_m: number | null;
      race_date: string | null;
      target_time_s: number | null;
      plan_starts_on: string | null;
    } | null;
    availability: {
      preferred_days: number[] | null;
      sessions_per_week: number;
      max_minutes_weekday: number | null;
      max_minutes_weekend: number | null;
    } | null;
  },
  today: string,
): SurveyValues {
  const d = base(today);
  const { profile: p, goal: g, availability: a } = rows;
  return {
    displayName: rows.displayName ?? '',
    goalType: g?.type ?? d.goalType,
    generalFocus: g?.general_focus ?? d.generalFocus,
    distanceM: (RACE_DISTANCES_M as readonly number[]).includes(g?.distance_m ?? 0) ? (g!.distance_m as RaceDistanceM) : d.distanceM,
    raceDate: g?.race_date ?? d.raceDate,
    targetTime: formatTime(g?.target_time_s),
    planStartsOn: g ? (g.plan_starts_on ?? '') : d.planStartsOn,
    level: p?.level ?? d.level,
    recentDistanceM: p?.recent_result_distance_m ?? null,
    recentTime: formatTime(p?.recent_result_time_s),
    currentRunsPerWeek: p?.current_runs_per_week ?? d.currentRunsPerWeek,
    preferredDays: a?.preferred_days?.length ? [...a.preferred_days] : d.preferredDays,
    sessionsPerWeek: a?.sessions_per_week ?? d.sessionsPerWeek,
    maxMinutesWeekday: a ? a.max_minutes_weekday : d.maxMinutesWeekday,
    maxMinutesWeekend: a ? a.max_minutes_weekend : d.maxMinutesWeekend,
    hasContraindications: p?.has_contraindications ?? d.hasContraindications,
    timezone: p?.timezone ?? d.timezone,
  };
}
