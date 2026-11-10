import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { EASE_BACK } from '@/constants/easing';
import type { ColorRole } from '@/constants/theme';

type BouncyTitleProps = {
  text: string;
  color?: ColorRole;
  /** Start pierwszej litery (ms). */
  delay?: number;
  /** Odstęp między literami (ms). */
  stagger?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Nagłówek, którego litery wskakują po kolei ze sprężystym odbiciem.
 * Czytnik ekranu dostaje cały tekst naraz. Przy „Ogranicz ruch” tekst tylko się pojawia.
 */
export function BouncyTitle({ text, color = 'text', delay = 0, stagger = 60, style }: BouncyTitleProps) {
  const reduced = useReducedMotion();
  const letters = Array.from(text);

  return (
    <View accessible accessibilityRole="header" accessibilityLabel={text} style={[styles.row, style]}>
      {letters.map((ch, i) => (
        <Animated.View
          key={`${ch}-${i}`}
          importantForAccessibility="no-hide-descendants"
          style={{
            animationName: reduced
              ? { from: { opacity: 0 }, to: { opacity: 1 } }
              : {
                  from: {
                    opacity: 0,
                    transform: [{ translateY: 34 }, { scale: 0.4 }, { rotate: i % 2 ? '10deg' : '-10deg' }],
                  },
                  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }, { rotate: '0deg' }] },
                },
            animationDuration: reduced ? 400 : 620,
            animationDelay: delay + i * stagger,
            animationTimingFunction: EASE_BACK,
            animationFillMode: 'both',
          }}>
          <Text variant="display" color={color}>
            {ch === ' ' ? ' ' : ch}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
