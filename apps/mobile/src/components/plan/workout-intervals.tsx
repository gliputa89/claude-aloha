import { flattenSteps, formatPace, isRepeat, stepsTotalS, ZONE_INFO, type PaceZone, type WorkoutItem, type WorkoutStep } from '@aloha/plan-engine';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, space, type ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

// Przebieg treningu jak w zegarkach: słupki o szerokości = czas odcinka i wysokości = strefa wysiłku,
// a pod spodem (po rozwinięciu) lista odcinków z tempem.

/** Kolory stref – role typów treningu (zasada: tylko jako znaczniki, tu słupki przebiegu). */
const ZONE_COLOR: Record<PaceZone, ColorRole> = {
  walk: 'workoutWalkRun',
  recovery: 'workoutRest',
  easy: 'workoutEasy',
  steady: 'workoutLong',
  tempo: 'workoutTempo',
  interval: 'workoutIntervals',
  sprint: 'accent',
};

const MAX_LEVEL = 7;

function useStepText() {
  const t = useT();
  const duration = (s: number) => {
    if (s < 60) return t('workout.seconds', { n: s });
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest ? t('workout.minSec', { m, s: String(rest).padStart(2, '0') }) : t('workout.minutes', { n: m });
  };
  const target = (s: WorkoutStep) =>
    s.pace ? t('workout.pace', { fast: formatPace(s.pace.fastS), slow: formatPace(s.pace.slowS) }) : t(`workout.effort.${s.zone}`);
  return { t, duration, target };
}

export function WorkoutChart({ steps }: { steps: WorkoutItem[] }) {
  const c = useColors();
  const { t, duration } = useStepText();
  const flat = flattenSteps(steps);
  if (!flat.length || !stepsTotalS(steps)) return null;
  const label = flat.map((s) => `${t(`workout.step.${s.kind}`)} ${duration(s.durationS)} ${t(`workout.zone.${s.zone}`)}`).join(', ');
  return (
    <View
      style={[styles.chart, { backgroundColor: c.background }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('workout.chartLabel', { steps: label })}>
      {flat.map((s, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              flexGrow: s.durationS,
              height: `${(ZONE_INFO[s.zone].level / MAX_LEVEL) * 100}%`,
              backgroundColor: c[ZONE_COLOR[s.zone]],
            },
          ]}
        />
      ))}
    </View>
  );
}

function StepLine({ s }: { s: WorkoutStep }) {
  const c = useColors();
  const { t, duration, target } = useStepText();
  return (
    <View style={styles.step}>
      <View style={[styles.dot, { backgroundColor: c[ZONE_COLOR[s.zone]] }]} />
      <Text variant="caption" style={styles.kind}>
        {t(`workout.step.${s.kind}`)}
      </Text>
      <Text variant="label" style={styles.time}>
        {duration(s.durationS)}
      </Text>
      <Text variant="caption" style={styles.flex}>
        {t(`workout.zone.${s.zone}`)} · {target(s)}
      </Text>
    </View>
  );
}

/** Lista odcinków; powtórzenia jako blok „N×”. */
export function WorkoutSteps({ steps }: { steps: WorkoutItem[] }) {
  const c = useColors();
  const { t } = useStepText();
  return (
    <View style={styles.list}>
      {steps.map((item, i) =>
        isRepeat(item) ? (
          <View key={i} style={[styles.repeat, { borderColor: c.border }]}>
            <Text variant="heading" color="textBrand" style={styles.times}>
              {t('workout.repeat', { n: item.times })}
            </Text>
            <View style={styles.flex}>
              {item.steps.map((s, j) => (
                <StepLine key={j} s={s} />
              ))}
            </View>
          </View>
        ) : (
          <StepLine key={i} s={item} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    height: 32,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  bar: { flexBasis: 0, minWidth: 2, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  list: { gap: space[2] },
  step: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  kind: { width: 92 },
  time: { width: 64 },
  flex: { flex: 1 },
  repeat: { flexDirection: 'row', gap: space[2], borderWidth: 1, borderRadius: radius.button, padding: space[2] },
  times: { width: 36 },
});
