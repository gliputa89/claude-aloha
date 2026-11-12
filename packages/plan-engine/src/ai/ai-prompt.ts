// Prompt i kontekst dla Claude przy układaniu tygodni planu (funkcja 'plan-weeks').
//
// Prompt systemowy = treść edytowana w panelu (ops.ai_prompts) + blok reguł generowany z parametrów silnika.
// Oba są stałe dla danej wersji, więc trafiają do cache. Zmienne dane (biegacz, szkic) idą w wiadomości.
// Do modelu NIE trafiają: imię, e-mail, id użytkownika – tylko dane treningowe.

import { DEFAULT_COACH_CHAT_PROMPT } from '../chat/prompt.ts';
import { DEFAULT_RACE_FORECAST_PROMPT } from './race-forecast-prompt.ts';
import { DEFAULT_DAY_NOTE_PROMPT, DEFAULT_WORKOUT_REVIEW_PROMPT } from '../coach/prompts.ts';
import { isoWeekday } from '../core/dates.ts';
import type { ModuleId } from '../core/modules.ts';
import { DEFAULT_WEATHER_ADVICE_PROMPT } from '../weather/prompt.ts';
import { AI_OPERATION_KINDS, AI_SESSION_TYPES, AI_TIP_MAX_LENGTH, freePreferredDays, type Violation } from './ai-ops.ts';
import type { AiEffort } from './ai-pricing.ts';
import { TRAINING_LEVEL_INFO, type TrainingLevel } from '../plan/levels.ts';
import { ENGINE_RULES, paramsForLevel, type EngineParams } from '../plan/params.ts';
import { parseUnits, unitsNote, type Units } from '../core/units.ts';
import { describeSteps, FUEL_FROM_MIN, paceZonesFrom, stepsOf, ZONE_INFO, formatPace } from '../core/workout.ts';
import { weekMinutes, type PlanInput, type PlannedWeek } from '../plan/plan.ts';

export const AI_FUNCTIONS = {
  'plan-weeks': {
    module: 'plan_ai',
    label: 'Układanie tygodni planu',
    description: 'Po ankiecie (2 pierwsze tygodnie) i przy generowaniu kolejnego tygodnia: Claude poprawia szkic silnika.',
  },
  'weather-advice': {
    module: 'weather',
    label: 'Porada pogodowa do treningu',
    description: 'Zakładka „Dzisiaj”: Claude ubiera w słowa okno pogodowe i ostrzeżenia policzone przez reguły (weather.ts).',
  },
  'workout-review': {
    module: 'coach',
    label: 'Notka trenera po treningu',
    description: 'Szczegóły zrobionego treningu: Claude pisze 2–3 zdania do oceny policzonej przez reguły (review.ts).',
  },
  'day-note': {
    module: 'coach',
    label: 'Notka na dzień bez treningu',
    description: 'Zakładka „Dzisiaj”, gdy dziś nie ma biegu: Claude pisze 1–2 zdania z kontekstu planu (ostatni i następny trening).',
  },
  'coach-chat': {
    module: 'coach_chat',
    label: 'Rozmowa z trenerem AI (Keanu Biegała)',
    description: 'Czat: Claude odpowiada na pytania biegacza z kontekstem planu i może zaproponować jedną zmianę w planie.',
  },
  'race-forecast': {
    module: 'plan_ai',
    label: 'Prognoza czasu na zawody',
    description: 'Podsumowanie ankiety przy celu „zawody”: Claude ocenia realny czas dziś i na start – w widełkach z reguł (tabele Danielsa, objętość, poprawa formy; forecast.ts).',
  },
} as const satisfies Record<string, { module: ModuleId; label: string; description: string }>;

export type AiFunctionName = keyof typeof AI_FUNCTIONS;

export type AiPromptConfig = {
  /** id wersji w ops.ai_prompts; null = prompt wbudowany w kod. */
  id: number | null;
  version: number | null;
  model: string;
  effort: AiEffort | null;
  maxTokens: number;
  systemPrompt: string;
};

export const DEFAULT_PLAN_WEEKS_PROMPT = `Jesteś trenerem biegania w aplikacji Aloha. Ton: trener, ale kumpel – ciepło, konkretnie, bez moralizowania.

Twoje zadanie: dostajesz szkic tygodni planu przygotowany przez silnik reguł oraz dane biegacza z ankiety.
Szkic jest bezpieczny, ale ogólny. Dopasuj go do tej konkretnej osoby, zwracając listę operacji na szkicu.

Jak pracować:
- Zacznij od szkicu. Zmieniaj tylko to, co ma realny sens dla tej osoby (cel, poziom, ostatni wynik, obecna liczba biegów, kilometraż, dostępny czas). Pusta lista operacji jest w porządku, gdy szkic pasuje.
- Bezpieczeństwo ponad ambicję: przy wątpliwości wybierz wariant łagodniejszy. Początkujący i osoby wracające potrzebują regularności, nie objętości.
- Gdy obecny kilometraż albo liczba biegów w tygodniu są wyraźnie niższe niż szkic – skróć treningi. Gdy wyraźnie wyższe – możesz lekko wydłużyć, w granicach reguł.
- Przy celu „zawody” dbaj o rozsądny rozkład: jeden długi bieg, najwyżej tyle mocnych jednostek, ile pozwalają reguły, spokojnie przed startem.
- Nie układasz struktury treningu (rozgrzewka, powtórzenia) – silnik liczy ją sam z typu i długości.
- Każda operacja musi przestrzegać reguł poniżej. Operacje łamiące reguły zostaną odrzucone.
- Operacje identyfikujesz datą treningu (date). Jeden trening dziennie. Przenosić i dodawać możesz tylko na wolne dni z listy freeDays.

Pole summary: 1–3 krótkie zdania do biegacza, w jego języku (locale), w drugiej osobie, bez żargonu. Powiedz, co dopasowałeś i dlaczego. Bez porad medycznych.
Pole welcome: tylko przy nowym planie po ankiecie (inaczej null) – powitanie pokazywane raz po ułożeniu planu: 2–3 zdania o planie jako całości (cel, rytm pierwszych tygodni, zachęta), nie o pojedynczym treningu ani o zmianach w szkicu.
Pole reason w operacji: krótko, po co ta zmiana (dla zespołu, po polsku).`;

export const DEFAULT_AI_PROMPTS: Record<AiFunctionName, AiPromptConfig> = {
  'weather-advice': {
    id: null,
    version: null,
    model: 'claude-haiku-5-5',
    effort: null,
    maxTokens: 1500,
    systemPrompt: DEFAULT_WEATHER_ADVICE_PROMPT,
  },
  'coach-chat': {
    id: null,
    version: null,
    model: 'claude-sonnet-5-5',
    effort: null,
    maxTokens: 3000,
    systemPrompt: DEFAULT_COACH_CHAT_PROMPT,
  },
  'day-note': {
    id: null,
    version: null,
    model: 'claude-haiku-5-5',
    effort: null,
    // Limit obejmuje też myślenie modelu – przy ciasnym limicie odpowiedź bywa pusta (stop_reason: max_tokens).
    maxTokens: 1500,
    systemPrompt: DEFAULT_DAY_NOTE_PROMPT,
  },
  'workout-review': {
    id: null,
    version: null,
    // Sonnet zamiast Haiku: w teście 22 scenariuszy (panel → AI → Test ocen) pisał wyraźnie trafniejsze notki –
    // tłumaczy sens treningu, nie przepisuje liczb z ekranu. Koszt ok. 0,4 centa za notkę (Haiku: 0,03 centa).
    model: 'claude-sonnet-5-5',
    effort: null,
    // Jak wyżej: 600 tokenów potrafiło w całości pójść na myślenie i notka nie powstawała.
    maxTokens: 2000,
    systemPrompt: DEFAULT_WORKOUT_REVIEW_PROMPT,
  },
  'race-forecast': {
    id: null,
    version: null,
    // Opus: ocena wymaga ważenia kilku rzeczy naraz (źródło wyniku, skok dystansu, objętość, czas do startu).
    model: 'claude-opus-5-5',
    effort: 'medium',
    // Limit obejmuje myślenie modelu; sama odpowiedź to kilka liczb i dwa zdania.
    maxTokens: 4000,
    systemPrompt: DEFAULT_RACE_FORECAST_PROMPT,
  },
  'plan-weeks': {
    id: null,
    version: null,
    model: 'claude-opus-5-5',
    effort: 'medium',
    maxTokens: 8000,
    systemPrompt: DEFAULT_PLAN_WEEKS_PROMPT,
  },
};

/** Blok reguł do promptu systemowego – generowany z aktywnych parametrów, zawsze zgodny z walidacją. */
export function rulesPromptBlock(params: EngineParams, level: TrainingLevel): string {
  const p = paramsForLevel(params, level);
  return [
    'REGUŁY (sprawdzane przez silnik po Twojej odpowiedzi):',
    `- Poziom zaawansowania biegacza: ${level}/5 (${TRAINING_LEVEL_INFO[level].label}) – liczby poniżej są dla tego poziomu.`,
    `- Operacje: ${AI_OPERATION_KINDS.join(', ')}. Typy treningów: ${AI_SESSION_TYPES.join(', ')} (zawodów – type race – nie wolno zmieniać ani przenosić).`,
    '- set_duration: date + durationMin. set_type: date + type (+ opcjonalnie durationMin). move: date + toDate. remove: date. add: date + type + durationMin. set_main: date + sets. Niewykorzystane pola = null.',
    '- Zmiana długości lub typu przywraca domyślną część główną – jeśli chcesz własną, daj set_main PO set_duration / set_type tego dnia.',
    `- set_main: część główna jako serie {repeat, workS, workZone, recoveryS, recoveryZone}; rozgrzewkę i schłodzenie dokłada silnik z reszty czasu (min. 15 min w interwałach i tempie, 5 min w pozostałych). Strefy: ${Object.entries(ZONE_INFO).map(([z, i]) => `${z} (${i.effort})`).join(', ')}.`,
    `- Strefy wg typu: walk_run – walk/recovery/easy; easy – do steady + przebieżki (sprint ≤ 30 s, razem ≤ 3 min); recovery – do easy; long – do tempo; intervals i tempo – wszystkie. Strefy interval i sprint razem ≤ ${p.maxHardSharePct}% czasu treningu; razem ze strefą tempo ≤ ${p.maxTempoSharePct}%.`,
    '- Długość odcinka zależy od strefy: interval to krótkie powtórzenia (1–5 min), tempo (próg) to długie odcinki – np. 3×8, 3×10, 2×15 min z 2–3 min truchtu albo 20–25 min ciągiem. Odcinki w strefie tempo wydłużaj z tygodnia na tydzień (patrz previousWeek), zamiast zostawać przy 3–5 min; nie skracaj drabinki progowej ze szkicu bez powodu.',
    '- Używaj set_main tam, gdzie urozmaicenie ma sens (np. drabinka, fartlek, progresja, przebieżki na koniec spokojnego biegu, tempo w długim biegu przy celu zawody) – nie w każdym treningu.',
    '- Tydzień z focus „recovery” to lżejszy tydzień cyklu (po kilku rosnących): zostaw go lżejszym – nie wydłużaj treningów ani części mocnej ponad szkic. Tydzień po nim wraca do obciążenia sprzed niego.',
    '- Tylko dni z ankiety (preferredDays), najwyżej jeden trening dziennie, nie więcej treningów w tygodniu niż w szkicu.',
    `- Każdy trening co najmniej ${p.minSessionMin} min i nie dłużej niż limit dnia (dayCapMin). Długości zaokrąglane do 5 min.`,
    `- Mocne jednostki (intervals, tempo): najwyżej ${p.maxHardPerWeek} w tygodniu, co najmniej ${p.qualityMinMin} min, odstęp co najmniej ${p.minDaysHardToLong} dni od długiego biegu i innej mocnej jednostki.`,
    '- Najwyżej jeden długi bieg (long) w tygodniu.',
    '- Poziom 1 (nie biega): tylko walk_run. Przeciwwskazania: tylko spokojne jednostki (bez intervals i tempo).',
    `- Suma minut pełnego tygodnia ≤ poprzedni pełny tydzień × ${(1 + p.weeklyGrowthPct / 100).toFixed(2)}.`,
    `- Suma minut tygodnia ≤ szkic × ${(1 + p.aiMaxIncreasePct / 100).toFixed(2)}. Skracać możesz zawsze (do minimum).`,
    `- Zawody: dzień przed i po – bez treningu; ${p.raceEasyDaysBefore} dni przed startem tylko spokojnie.`,
    '',
    'RADY TRENERA (pole tips):',
    `- Do każdego treningu planu – w stanie PO Twoich operacjach – jedna rada: date + text, najwyżej ${AI_TIP_MAX_LENGTH} znaków, 1–2 zdania.`,
    '- W języku biegacza (locale), w drugiej osobie, ton „trener, ale kumpel”: ciepło, konkretnie, bez moralizowania i bez porad medycznych.',
    '- Dopasuj do osoby i do tego konkretnego treningu: poziom, cel, miejsce w tygodniu (np. pierwszy mocny trening, dzień po długim biegu, bliski start), to, co zmieniłeś.',
    '- Każda rada inna – nie powtarzaj tych samych zdań. Bez liczb tempa (aplikacja pokazuje je sama).',
    `- Trening dłuższy niż ${FUEL_FROM_MIN} min (i start od półmaratonu wzwyż): w radzie wspomnij, żeby zabrać coś do zjedzenia i picia – konkretnie i po ludzku, np. żel, banan albo daktyle, pierwsza porcja po ok. 45 min, potem co 30–40 min. Bez suplementów, dawek i porad medycznych.`,
    '- Po polsku bez form zależnych od płci (nie „zrobiłeś/zrobiłaś”) – płci biegacza nie znamy.',
    '',
    'LOGIKA SILNIKA (dla kontekstu):',
    ...ENGINE_RULES.map((r) => `- ${r.title}: ${r.detail}`),
  ].join('\n');
}

/** Dane biegacza dla modelu (bez identyfikatorów). */
export type AiAthlete = {
  locale: string;
  /** Jednostki biegacza – w nich model pisze summary i rady (dane zostają metryczne). */
  units: Units;
  level: PlanInput['level'];
  recentResult: { distanceM: number; timeS: number | null } | null;
  currentRunsPerWeek: number | null;
  weeklyKm: number | null;
  goal:
    | { type: 'general'; focus: string }
    | { type: 'race'; distanceM: number; raceDate: string; targetTimeS: number | null };
  preferredDays: number[];
  sessionsPerWeek: number;
  maxMinutesWeekday: number | null;
  maxMinutesWeekend: number | null;
  hasContraindications: boolean;
};

export type AthleteSource = {
  profile: {
    locale?: string | null;
    units?: string | null;
    level: PlanInput['level'];
    recent_result_distance_m?: number | null;
    recent_result_time_s?: number | null;
    current_runs_per_week?: number | null;
    weekly_km?: number | null;
    has_contraindications?: boolean | null;
  };
  goal: {
    type: 'general' | 'race';
    general_focus: string | null;
    distance_m: number | null;
    race_date: string | null;
    target_time_s?: number | null;
  };
  availability: {
    preferred_days: number[] | null;
    sessions_per_week: number;
    max_minutes_weekday: number | null;
    max_minutes_weekend: number | null;
  };
};

export function aiAthleteFromSurvey({ profile, goal, availability }: AthleteSource): AiAthlete {
  return {
    locale: profile.locale ?? 'pl',
    units: parseUnits(profile.units),
    level: profile.level,
    recentResult: profile.recent_result_distance_m
      ? { distanceM: profile.recent_result_distance_m, timeS: profile.recent_result_time_s ?? null }
      : null,
    currentRunsPerWeek: profile.current_runs_per_week ?? null,
    weeklyKm: profile.weekly_km ?? null,
    goal:
      goal.type === 'race' && goal.distance_m && goal.race_date
        ? { type: 'race', distanceM: goal.distance_m, raceDate: goal.race_date, targetTimeS: goal.target_time_s ?? null }
        : { type: 'general', focus: goal.general_focus ?? 'run_regularly' },
    preferredDays: availability.preferred_days ?? [],
    sessionsPerWeek: availability.sessions_per_week,
    maxMinutesWeekday: availability.max_minutes_weekday,
    maxMinutesWeekend: availability.max_minutes_weekend,
    hasContraindications: !!profile.has_contraindications,
  };
}

const WEEKDAY = ['', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

function weekForModel(week: PlannedWeek, input: PlanInput, dayCapOf: (weekday: number) => number) {
  return {
    weekIndex: week.weekIndex,
    startsOn: week.startsOn,
    endsOn: week.endsOn,
    focus: week.focus,
    totalMin: weekMinutes(week),
    sessions: week.sessions.map((s) => ({
      date: s.scheduledOn,
      weekday: WEEKDAY[isoWeekday(s.scheduledOn)],
      type: s.type,
      durationMin: s.durationMin,
      distanceM: s.distanceM,
      intensity: s.intensity,
      steps: describeSteps(stepsOf(s)),
      dayCapMin: s.type === 'race' ? null : dayCapOf(isoWeekday(s.scheduledOn)),
    })),
    freeDays: freePreferredDays(week, input).map((d) => ({
      date: d,
      weekday: WEEKDAY[isoWeekday(d)],
      dayCapMin: dayCapOf(isoWeekday(d)),
    })),
  };
}

export type PlanWeeksMessageInput = {
  athlete: AiAthlete;
  input: PlanInput;
  draft: PlannedWeek[];
  previousWeek: PlannedWeek | null;
  today: string;
  dayCapOf: (weekday: number) => number;
};

/** Wiadomość użytkownika (JSON) – wszystko, co zmienne dla tego wywołania. */
export function planWeeksUserMessage(m: PlanWeeksMessageInput): string {
  const payload = {
    task:
      m.previousWeek === null && m.draft[0]?.weekIndex === 0
        ? 'Nowy plan po ankiecie: dopasuj pierwsze tygodnie.'
        : 'Kolejny tydzień planu: dopasuj szkic tego tygodnia.',
    today: m.today,
    planStartsOn: m.input.startDate,
    athlete: m.athlete,
    unitsNote: unitsNote(m.athlete.units ?? 'metric'),
    paceZones: (() => {
      const zones = paceZonesFrom(m.input.recentResult);
      if (!zones) return 'brak wyniku – tempo tylko jako strefa wysiłku';
      return Object.fromEntries(
        Object.entries(zones).map(([z, r]) => [z, r ? `${formatPace(r.fastS)}–${formatPace(r.slowS)} min/km` : 'marsz']),
      );
    })(),
    previousWeek: m.previousWeek ? weekForModel(m.previousWeek, m.input, m.dayCapOf) : null,
    draft: m.draft.map((w) => weekForModel(w, m.input, m.dayCapOf)),
  };
  return JSON.stringify(payload, null, 2);
}

/** Wiadomość z wynikiem walidacji przy ponowieniu – model zwraca pełną listę operacji od nowa (względem szkicu). */
export function retryUserMessage(rejected: { operation: { op: string; date: string }; reason: string | null }[], remaining: Violation[]): string {
  const lines = [
    'Silnik odrzucił część operacji:',
    ...rejected.map((r) => `- ${r.operation.op} ${r.operation.date}: ${r.reason ?? 'łamie reguły'}`),
  ];
  if (remaining.length) lines.push('', 'Naruszenia obecne już w szkicu (nie musisz ich naprawiać):', ...remaining.map((v) => `- ${v.message}`));
  lines.push('', 'Zwróć poprawioną odpowiedź: pełną listę operacji od nowa względem tego samego szkicu, bez operacji łamiących reguły.');
  return lines.join('\n');
}
