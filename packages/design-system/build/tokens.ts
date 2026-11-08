/* WYGENEROWANE z packages/design-system/tokens – nie edytuj ręcznie. Zmień tokeny i uruchom `pnpm tokens`. */

export const palette = {
  "teal": {
    "50": "#E6F4F1",
    "100": "#DCEFEA",
    "200": "#CDEBE5",
    "600": "#0E6E66",
    "700": "#0B5A53",
    "800": "#0A524C"
  },
  "amber": {
    "100": "#FFE7C2",
    "400": "#FFB547",
    "900": "#6B4300"
  },
  "neutral": {
    "0": "#FFFFFF",
    "50": "#F5F6F2",
    "200": "#E3E6E0",
    "300": "#C9CFC8",
    "600": "#5A6662",
    "700": "#3D4845",
    "900": "#16211F",
    "950": "#0C1312"
  }
} as const;

export const colors = {
  "light": {
    "background": "#F5F6F2",
    "surface": "#FFFFFF",
    "surfaceBrand": "#0E6E66",
    "surfaceBrandSoft": "#DCEFEA",
    "surfaceAccentSoft": "#FFE7C2",
    "text": "#16211F",
    "textMuted": "#5A6662",
    "textOnBrand": "#FFFFFF",
    "textOnBrandMuted": "#E6F4F1",
    "textBrand": "#0B5A53",
    "textOnAccent": "#16211F",
    "textAccentStrong": "#6B4300",
    "border": "#E3E6E0",
    "borderStrong": "#C9CFC8",
    "action": "#0E6E66",
    "actionHover": "#0A524C",
    "accent": "#FFB547"
  },
  "dark": {
    "background": "#0C1312",
    "surface": "#16211F",
    "surfaceBrand": "#0B5A53",
    "surfaceBrandSoft": "#0A524C",
    "surfaceAccentSoft": "#6B4300",
    "text": "#F5F6F2",
    "textMuted": "#C9CFC8",
    "textOnBrand": "#FFFFFF",
    "textOnBrandMuted": "#DCEFEA",
    "textBrand": "#CDEBE5",
    "textOnAccent": "#16211F",
    "textAccentStrong": "#FFE7C2",
    "border": "#3D4845",
    "borderStrong": "#5A6662",
    "action": "#CDEBE5",
    "actionHover": "#DCEFEA",
    "accent": "#FFB547"
  }
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorRole = keyof typeof colors.light;

export const font = {
  "family": {
    "display": "Space Grotesk",
    "body": "Inter"
  },
  "size": {
    "xs": 12,
    "sm": 14,
    "md": 15,
    "lg": 16,
    "xl": 22,
    "2xl": 26,
    "3xl": 28,
    "4xl": 32
  },
  "weight": {
    "regular": 400,
    "medium": 500,
    "semibold": 600,
    "bold": 700
  }
} as const;

export const space = {
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "12": 48
} as const;

export const radius = {
  "sm": 8,
  "button": 14,
  "md": 16,
  "card": 24,
  "pill": 999
} as const;

export const motion = {
  "duration": {
    "fast": 150,
    "normal": 250,
    "slow": 400
  }
} as const;
