// Edge Function: rozmowa z trenerem – czat z trenerem AI („Pan Aloha”) i z prawdziwym trenerem.
//
//   POST { action: 'open', coach: 'ai' | 'human', sessionId? }  → { thread, coach, messages }
//        wątek ogólny albo przy treningu (pytania przed / po); przy trenerze-człowieku przydziela trenera.
//   POST { action: 'send', threadId, text }                     → { messages } – wiadomość biegacza i (AI) odpowiedź,
//        która może nieść propozycję zmiany planu sprawdzoną regułami silnika. Wiadomość o zdrowiu bez zgody
//        'health_data' → { error: 'health_consent' } (nic nie zapisujemy; aplikacja prosi o zgodę i ponawia).
//   POST { action: 'answer', messageId, accept }                → { status } – akceptacja wykonuje zmianę w planie.
//
// Moduły pakietu: coach_chat (AI) i coach_human (człowiek) – bez modułu funkcja odpowiada 403 module_disabled.
// Odpowiedzi trenera-człowieka dopisuje panel (apps/admin → Trenerzy); aplikacja czyta wiadomości prosto z bazy (RLS).
// Logika: packages/plan-engine/src/chat/chat.ts. Prompt: funkcja AI 'coach-chat' (ops.ai_prompts).
// Do modelu idą plan, oceny i treść rozmowy – bez imienia, e-maila i identyfikatorów.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { claudeCaller, claudeKey } from '../_shared/claude.ts';
import { userModules } from '../_shared/modules.ts';
import {
  addDaysIso,
  CHAT_DAILY_LIMIT,
  CHAT_HISTORY_LIMIT,
  CHAT_MESSAGE_MAX_LENGTH,
  chatChangeWrite,
  checkChatChange,
  coachChatWithAi,
  describeSteps,
  engineFromRow,
  isoWeekday,
  mentionsHealth,
  noteActual,
  planInputFromSurvey,
  plannedWeekFromRow,
  promptFromRow,
  stepsOf,
  type AiCallPayload,
  type AiCallRecord,
  type ChatChange,
  type CoachChatContext,
  type ReviewFact,
  type ReviewVerdict,
} from '../_shared/plan-engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_COLUMNS = 'id, thread_id, sender, body, proposal, proposal_status, created_at';
const COACH_COLUMNS = 'id, kind, display_name, title, bio, avatar_url';

function todayIn(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

type SessionRow = {
  id: string;
  scheduled_on: string;
  type: string;
  duration_min: number | null;
  distance_m: number | null;
  intensity: string | null;
  structure: unknown;
  status: string;
  actual_distance_m: number | null;
  actual_duration_s: number | null;
};
type WeekRow = { id: string; week_index: number; starts_on: string; focus: string | null; base_easy_min: number | null; sessions: SessionRow[] };

/** Plan, ankieta i parametry silnika – wszystko, czego trzeba do kontekstu rozmowy i do sprawdzenia zmiany. */
async function loadPlan(db: SupabaseClient, userId: string) {
  const [profile, goal, availability, plan, config] = await Promise.all([
    db
      .from('profiles')
      .select('level, locale, timezone, has_contraindications, recent_result_distance_m, recent_result_time_s, training_level')
      .eq('id', userId)
      .maybeSingle(),
    db.from('goals').select('id, type, general_focus, distance_m, race_date, target_time_s, plan_starts_on').eq('user_id', userId).eq('status', 'active').maybeSingle(),
    db.from('availability').select('preferred_days, sessions_per_week, max_minutes_weekday, max_minutes_weekend').eq('user_id', userId).maybeSingle(),
    db
      .from('plans')
      .select(
        'id, starts_on, weeks(id, week_index, starts_on, focus, base_easy_min, sessions(id, scheduled_on, type, duration_min, distance_m, intensity, structure, status, actual_distance_m, actual_duration_s))',
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    db.rpc('get_engine_config'),
  ]);
  for (const r of [profile, goal, availability, plan]) if (r.error) throw new Error(r.error.message);
  const weeks = ((plan.data?.weeks ?? []) as WeekRow[]).sort((a, b) => a.week_index - b.week_index);
  const today = todayIn((profile.data?.timezone as string | undefined) ?? 'Europe/Warsaw');
  const input =
    profile.data?.level && goal.data && availability.data && plan.data
      ? {
          ...planInputFromSurvey({ profile: { ...profile.data, level: profile.data.level }, goal: goal.data, availability: availability.data }, plan.data.starts_on),
          params: engineFromRow(config.data).params,
        }
      : null;
  return { profile: profile.data, goal: goal.data, weeks, today, input };
}

type Loaded = Awaited<ReturnType<typeof loadPlan>>;

async function buildContext(db: SupabaseClient, loaded: Loaded, focusId: string | null): Promise<CoachChatContext> {
  const { weeks, today, profile, goal } = loaded;
  const from = addDaysIso(today, -7);
  const to = addDaysIso(today, 14);
  const all = weeks.flatMap((w) => w.sessions).filter((s) => s.type !== 'rest');
  const shown = all.filter((s) => s.scheduled_on >= from && s.scheduled_on <= to).sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));
  const focus = focusId ? (all.find((s) => s.id === focusId) ?? null) : null;
  const ids = [...new Set([...shown.map((s) => s.id), ...(focus ? [focus.id] : [])])];
  const reviews = ids.length > 0 ? await db.from('session_reviews').select('session_id, verdict, facts, note').in('session_id', ids) : { data: [] };
  const reviewOf = new Map((reviews.data ?? []).map((r) => [r.session_id as string, r]));

  // Wolne dni: od dziś do końca ostatniego tygodnia planu w oknie, bez treningu.
  const taken = new Set(all.map((s) => s.scheduled_on));
  const lastDay = weeks.length > 0 ? addDaysIso(weeks.at(-1)!.starts_on, 6) : today;
  const freeDays: string[] = [];
  for (let d = today; d <= to && d <= lastDay; d = addDaysIso(d, 1)) if (!taken.has(d)) freeDays.push(d);

  const focusReview = focus ? reviewOf.get(focus.id) : undefined;
  return {
    locale: (profile?.locale as string | undefined) ?? 'pl',
    today,
    weekday: isoWeekday(today),
    athlete: {
      level: (profile?.level as string | undefined) ?? null,
      goal: goal ? (goal.type === 'race' ? `zawody ${goal.distance_m} m, ${goal.race_date}` : (goal.general_focus as string | null)) : null,
    },
    plan: {
      sessions: shown.map((s) => ({
        date: s.scheduled_on,
        weekday: isoWeekday(s.scheduled_on),
        type: s.type,
        durationMin: s.duration_min,
        status: s.status,
        canChange: s.status === 'planned' && s.scheduled_on >= today && s.type !== 'race',
        verdict: (reviewOf.get(s.id)?.verdict as ReviewVerdict | undefined) ?? null,
      })),
      freeDays,
    },
    focus: focus
      ? {
          date: focus.scheduled_on,
          type: focus.type,
          durationMin: focus.duration_min,
          steps: describeSteps(stepsOf(focus)),
          phase: focus.status === 'planned' ? 'before' : 'after',
          actual: focus.status === 'planned' ? null : noteActual(focus.actual_distance_m, focus.actual_duration_s),
          verdict: (focusReview?.verdict as ReviewVerdict | undefined) ?? null,
          facts: (focusReview?.facts as ReviewFact[] | undefined) ?? [],
          coachNote: (focusReview?.note as string | null | undefined) ?? null,
        }
      : null,
  };
}

/** Czy zmianę da się teraz wykonać na planie z bazy; przy `ok` – tydzień po zmianie. */
function checkChange(change: ChatChange, loaded: Loaded) {
  if (!loaded.input) return { ok: false as const, reason: 'brak planu' };
  const sessions = loaded.weeks.flatMap((w) => w.sessions).filter((s) => s.type !== 'rest');
  return checkChatChange(change, {
    input: loaded.input,
    weeks: loaded.weeks.map((w) => plannedWeekFromRow(w)),
    statuses: new Map(sessions.map((s) => [s.scheduled_on, s.status])),
    today: loaded.today,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;
  const body = await req.json().catch(() => null);
  const modules = await userModules(db, userId);

  try {
    // ── Otwarcie wątku ──
    if (body?.action === 'open') {
      const kind = body.coach === 'human' ? 'human' : 'ai';
      if (!modules.has(kind === 'ai' ? 'coach_chat' : 'coach_human')) return json({ error: 'module_disabled' }, 403);
      const sessionId = typeof body.sessionId === 'string' && UUID.test(body.sessionId) ? (body.sessionId as string) : null;
      if (sessionId) {
        const own = await db.from('sessions').select('id').eq('id', sessionId).eq('user_id', userId).maybeSingle();
        if (!own.data) return json({ error: 'invalid_session' }, 400);
      }

      let coachId: string | null = null;
      if (kind === 'ai') {
        coachId = ((await db.from('coaches').select('id').eq('kind', 'ai').eq('active', true).maybeSingle()).data?.id as string | undefined) ?? null;
      } else {
        const assigned = await db.from('coach_assignments').select('coach_id').eq('user_id', userId).maybeSingle();
        coachId = (assigned.data?.coach_id as string | undefined) ?? null;
        if (!coachId) {
          // Pierwsza rozmowa: przydzielamy aktywnego trenera (na start – pierwszego z listy).
          const first = await db.from('coaches').select('id').eq('kind', 'human').eq('active', true).order('created_at').limit(1).maybeSingle();
          coachId = (first.data?.id as string | undefined) ?? null;
          if (coachId) await db.from('coach_assignments').upsert({ user_id: userId, coach_id: coachId }, { onConflict: 'user_id', ignoreDuplicates: true });
        }
      }
      if (!coachId) return json({ error: 'no_coach' }, 404);

      let thread = db.from('chat_threads').select('id').eq('user_id', userId).eq('coach_id', coachId);
      thread = sessionId ? thread.eq('session_id', sessionId) : thread.is('session_id', null);
      let threadId = ((await thread.maybeSingle()).data?.id as string | undefined) ?? null;
      if (!threadId) {
        const created = await db.from('chat_threads').insert({ user_id: userId, coach_id: coachId, session_id: sessionId }).select('id').single();
        if (created.error) throw new Error(created.error.message);
        threadId = created.data.id as string;
      }
      const [coach, messages] = await Promise.all([
        db.from('coaches').select(COACH_COLUMNS).eq('id', coachId).single(),
        db.from('chat_messages').select(MESSAGE_COLUMNS).eq('thread_id', threadId).order('id', { ascending: false }).limit(100),
      ]);
      return json({ thread: { id: threadId, sessionId }, coach: coach.data, messages: (messages.data ?? []).reverse() });
    }

    // ── Wiadomość biegacza ──
    if (body?.action === 'send') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!UUID.test(body.threadId ?? '') || text.length === 0 || text.length > CHAT_MESSAGE_MAX_LENGTH) return json({ error: 'invalid_message' }, 400);
      const thread = await db.from('chat_threads').select('id, coach_id, session_id, coaches(kind)').eq('id', body.threadId).eq('user_id', userId).maybeSingle();
      if (!thread.data) return json({ error: 'invalid_thread' }, 404);
      const kind = (thread.data.coaches as unknown as { kind: string } | null)?.kind === 'human' ? 'human' : 'ai';
      if (!modules.has(kind === 'ai' ? 'coach_chat' : 'coach_human')) return json({ error: 'module_disabled' }, 403);

      // Tematy zdrowotne (ból, choroba, leki…) to dane o zdrowiu: bez zgody 'health_data' nie zapisujemy wiadomości
      // i nie wysyłamy jej dalej. Aplikacja pokazuje wtedy prośbę o jednorazową zgodę i wysyła wiadomość ponownie.
      if (mentionsHealth(text)) {
        const consent = await db.rpc('has_consent', { uid: userId, consent_kind: 'health_data' });
        if (consent.error) throw new Error(consent.error.message);
        if (consent.data !== true) return json({ error: 'health_consent' });
      }

      if (kind === 'ai') {
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const sent = await db.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('sender', 'user').gte('created_at', since);
        if ((sent.count ?? 0) >= CHAT_DAILY_LIMIT) return json({ error: 'limit' }, 429);
      }

      const saved = await db.from('chat_messages').insert({ thread_id: thread.data.id, user_id: userId, sender: 'user', body: text }).select(MESSAGE_COLUMNS).single();
      if (saved.error) throw new Error(saved.error.message);
      await db.from('chat_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.data.id);
      // Trener-człowiek odpowie z panelu – tu kończymy.
      if (kind === 'human') return json({ messages: [saved.data] });

      const apiKey = claudeKey();
      if (!apiKey) return json({ messages: [saved.data], error: 'ai_unavailable' });
      const [loaded, history, promptRes] = await Promise.all([
        loadPlan(db, userId),
        db.from('chat_messages').select('sender, body').eq('thread_id', thread.data.id).order('id', { ascending: false }).limit(CHAT_HISTORY_LIMIT),
        db.rpc('get_ai_prompt', { p_function: 'coach-chat' }),
      ]);
      if (promptRes.error) console.error('get_ai_prompt failed', promptRes.error.message);
      const outcome = await coachChatWithAi({
        history: ((history.data ?? []) as { sender: 'user' | 'coach'; body: string }[]).reverse(),
        context: await buildContext(db, loaded, thread.data.session_id as string | null),
        prompt: promptFromRow('coach-chat', promptRes.data),
        call: claudeCaller(apiKey),
        log: async (call: AiCallRecord, payload: AiCallPayload) => {
          const { data, error } = await db.rpc('log_ai_call', { p_call: call, p_payload: payload });
          if (error) console.error('log_ai_call failed', error.code, error.message);
          return (data as number | null) ?? null;
        },
        meta: { userId, isTest: auth.user.user_metadata?.test_account === true },
      });
      if (!outcome.reply) return json({ messages: [saved.data], error: 'ai_unavailable' });

      // Propozycja trafia do biegacza tylko wtedy, gdy reguły planu ją przepuszczają.
      let proposal: ChatChange | null = outcome.change;
      if (proposal) {
        const checked = checkChange(proposal, loaded);
        if (!checked.ok) {
          console.warn('chat change rejected', userId, proposal.op, checked.reason);
          proposal = null;
        }
      }
      const reply = await db
        .from('chat_messages')
        .insert({
          thread_id: thread.data.id,
          user_id: userId,
          sender: 'coach',
          body: outcome.reply,
          proposal,
          proposal_status: proposal ? 'pending' : null,
          ai_call_id: outcome.callId,
        })
        .select(MESSAGE_COLUMNS)
        .single();
      if (reply.error) throw new Error(reply.error.message);
      await db.from('chat_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.data.id);
      return json({ messages: [saved.data, reply.data] });
    }

    // ── Odpowiedź na propozycję zmiany planu ──
    if (body?.action === 'answer') {
      const messageId = Number(body.messageId);
      if (!Number.isInteger(messageId) || typeof body.accept !== 'boolean') return json({ error: 'invalid_answer' }, 400);
      const message = await db.from('chat_messages').select('id, proposal, proposal_status').eq('id', messageId).eq('user_id', userId).maybeSingle();
      if (!message.data || message.data.proposal_status !== 'pending') return json({ error: 'no_proposal' }, 404);
      const setStatus = (status: string) => db.from('chat_messages').update({ proposal_status: status }).eq('id', messageId);
      if (!body.accept) {
        await setStatus('declined');
        return json({ status: 'declined' });
      }

      const change = message.data.proposal as ChatChange;
      const loaded = await loadPlan(db, userId);
      const checked = checkChange(change, loaded);
      const write = checked.ok ? chatChangeWrite(change, checked.weeks) : null;
      const row = loaded.weeks.flatMap((w) => w.sessions).find((s) => s.scheduled_on === change.date && s.type !== 'rest');
      // Plan zmienił się od czasu propozycji (albo trening już zrobiony) – propozycja wygasa, nic nie ruszamy.
      if (!checked.ok || !write || !row) {
        await setStatus('expired');
        return json({ status: 'expired' });
      }
      const applied =
        write.kind === 'delete'
          ? await db.from('sessions').delete().eq('id', row.id).eq('status', 'planned')
          : await db
              .from('sessions')
              .update({
                scheduled_on: write.session.scheduledOn,
                type: write.session.type,
                duration_min: write.session.durationMin,
                distance_m: write.session.distanceM,
                intensity: write.session.intensity,
                structure: write.session.structure,
              })
              .eq('id', row.id)
              .eq('status', 'planned');
      if (applied.error) throw new Error(applied.error.message);
      await setStatus('accepted');
      return json({ status: 'accepted' });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('coach-chat failed', userId, e instanceof Error ? e.message : e);
    return json({ error: 'failed' }, 500);
  }
});
