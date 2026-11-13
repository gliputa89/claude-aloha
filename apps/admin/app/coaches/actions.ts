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

/**
 * Trzech przykładowych trenerów do testów i makiet (dwóch mężczyzn, jedna kobieta). Dane są ZMYŚLONE, a zdjęcia
 * pochodzą z banku zdjęć (Unsplash, darmowa licencja) – profile mają is_demo = true i nie mogą trafić na stronę
 * jako prawdziwi trenerzy. Ponowne kliknięcie niczego nie dubluje.
 */
const DEMO_COACHES = [
  {
    display_name: 'Marek Zieliński',
    title: 'Trener biegania, maratończyk',
    title_en: 'Running coach, marathoner',
    headline: 'Pomagam zapracowanym dojść do pierwszej dychy i półmaratonu – bez kontuzji i bez wyrzutów sumienia.',
    headline_en: 'I help busy people reach their first 10K and half marathon – injury-free and guilt-free.',
    bio: 'Biegam od 15 lat, trenuję amatorów od 9. Zaczynałem jako typowy „biurowy” biegacz, więc wiem, jak wygląda trening wciśnięty między pracę a dom. Stawiam na regularność i spokojne budowanie formy: wolę trzy sensowne treningi w tygodniu przez rok niż pięć przez miesiąc. Prywatnie tata dwójki dzieci i fan biegania o świcie.',
    bio_en: 'I have been running for 15 years and coaching amateurs for 9. I started as a typical desk-job runner, so I know what training squeezed between work and home looks like. I focus on consistency and patient progress: three sensible runs a week for a year beat five a week for a month. Dad of two and a fan of sunrise runs.',
    specialties: ['pierwsze 10 km', 'półmaraton', 'bieganie przy pełnym etacie'],
    specialties_en: ['first 10K', 'half marathon', 'running with a full-time job'],
    experience_years: 9,
    city: 'Poznań',
    languages: ['pl', 'en'],
    avatar_url: 'https://images.unsplash.com/photo-1757620765404-a1ee66df5e27?w=640&h=640&fit=crop&crop=faces&q=80',
    photo_credit: 'Unsplash (photo-1757620765404-a1ee66df5e27), licencja Unsplash',
    sort_order: 1,
  },
  {
    display_name: 'Karolina Maj',
    title: 'Trenerka biegania, fizjoterapeutka',
    title_en: 'Running coach, physiotherapist',
    headline: 'Powroty po przerwie i kontuzji. Uczę biegać tak, żeby ciało nadążało za ambicją.',
    headline_en: 'Comebacks after a break or injury. I teach running so the body keeps up with the ambition.',
    bio: 'Z wykształcenia fizjoterapeutka, z zamiłowania biegaczka górska. Od 7 lat prowadzę osoby, które wracają do biegania po kontuzji, ciąży albo długiej przerwie. Dużo rozmawiam o regeneracji, śnie i sile – bo to one najczęściej decydują, czy plan się uda. Nie wierzę w „zaciskanie zębów”; wierzę w mądre dawkowanie obciążeń.',
    bio_en: 'A physiotherapist by training and a trail runner at heart. For 7 years I have coached people returning to running after injury, pregnancy or a long break. I talk a lot about recovery, sleep and strength – they usually decide whether a plan works. I do not believe in gritting your teeth; I believe in dosing load wisely.',
    specialties: ['powrót po kontuzji', 'bieganie po ciąży', 'siła i regeneracja'],
    specialties_en: ['return from injury', 'postpartum running', 'strength and recovery'],
    experience_years: 7,
    city: 'Kraków',
    languages: ['pl', 'en'],
    avatar_url: 'https://images.unsplash.com/photo-1544507888-56d73eb6046e?w=640&h=640&fit=crop&crop=faces&q=80',
    photo_credit: 'Unsplash (photo-1544507888-56d73eb6046e), licencja Unsplash',
    sort_order: 2,
  },
  {
    display_name: 'Tomasz Wrona',
    title: 'Trener przygotowania do maratonu',
    title_en: 'Marathon preparation coach',
    headline: 'Maraton i życiówki dla tych, którzy biegają już regularnie i chcą zrobić krok dalej.',
    headline_en: 'Marathons and personal bests for runners who already train regularly and want the next step.',
    bio: 'Były zawodnik na 5 i 10 km, dziś trener amatorów celujących w maraton. Przez 12 lat pracy przeprowadziłem przez metę ponad 200 debiutantów. Lubię liczby, ale nie pozwalam, żeby rządziły treningiem: tempo ma służyć Tobie, nie odwrotnie. Najbardziej cieszy mnie, gdy ktoś po roku pisze, że bieganie wciąż daje frajdę.',
    bio_en: 'A former 5K and 10K competitor, now coaching amateurs aiming for the marathon. In 12 years I have taken more than 200 first-timers to the finish line. I like numbers but never let them run the training: pace should serve you, not the other way round. My favourite message is one a year later saying running is still fun.',
    specialties: ['maraton', 'życiówka na 10 km', 'trening tempowy'],
    specialties_en: ['marathon', '10K personal best', 'tempo training'],
    experience_years: 12,
    city: 'Warszawa',
    languages: ['pl'],
    avatar_url: 'https://images.unsplash.com/photo-1639989889751-7803c2e3c440?w=640&h=640&fit=crop&crop=faces&q=80',
    photo_credit: 'Unsplash (photo-1639989889751-7803c2e3c440), licencja Unsplash',
    sort_order: 3,
  },
] as const;

export async function addDemoCoaches() {
  await requireAdmin();
  const db = createServiceClient();
  const existing = await db.from('coaches').select('display_name').eq('is_demo', true);
  if (existing.error) return console.error('addDemoCoaches failed', existing.error.code, existing.error.message);
  const have = new Set((existing.data ?? []).map((c) => c.display_name as string));
  const missing = DEMO_COACHES.filter((c) => !have.has(c.display_name)).map((c) => ({ ...c, kind: 'human', is_demo: true, specialties: [...c.specialties], specialties_en: [...c.specialties_en], languages: [...c.languages] }));
  if (missing.length > 0) {
    const { error } = await db.from('coaches').insert(missing);
    if (error) console.error('addDemoCoaches failed', error.code, error.message);
  }
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
