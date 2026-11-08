import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlumeriaPattern } from '@/components/brand/plumeria-pattern';
import { SunriseMark } from '@/components/brand/sunrise-mark';
import { WaveBand } from '@/components/brand/wave-band';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { EASE_OUT } from '@/constants/easing';
import { motion, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

/** Rozmiar kafelka wzoru plumerii – przesunięcie o tyle daje bezszwową pętlę. */
const PATTERN_TILE = 56;

/** Wejście elementu: lekkie uniesienie i pojawienie się (przy „Ogranicz ruch” samo pojawienie). */
function FadeUp({ delay, children }: { delay: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={{
        animationName: reduced
          ? { from: { opacity: 0 }, to: { opacity: 1 } }
          : {
              from: { opacity: 0, transform: [{ translateY: 14 }] },
              to: { opacity: 1, transform: [{ translateY: 0 }] },
            },
        animationDuration: motion.duration.slow + 200,
        animationDelay: delay,
        animationTimingFunction: EASE_OUT,
        animationFillMode: 'both',
      }}>
      {children}
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={[styles.hero, { backgroundColor: c.surfaceBrand, paddingTop: insets.top + space[8] }]}>
        {/* Wzór bardzo powoli dryfuje po skosie. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pattern,
            !reduced && {
              animationName: {
                from: { transform: [{ translateX: 0 }, { translateY: 0 }] },
                to: { transform: [{ translateX: PATTERN_TILE }, { translateY: PATTERN_TILE }] },
              },
              animationDuration: 28000,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            },
          ]}>
          <PlumeriaPattern />
        </Animated.View>

        <View style={styles.heroContent}>
          <SunriseMark size={128} />
          <FadeUp delay={650}>
            <Text variant="display" color="textOnBrand" align="center" accessibilityRole="header" style={styles.greeting}>
              {t('welcome.greeting')}
            </Text>
          </FadeUp>
          <FadeUp delay={780}>
            <Text color="textOnBrandMuted" align="center" weight="medium" style={styles.tagline}>
              {t('welcome.tagline')}
            </Text>
          </FadeUp>
        </View>

        <WaveBand
          width={width}
          layers={[
            { color: c.background, opacity: 0.35, mid: 22, amp: 12, durationMs: 16000, reverse: true },
            { color: c.background, mid: 34, amp: 11, durationMs: 11000 },
          ]}
        />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space[4] }]}>
        <FadeUp delay={900}>
          <Button label={t('welcome.createAccount')} onPress={() => router.push('/sign-up')} />
        </FadeUp>
        <FadeUp delay={980}>
          <Button variant="secondary" label={t('welcome.haveAccount')} onPress={() => router.push('/sign-in')} />
        </FadeUp>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: space[5],
    paddingBottom: space[12],
  },
  pattern: {
    position: 'absolute',
    top: -PATTERN_TILE,
    left: -PATTERN_TILE,
    right: 0,
    bottom: 0,
  },
  heroContent: { alignItems: 'center', gap: space[3] },
  greeting: { marginTop: space[6] },
  tagline: { maxWidth: 300 },
  actions: {
    paddingHorizontal: space[5],
    paddingTop: space[6],
    gap: space[3],
  },
});
