// Edge Function: check-in „Jak się dziś czujesz?” na karcie „Dzisiaj” – jedno tapnięcie, bez AI.
//
//   POST { action: 'submit', wellbeing: 1–5, tags?: string[] } → { checkIn, proposal }
//        zapisuje odpowiedź na dziś (jedna na dzień, kolejna ją zastępuje – dopóki trening nie został po niej zmieniony) i – przy słabszym dniu albo „mało czasu” –
//        zwraca łagodną propozycję zmiany dzisiejszego treningu (reguły: packages/plan-engine/src/checkin/checkin.ts).
//   POST { action: 'answer', adjustmentId, accept }           → { status } – akceptacja wykonuje zmianę w planie.
//
// Samopoczucie to dane o zdrowiu: funkcja działa tylko przy aktywnej zgodzie 'health_data' (inaczej `health_consent`).
// Propozycja ma kształt zmiany z czatu i przechodzi przez tę samą walidację i zapis (_shared/plan-change.ts) –
// jeden mechanizm zmian w planie. Podpowiedź „coś boli” niczego nie proponuje: aplikacja kieruje wtedy do czatu,
// a flaga bólu trafia do cotygodniowego przeglądu poziomu.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { applyPlanChange, checkChange, loadPlan } from '../_shared/plan-change.ts';
import { CHECKIN_TAGS, paramsOf, proposeFromCheckIn, type ChatChange } from '../_shared/plan-engine/index.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  try {
    const consent = await db.rpc('has_consent', { uid: userId, consent_kind: 'health_data' });
    if (consent.error) throw new Error(consent.error.message);
    if (consent.data !== true) return json({ error: 'health_consent' }, 403);

    if (body?.action === 'submit') {
      const wellbeing = Number(body.wellbeing);
      if (!Number.isInteger(wellbeing) || wellbeing < 1 || wellbeing > 5) return json({ error: 'invalid_wellbeing' }, 400);
      const tags = (Array.isArray(body.tags) ? body.tags : []).filter((t: unknown): t is string => (CHECKIN_TAGS as readonly unknown[]).includes(t));

      const loaded = await loadPlan(db, userId);
      const session = loaded.weeks
        .flatMap((w) => w.sessions)
        .find((s) => s.scheduled_on === loaded.today && s.type !== 'rest' && s.status === 'planned');

      // Trening został już dziś zmieniony po check-inie – sprawa zamknięta: nie zapisujemy nowej odpowiedzi
      // i nie proponujemy kolejnej zmiany (aplikacja nie pokazuje wtedy opcji „Zmień”).
      const existing = await db.from('check_ins').select('id, wellbeing, tags').eq('user_id', userId).eq('day', loaded.today).maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      if (existing.data) {
        const accepted = await db.from('adjustments').select('id').eq('check_in_id', existing.data.id).eq('status', 'accepted').limit(1);
        if (accepted.error) throw new Error(accepted.error.message);
        if ((accepted.data ?? []).length > 0) {
          return json({ checkIn: { wellbeing: existing.data.wellbeing, tags: existing.data.tags ?? [] }, proposal: null, decided: 'accepted' });
        }
      }

      const saved = await db
        .from('check_ins')
        .upsert(
          {
            user_id: userId,
            day: loaded.today,
            session_id: session?.id ?? null,
            skipped: false,
            wellbeing,
            tags,
            // Podpowiedź „coś boli” jest jawna – przegląd poziomu czyta tę flagę tak samo jak wyciągniętą z tekstu.
            ai_pain: tags.includes('pain'),
          },
          { onConflict: 'user_id,day' },
        )
        .select('id')
        .single();
      if (saved.error) throw new Error(saved.error.message);

      // Nowa odpowiedź zastępuje poprzednią – jej nierozstrzygnięta propozycja przestaje obowiązywać.
      const stale = await db.from('adjustments').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('check_in_id', saved.data.id).eq('status', 'proposed');
      if (stale.error) throw new Error(stale.error.message);

      const proposed =
        session && loaded.input
          ? proposeFromCheckIn({
              session: { date: session.scheduled_on, type: session.type, durationMin: session.duration_min },
              wellbeing,
              tags,
              minSessionMin: paramsOf(loaded.input).minSessionMin,
            })
          : null;
      // Propozycję pokazujemy tylko wtedy, gdy da się ją wykonać na aktualnym planie.
      if (!proposed || !checkChange(proposed.change, loaded).ok) return json({ checkIn: { wellbeing, tags }, proposal: null });

      const adjustment = await db
        .from('adjustments')
        .insert({
          user_id: userId,
          check_in_id: saved.data.id,
          level: proposed.level,
          diff: { change: proposed.change, from: { type: session!.type, durationMin: session!.duration_min } },
          rationale: proposed.reason,
          source: 'rules',
        })
        .select('id')
        .single();
      if (adjustment.error) throw new Error(adjustment.error.message);
      return json({
        checkIn: { wellbeing, tags },
        proposal: {
          id: adjustment.data.id,
          reason: proposed.reason,
          from: { type: session!.type, durationMin: session!.duration_min },
          to: { type: proposed.change.type ?? session!.type, durationMin: proposed.change.durationMin },
        },
      });
    }

    if (body?.action === 'answer') {
      if (typeof body.adjustmentId !== 'string' || !UUID.test(body.adjustmentId) || typeof body.accept !== 'boolean') {
        return json({ error: 'invalid_answer' }, 400);
      }
      const found = await db.from('adjustments').select('id, diff, status').eq('id', body.adjustmentId).eq('user_id', userId).maybeSingle();
      if (found.error) throw new Error(found.error.message);
      if (!found.data || found.data.status !== 'proposed') return json({ error: 'no_proposal' }, 404);
      const decide = (status: 'accepted' | 'rejected') =>
        db.from('adjustments').update({ status, decided_at: new Date().toISOString() }).eq('id', body.adjustmentId);
      if (!body.accept) {
        await decide('rejected');
        return json({ status: 'declined' });
      }
      const change = (found.data.diff as { change?: ChatChange }).change;
      // Plan zmienił się od czasu propozycji (albo trening już zrobiony) – propozycja wygasa, nic nie ruszamy.
      if (!change || (await applyPlanChange(db, await loadPlan(db, userId), change)) === 'expired') {
        await decide('rejected');
        return json({ status: 'expired' });
      }
      await decide('accepted');
      return json({ status: 'accepted' });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('check-in failed', userId, e);
    return json({ error: 'check_in_failed' }, 500);
  }
});
