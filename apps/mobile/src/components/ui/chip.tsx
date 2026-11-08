import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { motion, radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `radio` – jeden z grupy, `checkbox` – wielokrotny wybór. */
  role?: 'radio' | 'checkbox';
  accessibilityLabel?: string;
  /** Rozciągnij na dostępne miejsce (np. w rzędzie dni tygodnia). */
  fill?: boolean;
};

export function Chip({ label, selected, onPress, role = 'radio', accessibilityLabel, fill }: ChipProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [fill && styles.fill, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Animated.View
        style={[
          styles.chip,
          fill && styles.chipFill,
          {
            backgroundColor: selected ? c.action : c.surface,
            borderColor: selected ? c.action : c.border,
            transitionProperty: ['backgroundColor', 'borderColor'],
            transitionDuration: motion.duration.fast,
          },
        ]}>
        <Text variant="label" color={selected ? 'textOnBrand' : 'text'} align="center" numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // W rzędzie wielu chipów (dni tygodnia) – mniejszy margines, żeby „Pn” / „Mon” się mieściło.
  chipFill: { paddingHorizontal: space[1] },
  chip: {
    minHeight: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
