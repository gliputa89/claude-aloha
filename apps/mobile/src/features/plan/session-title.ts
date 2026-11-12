import type { TranslationKey } from '@aloha/i18n';

/** Start kontrolny (zawody B) albo sprawdzian z celu wynikowego – zapisane w strukturze startu. */
export function checkpointOf(session: { type: string; structure: unknown }): 'B' | 'trial' | null {
  if (session.type !== 'race' || !session.structure || typeof session.structure !== 'object') return null;
  const cp = (session.structure as { checkpoint?: unknown }).checkpoint;
  return cp === 'B' || cp === 'trial' ? cp : null;
}

/** Klucz nazwy treningu: typ, a dla startów z celów obok – „Sprawdzian” / „Start kontrolny”. */
export function sessionTitleKey(session: { type: string; structure: unknown }): TranslationKey {
  const cp = checkpointOf(session);
  return cp === 'trial' ? 'workout.trial' : cp === 'B' ? 'workout.raceB' : (`workout.${session.type}` as TranslationKey);
}
