import './supabase-storage';

/**
 * Ostatnie dane ekranów (plan, pogoda, notka dnia) zapamiętane na telefonie: „Dzisiaj” pokazuje je od razu
 * po starcie i po ankiecie, a świeże dociąga w tle. Każdy wpis należy do konta – po zmianie konta
 * cudzy wpis jest pomijany, a wylogowanie czyści wszystko.
 */
const PREFIX = 'aloha.cache.';

export type CacheKey = 'plan' | 'weather' | 'dayNote';

type Entry<T> = { owner: string; data: T };

export function readCache<T>(key: CacheKey, owner: string | null | undefined): T | null {
  if (!owner) return null;
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    return entry.owner === owner ? entry.data : null;
  } catch {
    return null;
  }
}

/** Zapisuje (albo, z `null`, usuwa) wpis. Błąd zapisu niczego nie blokuje – dane i tak są w pamięci. */
export function writeCache<T>(key: CacheKey, owner: string | null | undefined, data: T | null) {
  if (!owner) return;
  try {
    if (typeof localStorage === 'undefined') return;
    if (data === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify({ owner, data } satisfies Entry<T>));
  } catch {
    // jak wyżej
  }
}

/** Wylogowanie / usunięcie konta: na telefonie nie zostają dane planu. */
export function clearCache() {
  const keys: CacheKey[] = ['plan', 'weather', 'dayNote'];
  try {
    if (typeof localStorage === 'undefined') return;
    for (const key of keys) localStorage.removeItem(PREFIX + key);
  } catch {
    // jak wyżej
  }
}
