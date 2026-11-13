import type { TranslationKey } from '@aloha/i18n';
import { router } from 'expo-router';
import { ArrowsClockwise, CalendarCheck, ListChecks, type Icon } from 'phosphor-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlumeriaPattern } from '@/components/brand/plumeria-pattern';
import { SunriseMark } from '@/components/brand/sunrise-mark';
import { WaveBand } from '@/components/brand/wave-band';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/ui/fade-up';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { radius, space } from '@/constants/theme';
import { saveDisplayName } from '@/features/onboarding/save';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';
import { useAuth } from '@/providers/auth-provider';

const WAVE_HEIGHT = 48;
const NAME_MAX = 80;

/** Co nas czeka – trzy krótkie punkty pod powitaniem. */
const POINTS: { icon: Icon; title: TranslationKey; desc: TranslationKey }[] = [
  { icon: ListChecks, title: 'onboarding.hello.questionsTitle', desc: 'onboarding.hello.questionsDesc' },
  { icon: CalendarCheck, title: 'onboarding.hello.planTitle', desc: 'onboarding.hello.planDesc' },
  { icon: ArrowsClockwise, title: 'onboarding.hello.dailyTitle', desc: 'onboarding.hello.dailyDesc' },
];

/**
 * Powitanie przed ankietą: „Aloha, {imię}!” i krótko, co zrobimy.
 * Imię jest wymagane – konto z Apple często go nie ma (Apple podaje je tylko przy pierwszej autoryzacji),
 * więc wtedy pytamy o nie tutaj i zapisujemy w profilu.
 */
export default function HelloStep() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, profile, refreshProfile } = useAuth();

  const knownName = profile?.display_name?.trim() || null;
  const firstName = knownName?.split(/\s+/)[0] ?? null;
  // Raz zapytane – zostaje pole, nawet gdy po zapisie profil ma już imię (powrót z kolejnych kroków).
  const [askName] = useState(!knownName);
  const [name, setName] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  const start = async () => {
    if (!askName) {
      router.push('/goal');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError('authErrors.nameRequired');
      return;
    }
    const userId = session?.user.id;
    if (!userId) return;
    setSaving(true);
    try {
      if (trimmed !== knownName) await saveDisplayName(userId, trimmed);
      router.push('/goal');
      void refreshProfile();
    } catch {
      setError('onboarding.hello.nameSaveFailed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <View style={[styles.hero, { backgroundColor: c.surfaceBrand, paddingTop: insets.top + space[8] }]}>
            <PlumeriaPattern />
            <SunriseMark size={96} idle={false} />
            <View pointerEvents="none" style={styles.waves}>
              <WaveBand
                width={width}
                height={WAVE_HEIGHT}
                layers={[
                  { color: c.background, opacity: 0.35, mid: 20, amp: 10, durationMs: 16000, reverse: true },
                  { color: c.background, mid: 30, amp: 9, durationMs: 11000 },
                ]}
              />
            </View>
          </View>

          <View style={styles.content}>
            <FadeUp delay={250} style={styles.header}>
              <Text variant="display" accessibilityRole="header">
                {firstName && !askName
                  ? t('onboarding.hello.title', { name: firstName })
                  : t('onboarding.hello.titleNoName')}
              </Text>
              <Text color="textMuted">{t('onboarding.hello.lead')}</Text>
            </FadeUp>

            {askName ? (
              <FadeUp delay={350}>
                <TextField
                  label={t('onboarding.hello.nameAsk')}
                  placeholder={t('signUp.namePlaceholder')}
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    setError(null);
                  }}
                  error={error ? t(error) : undefined}
                  maxLength={NAME_MAX}
                  autoComplete="given-name"
                  textContentType="givenName"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={start}
                />
              </FadeUp>
            ) : null}

            <View style={styles.points}>
              {POINTS.map(({ icon: PointIcon, title, desc }, i) => (
                <FadeUp key={title} delay={(askName ? 450 : 350) + i * 80}>
                  <View style={styles.point}>
                    <View style={[styles.pointIcon, { backgroundColor: c.surfaceBrandSoft }]}>
                      <PointIcon size={22} weight="bold" color={c.textBrand} />
                    </View>
                    <View style={styles.pointText}>
                      <Text variant="bodyStrong">{t(title)}</Text>
                      <Text variant="caption">{t(desc)}</Text>
                    </View>
                  </View>
                </FadeUp>
              ))}
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { borderTopColor: c.border, backgroundColor: c.background, paddingBottom: insets.bottom + space[2] },
          ]}>
          <Button label={t('onboarding.hello.start')} loading={saving} onPress={start} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    overflow: 'hidden',
    paddingBottom: WAVE_HEIGHT + space[4],
  },
  waves: { position: 'absolute', left: 0, right: 0, bottom: 0, height: WAVE_HEIGHT },
  content: {
    paddingHorizontal: space[5],
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[6],
  },
  header: { gap: space[3] },
  points: { gap: space[4] },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  pointIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1, gap: space[1] },
  footer: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
