import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, space, type ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type Variant = 'primary' | 'secondary' | 'plain';

const look: Record<Variant, { bg?: ColorRole; text: ColorRole; border?: ColorRole }> = {
  primary: { bg: 'action', text: 'textOnBrand' },
  secondary: { bg: 'surface', text: 'text', border: 'border' },
  plain: { text: 'textBrand' },
};

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

export function Button({ label, variant = 'primary', loading = false, disabled, style, ...rest }: ButtonProps) {
  const c = useColors();
  const l = look[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      hitSlop={variant === 'plain' ? space[2] : undefined}
      style={(state) => [
        styles.base,
        variant === 'plain' ? styles.plain : styles.filled,
        {
          backgroundColor: l.bg ? c[l.bg] : 'transparent',
          borderColor: l.border ? c[l.border] : 'transparent',
          opacity: disabled && !loading ? 0.5 : state.pressed ? 0.85 : 1,
          transform: [{ scale: state.pressed && variant !== 'plain' ? 0.98 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={c[l.text]} />
        ) : (
          <Text variant="bodyStrong" weight="bold" color={l.text} align="center">
            {label}
          </Text>
        )}
      </View>
    </Pressable>
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
