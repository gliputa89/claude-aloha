import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { motion, radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

const DOTS = [0, 1, 2];
const DOT = space[2];

/**
 * „Trener pisze…”: dymek po stronie trenera z trzema podskakującymi kropkami – jak w komunikatorach.
 * `label` czyta czytnik ekranu (kropki same nic nie mówią). Przy „Ogranicz ruch” kropki stoją.
 */
export function TypingBubble({ label }: { label: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(motion.duration.normal)}
      exiting={reduced ? undefined : FadeOut.duration(motion.duration.fast)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={[styles.bubble, { backgroundColor: c.surface, borderColor: c.border }]}>
      {DOTS.map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: c.textMuted },
            reduced
              ? { opacity: 0.6 }
              : {
                  animationName: {
                    '0%': { opacity: 0.35, transform: [{ translateY: 0 }] },
                    '30%': { opacity: 1, transform: [{ translateY: -space[1] }] },
                    '60%': { opacity: 0.35, transform: [{ translateY: 0 }] },
                    '100%': { opacity: 0.35, transform: [{ translateY: 0 }] },
                  },
                  animationDuration: 1100,
                  animationDelay: i * 160,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                },
          ]}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 2,
    // Wysokość jak jednowierszowy dymek wiadomości – lista nie skacze, gdy kropki zamieniają się w odpowiedź.
    minHeight: 48,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.card,
    borderWidth: 1.5,
  },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill },
});
