import { cubicBezier } from 'react-native-reanimated';

/** Mocne ease-out dla wejść elementów UI. */
export const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
/** Ruch na ekranie / łagodne „oddychanie” w pętli. */
export const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);
/** Delikatne falowanie (sinusoidalne) – pętle tła. */
export const EASE_SINE = cubicBezier(0.37, 0, 0.63, 1);
