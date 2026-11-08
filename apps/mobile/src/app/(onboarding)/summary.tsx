import { assessRaceGoal, type GoalAssessment } from '@aloha/plan-engine';
import type { TranslationKey } from '@aloha/i18n';
import { router } from 'expo-router';
import { Lightbulb } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { OnboardingStep } from '@/components/onboarding/onboarding-step';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { LEVEL_TO_DB, recentTimeS, startBeforeRace, targetTimeS, useOnboardingDraft } from '@/features/onboarding/draft';
import { completeOnboarding } from '@/features/onboarding/save';
import { generatePlan } from '@/features/plan/api';
import { formatDuration, fromIsoDate } from '@/features/onboarding/time';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { useAuth } from '@/providers/auth-provider';

const GOAL_TITLE = {
  start_running: 'onboarding.goal.startTitle',
  improve_fitness: 'onboarding.goal.fitnessTitle',
  run_regularly: 'onboarding.goal.regularTitle',
  race: 'onboarding.goal.raceTitle',
} as const;

const LEVEL_TITLE = {
  none: 'onboarding.level.noneTitle',
  occasional: 'onboarding.level.occasionalTitle',
  regular: 'onboarding.level.regularTitle',
} as const;

export default function SummaryStep() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const { refreshProfile } = useAuth();
  const { draft, update } = useOnboardingDraft();
  const [dismissed, setDismissed] = useState(false);
  const [adjusted, setAdjusted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const formatDate = (iso: string) =>
    fromIsoDate(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const distanceLabel = (d: number) => t(`onboarding.distance.d${d}` as TranslationKey);
  /** Dystans w środku zdania (małą literą: „na maraton”). */
  const distanceInline = (d: number) => t(`onboarding.distanceInline.d${d}` as TranslationKey);

  const isRace = draft.goal === 'race' && !!draft.raceDate && !!draft.level;
  const target = targetTimeS(draft) ?? null;
  const recent = recentTimeS(draft) ?? null;
  const assessment: GoalAssessment | null =
    isRace && draft.raceDate && draft.level
      ? assessRaceGoal({
          goal: { distanceM: draft.raceDistanceM, raceDate: draft.raceDate, targetTimeS: target },
          level: LEVEL_TO_DB[draft.level],
          recent: recent ? { distanceM: draft.recentDistanceM, timeS: recent } : null,
          // Tygodnie przygotowań liczymy od startu planu, nie od dziś.
          today: draft.planStartDate,
        })
      : null;

  const suggestion = assessment && assessment.status !== 'ok' && !dismissed ? assessment : null;
  const suggestionText = (() => {
    if (!suggestion) return null;
    const distance = distanceInline(draft.raceDistanceM);
    if (suggestion.status === 'target_too_fast') {
      return t('onboarding.summary.tooFast', { suggested: formatDuration(suggestion.suggestion.targetTimeS) });
    }
    if (suggestion.suggestion.kind === 'shorter_distance') {
      return t('onboarding.summary.tooSoonDistance', {
        distance,
        weeks: suggestion.weeks,
        suggested: distanceInline(suggestion.suggestion.distanceM),
      });
    }
    return t('onboarding.summary.tooSoonDate', {
      distance,
      minWeeks: suggestion.minWeeks,
      date: formatDate(suggestion.suggestion.raceDate),
    });
  })();

  const acceptSuggestion = () => {
    if (!suggestion) return;
    if (suggestion.status === 'target_too_fast') {
      update({ targetTime: formatDuration(suggestion.suggestion.targetTimeS) });
    } else if (suggestion.suggestion.kind === 'shorter_distance') {
      // Krótszy dystans: docelowy czas z dłuższego nie ma sensu.
      update({ raceDistanceM: suggestion.suggestion.distanceM, targetTime: '' });
    } else {
      update({ raceDate: suggestion.suggestion.raceDate });
    }
    setAdjusted(true);
  };

  const goalValue = (() => {
    if (!draft.goal) return '';
    if (draft.goal !== 'race' || !draft.raceDate) return t(GOAL_TITLE[draft.goal]);
    const base = { distance: distanceLabel(draft.raceDistanceM), date: formatDate(draft.raceDate) };
    return target
      ? t('onboarding.summary.raceValueTime', { ...base, time: formatDuration(target) })
      : t('onboarding.summary.raceValue', base);
  })();

  const days = [...draft.days]
    .sort((a, b) => a - b)
    .map((d) => t(`onboarding.day.short${d}` as TranslationKey))
    .join(', ');

  const finish = async () => {
    setSaving(true);
    setError(false);
    try {
      await completeOnboarding(draft);
      // Plan od razu z odpowiedzi. Błąd nie blokuje – ekran główny spróbuje jeszcze raz.
      await generatePlan().catch(() => {});
      // Profil z onboarding_completed_at → nawigator sam przełączy na aplikację.
      await refreshProfile();
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <OnboardingStep
      step={5}
      title={t('onboarding.summary.title')}
      subtitle={t('onboarding.summary.subtitle')}
      footer={
        <Button label={t('onboarding.finish')} loading={saving} disabled={!startBeforeRace(draft)} onPress={finish} />
      }>
      {suggestionText && suggestion ? (
        <View style={[styles.suggestion, { backgroundColor: c.surfaceAccentSoft }]} accessibilityLiveRegion="polite">
          <View style={styles.suggestionRow}>
            <Lightbulb size={22} weight="bold" color={c.textAccentStrong} />
            <Text weight="medium" color="textAccentStrong" style={styles.flex}>
              {suggestionText}
            </Text>
          </View>
          <View style={styles.suggestionActions}>
            <Button label={t('onboarding.summary.accept')} onPress={acceptSuggestion} />
            <Button variant="plain" label={t('onboarding.summary.keepMine')} onPress={() => setDismissed(true)} />
          </View>
        </View>
      ) : adjusted ? (
        <Notice tone="success" message={t('onboarding.summary.adjusted')} />
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Row label={t('onboarding.summary.goal')} value={goalValue} onEdit={() => router.navigate('/goal')} />
        <Divider />
        <Row
          label={t('onboarding.summary.level')}
          value={draft.level ? t(LEVEL_TITLE[draft.level]) : ''}
          onEdit={() => router.navigate('/level')}
        />
        <Divider />
        <Row
          label={t('onboarding.summary.start')}
          value={formatDate(draft.planStartDate)}
          onEdit={() => router.navigate('/availability')}
        />
        <Divider />
        <Row
          label={t('onboarding.summary.availability')}
          value={t('onboarding.summary.availabilityValue', { sessions: draft.sessionsPerWeek, days })}
          onEdit={() => router.navigate('/availability')}
        />
        <Divider />
        <Row
          label={t('onboarding.summary.health')}
          value={draft.healthConsent ? t('onboarding.summary.consentOn') : t('onboarding.summary.consentOff')}
          onEdit={() => router.navigate('/health')}
        />
      </View>

      {!startBeforeRace(draft) ? <Notice message={t('onboarding.errors.startAfterRace')} /> : null}
      {error ? <Notice message={t('onboarding.errors.saveFailed')} /> : null}
    </OnboardingStep>
  );
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const t = useT();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="caption">{label}</Text>
        <Text weight="semibold">{value}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('onboarding.edit')}: ${label}`}
        onPress={onEdit}
        hitSlop={space[2]}
        style={styles.edit}>
        <Text variant="label" color="textBrand">
          {t('onboarding.edit')}
        </Text>
      </Pressable>
    </View>
  );
}

function Divider() {
  const c = useColors();
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  suggestion: { gap: space[4], padding: space[4], borderRadius: radius.card },
  suggestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  suggestionActions: { gap: space[1] },
  card: { borderRadius: radius.card, borderWidth: 1.5, paddingHorizontal: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[4] },
  edit: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
});
