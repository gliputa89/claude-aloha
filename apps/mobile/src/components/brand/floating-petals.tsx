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

/**
 * Gęsty rój na ekran układania planu: więcej kwiatów, a ujemne opóźnienie startuje każdy w innym miejscu drogi –
 * niebo jest pełne od pierwszej sekundy (cały ekran trwa zwykle 10–30 s).
 */
const DENSE_PETALS = [
  { x: 0.08, size: 18, rise: 22000, delay: -1100, sway: 12, spin: 16000 },
  { x: 0.62, size: 24, rise: 26000, delay: -14300, sway: 16, spin: 22000 },
  { x: 0.34, size: 14, rise: 20000, delay: -6000, sway: 10, spin: 14000 },
  { x: 0.86, size: 20, rise: 24000, delay: -19200, sway: 14, spin: 19000 },
  { x: 0.2, size: 26, rise: 28000, delay: -4200, sway: 18, spin: 25000 },
  { x: 0.5, size: 16, rise: 21000, delay: -14300, sway: 12, spin: 15000 },
  { x: 0.74, size: 14, rise: 19000, delay: -8000, sway: 10, spin: 13000 },
  { x: 0.95, size: 22, rise: 27000, delay: -24800, sway: 14, spin: 21000 },
  { x: 0.03, size: 20, rise: 25000, delay: -5500, sway: 12, spin: 18000 },
  { x: 0.44, size: 22, rise: 29000, delay: -17400, sway: 16, spin: 23000 },
  { x: 0.68, size: 16, rise: 23000, delay: -8000, sway: 10, spin: 16000 },
  { x: 0.14, size: 14, rise: 20000, delay: -17000, sway: 10, spin: 14000 },
  { x: 0.56, size: 26, rise: 30000, delay: -15000, sway: 18, spin: 26000 },
  { x: 0.9, size: 16, rise: 22000, delay: -2200, sway: 12, spin: 15000 },
];

type FloatingPetalsProps = {
  /** Wysokość obszaru, przez który kwiaty przelatują. */
  height: number;
  width: number;
  color?: ColorRole;
  opacity?: number;
  /** Mnożnik tempa: 1 – spokojnie, 2 – dwa razy szybciej. */
  speed?: number;
  /** Więcej kwiatów, gęściej w czasie (ekran układania planu). */
  dense?: boolean;
};

/**
 * Kilka kwiatów plumerii powoli unosi się od dołu ku górze, kołysząc się i obracając.
 * Tylko ekran startowy / onboarding. Przy „Ogranicz ruch” nic nie jest rysowane.
 */
export function FloatingPetals({ height, width, color = 'textOnBrand', opacity = 0.08, speed = 1, dense = false }: FloatingPetalsProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  if (reduced || height <= 0) return null;
  const petals = dense ? DENSE_PETALS : PETALS;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
      {petals.map((p, i) => (
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
              animationDuration: p.rise / speed,
              animationDelay: p.delay / speed,
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
              animationDuration: p.rise / 4 / speed,
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
                animationDuration: p.spin / speed,
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
