/* WYGENEROWANE z packages/design-system/tokens – nie edytuj ręcznie. Zmień tokeny i uruchom `pnpm tokens`. */

export const palette = {
  "teal": {
    "50": "#EAF5F3",
    "100": "#DDEFEC",
    "200": "#7ED8CE",
    "400": "#3FB8AC",
    "600": "#0E6E66",
    "700": "#0B5A53",
    "800": "#0A524C",
    "900": "#173A36",
    "950": "#04211E"
  },
  "amber": {
    "100": "#FFE7C2",
    "400": "#FFB547",
    "900": "#6B4300",
    "950": "#3A2600"
  },
  "neutral": {
    "0": "#FFFFFF",
    "50": "#F3F7F6",
    "100": "#E8F1EF",
    "200": "#DCE6E4",
    "300": "#C5D2D0",
    "400": "#93A6A3",
    "600": "#5B6B69",
    "700": "#253533",
    "800": "#152120",
    "900": "#10201E",
    "950": "#0C1514"
  },
  "workout": {
    "easy": "#3FA796",
    "long": "#2D7FB8",
    "intervals": "#F08A3C",
    "tempo": "#D9534F",
    "walkRun": "#8E7CC3",
    "rest": "#C5D2D0"
  }
} as const;

export const colors = {
  "light": {
    "background": "#F3F7F6",
    "surface": "#FFFFFF",
    "surfaceBrand": "#0E6E66",
    "surfaceBrandSoft": "#DDEFEC",
    "surfaceAccentSoft": "#FFE7C2",
    "text": "#10201E",
    "textMuted": "#5B6B69",
    "textOnBrand": "#FFFFFF",
    "textOnBrandMuted": "#EAF5F3",
    "textBrand": "#0E6E66",
    "textOnAccent": "#3A2600",
    "textAccentStrong": "#6B4300",
    "border": "#DCE6E4",
    "borderStrong": "#C5D2D0",
    "action": "#0E6E66",
    "actionHover": "#0A524C",
    "accent": "#FFB547",
    "workoutEasy": "#3FA796",
    "workoutLong": "#2D7FB8",
    "workoutIntervals": "#F08A3C",
    "workoutTempo": "#D9534F",
    "workoutWalkRun": "#8E7CC3",
    "workoutRest": "#C5D2D0",
    "textOnWorkout": "#0C1514"
  },
  "dark": {
    "background": "#0C1514",
    "surface": "#152120",
    "surfaceBrand": "#3FB8AC",
    "surfaceBrandSoft": "#173A36",
    "surfaceAccentSoft": "#6B4300",
    "text": "#E8F1EF",
    "textMuted": "#93A6A3",
    "textOnBrand": "#04211E",
    "textOnBrandMuted": "#173A36",
    "textBrand": "#7ED8CE",
    "textOnAccent": "#3A2600",
    "textAccentStrong": "#FFE7C2",
    "border": "#253533",
    "borderStrong": "#5B6B69",
    "action": "#3FB8AC",
    "actionHover": "#7ED8CE",
    "accent": "#FFB547",
    "workoutEasy": "#3FA796",
    "workoutLong": "#2D7FB8",
    "workoutIntervals": "#F08A3C",
    "workoutTempo": "#D9534F",
    "workoutWalkRun": "#8E7CC3",
    "workoutRest": "#5B6B69",
    "textOnWorkout": "#0C1514"
  }
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorRole = keyof typeof colors.light;

export const font = {
  "family": {
    "display": "Plus Jakarta Sans",
    "body": "Plus Jakarta Sans"
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
    "bold": 700,
    "extrabold": 800
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
  "button": 10,
  "md": 12,
  "card": 14,
  "pill": 999
} as const;

export const motion = {
  "duration": {
    "fast": 150,
    "normal": 250,
    "slow": 400
  }
} as const;
