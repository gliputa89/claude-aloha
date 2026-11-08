import type { Icon } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { motion, radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type OptionCardProps = {
  title: string;
  description?: string;
  icon?: Icon;
  selected: boolean;
  onPress: () => void;
};

/** Karta jednokrotnego wyboru (radio) – ikona, tytuł, opis. */
export function OptionCard({ title, description, icon: IconCmp, selected, onPress }: OptionCardProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={onPress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: selected ? c.surfaceBrandSoft : c.surface,
            borderColor: selected ? c.action : c.border,
            transitionProperty: ['backgroundColor', 'borderColor'],
            transitionDuration: motion.duration.fast,
          },
        ]}>
        {IconCmp ? (
          <View style={[styles.icon, { backgroundColor: selected ? c.action : c.surfaceBrandSoft }]}>
            <IconCmp size={24} weight="bold" color={selected ? c.textOnBrand : c.textBrand} />
          </View>
        ) : null}
        <View style={styles.text}>
          <Text variant="bodyStrong" weight="bold">
            {title}
          </Text>
          {description ? <Text variant="caption">{description}</Text> : null}
        </View>
        <View style={[styles.radio, { borderColor: selected ? c.action : c.borderStrong }]}>
          {selected ? <View style={[styles.radioDot, { backgroundColor: c.action }]} /> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    minHeight: 72,
    borderRadius: radius.card,
    borderWidth: 1.5,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill },
});
