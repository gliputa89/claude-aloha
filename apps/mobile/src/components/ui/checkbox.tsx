import { Check } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Tekst albo własna treść (np. z linkami). */
  label: ReactNode;
  /** Etykieta dla czytnika ekranu, gdy `label` nie jest zwykłym tekstem. */
  accessibilityLabel?: string;
  invalid?: boolean;
};

export function Checkbox({ checked, onChange, label, accessibilityLabel, invalid }: CheckboxProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
      onPress={() => onChange(!checked)}
      style={styles.row}>
      <View
        style={[
          styles.box,
          {
            backgroundColor: checked ? c.action : c.surface,
            borderColor: checked ? c.action : invalid ? c.accent : c.borderStrong,
          },
        ]}>
        {checked ? <Check size={16} weight="bold" color={c.textOnBrand} /> : null}
      </View>
      <View style={styles.label}>{typeof label === 'string' ? <Text>{label}</Text> : label}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 44,
    paddingVertical: space[1],
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
