import { Children, isValidElement, useState, type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SunriseMark } from '@/components/brand/sunrise-mark';
import { FadeUp } from '@/components/ui/fade-up';
import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type AuthFormScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Treść przyklejona na dole (np. przełącznik „Masz już konto?”). */
  footer?: ReactNode;
}>;

/** Kolejne elementy formularza wchodzą jeden po drugim, co tyle ms. */
const STAGGER = 70;
const FIRST_CHILD_DELAY = 260;

/**
 * Wspólny układ ekranów formularzy logowania / rejestracji: znak ze wschodem słońca, nagłówek,
 * przewijana treść, klawiatura nie zasłania pól. Elementy wchodzą kaskadowo, a gdy w trakcie
 * pojawi się nowy (np. komunikat błędu), reszta płynnie się przesuwa.
 */
export function AuthFormScreen({ title, subtitle, footer, children }: AuthFormScreenProps) {
  const c = useColors();
  const items = Children.toArray(children)
    .filter(isValidElement)
    .map((child, i) => ({ child, key: String(child.key ?? i) }));
  // Kaskada tylko dla elementów z pierwszego renderu – dodane później (np. błąd) wchodzą od razu.
  const [initialDelays] = useState(
    () => new Map(items.map(({ key }, i) => [key, FIRST_CHILD_DELAY + i * STAGGER])),
  );
  const [footerDelay] = useState(() => FIRST_CHILD_DELAY + (items.length + 1) * STAGGER);

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior="automatic">
          <View style={styles.header}>
            <SunriseMark size={56} wave="textBrand" delay={0} glow={false} />
            <FadeUp delay={120}>
              <Text variant="title" accessibilityRole="header">
                {title}
              </Text>
            </FadeUp>
            {subtitle ? (
              <FadeUp delay={180}>
                <Text color="textMuted">{subtitle}</Text>
              </FadeUp>
            ) : null}
          </View>
          {items.map(({ child, key }) => (
            <FadeUp key={key} delay={initialDelays.get(key) ?? 0} glide>
              {child}
            </FadeUp>
          ))}
          {footer ? (
            <FadeUp delay={footerDelay} glide style={styles.footer}>
              {footer}
            </FadeUp>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  header: { gap: space[2] },
  footer: { marginTop: 'auto', alignItems: 'center' },
});
