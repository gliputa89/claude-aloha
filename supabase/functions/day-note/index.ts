// Edge Function: notka trenera AI na dzień bez treningu (ekran „Dzisiaj”).
//
//   POST { today: 'YYYY-MM-DD' } z tokenem użytkownika → { text } albo { text: null }
//
// Jedna notka na użytkownika i dzień (public.day_notes) – kolejne wywołania tego dnia oddają zapisaną.
// Gdy dziś jest bieg w planie, nie ma klucza ANTHROPIC_API_KEY albo model zawiedzie → { text: null },
// a aplikacja pokazuje tekst ze słownika. Do modelu idzie tylko kontekst treningowy, bez danych osobowych.
// Prompt: funkcja AI 'day-note' (ops.ai_prompts, edytowana w panelu); logika w packages/plan-engine/day-note.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { claudeCaller, claudeKey } from '../_shared/claude.ts';
import {
  addDaysIso,
  DAY_NOTE_MAX_LENGTH,
  dayNoteUserMessage,
  isoWeekday,
  promptFromRow,
  shortNoteWithAi,
  type AiCallPayload,
  type AiCallRecord,
  type ReviewVerdict,
} from '../_shared/plan-engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

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

  // „Dziś” podaje aplikacja (strefa czasowa telefonu) – przyjmujemy tylko dzień sąsiadujący z datą serwera.
  const body = await req.json().catch(() => null);
  const today = typeof body?.today === 'string' && ISO_DATE.test(body.today) ? (body.today as string) : null;
  if (!today || Math.abs(daysBetween(new Date().toISOString().slice(0, 10), today)) > 1) return json({ error: 'invalid_day' }, 400);

  try {
    const saved = await db.from('day_notes').select('text').eq('user_id', userId).eq('day', today).maybeSingle();
    if (saved.error) throw new Error(saved.error.message);
    if (saved.data) return json({ text: saved.data.text });

    const planRes = await db
      .from('plans')
      .select('weeks(sessions(id, scheduled_on, type, status))')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (planRes.error) throw new Error(planRes.error.message);
    type Session = { id: string; scheduled_on: string; type: string; status: string };
    const sessions = ((planRes.data?.weeks ?? []) as { sessions: Session[] }[])
      .flatMap((w) => w.sessions)
      .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));
    // Bez planu nie ma o czym pisać; z biegiem na dziś notka nie jest potrzebna.
    if (sessions.length === 0) return json({ text: null });
    const todays = sessions.filter((s) => s.scheduled_on === today);
    if (todays.some((s) => s.type !== 'rest')) return json({ text: null });

    const apiKey = claudeKey();
    if (!apiKey) return json({ text: null });

    const training = sessions.filter((s) => s.type !== 'rest');
    const last = training.filter((s) => s.scheduled_on < today && (s.status === 'done' || s.status === 'partial')).at(-1);
    const next = training.find((s) => s.scheduled_on > today);
    const twoWeeks = training.filter((s) => s.scheduled_on < today && s.scheduled_on >= addDaysIso(today, -14));
    const [profile, promptRes, review, previous] = await Promise.all([
      db.from('profiles').select('locale').eq('id', userId).maybeSingle(),
      db.rpc('get_ai_prompt', { p_function: 'day-note' }),
      last ? db.from('session_reviews').select('verdict').eq('session_id', last.id).maybeSingle() : Promise.resolve({ data: null }),
      db.from('day_notes').select('text').eq('user_id', userId).order('day', { ascending: false }).limit(3),
    ]);
    if (promptRes.error) console.error('get_ai_prompt failed', promptRes.error.message);
    const locale = (profile.data?.locale as string | undefined) ?? 'pl';
    const previousNotes = (previous.data ?? []).map((r) => r.text as string);

    const outcome = await shortNoteWithAi({
      functionName: 'day-note',
      message: dayNoteUserMessage({
        locale,
        weekday: isoWeekday(today),
        kind: todays.length > 0 ? 'rest' : 'none',
        lastWorkout: last
          ? { type: last.type, daysAgo: daysBetween(last.scheduled_on, today), verdict: (review.data?.verdict as ReviewVerdict | undefined) ?? null }
          : null,
        next: next ? { type: next.type, inDays: daysBetween(today, next.scheduled_on) } : null,
        recent: { planned: twoWeeks.length, done: twoWeeks.filter((s) => s.status === 'done' || s.status === 'partial').length },
        previousNotes,
      }),
      previousNotes,
      maxLength: DAY_NOTE_MAX_LENGTH,
      locale,
      softMaxLength: 240,
      prompt: promptFromRow('day-note', promptRes.data),
      call: claudeCaller(apiKey),
      log: async (call: AiCallRecord, payload: AiCallPayload) => {
        const { data, error } = await db.rpc('log_ai_call', { p_call: call, p_payload: payload });
        if (error) console.error('log_ai_call failed', error.code, error.message);
        return (data as number | null) ?? null;
      },
      meta: { userId, isTest: auth.user.user_metadata?.test_account === true },
    });
    if (!outcome.note) return json({ text: null });

    // Dwa wywołania naraz (np. dwa urządzenia): zostaje pierwsza zapisana notka.
    const { error } = await db.from('day_notes').upsert({ user_id: userId, day: today, text: outcome.note, locale }, { onConflict: 'user_id,day', ignoreDuplicates: true });
    if (error) console.error('day_notes save failed', error.code, error.message);
    return json({ text: outcome.note });
  } catch (e) {
    console.error('day-note failed', userId, e instanceof Error ? e.message : e);
    return json({ error: 'failed' }, 500);
  }
});
