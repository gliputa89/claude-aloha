import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { font, type ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** Na RN każda grubość to osobna rodzina – mapujemy `font.weight` w jednym miejscu. */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const satisfies Record<keyof typeof font.weight, string>;

const variants = {
  display: { size: '4xl', weight: 'extrabold', lineHeight: 1.15 },
  title: { size: '3xl', weight: 'extrabold', lineHeight: 1.2 },
  heading: { size: 'xl', weight: 'bold', lineHeight: 1.25 },
  body: { size: 'lg', weight: 'regular', lineHeight: 1.45 },
  bodyStrong: { size: 'lg', weight: 'semibold', lineHeight: 1.45 },
  label: { size: 'sm', weight: 'semibold', lineHeight: 1.4 },
  caption: { size: 'sm', weight: 'regular', lineHeight: 1.4 },
} as const satisfies Record<
  string,
  { size: keyof typeof font.size; weight: keyof typeof font.weight; lineHeight: number }
>;

export type TextVariant = keyof typeof variants;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: ColorRole;
  weight?: keyof typeof font.weight;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color, weight, align, style, ...rest }: TextProps) {
  const c = useColors();
  const v = variants[variant];
  const size = font.size[v.size];
  const defaultColor: ColorRole = variant === 'caption' ? 'textMuted' : 'text';
  return (
    <RNText
      style={[
        {
          fontFamily: fontFamily[weight ?? v.weight],
          fontSize: size,
          lineHeight: Math.round(size * v.lineHeight),
          color: c[color ?? defaultColor],
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}
