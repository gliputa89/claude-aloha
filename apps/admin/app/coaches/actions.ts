'use server';

import { refresh } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? '').trim().slice(0, max);

/** Nowy trener-człowiek (profil widoczny dla biegaczy w czacie). */
export async function addCoach(form: FormData) {
  await requireAdmin();
  const display_name = text(form, 'name', 80);
  if (!display_name) return;
  const { error } = await createServiceClient()
    .from('coaches')
    .insert({ kind: 'human', display_name, title: text(form, 'title', 120) || null, bio: text(form, 'bio', 1000) || null });
  if (error) console.error('addCoach failed', error.code, error.message);
  refresh();
}

/** Włącza albo wyłącza trenera (wyłączony nie dostaje nowych biegaczy i znika z aplikacji). */
export async function setCoachActive(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  const { error } = await createServiceClient().from('coaches').update({ active: form.get('active') === 'true' }).eq('id', id).eq('kind', 'human');
  if (error) console.error('setCoachActive failed', error.code, error.message);
  refresh();
}

/** Odpowiedź trenera-człowieka w wątku biegacza (pisana z panelu). */
export async function replyAsCoach(form: FormData) {
  await requireAdmin();
  const threadId = String(form.get('threadId') ?? '');
  const body = text(form, 'body', 4000);
  if (!UUID.test(threadId) || !body) return;
  const db = createServiceClient();
  const thread = await db.from('chat_threads').select('id, user_id, coaches(kind)').eq('id', threadId).maybeSingle();
  // Z panelu odpowiadamy tylko w wątkach trenerów-ludzi – za Pana Aloha odpowiada model.
  if (!thread.data || (thread.data.coaches as unknown as { kind: string } | null)?.kind !== 'human') return;
  const { error } = await db.from('chat_messages').insert({ thread_id: threadId, user_id: thread.data.user_id, sender: 'coach', body });
  if (error) console.error('replyAsCoach failed', error.code, error.message);
  else await db.from('chat_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId);
  refresh();
}

/** Pakiet biegacza (free / trial / paid) – rozmowa z prawdziwym trenerem jest tylko w trial i paid. */
export async function setUserPackage(form: FormData) {
  await requireAdmin();
  const userId = String(form.get('userId') ?? '').trim();
  const status = String(form.get('status') ?? '');
  if (!UUID.test(userId) || !['free', 'trial', 'paid'].includes(status)) return;
  const { error } = await createServiceClient().from('profiles').update({ subscription_status: status }).eq('id', userId);
  if (error) console.error('setUserPackage failed', error.code, error.message);
  refresh();
}
