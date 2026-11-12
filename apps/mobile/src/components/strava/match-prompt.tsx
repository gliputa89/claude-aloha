import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TYPE_COLOR } from '@/components/plan/session-row';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { fromIsoDate } from '@/features/onboarding/time';
import type { PlanSession } from '@/features/plan/api';
import { allSessions, usePlan } from '@/features/plan/plan-provider';
import { answerStravaMatch, type StravaSuggestion } from '@/features/strava/api';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { sessionTitleKey } from '@/features/plan/session-title';

/**
 * „To był ten trening?” – bieg ze Stravy z innego dnia niż trening w planie (np. środowy zrobiony w czwartek).
 * Aplikacja tylko pyta; trening odhacza dopiero odpowiedź „tak”. `sessionId` zawęża do jednego treningu.
 */
export function MatchPrompts({ sessionId }: { sessionId?: string }) {
  const { state } = usePlan();
  if (state.kind !== 'ready') return null;
  const sessions = allSessions(state.plan);
  return state.plan.suggestions
    .filter((s) => !sessionId || s.suggested_session_id === sessionId)
    .map((suggestion) => {
      const session = sessions.find((s) => s.id === suggestion.suggested_session_id);
      return session ? <MatchPrompt key={suggestion.id} suggestion={suggestion} session={session} /> : null;
    });
}

function MatchPrompt({ suggestion, session }: { suggestion: StravaSuggestion; session: PlanSession }) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const { refresh } = usePlan();
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [failed, setFailed] = useState(false);

  const tag = locale === 'en' ? 'en-GB' : 'pl-PL';
  const weekday = (iso: string) => fromIsoDate(iso).toLocaleDateString(tag, { weekday: 'long' });
  const km = (m: number) => `${(m / 1000).toLocaleString(tag, { maximumFractionDigits: 1 })} km`;
  const run = [
    weekday(suggestion.local_date),
    suggestion.distance_m > 0 ? km(suggestion.distance_m) : null,
    t('workout.minutes', { n: Math.round(suggestion.moving_time_s / 60) }),
  ].filter(Boolean);
  const planned = [
    weekday(session.scheduled_on),
    t(sessionTitleKey(session)),
    session.duration_min ? t('workout.minutes', { n: session.duration_min }) : session.distance_m ? km(session.distance_m) : null,
  ].filter(Boolean);

  const answer = async (accept: boolean) => {
    setBusy(accept ? 'yes' : 'no');
    setFailed(false);
    if (await answerStravaMatch(suggestion.id, accept)) await refresh();
    else setFailed(true);
    setBusy(null);
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text weight="bold" accessibilityRole="header">
        {t('match.title')}
      </Text>
      <View style={styles.lines}>
        <Text variant="caption" color="text">
          {t('match.run', { details: run.join(' · ') })}
        </Text>
        <View style={styles.planned}>
          <View style={[styles.dot, { backgroundColor: c[TYPE_COLOR[session.type]] }]} />
          <Text variant="caption" color="text" style={styles.flex}>
            {t('match.planned', { details: planned.join(' · ') })}
          </Text>
        </View>
      </View>
      {failed ? <Text variant="caption">{t('match.failed')}</Text> : null}
      <View style={styles.actions}>
        <Button label={t('match.yes')} loading={busy === 'yes'} disabled={busy !== null} onPress={() => answer(true)} />
        <Button
          variant="secondary"
          label={t('match.no')}
          loading={busy === 'no'}
          disabled={busy !== null}
          onPress={() => answer(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  lines: { gap: space[1] },
  planned: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  actions: { gap: space[2] },
});
