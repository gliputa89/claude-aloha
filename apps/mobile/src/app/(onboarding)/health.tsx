import { router } from 'expo-router';
import { FirstAidKit, Info } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { OnboardingStep, StepSection } from '@/components/onboarding/onboarding-step';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useOnboardingDraft } from '@/features/onboarding/draft';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

export default function HealthStep() {
  const t = useT();
  const c = useColors();
  const { draft, update } = useOnboardingDraft();

  return (
    <OnboardingStep
      step={4}
      title={t('onboarding.health.title')}
      subtitle={t('onboarding.health.subtitle')}
      footer={
        <Button
          label={t('onboarding.next')}
          disabled={draft.contraindications === null}
          onPress={() => router.push('/summary')}
        />
      }>
      <StepSection label={t('onboarding.health.question')}>
        <View style={styles.chips} accessibilityRole="radiogroup">
          <Chip
            fill
            label={t('onboarding.health.no')}
            selected={draft.contraindications === false}
            onPress={() => update({ contraindications: false })}
          />
          <Chip
            fill
            label={t('onboarding.health.yes')}
            selected={draft.contraindications === true}
            onPress={() => update({ contraindications: true })}
          />
        </View>
        {draft.contraindications ? (
          <View style={[styles.note, { backgroundColor: c.surfaceAccentSoft }]} accessibilityLiveRegion="polite">
            <FirstAidKit size={20} weight="bold" color={c.textAccentStrong} />
            <Text variant="caption" weight="medium" color="textAccentStrong" style={styles.noteText}>
              {t('onboarding.health.yesAdvice')}
            </Text>
          </View>
        ) : null}
      </StepSection>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text variant="bodyStrong" weight="bold">
          {t('onboarding.health.consentTitle')}
        </Text>
        <Checkbox
          checked={draft.healthConsent}
          onChange={(healthConsent) => update({ healthConsent })}
          label={<Text variant="caption" color="text">{t('onboarding.health.consentLabel')}</Text>}
          accessibilityLabel={t('onboarding.health.consentLabel')}
        />
        <Text variant="caption">{t('onboarding.health.consentHint')}</Text>
      </View>

      <View style={styles.disclaimer}>
        <Info size={18} weight="bold" color={c.textMuted} />
        <Text variant="caption" style={styles.noteText}>
          {t('onboarding.health.disclaimer')}
        </Text>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space[2] },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[4],
    borderRadius: radius.card,
  },
  noteText: { flex: 1 },
  card: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
});
