import { Eye, EyeSlash, WarningCircle } from 'phosphor-react-native';
import { useEffect, useState, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fontFamily, Text } from '@/components/ui/text';
import { font, motion, radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  /** Pole hasła z przyciskiem „pokaż / ukryj”. */
  secure?: boolean;
  ref?: Ref<TextInputInstance>;
};

export function TextField({ label, hint, error, secure, ref, onFocus, onBlur, style, ...rest }: TextFieldProps) {
  const c = useColors();
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const reduced = useReducedMotion();
  const ToggleIcon = revealed ? EyeSlash : Eye;

  // Obramowanie płynnie przechodzi w kolor akcji przy fokusie; błąd ma pierwszeństwo.
  const focus = useSharedValue(0);
  const shakeX = useSharedValue(0);
  useEffect(() => {
    focus.value = reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: motion.duration.normal });
  }, [focused, reduced, focus]);

  // Nowy błąd = krótkie, delikatne potrząśnięcie polem (bez „Ogranicz ruch”).
  useEffect(() => {
    if (!error || reduced) return;
    const ease = Easing.inOut(Easing.sin);
    shakeX.value = withSequence(
      withTiming(-5, { duration: 45, easing: ease }),
      withRepeat(withTiming(5, { duration: 90, easing: ease }), 3, true),
      withTiming(0, { duration: 45, easing: ease }),
    );
  }, [error, reduced, shakeX]);

  const errorColor = error ? c.accent : null;
  const boxStyle = useAnimatedStyle(() => ({
    borderColor: errorColor ?? interpolateColor(focus.value, [0, 1], [c.border, c.action]),
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <Animated.View style={[styles.box, { backgroundColor: c.surface }, boxStyle]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={c.textMuted}
          selectionColor={c.action}
          cursorColor={c.action}
          secureTextEntry={secure && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: c.text }, style]}
          {...rest}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            onPress={() => setRevealed((v) => !v)}
            style={styles.toggle}
            hitSlop={space[1]}>
            <ToggleIcon size={22} weight="bold" color={c.textMuted} />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(motion.duration.normal)}
          exiting={reduced ? undefined : FadeOut.duration(motion.duration.fast)}
          style={styles.message}
          accessibilityLiveRegion="polite">
          <WarningCircle size={16} weight="bold" color={c.textAccentStrong} />
          <Text variant="caption" color="textAccentStrong" style={styles.messageText}>
            {error}
          </Text>
        </Animated.View>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontFamily: fontFamily.medium,
    fontSize: font.size.lg,
  },
  toggle: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1] },
  messageText: { flex: 1 },
});
