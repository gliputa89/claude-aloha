import { openURL } from 'expo-linking';
import { Watch } from 'phosphor-react-native';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { space } from '@/constants/theme';
import type { PlanSession } from '@/features/plan/api';
import { useAppleWatch } from '@/features/watch/apple-watch';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

/** Wyjaśnienie przed prośbą iOS pokazujemy raz na uruchomienie – przy kolejnych próbach od razu wysyłamy. */
let askedThisLaunch = false;

/** Aplikacja Watch na iPhonie – tam, w ustawieniach Treningu, iOS trzyma zgodę na dodawanie treningów (WorkoutKit). */
const WATCH_APP_URL = 'itms-watchs://';

/**
 * „Wyślij na Apple Watch”: planuje trening w aplikacji Trening na dzień z planu (WorkoutKit).
 * Przed pierwszym pytaniem iOS o zgodę mówi, co się stanie. Po odmowie iOS nie zapyta drugi raz – wtedy okienko
 * prowadzi do aplikacji Watch, gdzie zgodę włącza się ręcznie.
 * Nie pokazuje się bez zegarka, na Androidzie i dla treningów bez odcinków.
 */
export function AppleWatchButton({ session }: { session: PlanSession }) {
  const c = useColors();
  const t = useT();
  const { available, state, errorDetail, authorization, send, preview } = useAppleWatch(session);
  if (!available) return null;

  const showBlocked = (reason: 'denied' | 'restricted') =>
    Alert.alert(
      t('workoutDetail.watch.blockedTitle'),
      t(reason === 'restricted' ? 'workoutDetail.watch.restrictedBody' : 'workoutDetail.watch.blockedBody'),
      reason === 'restricted'
        ? [{ text: t('workoutDetail.watch.close'), style: 'cancel' }]
        : [
            { text: t('workoutDetail.watch.close'), style: 'cancel' },
            { text: t('workoutDetail.watch.openWatch'), onPress: () => void openURL(WATCH_APP_URL).catch(() => {}) },
          ],
    );

  const sendNow = async () => {
    const result = await send();
    if (result === 'denied' || result === 'restricted') showBlocked(result);
  };

  const onPress = async () => {
    const auth = await authorization();
    if (auth === 'denied' || auth === 'restricted') return showBlocked(auth);
    if (auth !== 'notDetermined' || askedThisLaunch) return void sendNow();
    askedThisLaunch = true;
    // Pierwszy raz: krótko, po co iOS zaraz zapyta – odmowa jest trudna do cofnięcia.
    Alert.alert(t('workoutDetail.watch.askTitle'), t('workoutDetail.watch.askBody'), [
      { text: t('workoutDetail.watch.askLater'), style: 'cancel' },
      { text: t('workoutDetail.watch.askContinue'), onPress: () => void sendNow() },
    ]);
  };

  if (state === 'scheduled') {
    return (
      <View style={styles.wrap}>
        <Notice tone="success" message={t('workoutDetail.watch.scheduled')} />
        <Button variant="plain" label={t('workoutDetail.watch.preview')} onPress={preview} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Button
        variant="secondary"
        label={t('workoutDetail.watch.send')}
        icon={<Watch size={20} weight="bold" color={c.text} />}
        loading={state === 'sending'}
        onPress={onPress}
      />
      {state === 'pending' ? (
        <Notice message={__DEV__ && errorDetail ? `${t('workoutDetail.watch.pending')}\n\n${errorDetail}` : t('workoutDetail.watch.pending')} />
      ) : null}
      {state === 'error' ? (
        // W buildzie deweloperskim dopisujemy techniczny powód – do diagnozy na telefonie, użytkownik go nie widzi.
        <Notice message={__DEV__ && errorDetail ? `${t('workoutDetail.watch.error')}\n\n${errorDetail}` : t('workoutDetail.watch.error')} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
});
