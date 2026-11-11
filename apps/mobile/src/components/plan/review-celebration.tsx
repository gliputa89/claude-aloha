import { Check } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { EASE_BACK, EASE_OUT } from '@/constants/easing';
import { radius, type ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** Siła świętowania: pełna („W punkt”), spokojna („Dobra robota”) albo żadna (słabsze werdykty, kolejne otwarcia). */
export type Celebration = 'full' | 'calm' | 'none';

const BADGE = 28;
const SPARKS: { angle: number; distance: number; size: number; color: ColorRole }[] = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12),
  distance: i % 2 ? 46 : 34,
  size: i % 3 === 0 ? 8 : 6,
  color: (['accent', 'surfaceBrand', 'action'] as const)[i % 3]!,
}));

/**
 * Znaczek „zrobione” w karcie oceny. Przy pierwszym otwarciu dobrze zrobionego treningu wskakuje ze sprężyną,
 * a wokół rozchodzi się pierścień („Dobra robota”) i iskry w kolorach marki („W punkt”).
 * Przy „Ogranicz ruch” i przy kolejnych otwarciach jest po prostu na miejscu.
 */
export function ReviewBadge({ celebration, delay }: { celebration: Celebration; delay: number }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const play = celebration !== 'none' && !reduced;
  return (
    <View style={styles.wrap}>
      {play ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { borderColor: c.surfaceBrand },
            {
              animationName: { from: { opacity: 0.7, transform: [{ scale: 1 }] }, to: { opacity: 0, transform: [{ scale: 2.8 }] } },
              animationDuration: 900,
              animationDelay: delay + 120,
              animationTimingFunction: EASE_OUT,
              animationFillMode: 'both',
            },
          ]}
        />
      ) : null}
      {play && celebration === 'full'
        ? SPARKS.map((s, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.spark,
                { width: s.size, height: s.size, marginLeft: -s.size / 2, marginTop: -s.size / 2, backgroundColor: c[s.color] },
                {
                  animationName: {
                    '0%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.4 }] },
                    '20%': { opacity: 1 },
                    '100%': {
                      opacity: 0,
                      transform: [
                        { translateX: Math.cos(s.angle) * s.distance },
                        { translateY: Math.sin(s.angle) * s.distance },
                        { scale: 1 },
                      ],
                    },
                  },
                  animationDuration: 900 + (i % 3) * 120,
                  animationDelay: delay + 160 + (i % 4) * 30,
                  animationTimingFunction: EASE_OUT,
                  animationFillMode: 'both',
                },
              ]}
            />
          ))
        : null}
      <Animated.View
        style={[
          styles.badge,
          { backgroundColor: c.surfaceBrand },
          play && {
            animationName: { from: { opacity: 0, transform: [{ scale: 0.2 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
            animationDuration: 520,
            animationDelay: delay,
            animationTimingFunction: EASE_BACK,
            animationFillMode: 'both',
          },
        ]}>
        <Check size={16} weight="bold" color={c.textOnBrand} />
      </Animated.View>
    </View>
  );
}

/**
 * Postęp 0→1 do „dobiegania” liczb (dystans, czas) po `delay` ms. Bez animacji od razu 1.
 * Liczby odświeżamy w JS – to kilkadziesiąt klatek tekstu, a wartość końcowa jest zawsze dokładna.
 */
export function useCountUp(play: boolean, delay: number, duration = 900) {
  const reduced = useReducedMotion();
  const animate = play && !reduced;
  const [progress, setProgress] = useState(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      // ease-out: szybko na początku, miękko przy wartości końcowej
      setProgress(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, delay, duration]);
  return progress;
}

const styles = StyleSheet.create({
  wrap: { width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' },
  badge: { width: BADGE, height: BADGE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: BADGE, height: BADGE, borderRadius: radius.pill, borderWidth: 2 },
  spark: { position: 'absolute', left: '50%', top: '50%', borderRadius: radius.pill },
});
