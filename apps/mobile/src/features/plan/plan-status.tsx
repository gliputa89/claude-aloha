import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { usePlan } from '@/features/plan/plan-provider';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

/** Stany planu bez danych: wczytywanie, układanie, błąd. Gdy plan jest gotowy – nic nie rysuje. */
export function PlanStatus() {
  const c = useColors();
  const t = useT();
  const { state, reload, generate } = usePlan();

  if (state.kind === 'loading' || state.kind === 'generating') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.action} size="large" />
        {state.kind === 'generating' ? <Text color="textMuted">{t('plan.generating')}</Text> : null}
      </View>
    );
  }
  if (state.kind === 'failed') {
    return (
      <View style={styles.block}>
        <Notice message={t('plan.failed')} />
        <Button label={t('plan.retry')} onPress={() => generate()} />
      </View>
    );
  }
  if (state.kind === 'loadFailed') {
    return (
      <View style={styles.block}>
        <Notice message={t('plan.loadFailed')} />
        <Button variant="secondary" label={t('plan.retry')} onPress={reload} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space[3], paddingVertical: space[8] },
  block: { gap: space[3] },
});
