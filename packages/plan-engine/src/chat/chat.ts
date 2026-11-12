// Rozmowa z trenerem AI (funkcja 'coach-chat', moduł coach_chat): kontekst dla modelu, odpowiedź z opcjonalną
// propozycją zmiany planu i jej walidacja tymi samymi regułami, którymi sprawdzamy plan od AI (ai-ops.ts).
//
// Model nigdy nie zmienia planu sam: zwraca jedną operację, silnik sprawdza, czy jest wykonalna i nie łamie reguł,
// a zapis następuje dopiero po akceptacji biegacza. Wywołanie modelu i log wstrzykuje środowisko (jak w ai-run.ts).
// Do modelu nie trafiają imię, e-mail ani identyfikatory – tylko plan, oceny i treść rozmowy.

import { AI_SESSION_TYPES, applyOperations, type AiOperation, type AiSessionType } from '../ai/ai-ops.ts';
import { costUsd, modelPrice } from '../ai/ai-pricing.ts';
import type { AiPromptConfig } from '../ai/ai-prompt.ts';
import type { AiCaller, AiLogger, AiMessage, AiModelRequest, AiModelResult, AiStatus } from '../ai/ai-run.ts';
import { noteActual, type NoteActual } from '../coach/review-note.ts';
import { parseUnits, unitsNote, type Units } from '../core/units.ts';
import { addDaysIso, isoWeekday } from '../core/dates.ts';
import { describeSteps, stepsOf } from '../core/workout.ts';
import { ENGINE_VERSION, type PlanInput, type PlannedSession, type PlannedWeek } from '../plan/plan.ts';
import type { ReviewFact, ReviewVerdict } from '../review/review.ts';

export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_REPLY_MAX_LENGTH = 1500;
/** Ile ostatnich wiadomości wątku dostaje model. */
export const CHAT_HISTORY_LIMIT = 20;
/** Dzienny limit wiadomości biegacza do trenera AI (koszt i ochrona przed nadużyciem). */
export const CHAT_DAILY_LIMIT = 40;

/**
 * Słowa, po których uznajemy, że wiadomość dotyczy zdrowia (ból, kontuzja, choroba, leki, ciąża…).
 * Taka wiadomość to dane o zdrowiu (art. 9 RODO): bez zgody 'health_data' nie zapisujemy jej i nie wysyłamy do modelu –
 * aplikacja prosi wtedy o jednorazową zgodę. Sito jest celowo szerokie: fałszywy alarm kosztuje jedno kliknięcie.
 */
const HEALTH_PL =
  /(?<!\p{L})(b[oó]l|boli|bolał|bolą|obolał|kontuzj|uraz|chor[oauy]|chorob|gorączk|przezięb|gryp|covid|leki|leków|lekarstw|lekarz|lekark|tablet|antybiotyk|zawrot|mdłoś|mdli|omdl|kłuj|kłuci|naciąg|naderw|zapaleni|skręc|złama|opuch|operacj|zabieg|ciąż|astm|cukrzyc|ciśnieni|duszno|kołatani|depresj|miesiączk|rehabilit|fizjoterap|szpital|diagnoz)/iu;
const HEALTH_EN =
  /\b(pain|painful|hurt|hurts|hurting|ache|aching|sore|injur|sick|illness|ill|fever|flu|covid|medication|medicine|pills?|antibiotic|dizzy|dizziness|nausea|faint|sprain|strained|swollen|swelling|surgery|pregnan|asthma|diabet|blood pressure|palpitation|depress|doctor|physio|hospital|diagnos)/i;

/** Czy wiadomość biegacza porusza tematy zdrowotne (do bramki zgody w czacie). */
export const mentionsHealth = (text: string) => HEALTH_PL.test(text) || HEALTH_EN.test(text);

export const CHAT_CHANGE_KINDS = ['move', 'set_duration', 'set_type', 'remove'] as const;
export type ChatChangeKind = (typeof CHAT_CHANGE_KINDS)[number];

/** Propozycja zmiany planu od trenera – zapisywana przy wiadomości, wykonywana po akceptacji. */
export type ChatChange = {
  op: ChatChangeKind;
  date: string;
  toDate: string | null;
  type: AiSessionType | null;
  durationMin: number | null;
  /** Jedno zdanie na kartę propozycji. */
  summary: string;
};

export const COACH_CHAT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    change: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['none', ...CHAT_CHANGE_KINDS] },
        date: { type: ['string', 'null'] },
        toDate: { type: ['string', 'null'] },
        type: { anyOf: [{ type: 'string', enum: [...AI_SESSION_TYPES] }, { type: 'null' }] },
        durationMin: { type: ['integer', 'null'] },
        summary: { type: 'string' },
      },
      required: ['op', 'date', 'toDate', 'type', 'durationMin', 'summary'],
      additionalProperties: false,
    },
  },
  required: ['reply', 'change'],
  additionalProperties: false,
} as const;

export type ChatSessionContext = {
  date: string;
  /** 1 = poniedziałek. */
  weekday: number;
  type: string;
  durationMin: number | null;
  status: string;
  /** Przyszły, niezrobiony trening – tylko taki można zmienić. */
  canChange: boolean;
  verdict: ReviewVerdict | null;
};

export type CoachChatContext = {
  locale: string;
  /** Jednostki biegacza i instrukcja dla modelu, w czym pisać dystans, tempo i temperaturę. */
  units: Units;
  unitsNote: string;
  today: string;
  weekday: number;
  athlete: { level: string | null; goal: string | null };
  /** `minSessionMin` – krótszego treningu reguły planu nie przyjmą. */
  plan: { sessions: ChatSessionContext[]; freeDays: string[]; minSessionMin: number | null };
  /** Rozmowa przy konkretnym treningu: pytania przed albo po. */
  focus: {
    date: string;
    type: string;
    durationMin: number | null;
    steps: string;
    phase: 'before' | 'after';
    actual: NoteActual | null;
    verdict: ReviewVerdict | null;
    facts: ReviewFact[];
    coachNote: string | null;
  } | null;
};

/** Wiersze z bazy potrzebne do kontekstu rozmowy (te same w Edge Function i w testerze w panelu). */
export type ChatContextRows = {
  locale: string | null;
  /** `profiles.units` – metric albo imperial; brak = metryczne. */
  units?: string | null;
  level: string | null;
  goal: { type: string; general_focus: string | null; distance_m: number | null; race_date: string | null } | null;
  weeks: {
    starts_on: string;
    sessions: {
      id: string;
      scheduled_on: string;
      type: string;
      duration_min: number | null;
      structure: unknown;
      status: string;
      actual_distance_m: number | null;
      actual_duration_s: number | null;
    }[];
  }[];
  reviews: { session_id: string; verdict: ReviewVerdict; facts: ReviewFact[]; note: string | null }[];
  /** Dziś w strefie biegacza. */
  today: string;
  /** Trening, przy którym toczy się rozmowa (wątek „przed / po”). */
  focusId: string | null;
  /** Najkrótszy trening dopuszczany przez reguły dla tego biegacza (z parametrów silnika). */
  minSessionMin?: number | null;
};

/** Kontekst rozmowy: plan od tygodnia wstecz do dwóch naprzód, wolne dni i – w wątku przy treningu – ten trening. */
export function chatContextFromRows(rows: ChatContextRows): CoachChatContext {
  const { today } = rows;
  const from = addDaysIso(today, -7);
  const to = addDaysIso(today, 14);
  const all = rows.weeks.flatMap((w) => w.sessions).filter((s) => s.type !== 'rest');
  const shown = all.filter((s) => s.scheduled_on >= from && s.scheduled_on <= to).sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));
  const focus = rows.focusId ? (all.find((s) => s.id === rows.focusId) ?? null) : null;
  const reviewOf = new Map(rows.reviews.map((r) => [r.session_id, r]));

  // Wolne dni: od dziś do końca ostatniego tygodnia planu w oknie, bez treningu.
  const taken = new Set(all.map((s) => s.scheduled_on));
  const lastStart = rows.weeks.map((w) => w.starts_on).sort().at(-1);
  const lastDay = lastStart ? addDaysIso(lastStart, 6) : today;
  const freeDays: string[] = [];
  for (let d = today; d <= to && d <= lastDay; d = addDaysIso(d, 1)) if (!taken.has(d)) freeDays.push(d);

  const focusReview = focus ? reviewOf.get(focus.id) : undefined;
  const units = parseUnits(rows.units);
  return {
    locale: rows.locale ?? 'pl',
    units,
    unitsNote: unitsNote(units),
    today,
    weekday: isoWeekday(today),
    athlete: {
      level: rows.level,
      goal: rows.goal ? (rows.goal.type === 'race' ? `zawody ${rows.goal.distance_m} m, ${rows.goal.race_date}` : rows.goal.general_focus) : null,
    },
    plan: {
      sessions: shown.map((s) => ({
        date: s.scheduled_on,
        weekday: isoWeekday(s.scheduled_on),
        type: s.type,
        durationMin: s.duration_min,
        status: s.status,
        canChange: s.status === 'planned' && s.scheduled_on >= today && s.type !== 'race',
        verdict: reviewOf.get(s.id)?.verdict ?? null,
      })),
      freeDays,
      minSessionMin: rows.minSessionMin ?? null,
    },
    focus: focus
      ? {
          date: focus.scheduled_on,
          type: focus.type,
          durationMin: focus.duration_min,
          steps: describeSteps(stepsOf(focus)),
          phase: focus.status === 'planned' ? 'before' : 'after',
          actual: focus.status === 'planned' ? null : noteActual(focus.actual_distance_m, focus.actual_duration_s, units),
          verdict: focusReview?.verdict ?? null,
          facts: focusReview?.facts ?? [],
          coachNote: focusReview?.note ?? null,
        }
      : null,
  };
}

/** Historia wątku + ostatnia wiadomość biegacza z doklejonym kontekstem → wiadomości dla modelu. */
export function coachChatMessages(history: { sender: 'user' | 'coach'; body: string }[], ctx: CoachChatContext): AiMessage[] {
  const recent = history.slice(-CHAT_HISTORY_LIMIT);
  // Rozmowa dla modelu musi zaczynać się od biegacza i kończyć jego wiadomością.
  while (recent.length > 0 && recent[0]!.sender !== 'user') recent.shift();
  const messages: AiMessage[] = recent.map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.body }));
  const last = messages.at(-1);
  if (last?.role === 'user') last.content = `<kontekst>\n${JSON.stringify(ctx, null, 2)}\n</kontekst>\n\n${last.content}`;
  return messages;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Odpowiedź modelu → tekst i (opcjonalnie) propozycja. Zła propozycja znika, odpowiedź zostaje. */
export function parseCoachChat(json: unknown): { reply: string; change: ChatChange | null } | null {
  if (typeof json !== 'object' || json === null) return null;
  const { reply, change } = json as { reply?: unknown; change?: Record<string, unknown> };
  if (typeof reply !== 'string') return null;
  const text = reply.trim();
  if (text.length === 0 || text.length > CHAT_REPLY_MAX_LENGTH) return null;
  const op = change?.op;
  if (!change || typeof op !== 'string' || !(CHAT_CHANGE_KINDS as readonly string[]).includes(op)) return { reply: text, change: null };
  if (typeof change.date !== 'string' || !ISO_DATE.test(change.date)) return { reply: text, change: null };
  const toDate = typeof change.toDate === 'string' && ISO_DATE.test(change.toDate) ? change.toDate : null;
  const type = (AI_SESSION_TYPES as readonly unknown[]).includes(change.type) ? (change.type as AiSessionType) : null;
  const durationMin = typeof change.durationMin === 'number' && Number.isFinite(change.durationMin) ? Math.round(change.durationMin) : null;
  if ((op === 'move' && !toDate) || (op === 'set_duration' && !durationMin) || (op === 'set_type' && !type)) return { reply: text, change: null };
  const summary = typeof change.summary === 'string' ? change.summary.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  return { reply: text, change: { op: op as ChatChangeKind, date: change.date, toDate, type, durationMin, summary } };
}

/** `weeks` – tydzień, którego dotyczy zmiana, już po niej. */
export type ChatChangeCheck = { ok: true; weeks: PlannedWeek[] } | { ok: false; reason: string };

/**
 * Czy propozycję da się wykonać na aktualnym planie bez łamania reguł. `statuses`: data → status treningu w bazie.
 * Biegacz sam prosi o zmianę, więc dzień docelowy nie musi być dniem z ankiety – reszta reguł obowiązuje.
 */
export function checkChatChange(
  change: ChatChange,
  ctx: { input: PlanInput; weeks: PlannedWeek[]; statuses: ReadonlyMap<string, string>; today: string },
): ChatChangeCheck {
  const status = ctx.statuses.get(change.date);
  if (!status) return { ok: false, reason: `w dniu ${change.date} nie ma treningu` };
  if (status !== 'planned') return { ok: false, reason: 'ten trening jest już zrobiony' };
  if (change.date < ctx.today) return { ok: false, reason: 'ten trening już minął' };
  if (change.toDate && change.toDate < ctx.today) return { ok: false, reason: 'nie można przenieść treningu na miniony dzień' };
  const operation: AiOperation = {
    op: change.op,
    date: change.date,
    toDate: change.toDate,
    type: change.type,
    durationMin: change.durationMin,
    sets: null,
    reason: change.summary,
  };
  // Sprawdzamy tylko tydzień, którego dotyczy zmiana (z poprzednim jako odniesieniem). Kolejnych tygodni nie
  // walidujemy: odpuszczenie albo skrócenie treningu zawsze jest bezpieczne, nawet jeśli następny tydzień wyjdzie
  // przez to „za duży” względem tego – wyrówna go generowanie kolejnego tygodnia.
  const sorted = [...ctx.weeks].sort((x, y) => x.weekIndex - y.weekIndex);
  const index = sorted.findIndex((w) => change.date >= w.startsOn && change.date <= w.endsOn);
  if (index < 0) return { ok: false, reason: `dzień ${change.date} jest poza planem` };
  const result = applyOperations([operation], {
    input: { ...ctx.input, preferredDays: [1, 2, 3, 4, 5, 6, 7] },
    draft: [sorted[index]!],
    previousWeek: index > 0 ? sorted[index - 1]! : null,
  });
  const outcome = result.results[0];
  return outcome?.status === 'applied' ? { ok: true, weeks: result.weeks } : { ok: false, reason: outcome?.reason ?? 'zmiana niewykonalna' };
}

/** Co zmienić w wierszu treningu po akceptacji: usunąć albo zapisać nowy stan (z dnia docelowego). */
export type ChatChangeWrite =
  | { kind: 'delete'; date: string }
  | { kind: 'update'; date: string; session: PlannedSession };

export function chatChangeWrite(change: ChatChange, after: PlannedWeek[]): ChatChangeWrite | null {
  if (change.op === 'remove') return { kind: 'delete', date: change.date };
  const target = change.op === 'move' ? change.toDate! : change.date;
  const session = after.flatMap((w) => w.sessions).find((s) => s.scheduledOn === target);
  return session ? { kind: 'update', date: change.date, session } : null;
}

export type CoachChatOptions = {
  history: { sender: 'user' | 'coach'; body: string }[];
  context: CoachChatContext;
  prompt: AiPromptConfig;
  call: AiCaller;
  log: AiLogger;
  meta: { userId: string | null; isTest: boolean; source?: 'app' | 'tester' };
  /**
   * Sprawdzenie propozycji regułami planu: null = w porządku, tekst = powód odrzucenia. Odrzucona propozycja
   * wraca do modelu z powodem (jedna poprawka), żeby biegacz nie dostał odpowiedzi „zaakceptuj poniżej” bez przycisku.
   */
  check?: (change: ChatChange) => string | null;
  /** Dopisek do odpowiedzi, gdy także poprawiona propozycja nie przeszła (w języku biegacza). */
  rejectedSuffix?: string;
  now?: () => number;
};

export type CoachChatOutcome = { reply: string | null; change: ChatChange | null; status: AiStatus; callId: number | null };

/**
 * Odpowiedź trenera AI. Nigdy nie rzuca: błąd modelu albo zła odpowiedź = `reply: null` (aplikacja prosi o ponowienie).
 * Propozycja, której nie przepuszczają reguły (`opts.check`), wraca do modelu z powodem – wynik to zawsze albo
 * propozycja wykonalna, albo sama odpowiedź.
 */
export async function coachChatWithAi(opts: CoachChatOptions): Promise<CoachChatOutcome> {
  const messages = coachChatMessages(opts.history, opts.context);
  const first = await attemptChat(opts, messages, 1, null);
  const reason = first.change && opts.check ? opts.check(first.change) : null;
  if (!first.reply || !first.change || !reason) return first;

  const second = await attemptChat(
    opts,
    [
      ...messages,
      { role: 'assistant', content: JSON.stringify({ reply: first.reply, change: first.change }) },
      {
        role: 'user',
        content: `Aplikacja sprawdziła tę propozycję i jej nie przyjmie: ${reason}. Odpowiedz biegaczowi jeszcze raz (on tamtej wersji nie widział): zaproponuj zmianę zgodną z regułami albo krótko wyjaśnij, czemu się nie da – wtedy change.op = "none".`,
      },
    ],
    2,
    first.callId,
  );
  const fixed = second.reply ? second : first;
  if (fixed.change && opts.check?.(fixed.change)) {
    return { ...fixed, change: null, reply: [fixed.reply, opts.rejectedSuffix].filter(Boolean).join('\n\n'), status: 'corrected' };
  }
  return { ...fixed, status: second.reply ? 'corrected' : fixed.status };
}

async function attemptChat(opts: CoachChatOptions, messages: AiMessage[], attempt: number, parentCallId: number | null): Promise<CoachChatOutcome> {
  const now = opts.now ?? Date.now;
  const request: AiModelRequest = {
    model: opts.prompt.model,
    maxTokens: opts.prompt.maxTokens,
    effort: opts.prompt.effort,
    system: [opts.prompt.systemPrompt],
    messages,
    outputSchema: COACH_CHAT_SCHEMA as unknown as Record<string, unknown>,
  };

  const started = now();
  let model: AiModelResult | null = null;
  let error: string | null = null;
  try {
    model = await opts.call(request);
    if (model.stopReason === 'refusal') error = 'model odmówił odpowiedzi (refusal)';
    else if (model.stopReason === 'max_tokens') error = 'odpowiedź ucięta (max_tokens) – zwiększ limit tokenów';
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  const durationMs = Math.max(0, Math.round(now() - started));

  let parsed: ReturnType<typeof parseCoachChat> = null;
  let status: AiStatus = 'fallback';
  if (model && !error) {
    try {
      parsed = parseCoachChat(model.text ? JSON.parse(model.text) : null);
    } catch {
      parsed = null;
    }
    status = parsed ? 'ok' : 'rejected';
    if (!parsed) error = 'odpowiedź pusta, za długa albo spoza schematu';
  }

  const price = modelPrice(model?.model ?? opts.prompt.model);
  const callId = await opts
    .log(
      {
        user_id: opts.meta.userId,
        function_name: 'coach-chat',
        model: model?.model ?? opts.prompt.model,
        input_tokens: model?.usage.inputTokens ?? null,
        output_tokens: model?.usage.outputTokens ?? null,
        cache_read_tokens: model?.usage.cacheReadTokens ?? null,
        cache_write_tokens: model?.usage.cacheWriteTokens ?? null,
        cost_usd: model ? costUsd(model.usage, price) : null,
        duration_ms: durationMs,
        validation_status: status,
        error,
        source: opts.meta.source ?? 'app',
        is_test: opts.meta.isTest,
        attempt,
        parent_call_id: parentCallId,
        prompt_id: opts.prompt.id,
        prompt_version: opts.prompt.version,
        engine_config_id: null,
        engine_config_version: 0,
        engine_version: ENGINE_VERSION,
        request_id: model?.requestId ?? null,
        stop_reason: model?.stopReason ?? null,
        price,
      },
      { request, response: model ? model.raw : { error }, result: null },
    )
    .catch(() => null);

  return { reply: parsed?.reply ?? null, change: parsed?.change ?? null, status, callId };
}
