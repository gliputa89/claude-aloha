import { RACE_DISTANCES_M } from '@aloha/plan-engine';
import { router } from 'expo-router';
import { Couch, PersonSimpleRun, PersonSimpleWalk } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { OnboardingStep, StepSection } from '@/components/onboarding/onboarding-step';
import { StravaSurveyCard } from '@/components/strava/strava-survey-card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { OptionCard } from '@/components/ui/option-card';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import { space } from '@/constants/theme';
import { useUnits } from '@/lib/locale-preference';
import { draftFromStrava, recentTimeS, useOnboardingDraft, weeklyKmOf, type LevelChoice } from '@/features/onboarding/draft';
import { useModule } from '@/features/modules/use-module';
import { confirmEliteTime, sanityOf } from '@/features/onboarding/time-check';
import { useT } from '@/hooks/use-t';

const LEVELS = [
  { id: 'none', icon: Couch, title: 'onboarding.level.noneTitle', desc: 'onboarding.level.noneDesc' },
  { id: 'occasional', icon: PersonSimpleWalk, title: 'onboarding.level.occasionalTitle', desc: 'onboarding.level.occasionalDesc' },
  { id: 'regular', icon: PersonSimpleRun, title: 'onboarding.level.regularTitle', desc: 'onboarding.level.regularDesc' },
] as const;

const DEFAULT_RUNS: Record<LevelChoice, number> = { none: 0, occasional: 1, regular: 3 };

export default function LevelStep() {
  const t = useT();
  const { draft, update } = useOnboardingDraft();
  const runs = draft.level && draft.level !== 'none';
  const recent = recentTimeS(draft);
  const weeklyKm = weeklyKmOf(draft);
  const miles = useUnits() === 'imperial';
  // Wynik szybszy niż rekord świata to pomyłka we wpisie – nie puszczamy dalej; poziom zawodowy – dopytujemy.
  const sanity = sanityOf(draft.recentDistanceM, recent);
  const valid = !!draft.level && recent !== undefined && weeklyKm !== undefined && sanity !== 'impossible';
  const next = () => {
    const go = () => router.push('/availability');
    if (sanity === 'elite' && recent) confirmEliteTime(t, draft.recentDistanceM, recent, go);
    else go();
  };
  // Strava jest modułem pakietu – bez niego zostają same pytania.
  const stravaModule = useModule('strava');

  return (
    <OnboardingStep
      step={2}
      title={t('onboarding.level.title')}
      subtitle={t('onboarding.level.subtitle')}
      footer={<Button label={t('onboarding.next')} disabled={!valid} onPress={next} />}>
      {stravaModule ? (
        <StravaSurveyCard proposal={draft.strava} onProposal={(proposal) => update(draftFromStrava(proposal, draft))} />
      ) : null}

      <View style={styles.options} accessibilityRole="radiogroup">
        {LEVELS.map((l) => (
          <OptionCard
            key={l.id}
            icon={l.icon}
            title={t(l.title)}
            description={t(l.desc)}
            selected={draft.level === l.id}
            onPress={() => update({ level: l.id, runsPerWeek: DEFAULT_RUNS[l.id] })}
          />
        ))}
      </View>

      {runs ? (
        <>
          <StepSection label={t('onboarding.level.runsLabel')}>
            <Stepper
              value={draft.runsPerWeek}
              min={1}
              max={7}
              onChange={(runsPerWeek) => update({ runsPerWeek })}
              label={t('onboarding.level.runsLabel')}
              decreaseLabel={t('onboarding.availability.decrease')}
              increaseLabel={t('onboarding.availability.increase')}
            />
          </StepSection>

          <StepSection label={t(miles ? 'onboarding.level.weeklyMiLabel' : 'onboarding.level.weeklyKmLabel')}>
            <TextField
              label={t(miles ? 'onboarding.level.weeklyMiField' : 'onboarding.level.weeklyKmField')}
              placeholder={t(miles ? 'onboarding.level.weeklyMiPlaceholder' : 'onboarding.level.weeklyKmPlaceholder')}
              hint={t('onboarding.level.weeklyKmHint')}
              value={draft.weeklyKm}
              onChangeText={(v) => update({ weeklyKm: v })}
              error={weeklyKm === undefined ? t(miles ? 'onboarding.errors.weeklyMiInvalid' : 'onboarding.errors.weeklyKmInvalid') : undefined}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </StepSection>

          <StepSection label={t('onboarding.level.resultLabel')}>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {RACE_DISTANCES_M.map((d) => (
                <Chip
                  key={d}
                  label={t(`onboarding.distance.d${d}`)}
                  selected={draft.recentDistanceM === d}
                  onPress={() => update({ recentDistanceM: d })}
                />
              ))}
            </View>
            <TextField
              label={t('onboarding.level.resultTimeLabel')}
              placeholder={t('onboarding.level.resultPlaceholder')}
              hint={t('onboarding.level.resultHint')}
              value={draft.recentTime}
              onChangeText={(v) => update({ recentTime: v })}
              error={recent === undefined ? t('onboarding.errors.timeInvalid') : sanity === 'impossible' ? t('onboarding.errors.timeImpossible') : undefined}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              maxLength={8}
            />
          </StepSection>
        </>
      ) : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  options: { gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
