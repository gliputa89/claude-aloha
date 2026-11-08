import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Pattern, Rect } from 'react-native-svg';

import type { ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

const PETAL_ANGLES = [0, 72, 144, 216, 288];

function Flower({ transform }: { transform: string }) {
  return (
    <G transform={transform}>
      {PETAL_ANGLES.map((angle) => (
        <Ellipse key={angle} cx={32} cy={18} rx={8.5} ry={14} transform={`rotate(${angle} 32 32)`} />
      ))}
      <Circle cx={32} cy={32} r={6.5} />
    </G>
  );
}

type PlumeriaPatternProps = {
  color?: ColorRole;
  /** 0.10–0.15 wg zasad marki. */
  opacity?: number;
};

/**
 * Tonalny wzór plumerii (assets/patterns/plumeria.svg) wypełniający rodzica.
 * Tylko ekran startowy i onboarding – nigdy na ekranach z planem.
 */
export function PlumeriaPattern({ color = 'textOnBrand', opacity = 0.12 }: PlumeriaPatternProps) {
  const c = useColors();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <Defs>
        <Pattern id="plumeria" width={56} height={56} patternUnits="userSpaceOnUse">
          <G fill={c[color]}>
            <Flower transform="translate(4 4) scale(.34)" />
            <Flower transform="translate(32 30) scale(.24) rotate(25 32 32)" />
          </G>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#plumeria)" opacity={opacity} />
    </Svg>
  );
}
