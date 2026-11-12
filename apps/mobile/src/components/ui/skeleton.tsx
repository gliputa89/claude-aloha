import type { DimensionValue } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { EASE_SINE } from '@/constants/easing';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** Spokojny zastępnik wiersza tekstu, gdy treść jeszcze się wczytuje (przy „Ogranicz ruch” nie pulsuje). */
export function Skeleton({ width = '100%', height = space[3] }: { width?: DimensionValue; height?: number }) {
  const c = useColors();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius.pill, backgroundColor: c.border },
        !reduced && {
          animationName: { from: { opacity: 1 }, to: { opacity: 0.45 } },
          animationDuration: 900,
          animationTimingFunction: EASE_SINE,
          animationIterationCount: 'infinite',
          animationDirection: 'alternate',
        },
      ]}
    />
  );
}
