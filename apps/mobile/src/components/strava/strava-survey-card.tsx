import type { StravaSurveyProposal } from '@aloha/plan-engine';
import type { TranslationKey } from '@aloha/i18n';
import { CheckCircle, Lightning } from 'phosphor-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { connectStrava, fetchStravaSurvey } from '@/features/strava/api';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

type Phase = 'idle' | 'connecting' | 'analyzing';

type StravaSurveyCardProps = {
  /** Propozycja już wczytana do ankiety (`null` – jeszcze nie połączono). */
  proposal: StravaSurveyProposal | null;
  onProposal: (proposal: StravaSurveyProposal) => void;
};

/**
 * Ankieta startowa, krok „Jak teraz biegasz?”: zamiast odpowiadać na pytania, biegacz łączy Stravę, a my
 * uzupełniamy odpowiedzi z jego biegów z ostatnich 2 miesięcy. Pytania zostają pod kartą – dla osób bez Stravy
 * i do poprawienia propozycji.
 */
export function StravaSurveyCard({ proposal, onProposal }: StravaSurveyCardProps) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<TranslationKey | null>(null);

  const start = async () => {
    setError(null);
    // Konto mogło być połączone wcześniej (np. powrót do ankiety) – wtedy ekran zgody Stravy nie jest potrzebny.
    setPhase('analyzing');
    let result = await fetchStravaSurvey();
    if (result.status === 'not_connected') {
      setPhase('connecting');
      const connected = await connectStrava('/level');
      if (connected !== 'connected') {
        setPhase('idle');
        if (connected !== 'cancelled') {
          setError(
            ({ no_activity_scope: 'profile.stravaNoScope', athlete_limit: 'profile.stravaLimit', failed: 'profile.stravaConnectFailed' } as const)[
              connected
            ],
          );
        }
        return;
      }
      setPhase('analyzing');
      result = await fetchStravaSurvey();
    }
    setPhase('idle');
    if (result.status === 'ready') onProposal(result.proposal);
    else setError('onboarding.level.strava.failed');
  };

  const km = (m: number) => (m / 1000).toLocaleString(locale === 'en' ? 'en-GB' : 'pl-PL', { maximumFractionDigits: m < 10_000 ? 1 : 0 });

  if (proposal) {
    const enough = proposal.level !== 'beginner';
    return (
      <View style={[styles.card, { backgroundColor: c.surfaceBrandSoft, borderColor: c.surfaceBrandSoft }]} accessibilityRole="summary">
        <View style={styles.head}>
          <CheckCircle size={24} weight="bold" color={c.textBrand} />
          <Text weight="bold" color="textBrand" style={styles.flex}>
            {t(enough ? 'onboarding.level.strava.doneTitle' : 'onboarding.level.strava.tooFewTitle')}
          </Text>
        </View>
        {enough ? (
          <>
            <Text variant="caption" weight="medium" color="text">
              {t('onboarding.level.strava.doneStats', {
                runs: proposal.runs,
                weeklyKm: km(proposal.weeklyDistanceM),
                longestKm: km(proposal.longestRunM),
              })}
            </Text>
            <Text variant="caption" color="text">
              {[
                proposal.recentResult
                  ? t(proposal.recentResult.fromRace ? 'onboarding.level.strava.resultRace' : 'onboarding.level.strava.resultEstimate')
                  : null,
                t('onboarding.level.strava.doneCheck'),
              ]
                .filter(Boolean)
                .join(' ')}
            </Text>
          </>
        ) : (
          <Text variant="caption" color="text">
            {t('onboarding.level.strava.tooFew')}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
            <Lightning size={20} weight="bold" color={c.textBrand} />
          </View>
          <Text variant="heading" style={styles.flex}>
            {t('onboarding.level.strava.title')}
          </Text>
        </View>
        {phase === 'analyzing' ? (
          <View style={styles.busy} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
            <ActivityIndicator color={c.action} />
            <Text variant="caption" style={styles.flex}>
              {t('onboarding.level.strava.analyzing')}
            </Text>
          </View>
        ) : (
          <>
            <Text variant="caption">{t('onboarding.level.strava.body')}</Text>
            <Button label={t('onboarding.level.strava.connect')} loading={phase === 'connecting'} onPress={start} />
          </>
        )}
      </View>
      {error ? <Notice message={t(error)} /> : null}
      <Text variant="label" color="textMuted">
        {t('onboarding.level.strava.manual')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  card: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52 },
  flex: { flex: 1 },
});
