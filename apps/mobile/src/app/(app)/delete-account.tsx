import type { TranslationKey } from '@aloha/i18n';
import { router, Stack } from 'expo-router';
import { CalendarBlank, ChatCircleDots, Flag, Lightning, Smiley, X, type IconProps } from 'phosphor-react-native';
import { useState, type ComponentType } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';
import { appleSignInAvailable, deleteAccount, usesAppleSignIn } from '@/lib/auth';
import { useAuth } from '@/providers/auth-provider';

/** Co znika razem z kontem – w kolejności, w jakiej biegacz o tym myśli. */
const LOST: { key: TranslationKey; Icon: ComponentType<IconProps> }[] = [
  { key: 'deleteAccount.lostPlan', Icon: CalendarBlank },
  { key: 'deleteAccount.lostGoal', Icon: Flag },
  { key: 'deleteAccount.lostCheckIns', Icon: Smiley },
  { key: 'deleteAccount.lostChats', Icon: ChatCircleDots },
  { key: 'deleteAccount.lostStrava', Icon: Lightning },
];

/**
 * Arkusz „Usuń konto” (z Profilu): co zniknie, co zostanie (zapis o usunięciu), potwierdzenie wpisaniem słowa
 * i usunięcie po stronie serwera. Po usunięciu telefon się wylogowuje, a nawigator wraca do ekranu startowego.
 */
export default function DeleteAccountScreen() {
  const c = useColors();
  const t = useT();
  const { session } = useAuth();
  const user = session?.user;
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const word = t('deleteAccount.confirmWord');
  const confirmed = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
  const apple = appleSignInAvailable && usesAppleSignIn(user);

  const remove = async () => {
    if (!user || !confirmed || busy) return;
    setBusy(true);
    setError(null);
    const result = await deleteAccount(user);
    if (result.status === 'deleted') {
      Alert.alert(t('deleteAccount.doneTitle'), t('deleteAccount.doneBody'));
      return;
    }
    setBusy(false);
    if (result.status === 'error') setError(result.error);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <View style={[styles.bar, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <View style={[styles.grabber, { backgroundColor: c.borderStrong }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workoutDetail.close')}
          disabled={busy}
          onPress={() => router.back()}
          hitSlop={space[2]}
          style={({ pressed }) => [styles.close, { backgroundColor: c.surface, opacity: pressed ? 0.6 : 1 }]}>
          <X size={18} weight="bold" color={c.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text variant="title" accessibilityRole="header">
            {t('deleteAccount.title')}
          </Text>
          <Text color="textMuted">{t('deleteAccount.body')}</Text>
        </View>

        <View style={styles.section}>
          <Text variant="heading" accessibilityRole="header">
            {t('deleteAccount.lostTitle')}
          </Text>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {LOST.map(({ key, Icon }, i) => (
              <View
                key={key}
                style={[styles.row, i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
                  <Icon size={20} weight="bold" color={c.textBrand} />
                </View>
                <Text style={styles.flex}>{t(key)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="heading" accessibilityRole="header">
            {t('deleteAccount.keptTitle')}
          </Text>
          <Text color="textMuted">{t('deleteAccount.keptBody')}</Text>
        </View>

        {apple ? <Text color="textMuted">{t('deleteAccount.appleNote')}</Text> : null}

        <TextField
          label={t('deleteAccount.confirmLabel', { word })}
          placeholder={word}
          value={typed}
          onChangeText={(text) => {
            setTyped(text);
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={remove}
        />

        {error ? <Notice message={t(error)} /> : null}

        <View style={styles.actions}>
          <Button
            variant="danger"
            label={t('deleteAccount.submit')}
            loading={busy}
            disabled={!confirmed || busy}
            onPress={remove}
          />
          <Button variant="secondary" label={t('deleteAccount.keep')} disabled={busy} onPress={() => router.back()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { height: 56, alignItems: 'center', justifyContent: 'center' },
  grabber: { position: 'absolute', top: space[2], width: 36, height: 5, borderRadius: radius.pill },
  close: {
    position: 'absolute',
    top: space[3],
    right: space[4],
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[12], gap: space[6] },
  head: { gap: space[2] },
  section: { gap: space[3] },
  card: { borderRadius: radius.card, borderWidth: 1.5, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 56,
  },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: space[3] },
});
