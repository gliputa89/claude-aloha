import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { EASE_OUT } from '@/constants/easing';
import { motion } from '@/constants/theme';

type FadeUpProps = {
  /** Opóźnienie wejścia (ms). */
  delay?: number;
  /** Wysokość uniesienia (pt). */
  distance?: number;
  /** Płynne przesuwanie, gdy nad elementem coś się pojawi lub zniknie (np. komunikat błędu). */
  glide?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Wejście elementu: lekkie uniesienie i pojawienie się (przy „Ogranicz ruch” samo pojawienie). */
export function FadeUp({ delay = 0, distance = 14, glide = false, style, children }: FadeUpProps) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      layout={glide && !reduced ? LinearTransition.duration(motion.duration.normal) : undefined}
      style={[
        {
          animationName: reduced
            ? { from: { opacity: 0 }, to: { opacity: 1 } }
            : {
                from: { opacity: 0, transform: [{ translateY: distance }] },
                to: { opacity: 1, transform: [{ translateY: 0 }] },
              },
          animationDuration: motion.duration.slow + 200,
          animationDelay: delay,
          animationTimingFunction: EASE_OUT,
          animationFillMode: 'both',
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}
