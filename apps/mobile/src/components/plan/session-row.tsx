import type { TranslationKey } from '@aloha/i18n';
import { estimateDistanceM, formatApproxKm, stepsOf } from '@aloha/plan-engine';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { WorkoutChart } from '@/components/plan/workout-intervals';
import { Text } from '@/components/ui/text';
import { radius, space, type ColorRole } from '@/constants/theme';
import type { PlanSession } from '@/features/plan/api';
import { fromIsoDate } from '@/features/onboarding/time';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

/** Kolory typów treningu – tylko jako kropka/znacznik (zasada designu). */
export const TYPE_COLOR: Record<PlanSession['type'], ColorRole> = {
  walk_run: 'workoutWalkRun',
  easy: 'workoutEasy',
  recovery: 'workoutEasy',
  long: 'workoutLong',
  intervals: 'workoutIntervals',
  tempo: 'workoutTempo',
  race: 'accent',
  rest: 'workoutRest',
};

export function useDetail(session: PlanSession) {
  const t = useT();
  const s = session.structure;
  if (!('kind' in s)) return null;
  switch (s.kind) {
    case 'walk_run':
      return t('workout.detailWalkRun', { repeats: s.repeats, run: s.runMin, walk: s.walkMin });
    case 'intervals':
      return t('workout.detailIntervals', { repeats: s.repeats, work: s.workMin, rest: s.recoveryMin });
    case 'tempo':
      return t('workout.detailTempo', { work: s.workMin });
    case 'race':
      return t('workout.detailRace');
    default:
      return t('workout.detailSteady');
  }
}

/** Karta treningu: dzień, typ, długość i przebieg (słupki odcinków); tapnięcie otwiera arkusz ze szczegółami. */
export function SessionRow({ session, today }: { session: PlanSession; today: boolean }) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  // Własna część główna (np. od AI) ma inny przebieg niż domyślny opis typu – wtedy opis zastępuje wykres.
  const custom = 'custom' in session.structure && session.structure.custom === true;
  const defaultDetail = useDetail(session);
  const detail = custom ? null : defaultDetail;
  const steps = session.type === 'rest' ? [] : stepsOf(session);
  const date = fromIsoDate(session.scheduled_on);
  const weekday = ((date.getDay() + 6) % 7) + 1;
  const title = t(`workout.${session.type}` as TranslationKey);
  const right = session.duration_min
    ? t('workout.minutes', { n: session.duration_min })
    : session.distance_m
      ? `${(session.distance_m / 1000).toLocaleString(locale === 'en' ? 'en-GB' : 'pl-PL', { maximumFractionDigits: 1 })} km`
      : '';
  const hasSteps = steps.length > 0;
  // Suma w km tylko orientacyjnie (z czasu i stref tempa); odcinki zostają na czas.
  const approxKm =
    session.duration_min && hasSteps ? formatApproxKm(estimateDistanceM(steps), locale === 'en' ? 'en' : 'pl') : null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: session.id } })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: today ? c.surfaceBrandSoft : c.surface,
          borderColor: today ? c.action : c.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityHint={t('workout.openDetails')}
      accessibilityLabel={[
        today ? t('plan.today') : null,
        t(`onboarding.day.long${weekday}` as TranslationKey),
        title,
        detail,
        right,
        approxKm,
      ]
        .filter(Boolean)
        .join(', ')}>
      <View style={styles.row}>
        <View style={styles.date}>
          <Text variant="caption" weight="semibold" color={today ? 'textBrand' : 'textMuted'}>
            {today ? t('plan.today') : t(`onboarding.day.short${weekday}` as TranslationKey)}
          </Text>
          <Text variant="heading">{date.getDate()}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: c[TYPE_COLOR[session.type]] }]} />
        <View style={styles.body}>
          <Text weight="bold">{title}</Text>
          {detail ? <Text variant="caption">{detail}</Text> : null}
        </View>
        <View style={styles.total}>
          <Text weight="semibold" color="textMuted">
            {right}
          </Text>
          {approxKm ? <Text variant="caption">{approxKm}</Text> : null}
        </View>
      </View>
      {hasSteps ? (
        <View style={styles.outline}>
          <WorkoutChart steps={steps} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  date: { width: 44, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  body: { flex: 1, gap: 2 },
  total: { alignItems: 'flex-end', gap: 2 },
  outline: { gap: space[3] },
});
