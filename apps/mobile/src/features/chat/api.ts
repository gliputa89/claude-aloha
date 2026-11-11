import type { ChatChange } from '@aloha/plan-engine';

import { HEALTH_CONSENT_VERSION } from '@/features/onboarding/save';
import { supabase } from '@/lib/supabase';

export type CoachKind = 'ai' | 'human';

export type Coach = {
  id: string;
  kind: CoachKind;
  display_name: string;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export type ChatMessage = {
  id: number;
  thread_id: string;
  sender: 'user' | 'coach';
  body: string;
  /** Propozycja zmiany planu od trenera i co biegacz z nią zrobił. */
  proposal: ChatChange | null;
  proposal_status: 'pending' | 'accepted' | 'declined' | 'expired' | null;
  created_at: string;
};

/** `health_consent` – wiadomość dotyczy zdrowia, a biegacz nie dał jeszcze zgody na takie dane (nic nie zostało zapisane). */
export type ChatError = 'module_disabled' | 'no_coach' | 'limit' | 'ai_unavailable' | 'health_consent' | 'failed';

const MESSAGE_COLUMNS = 'id, thread_id, sender, body, proposal, proposal_status, created_at';

async function call<T>(body: Record<string, unknown>): Promise<(T & { error?: ChatError }) | { error: ChatError }> {
  try {
    const { data, error } = await supabase.functions.invoke<T & { error?: ChatError }>('coach-chat', { method: 'POST', body });
    if (error) {
      // Treść błędu funkcji (np. limit, wyłączony moduł) siedzi w odpowiedzi HTTP.
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
      return { error: (detail?.error as ChatError | undefined) ?? 'failed' };
    }
    return data ?? { error: 'failed' };
  } catch {
    return { error: 'failed' };
  }
}

/** Otwiera (albo zakłada) wątek z trenerem: ogólny albo przy treningu `sessionId`. */
export const openChat = (coach: CoachKind, sessionId?: string) =>
  call<{ thread: { id: string; sessionId: string | null }; coach: Coach; messages: ChatMessage[] }>({ action: 'open', coach, sessionId });

/** Wysyła wiadomość; przy trenerze AI wraca od razu z jego odpowiedzią. */
export const sendChat = (threadId: string, text: string) => call<{ messages: ChatMessage[] }>({ action: 'send', threadId, text });

/** Akceptuje albo odrzuca propozycję zmiany planu. `expired` – plan zmienił się w międzyczasie. */
export const answerProposal = (messageId: number, accept: boolean) =>
  call<{ status: 'accepted' | 'declined' | 'expired' }>({ action: 'answer', messageId, accept });

/** Zapisuje zgodę na przetwarzanie danych o zdrowiu (dziennik zgód) – raz, przy pierwszej rozmowie o zdrowiu. */
export async function grantHealthConsent(userId: string): Promise<boolean> {
  const { error } = await supabase.from('consents').insert({ user_id: userId, kind: 'health_data', granted: true, version: HEALTH_CONSENT_VERSION });
  return !error;
}

/** Nowsze wiadomości wątku prosto z bazy (odpowiedzi trenera-człowieka przychodzą z panelu). */
export async function fetchNewMessages(threadId: string, afterId: number): Promise<ChatMessage[]> {
  const { data, error } = await supabase.from('chat_messages').select(MESSAGE_COLUMNS).eq('thread_id', threadId).gt('id', afterId).order('id');
  return error ? [] : ((data ?? []) as ChatMessage[]);
}
