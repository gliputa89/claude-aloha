import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';

export type StravaActivityRow = {
  id: number;
  session_id: string | null;
  sport_type: string;
  name: string | null;
  local_date: string;
  distance_m: number;
  moving_time_s: number;
};

export type StravaData =
  /** Baza bez migracji 20261110160000_strava. */
  | { available: false }
  | {
      available: true;
      /** Stan połączenia – bez tokenów (te nie wychodzą poza bazę i Edge Function). */
      connection: {
        athlete_id: number;
        athlete_name: string | null;
        last_synced_at: string | null;
        last_error: string | null;
        created_at: string;
      } | null;
      /** Ostatnie biegi pobrane ze Stravy. */
      activities: StravaActivityRow[];
      total: number;
      matched: number;
    };

/** Połączenie ze Stravą i pobrane biegi użytkownika – do karty w testerze. */
export async function loadStrava(userId: string): Promise<StravaData> {
  const db = createServiceClient();
  const [connection, activities, matched] = await Promise.all([
    db
      .from('strava_connections')
      .select('athlete_id, athlete_name, last_synced_at, last_error, created_at')
      .eq('user_id', userId)
      .maybeSingle(),
    db
      .from('strava_activities')
      .select('id, session_id, sport_type, name, local_date, distance_m, moving_time_s', { count: 'exact' })
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(8),
    db.from('strava_activities').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('session_id', 'is', null),
  ]);
  if (connection.error || activities.error) return { available: false };
  return {
    available: true,
    connection: connection.data,
    activities: (activities.data ?? []) as StravaActivityRow[],
    total: activities.count ?? 0,
    matched: matched.count ?? 0,
  };
}
