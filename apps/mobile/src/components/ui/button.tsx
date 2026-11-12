import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { motion, radius, space, type ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'plain';

const look: Record<Variant, { bg?: ColorRole; text: ColorRole; border?: ColorRole }> = {
  primary: { bg: 'action', text: 'textOnBrand' },
  secondary: { bg: 'surface', text: 'text', border: 'border' },
  // Nieodwracalna akcja (np. usunięcie konta) – kontur zamiast czerwonego tła, czytelny w obu trybach.
  danger: { bg: 'surface', text: 'danger', border: 'danger' },
  plain: { text: 'textBrand' },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Sprężyna wciśnięcia: szybka, bez przesadnego odbicia. */
const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  /** Ikona przed etykietą (np. logo dostawcy logowania). */
  icon?: ReactNode;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  icon,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  const l = look[variant];
  const inactive = disabled || loading;
  const pressed = useSharedValue(0);

  const baseOpacity = disabled && !loading ? 0.5 : 1;
  const pressStyle = useAnimatedStyle(() =>
    variant === 'plain'
      ? { opacity: baseOpacity * (1 - pressed.value * 0.45) }
      : { transform: [{ scale: 1 - pressed.value * 0.035 }], opacity: baseOpacity * (1 - pressed.value * 0.1) },
  );
  const press = (to: number) => {
    pressed.value = reduced ? to : withSpring(to, PRESS_SPRING);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      hitSlop={variant === 'plain' ? space[2] : undefined}
      onPressIn={(e) => {
        press(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press(0);
        onPressOut?.(e);
      }}
      style={[
        styles.base,
        variant === 'plain' ? styles.plain : styles.filled,
        {
          backgroundColor: l.bg ? c[l.bg] : 'transparent',
          borderColor: l.border ? c[l.border] : 'transparent',
        },
        typeof style === 'function' ? undefined : style,
        pressStyle,
      ]}
      {...rest}>
      <View style={styles.content}>
        {/* Etykieta i wskaźnik ładowania płynnie się wymieniają. */}
        {loading ? (
          <Animated.View
            key="loading"
            entering={reduced ? undefined : FadeIn.duration(motion.duration.normal)}
            exiting={reduced ? undefined : FadeOut.duration(motion.duration.fast)}>
            <ActivityIndicator color={c[l.text]} />
          </Animated.View>
        ) : (
          <Animated.View
            key="label"
            entering={reduced ? undefined : FadeIn.duration(motion.duration.normal)}
            exiting={reduced ? undefined : FadeOut.duration(motion.duration.fast)}
            style={styles.content}>
            {icon}
            <Text variant="bodyStrong" weight="bold" color={l.text} align="center">
              {label}
            </Text>
          </Animated.View>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    justifyContent: 'center',
  },
  filled: {
    minHeight: 52,
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  plain: {
    minHeight: 44,
    paddingHorizontal: space[2],
    alignSelf: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
});
