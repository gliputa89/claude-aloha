import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleSignIn } from '@/components/auth/apple-sign-in';
import { BouncyTitle } from '@/components/brand/bouncy-title';
import { FloatingPetals } from '@/components/brand/floating-petals';
import { PlumeriaPattern } from '@/components/brand/plumeria-pattern';
import { SunriseMark } from '@/components/brand/sunrise-mark';
import { WaveBand } from '@/components/brand/wave-band';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/ui/fade-up';
import { Text } from '@/components/ui/text';
import { EASE_OUT } from '@/constants/easing';
import { space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';
import { appleSignInAvailable } from '@/lib/auth';

/** Rozmiar kafelka wzoru plumerii – przesunięcie o tyle daje bezszwową pętlę. */
const PATTERN_TILE = 56;

/**
 * Choreografia wejścia (ms):
 * 0     wzór plumerii wyłania się z lekkiego przybliżenia, słońce wschodzi zza fali
 * 550   „przypływ” – fale razem z panelem przycisków wjeżdżają od dołu
 * 700   litery „Aloha!” wskakują po kolei
 * 1150+ podtytuł i przyciski
 * 1750  jeden impuls kręgów od słońca
 * potem ciągle: dryf wzoru, falowanie, bardzo powoli unoszące się kwiaty
 */
const TIDE_DELAY = 550;
const TIDE_MS = 1100;
const TIDE_DISTANCE = 320;
const WAVE_HEIGHT = 56;
const GREETING_DELAY = 700;

export default function WelcomeScreen() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [heroHeight, setHeroHeight] = useState(0);

  const greeting = t('welcome.greeting');
  const afterGreeting = GREETING_DELAY + Array.from(greeting).length * 60;

  // Fale i panel przycisków wjeżdżają razem, jak przypływ.
  const tide = reduced
    ? undefined
    : {
        animationName: {
          from: { transform: [{ translateY: TIDE_DISTANCE }] },
          to: { transform: [{ translateY: 0 }] },
        },
        animationDuration: TIDE_MS,
        animationDelay: TIDE_DELAY,
        animationTimingFunction: EASE_OUT,
        animationFillMode: 'both' as const,
      };

  return (
    <View style={[styles.flex, { backgroundColor: c.surfaceBrand }]}>
      <View
        onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
        style={[styles.hero, { backgroundColor: c.surfaceBrand, paddingTop: insets.top + space[8] }]}>
        {/* Wzór: na starcie wyłania się z przybliżenia, potem bardzo powoli dryfuje po skosie. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              animationName: reduced
                ? { from: { opacity: 0 }, to: { opacity: 1 } }
                : {
                    from: { opacity: 0, transform: [{ scale: 1.18 }] },
                    to: { opacity: 1, transform: [{ scale: 1 }] },
                  },
              animationDuration: 1600,
              animationTimingFunction: EASE_OUT,
              animationFillMode: 'both',
            },
          ]}>
          <Animated.View
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
        </Animated.View>

        <FloatingPetals width={width} height={heroHeight} />

        <View style={styles.heroContent}>
          <SunriseMark size={128} rays idle={false} />
          <BouncyTitle text={greeting} color="textOnBrand" delay={GREETING_DELAY} style={styles.greeting} />
          <FadeUp delay={afterGreeting}>
            <Text color="textOnBrandMuted" align="center" weight="medium" style={styles.tagline}>
              {t('welcome.tagline')}
            </Text>
          </FadeUp>
        </View>
      </View>

      <Animated.View
        style={[styles.actions, { backgroundColor: c.background, paddingBottom: insets.bottom + space[4] }, tide]}>
        {/* Fale siedzą na górnej krawędzi panelu, więc wjeżdżają razem z nim. */}
        <View pointerEvents="none" style={styles.waves}>
          <WaveBand
            width={width}
            layers={[
              { color: c.background, opacity: 0.35, mid: 22, amp: 12, durationMs: 16000, reverse: true },
              { color: c.background, mid: 34, amp: 11, durationMs: 11000 },
            ]}
          />
        </View>
        <FadeUp delay={afterGreeting + 80}>
          <Button label={t('welcome.createAccount')} onPress={() => router.push('/sign-up')} />
        </FadeUp>
        <FadeUp delay={afterGreeting + 160}>
          <Button variant="secondary" label={t('welcome.haveAccount')} onPress={() => router.push('/sign-in')} />
        </FadeUp>
        {appleSignInAvailable ? (
          <FadeUp delay={afterGreeting + 240}>
            <AppleSignIn />
          </FadeUp>
        ) : null}
      </Animated.View>
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
  waves: { position: 'absolute', left: 0, right: 0, top: -WAVE_HEIGHT, height: WAVE_HEIGHT },
  actions: {
    paddingHorizontal: space[5],
    paddingTop: space[6],
    gap: space[3],
  },
});
