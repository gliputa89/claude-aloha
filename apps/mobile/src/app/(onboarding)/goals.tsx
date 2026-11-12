import { continuousSteps } from '@aloha/plan-engine';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Ladder } from '@/components/goals/goal-progress';
import { OnboardingStep, StepSection } from '@/components/onboarding/onboarding-step';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { radius, space } from '@/constants/theme';
import { distanceLabel, goalDescription, goalLikeOfSpec, goalTitle, pluralKey } from '@/features/goals/labels';
import { recentTimeS, useOnboardingDraft } from '@/features/onboarding/draft';
import { goalsToSave, isGoalChecked, performanceTargetS, suggestedGoalsOf } from '@/features/onboarding/goals';
import { formatDuration, todayIso } from '@/features/onboarding/time';
import { sanityOf } from '@/features/onboarding/time-check';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

const LEVEL_TITLE = {
  none: 'onboarding.level.noneTitle',
  occasional: 'onboarding.level.occasionalTitle',
  regular: 'onboarding.level.regularTitle',
} as const;

/** Krok „Twoje cele” (makieta): cel prowadzący i cele obok, ułożone z odpowiedzi – do zmiany albo odznaczenia. */
export default function GoalsStep() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const { draft, update } = useOnboardingDraft();
  const suggested = suggestedGoalsOf(draft);
  const today = todayIso();
  const recent = recentTimeS(draft);

  if (!suggested) {
    return (
      <OnboardingStep step={5} title={t('onboarding.goals.title')} footer={<Button label={t('onboarding.next')} onPress={() => router.navigate('/goal')} />}>
        {null}
      </OnboardingStep>
    );
  }

  const primary = suggested.primary;
  const isPerformance = primary.kind === 'performance';
  const target = isPerformance ? performanceTargetS(draft, primary.targetTimeS) : null;
  const sanity = isPerformance && target && primary.distanceM ? sanityOf(primary.distanceM, target) : 'ok';
  const shownPrimary = isPerformance ? { ...primary, targetTimeS: target ?? null } : primary;
  const like = goalLikeOfSpec(shownPrimary);
  const valid = goalsToSave(draft) !== null && sanity !== 'impossible';

  const chips = [
    draft.level ? t(LEVEL_TITLE[draft.level]) : null,
    t(`goals.titleConsistency${pluralKey(draft.sessionsPerWeek)}`, { n: draft.sessionsPerWeek }),
    recent ? t('onboarding.goals.recent', { distance: distanceLabel(t, draft.recentDistanceM), time: formatDuration(recent) }) : null,
  ].filter((x): x is string => !!x);

  return (
    <OnboardingStep
      step={5}
      title={t('onboarding.goals.title')}
      subtitle={t('onboarding.goals.subtitle')}
      footer={<Button label={t('onboarding.next')} disabled={!valid} onPress={() => router.push('/summary')} />}>
      <View style={styles.chips}>
        {chips.map((chip) => (
          <View key={chip} style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text variant="caption" weight="semibold">
              {chip}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.block}>
        <View style={[styles.primary, { backgroundColor: c.surfaceBrand }]} accessible accessibilityLabel={`${t('onboarding.goals.leads')}. ${goalTitle(t, locale, like)}. ${goalDescription(t, locale, like, today)}`}>
          <Text variant="caption" weight="bold" color="textOnBrandMuted" style={styles.overline}>
            {t('onboarding.goals.leads')}
          </Text>
          <Text variant="heading" weight="extrabold" color="textOnBrand">
            {goalTitle(t, locale, like)}
          </Text>
          <Text variant="caption" color="textOnBrandMuted">
            {goalDescription(t, locale, like, today)}
          </Text>
          {primary.kind === 'continuous' && primary.targetMinutes ? (
            <Ladder steps={continuousSteps(primary.targetMinutes)} current={0} label={goalTitle(t, locale, like)} />
          ) : null}
        </View>

        {isPerformance ? (
          <StepSection
            label={t('onboarding.goals.targetLabel')}
            hint={primary.targetTimeS ? t('goalNew.timeRealistic', { time: formatDuration(primary.targetTimeS) }) : undefined}>
            <TextField
              label={t('goalNew.timeField')}
              placeholder={t('goalNew.timePlaceholder')}
              hint={t('goalNew.timeHint')}
              value={draft.performanceTime ?? (primary.targetTimeS ? formatDuration(primary.targetTimeS) : '')}
              onChangeText={(v) => update({ performanceTime: v })}
              error={
                target === undefined
                  ? t('onboarding.errors.timeInvalid')
                  : sanity === 'impossible'
                    ? t('onboarding.errors.timeImpossible')
                    : target === null && draft.performanceTime !== null
                      ? t('onboarding.goals.targetMissing')
                      : undefined
              }
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              maxLength={8}
            />
          </StepSection>
        ) : null}
      </View>

      {suggested.secondary.length > 0 ? (
        <StepSection label={t('onboarding.goals.also')} hint={t('onboarding.goals.alsoHint')}>
          {suggested.secondary.map((g, i) => {
            const item = goalLikeOfSpec(g.spec);
            const title = goalTitle(t, locale, item);
            const desc = goalDescription(t, locale, item, today);
            return (
              <View key={`${g.spec.kind}-${i}`} style={[styles.option, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Checkbox
                  checked={isGoalChecked(draft, i, g.checked)}
                  onChange={(checked) => update({ goalChecks: { ...draft.goalChecks, [i]: checked } })}
                  accessibilityLabel={`${title}. ${desc}`}
                  label={
                    <View style={styles.optionText}>
                      <Text weight="bold">{title}</Text>
                      <Text variant="caption">{desc}</Text>
                    </View>
                  }
                />
              </View>
            );
          })}
        </StepSection>
      ) : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: -space[2] },
  chip: { paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.pill, borderWidth: 1 },
  block: { gap: space[4] },
  primary: { gap: space[2], padding: space[4], borderRadius: radius.card },
  overline: { textTransform: 'uppercase', letterSpacing: 0.6 },
  option: { paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.card, borderWidth: 1.5 },
  optionText: { gap: 2 },
});
