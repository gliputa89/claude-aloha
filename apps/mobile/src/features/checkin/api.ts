import type { CheckInReason, CheckInTag } from '@aloha/plan-engine';
import { useEffect, useSyncExternalStore } from 'react';

import { HEALTH_CONSENT_VERSION } from '@/features/onboarding/save';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** Propozycja po check-inie: co było w planie i co proponujemy zamiast tego. */
export type CheckInProposal = {
  id: string;
  reason: CheckInReason;
  from: { type: string; durationMin: number | null };
  to: { type: string; durationMin: number | null };
};

export type CheckIn = {
  wellbeing: number;
  tags: CheckInTag[];
  /** Nierozstrzygnięta propozycja zmiany dzisiejszego treningu (albo jej brak). */
  proposal: CheckInProposal | null;
  /** Co biegacz zrobił z ostatnią propozycją do tego check-inu. */
  decided: 'accepted' | 'rejected' | null;
};

type AdjustmentRow = {
  id: string;
  rationale: string;
  status: 'proposed' | 'accepted' | 'rejected';
  diff: { change?: { type: string | null; durationMin: number | null }; from?: { type: string; durationMin: number | null } };
};

/** Dzisiejszy check-in z bazy (z propozycją, jeśli jest); `null` – jeszcze nie odpowiedziano. Błąd = brak check-inu. */
export async function fetchCheckIn(day: string): Promise<CheckIn | null> {
  const found = await supabase.from('check_ins').select('id, wellbeing, tags, skipped').eq('day', day).maybeSingle();
  if (found.error || !found.data || found.data.skipped || !found.data.wellbeing) return null;
  const latest = await supabase
    .from('adjustments')
    .select('id, rationale, status, diff')
    .eq('check_in_id', found.data.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = (latest.data as AdjustmentRow | null) ?? null;
  const from = row?.diff.from;
  const change = row?.diff.change;
  return {
    wellbeing: found.data.wellbeing as number,
    tags: (found.data.tags ?? []) as CheckInTag[],
    proposal:
      row && row.status === 'proposed' && from && change
        ? { id: row.id, reason: row.rationale as CheckInReason, from, to: { type: change.type ?? from.type, durationMin: change.durationMin } }
        : null,
    decided: row && row.status !== 'proposed' ? row.status : null,
  };
}

/** Zapisuje odpowiedź na dziś (kolejna zastępuje poprzednią) i zwraca propozycję z reguł – albo jej brak. `null` – błąd. */
export async function submitCheckIn(wellbeing: number, tags: CheckInTag[]): Promise<CheckIn | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      checkIn?: { wellbeing: number; tags: CheckInTag[] };
      proposal?: CheckInProposal | null;
    }>('check-in', { method: 'POST', body: { action: 'submit', wellbeing, tags } });
    if (error || !data?.checkIn) return null;
    return { ...data.checkIn, proposal: data.proposal ?? null, decided: null };
  } catch {
    return null;
  }
}

/** Akceptuje albo odrzuca propozycję. `expired` – plan zmienił się w międzyczasie; `failed` – błąd sieci / serwera. */
export async function answerCheckIn(adjustmentId: string, accept: boolean): Promise<'accepted' | 'declined' | 'expired' | 'failed'> {
  try {
    const { data, error } = await supabase.functions.invoke<{ status?: 'accepted' | 'declined' | 'expired' }>('check-in', {
      method: 'POST',
      body: { action: 'answer', adjustmentId, accept },
    });
    return error || !data?.status ? 'failed' : data.status;
  } catch {
    return 'failed';
  }
}

// ───────────────────────── włącznik check-inu = zgoda na dane o zdrowiu ─────────────────────────

/** Stan zgody wspólny dla ekranów (Dzisiaj, Profil): `null` – jeszcze nie wiemy. */
let consent: { userId: string; granted: boolean | null } = { userId: '', granted: null };
const listeners = new Set<() => void>();
const publish = (next: typeof consent) => {
  consent = next;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Czy check-in jest włączony. Samopoczucie to dane o zdrowiu, więc włącznik jest po prostu zgodą 'health_data'
 * w dzienniku zgód – tą samą, o którą pyta ankieta i czat. Wyłączenie dopisuje wycofanie zgody.
 * `set` zwraca `false`, gdy zapis się nie udał (stan zostaje bez zmian).
 */
export function useCheckInEnabled(): { enabled: boolean | null; set: (on: boolean) => Promise<boolean> } {
  const userId = useAuth().session?.user.id ?? '';
  const state = useSyncExternalStore(subscribe, () => consent);

  useEffect(() => {
    if (!userId || (consent.userId === userId && consent.granted !== null)) return;
    publish({ userId, granted: null });
    supabase.rpc('has_consent', { uid: userId, consent_kind: 'health_data' }).then(({ data, error }) => {
      // Błąd odczytu = traktujemy jak brak zgody (nigdy nie pokazujemy check-inu „na zapas”).
      if (consent.userId === userId) publish({ userId, granted: !error && data === true });
    });
  }, [userId]);

  const set = async (on: boolean) => {
    if (!userId) return false;
    const { error } = await supabase.from('consents').insert({ user_id: userId, kind: 'health_data', granted: on, version: HEALTH_CONSENT_VERSION });
    if (error) return false;
    publish({ userId, granted: on });
    return true;
  };

  return { enabled: state.userId === userId ? state.granted : null, set };
}
