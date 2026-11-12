import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors, radius, type ColorRole } from '@/constants/theme';
import { EASE_OUT, EASE_SINE } from '@/constants/easing';
import { useColors } from '@/hooks/use-colors';

type SunriseMarkProps = {
  size?: number;
  /** Kolor fali – na tle marki `textOnBrand`. */
  wave?: ColorRole;
  /** Opóźnienie wschodu (ms). */
  delay?: number;
  /** Ciepła poświata za słońcem – wyłącz, gdy znak stoi w przewijanym kontenerze, który by ją przyciął. */
  glow?: boolean;
  /** Po wschodzie od słońca jeden raz rozchodzą się ciepłe kręgi (ekran startowy). */
  rays?: boolean;
  /** Po wschodzie słońce i poświata delikatnie „oddychają” w pętli. */
  idle?: boolean;
  /** Wymusza kolory jednego trybu – tam, gdzie tło nie zależy od trybu (ekran startowy jak natywny splash). */
  scheme?: 'light' | 'dark';
};

const RAY_RINGS = [0, 1];
const RAY_MS = 1800;

const RISE_MS = 1100;

/**
 * Znak „Słońce nad falą” z animacją wschodu: słońce wyłania się zza fali,
 * potem delikatnie się unosi, a za nim pulsuje ciepła poświata.
 * Przy „Ogranicz ruch” – statyczny znak z poświatą.
 */
export function SunriseMark({
  size = 120,
  wave = 'textOnBrand',
  delay = 150,
  glow = true,
  rays = false,
  idle = true,
  scheme,
}: SunriseMarkProps) {
  const themed = useColors();
  const c = scheme ? colors[scheme] : themed;
  const reduced = useReducedMotion();
  const k = size / 64;

  const sunSize = 28 * k;
  const sunLeft = (32 - 14) * k;
  const sunTop = (27 - 14) * k;
  const glowSize = size * 2.8;
  const glowOffset = (glowSize - size) / 2;
  // Środek poświaty = środek słońca (27/64 wysokości, a nie środek znaku).
  const glowTop = 27 * k - glowSize / 2;

  return (
    <View style={{ width: size, height: size }} accessible={false}>
      {/* Poświata: pojawia się razem ze wschodem, potem powoli „oddycha”. */}
      {glow ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.abs,
            {
              width: glowSize,
              height: glowSize,
              left: -glowOffset,
              top: glowTop,
            },
            !reduced && {
              animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
              animationDuration: RISE_MS * 1.4,
              animationDelay: delay,
              animationTimingFunction: EASE_OUT,
              animationFillMode: 'both',
            },
          ]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              !reduced &&
                idle && {
                  animationName: {
                    from: { transform: [{ scale: 0.92 }], opacity: 0.75 },
                    to: { transform: [{ scale: 1.06 }], opacity: 1 },
                  },
                  animationDuration: 4200,
                  animationDelay: delay + RISE_MS,
                  animationTimingFunction: EASE_SINE,
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate',
                },
            ]}>
            <Svg width={glowSize} height={glowSize}>
              <Defs>
                <RadialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={c.accent} stopOpacity={0.55} />
                  <Stop offset="0.35" stopColor={c.accent} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#sun-glow)" />
            </Svg>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* Kręgi: szybko rosną i gasną, potem długa przerwa do następnego „impulsu”. */}
      {rays && !reduced
        ? RAY_RINGS.map((i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.abs,
                styles.ring,
                { left: sunLeft, top: sunTop, width: sunSize, height: sunSize, borderColor: c.accent },
                {
                  animationName: {
                    '0%': { transform: [{ scale: 1 }], opacity: 0 },
                    '10%': { opacity: 0.7 },
                    '100%': { transform: [{ scale: 3.2 }], opacity: 0 },
                  },
                  animationDuration: RAY_MS,
                  animationDelay: delay + RISE_MS * 0.8 + i * 380,
                  animationTimingFunction: EASE_OUT,
                  animationIterationCount: 1,
                  animationFillMode: 'backwards',
                },
              ]}
            />
          ))
        : null}

      {/* Słońce przycięte na linii fali – wschodzi zza niej. */}
      <View style={[styles.abs, styles.clip, { width: size, height: 40 * k }]}>
        <Animated.View
          style={[
            styles.abs,
            { left: sunLeft, top: sunTop, width: sunSize, height: sunSize },
            !reduced && {
              animationName: {
                from: { transform: [{ translateY: 20 * k }] },
                to: { transform: [{ translateY: 0 }] },
              },
              animationDuration: RISE_MS,
              animationDelay: delay,
              animationTimingFunction: EASE_OUT,
              animationFillMode: 'both',
            },
          ]}>
          <Animated.View
            style={[
              styles.sun,
              { backgroundColor: c.accent },
              !reduced &&
                idle && {
                  animationName: {
                    from: { transform: [{ translateY: 0 }] },
                    to: { transform: [{ translateY: -2.5 * k }] },
                  },
                  animationDuration: 3600,
                  animationDelay: delay + RISE_MS,
                  animationTimingFunction: EASE_SINE,
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate',
                },
            ]}
          />
        </Animated.View>
      </View>

      <Svg style={styles.abs} width={size} height={size} viewBox="0 0 64 64">
        <Path
          d="M6 40c4.3 0 6.5-4.5 13-4.5S27.7 40 32 40s6.5-4.5 13-4.5S53.7 40 58 40v6c-4.3 0-6.5-4.5-13-4.5S36.3 46 32 46s-6.5-4.5-13-4.5S10.3 46 6 46z"
          fill={c[wave]}
        />
        <Path
          d="M12 52c3.3 0 5-3 10-3s6.7 3 10 3 5-3 10-3 6.7 3 10 3"
          fill="none"
          stroke={c[wave]}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  clip: { overflow: 'hidden' },
  sun: { flex: 1, borderRadius: radius.pill },
  ring: { borderRadius: radius.pill, borderWidth: 2, opacity: 0 },
});
