import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type AuthFormScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Treść przyklejona na dole (np. przełącznik „Masz już konto?”). */
  footer?: ReactNode;
}>;

/** Wspólny układ ekranów formularzy logowania / rejestracji: nagłówek, przewijana treść, klawiatura nie zasłania pól. */
export function AuthFormScreen({ title, subtitle, footer, children }: AuthFormScreenProps) {
  const c = useColors();
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
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
          </View>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
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
