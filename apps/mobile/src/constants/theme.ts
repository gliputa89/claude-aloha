/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { colors } from '@aloha/design-system';
import { Platform } from 'react-native';

export { colors, font, motion, radius, space } from '@aloha/design-system';

// Kolory pochodzą z packages/design-system (wspólne tokeny dla aplikacji i strony).
// Klucze poniżej zostawiamy zgodne z szablonem Expo; nowe ekrany korzystają bezpośrednio z ról `colors`.
const fromTokens = (scheme: 'light' | 'dark') => ({
  ...colors[scheme],
  backgroundElement: colors[scheme].surface,
  backgroundSelected: colors[scheme].surfaceBrandSoft,
  textSecondary: colors[scheme].textMuted,
});

export const Colors = {
  light: fromTokens('light'),
  dark: fromTokens('dark'),
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
