import { Check } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { motion, radius, space, type ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** Na turkusowej karcie celu prowadzącego albo na zwykłej (białej) karcie. */
export type ProgressTone = 'brand' | 'surface';

const track = (tone: ProgressTone): ColorRole => (tone === 'brand' ? 'actionHover' : 'background');
const fill = (tone: ProgressTone): ColorRole => (tone === 'brand' ? 'accent' : 'action');

/** Pasek postępu 0–1. Pełny pasek płynnie rośnie przy wejściu (bez ruchu przy „Ogranicz ruch”). */
export function ProgressBar({ fraction, tone = 'surface', label }: { fraction: number; tone?: ProgressTone; label: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.track, { backgroundColor: c[track(tone)] }]}>
      <Animated.View
        style={[
          styles.fill,
          { width: `${pct}%`, backgroundColor: c[fill(tone)] },
          !reduced && {
            animationName: { from: { transform: [{ scaleX: 0 }] }, to: { transform: [{ scaleX: 1 }] } },
            animationDuration: motion.duration.slow,
            transformOrigin: 'left',
          },
        ]}
      />
    </View>
  );
}

/** Tygodnie celu „regularnie”: pełne – kolor akcji, bieżący – bursztyn, reszta – tło. Bez czerwieni i przekreśleń. */
export function WeekDots({ weeks, tone = 'surface', label }: { weeks: ('done' | 'current' | 'open')[]; tone?: ProgressTone; label: string }) {
  const c = useColors();
  // Przy długim okresie (np. 20 tygodni) pokazujemy ostatnie 12 – inaczej kreski robią się nieczytelne.
  const anchor = weeks.indexOf('current') >= 0 ? weeks.indexOf('current') : weeks.length - 1;
  const from = Math.max(0, Math.min(weeks.length - 12, anchor - 8));
  const shown = weeks.length > 12 ? weeks.slice(from, from + 12) : weeks;
  return (
    <View accessible accessibilityLabel={label} style={styles.dots}>
      {shown.map((w, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: w === 'done' ? c[tone === 'brand' ? 'textOnBrand' : 'action'] : w === 'current' ? c.accent : c[track(tone)] },
          ]}
        />
      ))}
    </View>
  );
}

/** Drabinka „bez zatrzymania”: odhaczone kroki, następny obwiedziony, dalsze puste. */
export function Ladder({ steps, current, label }: { steps: number[]; current: number; label: string }) {
  const c = useColors();
  const nextIdx = steps.findIndex((s) => s > current);
  return (
    <View accessible accessibilityLabel={label} style={styles.ladder}>
      {steps.map((m, i) => {
        const done = m <= current;
        const next = i === nextIdx;
        return (
          <View key={m} style={styles.step}>
            <View
              style={[
                styles.stepDot,
                done
                  ? { backgroundColor: c.accent }
                  : next
                    ? { borderWidth: 2, borderStyle: 'dashed', borderColor: c.accent, backgroundColor: c.actionHover }
                    : { backgroundColor: c.actionHover },
              ]}>
              {done ? <Check size={14} weight="bold" color={c.textOnAccent} /> : null}
            </View>
            <Text variant="caption" weight={next ? 'bold' : 'semibold'} color={next ? 'textOnBrand' : 'textOnBrandMuted'}>
              {i === 0 || i === steps.length - 1 ? `${m} min` : String(m)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill },
  dots: { flexDirection: 'row', gap: space[1] },
  dot: { flex: 1, height: 6, borderRadius: radius.pill },
  ladder: { flexDirection: 'row', justifyContent: 'space-between', gap: space[1] },
  step: { flex: 1, alignItems: 'center', gap: space[1] },
  stepDot: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
