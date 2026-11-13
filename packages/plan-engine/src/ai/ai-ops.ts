// Operacje AI na szkicu planu i walidacja wyniku (docs/PROJECT.md 5 – „walidacja każdej propozycji AI”).
//
// Claude nie układa planu od zera: dostaje szkic silnika i zwraca listę operacji (skróć, zmień typ, przenieś,
// usuń, dodaj). Silnik nakłada je po kolei; operacja, która wprowadza nowe naruszenie reguł, jest cofana
// i trafia do odrzuconych z powodem. Wynik jest więc zawsze nie gorszy (pod względem reguł) niż szkic.
// Strukturę treningu (rozgrzewka, powtórzenia, schłodzenie) zawsze liczy silnik.

import { addDaysIso, daysBetween, isoWeekday } from '../core/dates.ts';
import { trainingLevelOf } from '../plan/levels.ts';
import type { LevelParams } from '../plan/params.ts';
import { buildFromMainSets, paceZonesFrom, PACE_ZONES, type MainSet, type PaceZone } from '../core/workout.ts';
import {
  dayCap,
  isFullWeek,
  paramsOf,
  qualityStructure,
  round5,
  walkRun,
  weeklyGrowth,
  weekMinutes,
  withSteps,
  type Intensity,
  type PlanInput,
  type PlannedSession,
  type PlannedWeek,
  type SessionType,
} from '../plan/plan.ts';

export const AI_OPERATION_KINDS = ['set_duration', 'set_type', 'set_main', 'move', 'remove', 'add'] as const;
export type AiOperationKind = (typeof AI_OPERATION_KINDS)[number];

/** Typy, które AI może ustawić (zawody są nietykalne). */
export const AI_SESSION_TYPES = ['walk_run', 'easy', 'recovery', 'long', 'intervals', 'tempo'] as const;
export type AiSessionType = (typeof AI_SESSION_TYPES)[number];

export type AiOperation = {
  op: AiOperationKind;
  /** Dzień treningu, którego dotyczy operacja (`YYYY-MM-DD`); przy `add` – dzień nowego treningu. */
  date: string;
  /** Tylko `move`: nowy dzień. */
  toDate: string | null;
  /** `set_type` i `add`: nowy typ. */
  type: AiSessionType | null;
  /** `set_duration` i `add` (opcjonalnie `set_type`): długość w minutach. */
  durationMin: number | null;
  /** Tylko `set_main`: część główna jako serie (powtórzenia × odcinek + przerwa). */
  sets: MainSet[] | null;
  /** Krótko, po co ta zmiana (widoczne w panelu). */
  reason: string;
};

/** Rada trenera do jednego treningu (dzień po wykonaniu operacji). */
export type AiTip = { date: string; text: string };

/** Najdłuższa rada (znaki) – dłuższe przycinamy. */
export const AI_TIP_MAX_LENGTH = 180;

/** Najdłuższe powitanie po ułożeniu planu (znaki) – dłuższe przycinamy. */
export const AI_WELCOME_MAX_LENGTH = 600;

export type AiPlanResponse = {
  /** Krótkie, ludzkie uzasadnienie dla użytkownika w jego języku. */
  summary: string;
  /**
   * Powitanie od trenera pokazywane raz, tuż po ułożeniu pierwszego planu – o planie jako całości,
   * nie o pojedynczym treningu. `null` przy kolejnych tygodniach (i w starszych odpowiedziach).
   */
  welcome: string | null;
  operations: AiOperation[];
  /** Rady trenera do treningów planu (po operacjach), w języku biegacza. */
  tips: AiTip[];
};

export const AI_OPERATION_LABEL: Record<AiOperationKind, string> = {
  set_duration: 'zmień długość',
  set_type: 'zmień rodzaj',
  set_main: 'ułóż część główną',
  move: 'przenieś na inny dzień',
  remove: 'usuń trening',
  add: 'dodaj trening',
};

/** Schemat odpowiedzi dla structured outputs (`output_config.format`). */
/** Serie części głównej w odpowiedzi modelu – ten sam fragment schematu w planie (set_main) i w czacie. */
export const MAIN_SETS_SCHEMA = {
  anyOf: [
    {
      type: 'array',
      description: 'Serie części głównej w kolejności. Rozgrzewkę i schłodzenie dokłada silnik.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['repeat', 'workS', 'workZone', 'recoveryS', 'recoveryZone'],
        properties: {
          repeat: { type: 'integer', description: 'ile razy powtórzyć (1 = pojedynczy odcinek)' },
          workS: { type: 'integer', description: 'czas odcinka w sekundach' },
          workZone: { type: 'string', enum: [...PACE_ZONES] },
          recoveryS: { type: ['integer', 'null'], description: 'przerwa po odcinku w sekundach; null = bez przerwy' },
          recoveryZone: { anyOf: [{ type: 'string', enum: [...PACE_ZONES] }, { type: 'null' }] },
        },
      },
    },
    { type: 'null' },
  ],
} as const;

export const AI_PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'welcome', 'operations', 'tips'],
  properties: {
    summary: {
      type: 'string',
      description: 'Krótkie (1–3 zdania), ciepłe uzasadnienie zmian dla biegacza, w jego języku.',
    },
    welcome: {
      type: ['string', 'null'],
      description:
        'Tylko gdy task to nowy plan po ankiecie – inaczej null. Powitanie od trenera pokazywane raz, tuż po ułożeniu planu: ' +
        '2–3 krótkie zdania w języku biegacza, w drugiej osobie. Powiedz, do czego ten plan prowadzi (jego cel), jak wyglądają ' +
        'pierwsze tygodnie jako całość (rytm, liczba treningów, od czego zaczynamy) i dodaj jedno zdanie zachęty. ' +
        'Nie opisuj pojedynczego treningu ani pierwszego dnia, nie wyliczaj zmian względem szkicu, bez porad medycznych.',
    },
    operations: {
      type: 'array',
      description: 'Zmiany względem szkicu, w kolejności wykonania. Pusta lista = szkic bez zmian.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'date', 'toDate', 'type', 'durationMin', 'sets', 'reason'],
        properties: {
          op: { type: 'string', enum: [...AI_OPERATION_KINDS] },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          toDate: { type: ['string', 'null'], description: 'YYYY-MM-DD, tylko dla move' },
          type: { anyOf: [{ type: 'string', enum: [...AI_SESSION_TYPES] }, { type: 'null' }] },
          durationMin: { type: ['integer', 'null'] },
          sets: MAIN_SETS_SCHEMA,
          reason: { type: 'string' },
        },
      },
    },
    tips: {
      type: 'array',
      description: 'Rada trenera do każdego treningu planu (stan PO operacjach), jedna na dzień, w języku biegacza.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'text'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD – dzień treningu' },
          text: { type: 'string', description: `Jedno–dwa krótkie zdania, do ${AI_TIP_MAX_LENGTH} znaków.` },
        },
      },
    },
  },
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isZone = (z: unknown): z is PaceZone => PACE_ZONES.includes(z as PaceZone);
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

/** Serie części głównej z odpowiedzi modelu (ten sam kształt w planie i w czacie); zły kształt = null. */
export function parseMainSets(raw: unknown): MainSet[] | null {
  if (!Array.isArray(raw)) return null;
  const sets: MainSet[] = [];
  for (const item of raw.slice(0, 20)) {
    const s = (item ?? {}) as Record<string, unknown>;
    const repeat = int(s.repeat);
    const workS = int(s.workS);
    if (repeat === null || workS === null || !isZone(s.workZone)) return null;
    const recoveryS = int(s.recoveryS);
    sets.push({
      repeat,
      workS,
      workZone: s.workZone,
      recoveryS: recoveryS && recoveryS > 0 ? recoveryS : null,
      recoveryZone: recoveryS && recoveryS > 0 && isZone(s.recoveryZone) ? s.recoveryZone : null,
    });
  }
  return sets;
}

/** Sprawdza kształt odpowiedzi modelu (structured outputs zwykle to gwarantuje, ale nie ufamy na ślepo). */
export function parseAiPlanResponse(raw: unknown): { ok: true; value: AiPlanResponse } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'odpowiedź nie jest obiektem' };
  const r = raw as Record<string, unknown>;
  if (typeof r.summary !== 'string') return { ok: false, error: 'brak pola summary' };
  if (!Array.isArray(r.operations)) return { ok: false, error: 'brak listy operations' };
  if (r.operations.length > 40) return { ok: false, error: 'za dużo operacji (> 40)' };
  const operations: AiOperation[] = [];
  for (const [i, item] of r.operations.entries()) {
    const o = (item ?? {}) as Record<string, unknown>;
    if (!AI_OPERATION_KINDS.includes(o.op as AiOperationKind)) return { ok: false, error: `operacja ${i + 1}: nieznane op` };
    if (typeof o.date !== 'string' || !ISO_DATE.test(o.date)) return { ok: false, error: `operacja ${i + 1}: zła data` };
    operations.push({
      op: o.op as AiOperationKind,
      date: o.date,
      toDate: typeof o.toDate === 'string' && ISO_DATE.test(o.toDate) ? o.toDate : null,
      type: AI_SESSION_TYPES.includes(o.type as AiSessionType) ? (o.type as AiSessionType) : null,
      durationMin: typeof o.durationMin === 'number' && Number.isFinite(o.durationMin) ? Math.round(o.durationMin) : null,
      sets: parseMainSets(o.sets),
      reason: typeof o.reason === 'string' ? o.reason.slice(0, 500) : '',
    });
  }
  const welcome = typeof r.welcome === 'string' ? r.welcome.trim().slice(0, AI_WELCOME_MAX_LENGTH) : '';
  return { ok: true, value: { summary: r.summary.slice(0, 2000), welcome: welcome || null, operations, tips: parseTips(r.tips) } };
}

/** Rady są dodatkiem – błędne pozycje pomijamy, zamiast odrzucać całą odpowiedź. */
function parseTips(raw: unknown): AiTip[] {
  if (!Array.isArray(raw)) return [];
  const tips: AiTip[] = [];
  for (const item of raw.slice(0, 60)) {
    const t = (item ?? {}) as Record<string, unknown>;
    if (typeof t.date !== 'string' || !ISO_DATE.test(t.date) || typeof t.text !== 'string') continue;
    const text = t.text.replace(/\s+/g, ' ').trim().slice(0, AI_TIP_MAX_LENGTH);
    if (text) tips.push({ date: t.date, text });
  }
  return tips;
}

/**
 * Rady przypisane do treningów gotowych tygodni: dzień → tekst. Tylko dni, w które jest trening
 * (rada do dnia przeniesionego lub usuniętego treningu przepada), przy powtórzeniu wygrywa pierwsza.
 */
export function coachTipsFor(weeks: PlannedWeek[], tips: AiTip[]): Record<string, string> {
  const days = new Set(weeks.flatMap((w) => w.sessions.map((s) => s.scheduledOn)));
  const out: Record<string, string> = {};
  for (const tip of tips) {
    if (days.has(tip.date) && !(tip.date in out)) out[tip.date] = tip.text;
  }
  return out;
}

// ───────────────────────── walidacja ─────────────────────────

export type ViolationCode =
  | 'out_of_week'
  | 'before_start'
  | 'two_per_day'
  | 'not_preferred_day'
  | 'too_many_sessions'
  | 'too_short'
  | 'over_day_cap'
  | 'quality_too_short'
  | 'beginner_type'
  | 'contraindication_intensity'
  | 'too_many_hard'
  | 'hard_spacing'
  | 'two_long'
  | 'growth'
  | 'over_draft'
  | 'race_changed'
  | 'race_rest_day'
  | 'race_taper';

export type Violation = { code: ViolationCode; weekIndex: number; date: string | null; message: string };

export const VIOLATION_LABEL: Record<ViolationCode, string> = {
  out_of_week: 'trening poza tygodniem',
  before_start: 'trening przed startem planu',
  two_per_day: 'dwa treningi jednego dnia',
  not_preferred_day: 'dzień spoza ankiety',
  too_many_sessions: 'więcej treningów niż w szkicu',
  too_short: 'trening krótszy niż minimum',
  over_day_cap: 'ponad limit czasu dnia',
  quality_too_short: 'mocna jednostka za krótka',
  beginner_type: 'osoba nie biega – tylko marszobieg',
  contraindication_intensity: 'przeciwwskazania – tylko spokojnie',
  too_many_hard: 'za dużo mocnych jednostek',
  hard_spacing: 'mocna jednostka za blisko długiego / mocnego',
  two_long: 'dwa długie biegi w tygodniu',
  growth: 'przyrost tygodniowy ponad limit',
  over_draft: 'tydzień dłuższy niż pozwala limit dla AI',
  race_changed: 'zmieniono zawody',
  race_rest_day: 'trening dzień przed / po zawodach',
  race_taper: 'mocno tuż przed zawodami',
};

const isHard = (s: PlannedSession) => s.type === 'intervals' || s.type === 'tempo';

export type ValidationContext = {
  input: PlanInput;
  /** Szkic silnika (te same numery tygodni co sprawdzany wynik). */
  draft: PlannedWeek[];
  /** Tydzień przed pierwszym sprawdzanym (do przyrostu i odstępów), jeśli istnieje. */
  previousWeek?: PlannedWeek | null;
  /** Naruszenia, których applyOperations nie traktuje jako nowych (np. przyrost przy przeniesieniu między tygodniami). */
  ignore?: readonly ViolationCode[];
};

/** Naruszenia reguł w tygodniach planu. Pusta lista = plan zgodny z regułami. */
export function validateWeeks(weeks: PlannedWeek[], ctx: ValidationContext): Violation[] {
  const { input } = ctx;
  const p: LevelParams = paramsOf(input);
  const out: Violation[] = [];
  const add = (code: ViolationCode, weekIndex: number, date: string | null, detail?: string) =>
    out.push({ code, weekIndex, date, message: detail ? `${VIOLATION_LABEL[code]}: ${detail}` : VIOLATION_LABEL[code] });

  const ordered = [...(ctx.previousWeek ? [ctx.previousWeek] : []), ...weeks];
  const allSessions = ordered.flatMap((w) => w.sessions);

  for (const [i, week] of weeks.entries()) {
    const draft = ctx.draft.find((d) => d.weekIndex === week.weekIndex);
    const prev = i > 0 ? weeks[i - 1] : (ctx.previousWeek ?? null);
    const regular = week.sessions.filter((s) => s.type !== 'race');
    const seen = new Set<string>();

    for (const s of week.sessions) {
      const wi = week.weekIndex;
      if (s.scheduledOn < week.startsOn || s.scheduledOn > week.endsOn) add('out_of_week', wi, s.scheduledOn);
      if (s.scheduledOn < input.startDate) add('before_start', wi, s.scheduledOn);
      if (seen.has(s.scheduledOn)) add('two_per_day', wi, s.scheduledOn);
      seen.add(s.scheduledOn);
      if (s.type === 'race') continue;

      const weekday = isoWeekday(s.scheduledOn);
      if (!input.preferredDays.includes(weekday)) add('not_preferred_day', wi, s.scheduledOn);
      const minutes = s.durationMin ?? 0;
      if (minutes < p.minSessionMin) add('too_short', wi, s.scheduledOn, `${minutes} < ${p.minSessionMin} min`);
      const cap = dayCap(input, weekday);
      if (minutes > cap) add('over_day_cap', wi, s.scheduledOn, `${minutes} > ${cap} min`);
      if (isHard(s) && minutes < p.qualityMinMin) add('quality_too_short', wi, s.scheduledOn);
      if (trainingLevelOf(input) === 1 && s.type !== 'walk_run') add('beginner_type', wi, s.scheduledOn);
      if (input.hasContraindications && s.intensity !== 'easy') add('contraindication_intensity', wi, s.scheduledOn);
      if (isHard(s)) {
        const tooClose = allSessions.some(
          (o) =>
            o !== s &&
            (o.type === 'long' || isHard(o)) &&
            Math.abs(daysBetween(o.scheduledOn, s.scheduledOn)) < p.minDaysHardToLong,
        );
        if (tooClose) add('hard_spacing', wi, s.scheduledOn);
      }
    }

    const draftRegular = draft ? draft.sessions.filter((s) => s.type !== 'race').length : input.sessionsPerWeek;
    if (regular.length > draftRegular) add('too_many_sessions', week.weekIndex, null, `${regular.length} > ${draftRegular}`);
    const hard = regular.filter(isHard).length;
    if (hard > p.maxHardPerWeek) add('too_many_hard', week.weekIndex, null, `${hard} > ${p.maxHardPerWeek}`);
    if (regular.filter((s) => s.type === 'long').length > 1) add('two_long', week.weekIndex, null);

    const minutes = weekMinutes(week);
    // Jak capGrowth w silniku: tydzień zawodów (i tydzień po nim) nie jest punktem odniesienia,
    // a tygodnia z samymi minimalnymi treningami nie da się już skrócić.
    const atFloor = regular.every((s) => (s.durationMin ?? 0) <= p.minSessionMin);
    if (week.focus !== 'race' && prev && prev.focus !== 'race' && prev.focus !== 'recovery' && !atFloor && isFullWeek(prev) && isFullWeek(week) && weekMinutes(prev) > 0) {
      const limit = weekMinutes(prev) * weeklyGrowth(p);
      if (minutes > limit + 1e-9) add('growth', week.weekIndex, null, `${minutes} > ${Math.floor(limit)} min`);
    }
    if (draft) {
      const limit = weekMinutes(draft) * (1 + p.aiMaxIncreasePct / 100);
      if (minutes > limit + 1e-9) add('over_draft', week.weekIndex, null, `${minutes} > ${Math.floor(limit)} min`);

      const draftRace = draft.sessions.find((s) => s.type === 'race');
      const race = week.sessions.find((s) => s.type === 'race');
      if (draftRace && (!race || race.scheduledOn !== draftRace.scheduledOn || race.distanceM !== draftRace.distanceM)) {
        add('race_changed', week.weekIndex, draftRace.scheduledOn);
      }
      if (!draftRace && race) add('race_changed', week.weekIndex, race.scheduledOn);
    }

    const race = week.sessions.find((s) => s.type === 'race');
    if (race) {
      for (const s of regular) {
        const before = daysBetween(s.scheduledOn, race.scheduledOn);
        if (Math.abs(before) <= 1) add('race_rest_day', week.weekIndex, s.scheduledOn);
        else if (before > 0 && before <= p.raceEasyDaysBefore && s.intensity !== 'easy') add('race_taper', week.weekIndex, s.scheduledOn);
      }
    }
  }
  return out;
}

const violationKey = (v: Violation) => `${v.code}|${v.weekIndex}|${v.date ?? ''}`;

// ───────────────────────── nakładanie operacji ─────────────────────────

/** Trening danego typu i długości – struktura i intensywność zawsze z silnika. */
export function buildSession(
  input: PlanInput,
  weekIndex: number,
  scheduledOn: string,
  type: AiSessionType,
  durationMin: number,
): PlannedSession {
  const duration = round5(durationMin);
  const gentle = input.hasContraindications;
  const base = { scheduledOn, type: type as SessionType, durationMin: duration, distanceM: null };
  const session: PlannedSession = (() => {
    switch (type) {
      case 'walk_run':
        return { ...base, intensity: 'easy' as Intensity, structure: walkRun(duration, weekIndex, gentle) };
      case 'intervals':
        return { ...base, intensity: 'hard' as Intensity, structure: qualityStructure(input, weekIndex, 'intervals', duration) };
      case 'tempo':
        return { ...base, intensity: 'moderate' as Intensity, structure: qualityStructure(input, weekIndex, 'tempo', duration) };
      default:
        return { ...base, intensity: 'easy' as Intensity, structure: { kind: 'steady' as const } };
    }
  })();
  return withSteps(session, input);
}

export type OperationResult = {
  operation: AiOperation;
  status: 'applied' | 'rejected';
  /** Powód odrzucenia (operacja niewykonalna albo łamie reguły). */
  reason: string | null;
  violations: Violation[];
};

const clone = (weeks: PlannedWeek[]): PlannedWeek[] =>
  weeks.map((w) => ({ ...w, sessions: w.sessions.map((s) => ({ ...s, structure: { ...s.structure } })) }));

const weekOf = (weeks: PlannedWeek[], date: string) => weeks.find((w) => date >= w.startsOn && date <= w.endsOn);

/** Wykonuje jedną operację na kopii tygodni; błąd → komunikat (operacja niewykonalna). */
function execute(weeks: PlannedWeek[], op: AiOperation, input: PlanInput): string | null {
  const week = weekOf(weeks, op.date);
  if (!week) return `dzień ${op.date} jest poza generowanymi tygodniami`;
  const index = week.sessions.findIndex((s) => s.scheduledOn === op.date);
  const session = index >= 0 ? week.sessions[index] : undefined;
  if (session?.type === 'race') return 'zawodów nie można zmieniać';

  switch (op.op) {
    case 'set_duration': {
      if (!session) return `brak treningu ${op.date}`;
      if (op.durationMin === null || op.durationMin <= 0) return 'brak durationMin';
      week.sessions[index] = buildSession(input, week.weekIndex, op.date, session.type as AiSessionType, op.durationMin);
      return null;
    }
    case 'set_type': {
      if (!session) return `brak treningu ${op.date}`;
      if (!op.type) return 'brak type';
      week.sessions[index] = buildSession(input, week.weekIndex, op.date, op.type, op.durationMin ?? session.durationMin ?? 0);
      return null;
    }
    case 'set_main': {
      if (!session) return `brak treningu ${op.date}`;
      if (!op.sets?.length) return 'brak sets';
      // Z `durationMin` trening zmienia też długość: mniej powtórzeń bez tego zostawiłoby ten sam czas,
      // a silnik wlałby resztę w rozgrzewkę i schłodzenie (np. 27 min rozgrzewki).
      const mainDurationMin = op.durationMin && op.durationMin > 0 ? op.durationMin : (session.durationMin ?? 0);
      const built = buildFromMainSets(
        op.sets,
        {
          type: session.type,
          durationMin: mainDurationMin,
          walkRunOnly: trainingLevelOf(input) === 1,
          gentle: input.hasContraindications,
          maxHardSharePct: paramsOf(input).maxHardSharePct,
          maxTempoSharePct: paramsOf(input).maxTempoSharePct,
        },
        paceZonesFrom(input.recentResult),
      );
      if (!built.ok) return built.error;
      const base =
        mainDurationMin === session.durationMin ? session : buildSession(input, week.weekIndex, op.date, session.type as AiSessionType, mainDurationMin);
      week.sessions[index] = { ...base, structure: { ...base.structure, steps: built.steps, custom: true } };
      return null;
    }
    case 'remove': {
      if (!session) return `brak treningu ${op.date}`;
      week.sessions.splice(index, 1);
      return null;
    }
    case 'move': {
      if (!session) return `brak treningu ${op.date}`;
      if (!op.toDate) return 'brak toDate';
      const target = weekOf(weeks, op.toDate);
      if (!target) return `dzień ${op.toDate} jest poza generowanymi tygodniami`;
      if (target.sessions.some((s) => s.scheduledOn === op.toDate)) return `${op.toDate} jest już zajęty`;
      week.sessions.splice(index, 1);
      const moved = buildSession(input, target.weekIndex, op.toDate, session.type as AiSessionType, session.durationMin ?? 0);
      target.sessions.push(moved);
      target.sessions.sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn));
      return null;
    }
    case 'add': {
      if (session) return `${op.date} jest już zajęty`;
      if (!op.type || op.durationMin === null) return 'brak type albo durationMin';
      week.sessions.push(buildSession(input, week.weekIndex, op.date, op.type, op.durationMin));
      week.sessions.sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn));
      return null;
    }
  }
}

export type ApplyResult = {
  weeks: PlannedWeek[];
  results: OperationResult[];
  /** Naruszenia, które zostały w wyniku (zwykle te same co w szkicu – AI nie może dodać nowych). */
  remaining: Violation[];
};

/**
 * Nakłada operacje po kolei. Operacja jest przyjmowana tylko wtedy, gdy jest wykonalna
 * i nie wprowadza żadnego nowego naruszenia względem stanu sprzed niej.
 * `start` – stan, na który nakładamy operacje, gdy ma być inny niż szkic (szkic zostaje wtedy tylko odniesieniem limitów).
 */
export function applyOperations(operations: AiOperation[], ctx: ValidationContext, start: PlannedWeek[] = ctx.draft): ApplyResult {
  let weeks = clone(start);
  let current = validateWeeks(weeks, ctx);
  const results: OperationResult[] = [];

  for (const operation of operations) {
    const next = clone(weeks);
    const error = execute(next, operation, ctx.input);
    if (error) {
      results.push({ operation, status: 'rejected', reason: error, violations: [] });
      continue;
    }
    const after = validateWeeks(next, ctx);
    const known = new Set(current.map(violationKey));
    const added = after.filter((v) => !known.has(violationKey(v)) && !ctx.ignore?.includes(v.code));
    if (added.length) {
      results.push({ operation, status: 'rejected', reason: added.map((v) => v.message).join('; '), violations: added });
      continue;
    }
    weeks = next;
    current = after;
    results.push({ operation, status: 'applied', reason: null, violations: [] });
  }
  return { weeks, results, remaining: current };
}

/** Wolne dni z ankiety w tygodniu (do podpowiedzi dla modelu, gdzie można przenieść / dodać trening). */
export function freePreferredDays(week: PlannedWeek, input: PlanInput): string[] {
  const days: string[] = [];
  for (let d = week.startsOn; d <= week.endsOn; d = addDaysIso(d, 1)) {
    if (d < input.startDate) continue;
    if (!input.preferredDays.includes(isoWeekday(d))) continue;
    if (week.sessions.some((s) => s.scheduledOn === d)) continue;
    days.push(d);
  }
  return days;
}
