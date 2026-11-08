import { Minus, Plus } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Etykieta dla czytnika ekranu, np. „Ile treningów w tygodniu?”. */
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
};

/** Licznik – / wartość / +. Dla VoiceOver działa jak „adjustable” (gest w górę / w dół). */
export function Stepper({ value, min, max, onChange, label, decreaseLabel, increaseLabel }: StepperProps) {
  const c = useColors();
  const dec = () => value > min && onChange(value - 1);
  const inc = () => value < max && onChange(value + 1);

  return (
    <View
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? inc() : dec())}>
      <StepButton onPress={dec} disabled={value <= min} label={decreaseLabel}>
        <Minus size={20} weight="bold" color={value <= min ? c.textMuted : c.textBrand} />
      </StepButton>
      <Text variant="heading" align="center" style={styles.value}>
        {value}
      </Text>
      <StepButton onPress={inc} disabled={value >= max} label={increaseLabel}>
        <Plus size={20} weight="bold" color={value >= max ? c.textMuted : c.textBrand} />
      </StepButton>
    </View>
  );
}

function StepButton({
  onPress,
  disabled,
  label,
  children,
}: {
  onPress: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: c.surfaceBrandSoft, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[1],
    borderRadius: radius.card,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  value: { minWidth: 56 },
  button: {
    width: 48,
    height: 44,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
