import { getCalendars } from 'expo-localization';

import { supabase } from '@/lib/supabase';

import { LEVEL_TO_DB, recentTimeS, targetTimeS, type OnboardingDraft } from './draft';

/** Wersja treści zgody na dane zdrowotne (zapisywana w public.consents). */
export const HEALTH_CONSENT_VERSION = '2026-11';

/** Zapisuje całą ankietę jednym wywołaniem (RPC public.complete_onboarding – jedna transakcja). */
export async function completeOnboarding(draft: OnboardingDraft) {
  if (!draft.goal || !draft.level || draft.contraindications === null) {
    throw new Error('Niepełna ankieta');
  }
  const isRace = draft.goal === 'race';
  const { error } = await supabase.rpc('complete_onboarding', {
    p_goal_type: isRace ? 'race' : 'general',
    p_general_focus: isRace ? null : draft.goal,
    p_distance_m: isRace ? draft.raceDistanceM : null,
    p_race_date: isRace ? draft.raceDate : null,
    p_target_time_s: isRace ? (targetTimeS(draft) ?? null) : null,
    p_plan_starts_on: draft.planStartDate,
    p_level: LEVEL_TO_DB[draft.level],
    p_recent_distance_m: recentTimeS(draft) ? draft.recentDistanceM : null,
    p_recent_time_s: recentTimeS(draft) ?? null,
    p_current_runs_per_week: draft.level === 'none' ? 0 : draft.runsPerWeek,
    p_preferred_days: [...draft.days].sort((a, b) => a - b),
    p_sessions_per_week: draft.sessionsPerWeek,
    p_max_minutes_weekday: draft.maxWeekday,
    p_max_minutes_weekend: draft.maxWeekend,
    p_has_contraindications: draft.contraindications,
    p_health_consent: draft.healthConsent,
    p_consent_version: HEALTH_CONSENT_VERSION,
    p_timezone: getCalendars()[0]?.timeZone ?? '',
  });
  if (error) throw error;
}
