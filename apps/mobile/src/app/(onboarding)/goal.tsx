import { RACE_DISTANCES_M } from '@aloha/plan-engine';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router } from 'expo-router';
import { CalendarCheck, SneakerMove, Trophy, TrendUp } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { OnboardingStep, StepSection } from '@/components/onboarding/onboarding-step';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { OptionCard } from '@/components/ui/option-card';
import { TextField } from '@/components/ui/text-field';
import { radius, space } from '@/constants/theme';
import { targetTimeS, useOnboardingDraft, type GoalChoice } from '@/features/onboarding/draft';
import { addDays, fromIsoDate, toIsoDate } from '@/features/onboarding/time';
import { confirmEliteTime, sanityOf } from '@/features/onboarding/time-check';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

const GOALS = [
  { id: 'start_running', icon: SneakerMove, title: 'onboarding.goal.startTitle', desc: 'onboarding.goal.startDesc' },
  { id: 'improve_fitness', icon: TrendUp, title: 'onboarding.goal.fitnessTitle', desc: 'onboarding.goal.fitnessDesc' },
  { id: 'run_regularly', icon: CalendarCheck, title: 'onboarding.goal.regularTitle', desc: 'onboarding.goal.regularDesc' },
  { id: 'race', icon: Trophy, title: 'onboarding.goal.raceTitle', desc: 'onboarding.goal.raceDesc' },
] as const;

export default function GoalStep() {
  const t = useT();
  const c = useColors();
  const { draft, update } = useOnboardingDraft();
  const isRace = draft.goal === 'race';
  const target = targetTimeS(draft);
  const tomorrow = addDays(new Date(), 1);
  const raceDate = draft.raceDate ? fromIsoDate(draft.raceDate) : addDays(new Date(), 12 * 7);

  const choose = (goal: GoalChoice) =>
    update({
      goal,
      // Domyślna data zawodów za 12 tygodni – użytkownik i tak ją zmieni.
      raceDate: goal === 'race' && !draft.raceDate ? toIsoDate(raceDate) : draft.raceDate,
    });

  // Czas szybszy niż rekord świata to pomyłka we wpisie – nie puszczamy dalej; poziom zawodowy – dopytujemy.
  const sanity = isRace ? sanityOf(draft.raceDistanceM, target) : 'ok';
  const valid = !!draft.goal && (!isRace || (!!draft.raceDate && target !== undefined && sanity !== 'impossible'));
  const next = () => {
    const go = () => router.push('/level');
    if (sanity === 'elite' && target) confirmEliteTime(t, draft.raceDistanceM, target, go);
    else go();
  };

  return (
    <OnboardingStep
      step={1}
      title={t('onboarding.goal.title')}
      subtitle={t('onboarding.goal.subtitle')}
      footer={<Button label={t('onboarding.next')} disabled={!valid} onPress={next} />}>
      <View style={styles.options} accessibilityRole="radiogroup">
        {GOALS.map((g) => (
          <OptionCard
            key={g.id}
            icon={g.icon}
            title={t(g.title)}
            description={t(g.desc)}
            selected={draft.goal === g.id}
            onPress={() => choose(g.id)}
          />
        ))}
      </View>

      {isRace ? (
        <View style={[styles.race, { backgroundColor: c.surface, borderColor: c.border }]}>
          <StepSection label={t('onboarding.goal.distanceLabel')}>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {RACE_DISTANCES_M.map((d) => (
                <Chip
                  key={d}
                  label={t(`onboarding.distance.d${d}`)}
                  selected={draft.raceDistanceM === d}
                  onPress={() => update({ raceDistanceM: d })}
                />
              ))}
            </View>
          </StepSection>

          <StepSection label={t('onboarding.goal.dateLabel')}>
            <DateTimePicker
              value={raceDate}
              mode="date"
              display="compact"
              minimumDate={tomorrow}
              maximumDate={addDays(new Date(), 2 * 365)}
              accentColor={c.action}
              onValueChange={(_e, date) => update({ raceDate: toIsoDate(date) })}
              style={styles.date}
            />
          </StepSection>

          <StepSection label={t('onboarding.goal.targetLabel')} hint={draft.targetSuggest ? t('onboarding.goal.targetUnknownHint') : undefined}>
            {draft.targetSuggest ? null : (
              <TextField
                label={t('onboarding.goal.targetField')}
                placeholder={t('onboarding.goal.targetPlaceholder')}
                hint={t('onboarding.goal.targetHint')}
                value={draft.targetTime}
                onChangeText={(v) => update({ targetTime: v })}
                error={target === undefined ? t('onboarding.errors.timeInvalid') : sanity === 'impossible' ? t('onboarding.errors.timeImpossible') : undefined}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                maxLength={8}
              />
            )}
            <Checkbox
              checked={draft.targetSuggest}
              onChange={(targetSuggest) => update({ targetSuggest })}
              label={t('onboarding.goal.targetUnknown')}
            />
          </StepSection>
        </View>
      ) : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  options: { gap: space[3] },
  race: { gap: space[5], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  date: { alignSelf: 'flex-start' },
});
