import type { TranslationKey } from '@aloha/i18n';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { OnboardingStep, StepSection } from '@/components/onboarding/onboarding-step';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { Stepper } from '@/components/ui/stepper';
import { space } from '@/constants/theme';
import { startBeforeRace, useOnboardingDraft } from '@/features/onboarding/draft';
import { addDays, fromIsoDate, toIsoDate } from '@/features/onboarding/time';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const WEEKDAY_MINUTES = [30, 45, 60, 90] as const;
const WEEKEND_MINUTES = [30, 45, 60, 90, 120] as const;

export default function AvailabilityStep() {
  const t = useT();
  const c = useColors();
  const { draft, update } = useOnboardingDraft();
  const startOk = startBeforeRace(draft);
  const maxSessions = Math.max(1, draft.days.length);

  const toggleDay = (day: number) => {
    const days = draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day];
    // Liczba treningów nie przekracza liczby dni. Dopóki użytkownik jej nie ruszał
    // (równa się liczbie dni), idzie razem z zaznaczaniem dni.
    const following = draft.days.length === 0 || draft.sessionsPerWeek === draft.days.length;
    const sessionsPerWeek = Math.max(1, following ? days.length : Math.min(draft.sessionsPerWeek, days.length));
    update({ days, sessionsPerWeek });
  };

  const valid = startOk && draft.days.length > 0 && draft.sessionsPerWeek >= 1 && draft.sessionsPerWeek <= draft.days.length;

  return (
    <OnboardingStep
      step={3}
      title={t('onboarding.availability.title')}
      subtitle={t('onboarding.availability.subtitle')}
      footer={<Button label={t('onboarding.next')} disabled={!valid} onPress={() => router.push('/health')} />}>
      <StepSection label={t('onboarding.availability.startLabel')} hint={t('onboarding.availability.startHint')}>
        <DateTimePicker
          value={fromIsoDate(draft.planStartDate)}
          mode="date"
          display="compact"
          minimumDate={new Date()}
          maximumDate={addDays(new Date(), 90)}
          accentColor={c.action}
          onValueChange={(_e, date) => update({ planStartDate: toIsoDate(date) })}
          style={styles.date}
        />
        {!startOk ? <Notice message={t('onboarding.errors.startAfterRace')} /> : null}
      </StepSection>

      <StepSection label={t('onboarding.availability.daysLabel')}>
        <View style={styles.days}>
          {DAYS.map((d) => (
            <Chip
              key={d}
              fill
              role="checkbox"
              label={t(`onboarding.day.short${d}` as TranslationKey)}
              accessibilityLabel={t(`onboarding.day.long${d}` as TranslationKey)}
              selected={draft.days.includes(d)}
              onPress={() => toggleDay(d)}
            />
          ))}
        </View>
      </StepSection>

      <StepSection label={t('onboarding.availability.sessionsLabel')} hint={t('onboarding.availability.sessionsHint')}>
        <Stepper
          value={Math.min(draft.sessionsPerWeek, maxSessions)}
          min={1}
          max={maxSessions}
          onChange={(sessionsPerWeek) => update({ sessionsPerWeek })}
          label={t('onboarding.availability.sessionsLabel')}
          decreaseLabel={t('onboarding.availability.decrease')}
          increaseLabel={t('onboarding.availability.increase')}
        />
      </StepSection>

      <StepSection label={t('onboarding.availability.weekdayLabel')}>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {WEEKDAY_MINUTES.map((m) => (
            <Chip
              key={m}
              fill
              label={t('onboarding.availability.minutes', { n: m })}
              selected={draft.maxWeekday === m}
              onPress={() => update({ maxWeekday: m })}
            />
          ))}
        </View>
      </StepSection>

      <StepSection label={t('onboarding.availability.weekendLabel')}>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {WEEKEND_MINUTES.map((m) => (
            <Chip
              key={m}
              fill
              label={t('onboarding.availability.minutes', { n: m })}
              selected={draft.maxWeekend === m}
              onPress={() => update({ maxWeekend: m })}
            />
          ))}
        </View>
      </StepSection>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  date: { alignSelf: 'flex-start' },
  days: { flexDirection: 'row', gap: space[1] },
  // Jeden wiersz – chipy dzielą szerokość po równo.
  chips: { flexDirection: 'row', gap: space[2] },
});
