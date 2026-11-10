import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** Prosta karta z informacją (dzień wolny, brak treningu). */
export function InfoCard({ title, body }: { title?: string; body: string }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {title ? <Text weight="bold">{title}</Text> : null}
      <Text variant="caption">{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[1], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
});
