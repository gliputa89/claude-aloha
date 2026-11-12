import type { TranslationKey } from '@aloha/i18n';
import { nextGoalSuggestions, type GoalRow, type GoalSpec, type NextGoalSuggestion } from '@aloha/plan-engine';
import { router, useLocalSearchParams } from 'expo-router';
import { Trophy, X } from 'phosphor-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { OptionCard } from '@/components/ui/option-card';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { radius, space } from '@/constants/theme';
import { addGoal, finishGoal, setPrimaryGoal } from '@/features/goals/api';
import { useGoals } from '@/features/goals/goals-provider';
import { distanceLabel, formatDate, goalDescription, goalLikeOfRow, goalLikeOfSpec, goalTitle } from '@/features/goals/labels';
import { formatDuration, parseDuration, todayIso } from '@/features/onboarding/time';
import { allSessions, usePlan } from '@/features/plan/plan-provider';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

/** Następny cel prowadzący: z listy celów obok, nowa propozycja albo dodanie zawodów. */
type NextChoice = { kind: 'existing'; goal: GoalRow } | { kind: 'spec'; spec: GoalSpec } | { kind: 'race'; distanceM: number };

/** Arkusz po zakończonym celu (makieta „Po zawodach”): wynik, a dla celu prowadzącego – co poprowadzi plan dalej. */
export default function GoalFinishScreen() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, secondary, progressOf, changed } = useGoals();
  const plan = usePlan();
  const goal = state.kind === 'ready' ? state.data.active.find((g) => g.id === id) : undefined;
  const today = todayIso();

  // Wynik zawodów ze Stravy (bieg przypisany do startu w planie) albo najlepszy czas z postępu celu.
  const progress = goal ? progressOf(goal) : null;
  const raceSession =
    goal?.kind === 'race' && plan.state.kind === 'ready'
      ? allSessions(plan.state.plan).find((s) => s.type === 'race' && s.scheduled_on === goal.race_date && s.actual_duration_s)
      : undefined;
  const prefill = raceSession?.actual_duration_s ?? (progress?.kind === 'performance' ? progress.bestS : null) ?? goal?.result_time_s ?? null;
  const [time, setTime] = useState(prefill ? formatDuration(prefill) : '');
  const timed = goal?.kind === 'race' || goal?.kind === 'performance';
  const resultS = time.trim() ? parseDuration(time) : null;
  const timeInvalid = time.trim() !== '' && resultS === null;

  const isPrimary = goal?.role === 'primary';
  const queue = secondary.filter((g) => g.id !== id && !(g.kind === 'race' && g.race_date !== null && g.race_date < today));
  const suggestions: NextGoalSuggestion[] =
    goal && isPrimary
      ? nextGoalSuggestions({
          finished: goal,
          resultTimeS: resultS,
          sessionsPerWeek: state.kind === 'ready' ? (state.data.context.runsPerWeek ?? 3) : 3,
          today,
        })
      : [];
  const choices: NextChoice[] = [
    ...queue.map((g) => ({ kind: 'existing' as const, goal: g })),
    ...suggestions.map((s) => ('spec' in s ? { kind: 'spec' as const, spec: s.spec } : { kind: 'race' as const, distanceM: s.distanceM })),
  ];
  const recommendedIdx = queue.length > 0 ? 0 : Math.max(0, suggestions.findIndex((s) => 'recommended' in s && s.recommended));
  const [picked, setPicked] = useState<number | null>(null);
  const choiceIdx = picked ?? recommendedIdx;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  if (!goal) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
        <View style={styles.content}>
          <Notice message={t('goals.loadFailed')} />
          <Button variant="secondary" label={t('goalNew.close')} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const target = goal.target_time_s;
  // Zawody bez docelowego czasu: meta = cel osiągnięty. Z czasem: osiągnięty, gdy zmieścił się w celu – inaczej „ukończone”.
  const achieved = timed ? (resultS === null ? goal.kind === 'race' && !target : !target || resultS <= target) : true;
  const title = goal.kind === 'race' ? t('goalFinish.titleRace') : achieved ? t('goalFinish.titleAchieved') : t('goalFinish.titleCompleted');
  const diff = target && resultS ? Math.abs(target - resultS) : null;

  const finish = async (withNext: boolean) => {
    setSaving(true);
    setError(false);
    const ok = await finishGoal(goal.id, achieved, timed ? resultS : null);
    if (!ok) {
      setError(true);
      setSaving(false);
      return;
    }
    const choice = withNext ? choices[choiceIdx] : undefined;
    if (choice?.kind === 'race') {
      // Zawody bez daty: biegacz uzupełnia je w arkuszu nowego celu (od razu jako prowadzące).
      await changed();
      router.replace({ pathname: '/goal-new', params: { kind: 'race', primary: '1' } });
      return;
    }
    let rebuild = false;
    if (choice?.kind === 'existing') rebuild = (await setPrimaryGoal(choice.goal.id)) === null;
    if (choice?.kind === 'spec') rebuild = !('error' in (await addGoal(choice.spec, true)));
    await changed({ rebuildPlan: rebuild });
    router.back();
  };

  const choiceText = (choice: NextChoice) => {
    if (choice.kind === 'existing') {
      const like = goalLikeOfRow(choice.goal);
      return { title: goalTitle(t, locale, like), desc: `${t('goalFinish.fromList')} · ${goalDescription(t, locale, like, today)}` };
    }
    if (choice.kind === 'spec') {
      const like = goalLikeOfSpec(choice.spec);
      return { title: goalTitle(t, locale, like), desc: goalDescription(t, locale, like, today) };
    }
    return { title: t('goalFinish.addRace', { distance: distanceLabel(t, choice.distanceM) }), desc: t('goalFinish.addRaceDesc') };
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.closeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('goalNew.close')}
              onPress={() => router.back()}
              hitSlop={space[2]}
              style={[styles.close, { backgroundColor: c.surface }]}>
              <X size={18} weight="bold" color={c.textMuted} />
            </Pressable>
          </View>

          <View style={[styles.hero, { backgroundColor: c.surfaceBrand }]}>
            <View style={[styles.trophy, { backgroundColor: c.accent }]}>
              <Trophy size={28} weight="bold" color={c.textOnAccent} />
            </View>
            <Text variant="title" color="textOnBrand" align="center" accessibilityRole="header">
              {title}
            </Text>
            <Text variant="caption" color="textOnBrandMuted" align="center">
              {[goalTitle(t, locale, goalLikeOfRow(goal)), goal.kind === 'race' && goal.race_date ? formatDate(locale, goal.race_date) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {timed && resultS ? (
              <>
                <Text variant="display" color="textOnBrand" align="center">
                  {formatDuration(resultS)}
                </Text>
                {target && diff !== null ? (
                  <Text variant="caption" weight="semibold" color="textOnBrandMuted" align="center">
                    {t((resultS <= target ? 'goalFinish.vsTargetFaster' : 'goalFinish.vsTargetSlower') as TranslationKey, {
                      target: formatDuration(target),
                      diff: formatDuration(diff),
                    })}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>

          {timed ? (
            <TextField
              label={t('goalFinish.resultLabel')}
              placeholder={t('goalNew.timePlaceholder')}
              hint={raceSession ? t('goalFinish.resultFromStrava') : t('goalNew.timeHint')}
              value={time}
              onChangeText={setTime}
              error={timeInvalid ? t('onboarding.errors.timeInvalid') : undefined}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              maxLength={8}
            />
          ) : null}

          {isPrimary && choices.length > 0 ? (
            <View style={styles.next}>
              <Text variant="heading" accessibilityRole="header">
                {t('goalFinish.nextTitle')}
              </Text>
              <Text color="textMuted">{t('goalFinish.nextBody')}</Text>
              <View style={styles.choices} accessibilityRole="radiogroup">
                {choices.map((choice, i) => {
                  const text = choiceText(choice);
                  return (
                    <OptionCard
                      key={choice.kind === 'existing' ? choice.goal.id : `${choice.kind}-${i}`}
                      title={i === recommendedIdx && queue.length === 0 ? `${text.title} · ${t('goalFinish.recommended')}` : text.title}
                      description={text.desc}
                      selected={choiceIdx === i}
                      onPress={() => setPicked(i)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}

          {error ? <Notice message={t('goals.saveFailed')} /> : null}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Button
            label={isPrimary && choices.length > 0 ? t('goalFinish.save') : t('goalFinish.saveOnly')}
            loading={saving}
            disabled={timeInvalid}
            onPress={() => finish(isPrimary)}
          />
          {isPrimary ? <Button variant="plain" label={t('goalFinish.later')} disabled={saving || timeInvalid} onPress={() => finish(false)} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[6], gap: space[5] },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: space[2], padding: space[5], borderRadius: radius.card },
  trophy: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  next: { gap: space[3] },
  choices: { gap: space[2] },
  footer: { paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2], gap: space[1], borderTopWidth: StyleSheet.hairlineWidth },
});
