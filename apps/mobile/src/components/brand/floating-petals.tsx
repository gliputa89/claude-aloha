import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { PlumeriaFlower } from '@/components/brand/plumeria-pattern';
import { EASE_SINE } from '@/constants/easing';
import type { ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** Kwiaty: pozycja (ułamek szerokości), rozmiar, czas wznoszenia, opóźnienie, zakres kołysania. */
const PETALS = [
  { x: 0.12, size: 22, rise: 26000, delay: 1200, sway: 14, spin: 18000 },
  { x: 0.78, size: 30, rise: 32000, delay: 6000, sway: 18, spin: 24000 },
  { x: 0.42, size: 16, rise: 24000, delay: 11000, sway: 10, spin: 15000 },
  { x: 0.9, size: 18, rise: 28000, delay: 16000, sway: 12, spin: 20000 },
  { x: 0.28, size: 26, rise: 34000, delay: 21000, sway: 16, spin: 26000 },
];

type FloatingPetalsProps = {
  /** Wysokość obszaru, przez który kwiaty przelatują. */
  height: number;
  width: number;
  color?: ColorRole;
  opacity?: number;
};

/**
 * Kilka kwiatów plumerii powoli unosi się od dołu ku górze, kołysząc się i obracając.
 * Tylko ekran startowy / onboarding. Przy „Ogranicz ruch” nic nie jest rysowane.
 */
export function FloatingPetals({ height, width, color = 'textOnBrand', opacity = 0.08 }: FloatingPetalsProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  if (reduced || height <= 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
      {PETALS.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.petal,
            { left: p.x * width - p.size / 2, top: height },
            {
              animationName: {
                '0%': { transform: [{ translateY: 0 }], opacity: 0 },
                '12%': { opacity: 1 },
                '85%': { opacity: 1 },
                '100%': { transform: [{ translateY: -(height + p.size * 2) }], opacity: 0 },
              },
              animationDuration: p.rise,
              animationDelay: p.delay,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationFillMode: 'backwards',
            },
          ]}>
          {/* Krycie na osobnym poziomie – animacja wznoszenia steruje własnym opacity (pojawienie / zniknięcie). */}
          <Animated.View
            style={{
              opacity,
              animationName: {
                from: { transform: [{ translateX: -p.sway }] },
                to: { transform: [{ translateX: p.sway }] },
              },
              animationDuration: p.rise / 4,
              animationTimingFunction: EASE_SINE,
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
            }}>
            <Animated.View
              style={{
                animationName: {
                  from: { transform: [{ rotate: '0deg' }] },
                  to: { transform: [{ rotate: i % 2 ? '-360deg' : '360deg' }] },
                },
                animationDuration: p.spin,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}>
              <PlumeriaFlower size={p.size} color={c[color]} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  petal: { position: 'absolute' },
});
