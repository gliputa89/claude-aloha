import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { motion, radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

const STEPS = [
  'onboarding.summary.forecastStepTables',
  'onboarding.summary.forecastStepVolume',
  'onboarding.summary.forecastStepForm',
] as const;
const STEP_MS = 1700;
/** Co ile ms przeskakują cyfry – szybko jak stoper, ale bez migotania. */
const TICK_MS = 85;

const digit = () => Math.floor(Math.random() * 10);
const pad = (n: number) => String(n).padStart(2, '0');

/** Losowy czas w formacie zawodów: z godziną dla półmaratonu i maratonu, bez niej dla krótszych dystansów. */
function spin(withHours: boolean) {
  const mm = pad(Math.floor(Math.random() * 60));
  const ss = pad(Math.floor(Math.random() * 60));
  return withHours ? `${1 + (digit() % 4)}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Liczenie realnego czasu na zawody: cyfry kręcą się jak stoper szukający wyniku, a pod nimi zmienia się opis
 * tego, co trener właśnie sprawdza. Przy „Ogranicz ruch” cyfry stoją (kreski), zmienia się tylko tekst.
 */
export function ForecastLoading({ title, withHours }: { title: string; withHours: boolean }) {
  const c = useColors();
  const t = useT();
  const reduced = useReducedMotion();
  const [time, setTime] = useState(() => spin(withHours));
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setTime(spin(withHours)), TICK_MS);
    return () => clearInterval(timer);
  }, [reduced, withHours]);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${title}. ${t(STEPS[step]!)}`}>
      <Text weight="bold">{title}</Text>
      {/* Stała szerokość cyfr – liczba nie „pływa”, gdy zmienia się co ułamek sekundy. */}
      <Text variant="title" color="textBrand" style={styles.time} importantForAccessibility="no-hide-descendants">
        {reduced ? (withHours ? '–:––:––' : '––:––') : time}
      </Text>
      <View style={styles.step}>
        <Animated.View
          key={step}
          entering={reduced ? FadeIn.duration(motion.duration.normal) : FadeInDown.duration(motion.duration.normal)}
          exiting={FadeOut.duration(motion.duration.fast)}>
          <Text variant="caption">{t(STEPS[step]!)}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  time: { fontVariant: ['tabular-nums'] },
  // Stała wysokość – karta nie skacze przy zmianie opisu.
  step: { minHeight: 20, justifyContent: 'center' },
});
