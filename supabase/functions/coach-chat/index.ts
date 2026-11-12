// Edge Function: rozmowa z trenerem – czat z trenerem AI („Keanu Biegała”) i z prawdziwym trenerem.
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
import { applyPlanChange, checkChange, loadPlan, type Loaded } from '../_shared/plan-change.ts';
import {
  CHAT_DAILY_LIMIT,
  CHAT_HISTORY_LIMIT,
  CHAT_MESSAGE_MAX_LENGTH,
  chatContextFromRows,
  coachChatWithAi,
  mentionsHealth,
  paramsOf,
  promptFromRow,
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
const COACH_COLUMNS = 'id, kind, display_name, title, bio, avatar_url, headline, headline_en, title_en';

async function buildContext(db: SupabaseClient, loaded: Loaded, focusId: string | null): Promise<CoachChatContext> {
  const ids = loaded.weeks.flatMap((w) => w.sessions).map((s) => s.id);
  const reviews = ids.length > 0 ? await db.from('session_reviews').select('session_id, verdict, facts, note').in('session_id', ids) : { data: [] };
  return chatContextFromRows({
    locale: (loaded.profile?.locale as string | undefined) ?? null,
    level: (loaded.profile?.level as string | undefined) ?? null,
    goal: loaded.goal,
    weeks: loaded.weeks,
    reviews: (reviews.data ?? []) as { session_id: string; verdict: ReviewVerdict; facts: ReviewFact[]; note: string | null }[],
    today: loaded.today,
    focusId,
    minSessionMin: loaded.input ? paramsOf(loaded.input).minSessionMin : null,
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
        // Propozycja łamiąca reguły wraca do modelu z powodem; biegacz widzi tylko wykonalną albo samą odpowiedź.
        check: (change) => {
          const checked = checkChange(change, loaded);
          return checked.ok ? null : checked.reason;
        },
        rejectedSuffix: loaded.profile?.locale === 'en' ? '(I can’t make this change in the plan – the plan rules don’t allow it.)' : '(Tej zmiany nie mogę wprowadzić w planie – nie pozwalają na nią reguły planu.)',
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
      // Plan zmienił się od czasu propozycji (albo trening już zrobiony) – propozycja wygasa, nic nie ruszamy.
      if ((await applyPlanChange(db, await loadPlan(db, userId), change)) === 'expired') {
        await setStatus('expired');
        return json({ status: 'expired' });
      }
      await setStatus('accepted');
      return json({ status: 'accepted' });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('coach-chat failed', userId, e instanceof Error ? e.message : e);
    return json({ error: 'failed' }, 500);
  }
});
