import type { GoalRow } from '@aloha/plan-engine';
import { router } from 'expo-router';
import { Flag, Plus } from 'phosphor-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { FinishedGoalCard, GoalListRow, PrimaryGoalCard } from '@/components/goals/goal-cards';
import { Button } from '@/components/ui/button';
import { InfoCard } from '@/components/ui/info-card';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { removeGoal, setPrimaryGoal } from '@/features/goals/api';
import { useGoals } from '@/features/goals/goals-provider';
import { goalLikeOfRow, goalTitle } from '@/features/goals/labels';
import { touchesPlanRow } from '@/features/goals/plan-impact';
import { usePlan } from '@/features/plan/plan-provider';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

/** Ile osiągniętych celów widać bez rozwijania. */
const SHELF = 2;

/** Zakładka „Cele”: cel prowadzący, cele obok i osiągnięte (makieta „Cele”). */
export default function GoalsScreen() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const { state, primary, secondary, progressOf, reload, changed } = useGoals();
  const plan = usePlan();
  const planEndsOn = plan.state.kind === 'ready' ? (plan.state.plan.weeks.at(-1)?.sessions.at(-1)?.scheduled_on ?? plan.state.plan.ends_on) : null;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [shelfOpen, setShelfOpen] = useState(false);

  const titleOf = (g: GoalRow) => goalTitle(t, locale, goalLikeOfRow(g));

  /** Zapis z blokadą przycisków i komunikatem przy błędzie. */
  const run = async (action: () => Promise<boolean>, rebuildPlan = false) => {
    setBusy(true);
    setProblem(null);
    const ok = await action();
    if (ok) await changed({ rebuildPlan });
    else setProblem(t('goals.saveFailed'));
    setBusy(false);
  };

  const makePrimary = (g: GoalRow) =>
    Alert.alert(t('goals.makePrimaryConfirm', { goal: titleOf(g) }), t('goals.makePrimaryBody'), [
      { text: t('goals.cancel'), style: 'cancel' },
      {
        text: t('goals.makePrimaryAction'),
        onPress: () =>
          run(async () => {
            const error = await setPrimaryGoal(g.id);
            if (error === 'too_many_goals') setProblem(t('goals.tooMany'));
            return error === null;
          }, true),
      },
    ]);

  const remove = (g: GoalRow) =>
    Alert.alert(t('goals.removeConfirm', { goal: titleOf(g) }), t('goals.removeConfirmBody'), [
      { text: t('goals.cancel'), style: 'cancel' },
      { text: t('goals.removeAction'), style: 'destructive', onPress: () => run(() => removeGoal(g.id), touchesPlanRow(g, planEndsOn)) },
    ]);

  const openGoal = (g: GoalRow) => {
    const p = progressOf(g);
    const timed = g.kind === 'race' || g.kind === 'performance';
    // Zawody po terminie albo osiągnięty cel → od razu ekran wyniku i „co dalej”.
    if ((p?.kind === 'race' && p.past) || (p && 'achieved' in p && p.achieved)) {
      router.push({ pathname: '/goal-finish', params: { id: g.id } });
      return;
    }
    const finish = timed
      ? { text: t('goals.enterResult'), onPress: () => router.push({ pathname: '/goal-finish', params: { id: g.id } }) }
      : { text: t('goals.markDone'), onPress: () => router.push({ pathname: '/goal-finish', params: { id: g.id } }) };
    const buttons =
      g.role === 'primary'
        ? [finish, { text: t('goals.cancel'), style: 'cancel' as const }]
        : [
            { text: t('goals.makePrimary'), onPress: () => makePrimary(g) },
            finish,
            { text: t('goals.remove'), style: 'destructive' as const, onPress: () => remove(g) },
            { text: t('goals.cancel'), style: 'cancel' as const },
          ];
    Alert.alert(titleOf(g), undefined, buttons);
  };

  const addButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('goals.add')}
      onPress={() => router.push('/goal-new')}
      disabled={busy}
      hitSlop={space[2]}
      style={({ pressed }) => [styles.add, { backgroundColor: c.action, opacity: pressed || busy ? 0.7 : 1 }]}>
      {busy ? <ActivityIndicator color={c.textOnBrand} /> : <Plus size={22} weight="bold" color={c.textOnBrand} />}
    </Pressable>
  );

  const data = state.kind === 'ready' ? state.data : null;
  const finished = data?.finished ?? [];
  const hasRace = (data?.active ?? []).some((g) => g.kind === 'race');

  return (
    <Screen title={t('goals.title')} trailing={addButton} onRefresh={reload}>
      {problem ? <Notice message={problem} /> : null}

      {state.kind === 'loading' ? (
        <View style={[styles.empty, { backgroundColor: c.surface }]}>
          <Skeleton width="40%" />
          <Skeleton height={space[6]} width="70%" />
          <Skeleton />
          <Skeleton width="60%" />
        </View>
      ) : state.kind === 'failed' ? (
        <InfoCard body={t('goals.loadFailed')} />
      ) : (
        <>
          {primary ? (
            <PrimaryGoalCard goal={primary} progress={progressOf(primary)} onPress={() => openGoal(primary)} />
          ) : (
            <View style={[styles.empty, { backgroundColor: c.surfaceBrandSoft }]}>
              <Text weight="bold">{t('goals.noPrimaryTitle')}</Text>
              <Text variant="caption" color="text">
                {t('goals.noPrimaryBody')}
              </Text>
              <Button label={t('goals.add')} onPress={() => router.push({ pathname: '/goal-new', params: { primary: '1' } })} />
            </View>
          )}

          {secondary.length > 0 ? (
            <View style={styles.section}>
              <Text variant="label" color="textMuted" accessibilityRole="header">
                {t('goals.also')}
              </Text>
              <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
                {secondary.map((g, i) => (
                  <GoalListRow key={g.id} goal={g} progress={progressOf(g)} onPress={() => openGoal(g)} last={i === secondary.length - 1} />
                ))}
              </View>
            </View>
          ) : null}

          {!hasRace && secondary.length < 3 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('goals.addRaceTitle')} ${t('goals.addRaceBody')}`}
              onPress={() => router.push({ pathname: '/goal-new', params: { kind: 'race' } })}
              style={({ pressed }) => [styles.addRace, { borderColor: c.borderStrong, opacity: pressed ? 0.7 : 1 }]}>
              <View style={[styles.addRaceIcon, { backgroundColor: c.surfaceAccentSoft }]}>
                <Flag size={20} weight="bold" color={c.textAccentStrong} />
              </View>
              <View style={styles.flex}>
                <Text weight="bold">{t('goals.addRaceTitle')}</Text>
                <Text variant="caption">{t('goals.addRaceBody')}</Text>
              </View>
              <Text variant="label" color="textBrand">
                {t('goals.addRaceAction')}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.section}>
            <View style={styles.shelfHeader}>
              <Text variant="label" color="textMuted" accessibilityRole="header" style={styles.flex}>
                {t('goals.achieved')}
              </Text>
              {finished.length > SHELF ? (
                <Pressable accessibilityRole="button" onPress={() => setShelfOpen((o) => !o)} hitSlop={space[2]} style={styles.shelfToggle}>
                  <Text variant="label" color="textBrand">
                    {shelfOpen ? t('goals.showLess') : t('goals.showAll', { n: finished.length })}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {finished.length === 0 ? (
              <View style={[styles.shelfEmpty, { backgroundColor: c.surfaceBrandSoft }]}>
                <Text variant="caption" color="text">
                  {t('goals.achievedEmpty')}
                </Text>
              </View>
            ) : (
              <View style={styles.shelf}>
                {(shelfOpen ? finished : finished.slice(0, SHELF)).map((g) => (
                  <View key={g.id} style={styles.shelfItem}>
                    <FinishedGoalCard goal={g} />
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  add: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  section: { gap: space[3] },
  list: { borderRadius: radius.card, borderWidth: 1.5, overflow: 'hidden' },
  empty: { gap: space[2], padding: space[4], borderRadius: radius.card },
  addRace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addRaceIcon: { width: 40, height: 40, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  shelfHeader: { flexDirection: 'row', alignItems: 'center' },
  shelfToggle: { minHeight: 44, justifyContent: 'center' },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  shelfItem: { flexBasis: '47%', flexGrow: 1 },
  shelfEmpty: { padding: space[4], borderRadius: radius.card },
});
