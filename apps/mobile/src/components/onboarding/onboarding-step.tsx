import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { motion, radius, space } from '@/constants/theme';
import { EASE_OUT } from '@/constants/easing';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

export const ONBOARDING_STEPS = 5;

type OnboardingStepProps = PropsWithChildren<{
  step: number;
  title: string;
  subtitle?: string;
  /** Przycisk(i) przyklejone na dole, nad paskiem domowym. */
  footer: ReactNode;
}>;

/** Wspólny układ kroku ankiety: pasek postępu, nagłówek, przewijana treść, akcja na dole. */
export function OnboardingStep({ step, title, subtitle, footer, children }: OnboardingStepProps) {
  const c = useColors();
  const t = useT();

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <View
            style={styles.progress}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('onboarding.progress', { step, total: ONBOARDING_STEPS })}
            accessibilityValue={{ min: 0, max: ONBOARDING_STEPS, now: step }}>
            {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
              <View key={i} style={[styles.segment, { backgroundColor: c.border }]}>
                {i < step ? (
                  <Animated.View
                    style={[
                      styles.segmentFill,
                      { backgroundColor: c.action },
                      // Bieżący segment wypełnia się przy wejściu na krok.
                      i === step - 1 && {
                        animationName: { from: { transform: [{ scaleX: 0 }] }, to: { transform: [{ scaleX: 1 }] } },
                        animationDuration: motion.duration.slow,
                        animationTimingFunction: EASE_OUT,
                        transformOrigin: 'left',
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.header}>
            <Text variant="caption" weight="semibold" color="textBrand">
              {t('onboarding.progress', { step, total: ONBOARDING_STEPS })}
            </Text>
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
          </View>

          {children}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Nagłówek sekcji wewnątrz kroku (np. „Dystans”). */
export function StepSection({ label, hint, children }: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <View style={styles.section}>
      <Text variant="label">{label}</Text>
      {children}
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: space[5],
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[6],
  },
  progress: { flexDirection: 'row', gap: space[1] },
  segment: { flex: 1, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  segmentFill: { flex: 1, borderRadius: radius.pill },
  header: { gap: space[2] },
  section: { gap: space[3] },
  footer: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[2],
    gap: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
