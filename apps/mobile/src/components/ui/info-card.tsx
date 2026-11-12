import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** Prosta karta z informacją (dzień wolny, brak treningu). `loading` – treść jeszcze się wczytuje. */
export function InfoCard({ title, body, loading = false }: { title?: string; body: string; loading?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {title ? <Text weight="bold">{title}</Text> : null}
      {loading ? (
        <View style={styles.lines}>
          <Skeleton />
          <Skeleton />
          <Skeleton width="60%" />
        </View>
      ) : (
        <Text variant="caption">{body}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[1], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  // Trzy wiersze o wysokości zbliżonej do typowej notki – karta nie skacze, gdy tekst dojdzie.
  lines: { gap: space[2], paddingVertical: space[1] },
});
