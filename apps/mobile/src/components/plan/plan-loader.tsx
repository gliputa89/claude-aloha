import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BouncyTitle } from '@/components/brand/bouncy-title';
import { FloatingPetals } from '@/components/brand/floating-petals';
import { PlumeriaPattern } from '@/components/brand/plumeria-pattern';
import { WaveBand } from '@/components/brand/wave-band';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/ui/fade-up';
import { Text } from '@/components/ui/text';
import { EASE_OUT } from '@/constants/easing';
import { motion, radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** Wynik generowania do pokazania w finale. `null` → plan dokończy ekran główny (błąd sieci / serwera). */
export type PlanLoaderResult = {
  /** Liczba treningów w pierwszych tygodniach. */
  sessions: number;
  /** Sformatowana data startu, np. „poniedziałek, 16 listopada”. */
  startLabel: string;
  /** Wiadomość od trenera o gotowym planie: powitanie od AI albo stały tekst ze słownika. */
  note: string;
};

export type PlanLoaderTexts = {
  /** Kolejne komunikaty trenera w trakcie układania planu. */
  steps: string[];
  /** Dopisek, gdy generowanie się przeciąga. */
  slow: string;
  /** Etykieta postępu dla czytnika ekranu. */
  progressLabel: string;
  doneTitle: string;
  sessionsLabel: string;
  startLabel: string;
  coachLabel: string;
  cta: string;
  fallbackTitle: string;
  fallbackBody: string;
};

type PlanLoaderProps = {
  texts: PlanLoaderTexts;
  /** Trwające generowanie. `null` → jeszcze nie wystartowało. Nie odrzuca – błąd to wynik `null`. */
  task: Promise<PlanLoaderResult | null> | null;
  onContinue: () => void;
  continuing?: boolean;
};

const WAVE_HEIGHT = 56;
const SUN_SIZE = 132;
const GLOW_SIZE = SUN_SIZE * 3;
/** Słońce w trakcie pracy dochodzi do tej części drogi; resztę pokonuje w finale. */
const WORKING_RISE = 0.82;
const WORKING_MS = 11000;
/** Finał nie wcześniej niż po tylu ms – szybka odpowiedź nie może „mignąć”. */
const MIN_VISIBLE_MS = 3200;
const STEP_MS = 2600;
const SLOW_AFTER_MS = 25000;
const RAY_RINGS = [0, 1, 2];
const GLOW_BREATH_MS = 3400;

type Phase = { kind: 'working' } | { kind: 'done'; result: PlanLoaderResult | null };

/**
 * Pełnoekranowe „Układam Twój plan”: słońce wschodzi zza fal w miarę pracy, trener mówi, co robi,
 * a w finale pokazuje gotowy plan. Postęp jest umowny (nie znamy realnego) – finał odpala wynik `task`.
 * Komponent nie wie, skąd wynik pochodzi, więc podgląd deweloperski podaje mu sztuczne obietnice.
 */
export function PlanLoader({ texts, task, onContinue, continuing = false }: PlanLoaderProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [skyHeight, setSkyHeight] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'working' });
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);

  const done = phase.kind === 'done';
  const lastStep = texts.steps.length - 1;

  // 0 – słońce schowane za falą, 1 – w całości nad nią.
  const rise = useSharedValue(reduced ? WORKING_RISE : 0);

  useEffect(() => {
    if (reduced) return;
    rise.value = withTiming(WORKING_RISE, { duration: WORKING_MS, easing: Easing.out(Easing.cubic) });
  }, [reduced, rise]);

  useEffect(() => {
    if (done) return;
    const stepTimer = setInterval(() => setStep((s) => Math.min(s + 1, lastStep)), STEP_MS);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearInterval(stepTimer);
      clearTimeout(slowTimer);
    };
  }, [done, lastStep]);

  useEffect(() => {
    if (!task) return;
    let active = true;
    const minTime = new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_MS));
    Promise.all([task.catch(() => null), minTime]).then(([result]) => {
      if (!active) return;
      setPhase({ kind: 'done', result });
      rise.value = reduced ? 1 : withSpring(1, { damping: 11, stiffness: 90, mass: 0.9 });
    });
    return () => {
      active = false;
    };
  }, [task, reduced, rise]);

  // Jak wysoko wschodzi słońce: nad fale plus ok. jedna piąta nieba, ale tak, żeby zostało pod paskiem stanu.
  const travel = Math.max(
    SUN_SIZE + space[6],
    Math.min(SUN_SIZE + space[6] + skyHeight * 0.22, skyHeight - insets.top - SUN_SIZE * 0.3),
  );
  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -rise.value * travel }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + rise.value * 0.75 }));
  // Niebo jaśnieje od horyzontu razem ze wschodem.
  const dawnStyle = useAnimatedStyle(() => ({ opacity: rise.value * 0.9 }));

  const result = done ? phase.result : null;

  return (
    <View style={[styles.flex, { backgroundColor: c.surfaceBrand }]}>
      <View
        onLayout={(e) => setSkyHeight(e.nativeEvent.layout.height)}
        style={[styles.sky, { paddingTop: insets.top }]}
        accessible={false}>
        <PlumeriaPattern />
        {/* Łuna świtu: ciepłe światło od horyzontu, coraz mocniejsze, im wyżej słońce. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, dawnStyle]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="loader-dawn" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={c.accent} stopOpacity={0.34} />
                <Stop offset="0.55" stopColor={c.accent} stopOpacity={0.08} />
                <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#loader-dawn)" />
          </Svg>
        </Animated.View>
        <FloatingPetals width={width} height={skyHeight} speed={2.2} opacity={0.13} />

        <Animated.View style={[styles.sun, { left: (width - SUN_SIZE) / 2 }, sunStyle]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              glowStyle,
              // Poświata lekko „oddycha”.
              reduced
                ? null
                : {
                    animationName: { from: { transform: [{ scale: 0.94 }] }, to: { transform: [{ scale: 1.08 }] } },
                    animationDuration: GLOW_BREATH_MS,
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDirection: 'alternate',
                  },
            ]}>
            <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
              <Defs>
                <RadialGradient id="loader-glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={c.accent} stopOpacity={0.55} />
                  <Stop offset="0.35" stopColor={c.accent} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#loader-glow)" />
            </Svg>
          </Animated.View>

          {/* Finał: od słońca rozchodzą się kręgi. */}
          {done && !reduced
            ? RAY_RINGS.map((i) => (
                <Animated.View
                  key={i}
                  pointerEvents="none"
                  style={[
                    styles.ring,
                    { borderColor: c.accent },
                    {
                      animationName: {
                        '0%': { transform: [{ scale: 1 }], opacity: 0 },
                        '12%': { opacity: 0.75 },
                        '100%': { transform: [{ scale: 2.6 }], opacity: 0 },
                      },
                      animationDuration: 1700,
                      animationDelay: 180 + i * 320,
                      animationTimingFunction: EASE_OUT,
                      animationFillMode: 'backwards',
                    },
                  ]}
                />
              ))
            : null}

          <View style={[styles.disc, { backgroundColor: c.accent }]} />
        </Animated.View>
      </View>

      <View style={[styles.panel, { backgroundColor: c.background, paddingBottom: insets.bottom + space[4] }]}>
        {/* Fale na górnej krawędzi panelu zasłaniają dół nieba – słońce wschodzi zza nich. */}
        <View pointerEvents="none" style={styles.waves}>
          <WaveBand
            width={width}
            layers={[
              { color: c.background, opacity: 0.35, mid: 22, amp: 12, durationMs: 16000, reverse: true },
              { color: c.background, mid: 34, amp: 11, durationMs: 11000 },
            ]}
          />
        </View>

        {done ? (
          <View style={styles.result}>
            <BouncyTitle text={result ? texts.doneTitle : texts.fallbackTitle} style={styles.center} />
            {result ? (
              <>
                <FadeUp delay={420} style={styles.stats}>
                  <Stat label={texts.sessionsLabel} value={String(result.sessions)} />
                  <Stat label={texts.startLabel} value={result.startLabel} wide />
                </FadeUp>
                <FadeUp delay={560}>
                  <View style={[styles.coach, { backgroundColor: c.surfaceBrandSoft }]}>
                    <Text variant="label" color="textBrand">
                      {texts.coachLabel}
                    </Text>
                    <Text numberOfLines={7}>{result.note}</Text>
                  </View>
                </FadeUp>
              </>
            ) : (
              <FadeUp delay={420}>
                <Text align="center" color="textMuted">
                  {texts.fallbackBody}
                </Text>
              </FadeUp>
            )}
            <FadeUp delay={result ? 700 : 560}>
              <Button label={texts.cta} loading={continuing} onPress={onContinue} />
            </FadeUp>
          </View>
        ) : (
          <View
            style={styles.working}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={texts.progressLabel}
            accessibilityLiveRegion="polite"
            accessibilityValue={{ text: texts.steps[step] }}>
            <View style={styles.message}>
              <Animated.View
                key={step}
                entering={reduced ? FadeIn.duration(motion.duration.normal) : FadeInDown.duration(motion.duration.slow)}
                exiting={FadeOut.duration(motion.duration.fast)}
                style={styles.messageInner}>
                <Text variant="heading" align="center">
                  {texts.steps[step]}
                </Text>
              </Animated.View>
            </View>

            <View style={styles.dots}>
              {texts.steps.map((_, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i <= step ? c.action : c.border,
                      width: i === step ? space[6] : space[2],
                      transitionProperty: ['backgroundColor', 'width'],
                      transitionDuration: motion.duration.normal,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.slow}>
              {slow ? (
                <Animated.View entering={FadeIn.duration(motion.duration.slow)}>
                  <Text variant="caption" align="center">
                    {texts.slow}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.stat, wide && styles.statWide, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text variant="caption">{label}</Text>
      <Text variant="heading" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
  sky: { flex: 1, minHeight: SUN_SIZE + WAVE_HEIGHT, overflow: 'hidden' },
  // Start: słońce w całości pod grzbietem fal (fale zasłaniają dolne WAVE_HEIGHT nieba).
  sun: { position: 'absolute', bottom: WAVE_HEIGHT * 0.35 - SUN_SIZE, width: SUN_SIZE, height: SUN_SIZE },
  glow: {
    position: 'absolute',
    left: (SUN_SIZE - GLOW_SIZE) / 2,
    top: (SUN_SIZE - GLOW_SIZE) / 2,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  ring: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: radius.pill, borderWidth: 2, opacity: 0 },
  disc: { flex: 1, borderRadius: radius.pill },
  waves: { position: 'absolute', left: 0, right: 0, top: -WAVE_HEIGHT, height: WAVE_HEIGHT },
  panel: { paddingHorizontal: space[5], paddingTop: space[5], minHeight: 300 },
  working: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[5] },
  message: { minHeight: 84, alignSelf: 'stretch', justifyContent: 'center' },
  messageInner: { alignSelf: 'stretch' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { height: space[2], borderRadius: radius.pill },
  slow: { minHeight: space[6], justifyContent: 'center' },
  result: { gap: space[5] },
  stats: { flexDirection: 'row', gap: space[3] },
  stat: { flex: 1, gap: space[1], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  statWide: { flex: 2 },
  coach: { gap: space[2], padding: space[4], borderRadius: radius.card },
});
