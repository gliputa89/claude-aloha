import { Watch } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { space } from '@/constants/theme';
import type { PlanSession } from '@/features/plan/api';
import { useAppleWatch } from '@/features/watch/apple-watch';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

/**
 * „Wyślij na Apple Watch”: planuje trening w aplikacji Trening na dzień z planu (WorkoutKit).
 * Nie pokazuje się bez zegarka, na Androidzie i dla treningów bez odcinków.
 */
export function AppleWatchButton({ session }: { session: PlanSession }) {
  const c = useColors();
  const t = useT();
  const { available, state, send, preview } = useAppleWatch(session);
  if (!available) return null;

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
        onPress={send}
      />
      {state === 'denied' ? <Notice message={t('workoutDetail.watch.denied')} /> : null}
      {state === 'error' ? <Notice message={t('workoutDetail.watch.error')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
});
