import { CheckCircle, WarningCircle } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type NoticeProps = {
  message: string;
  /** `warning` – coś do poprawienia (bursztyn, bez czerwieni), `success` – potwierdzenie. */
  tone?: 'warning' | 'success';
};

export function Notice({ message, tone = 'warning' }: NoticeProps) {
  const c = useColors();
  const warning = tone === 'warning';
  const Icon = warning ? WarningCircle : CheckCircle;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: warning ? c.surfaceAccentSoft : c.surfaceBrandSoft }]}>
      <Icon size={20} weight="bold" color={warning ? c.textAccentStrong : c.textBrand} />
      <Text variant="caption" weight="medium" color={warning ? 'textAccentStrong' : 'textBrand'} style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[4],
    borderRadius: radius.card,
  },
  text: { flex: 1 },
});
