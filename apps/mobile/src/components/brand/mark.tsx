import Svg, { Circle, Path } from 'react-native-svg';

import type { ColorRole } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type MarkProps = {
  size?: number;
  /** Kolor fali: `surfaceBrand` na jasnym tle, `textOnBrand` na tle marki (jak mark-on-brand.svg). */
  wave?: ColorRole;
};

/** Znak „Słońce nad falą” (packages/design-system/assets/logo/mark.svg) w kolorach z ról. */
export function Mark({ size = 64, wave = 'surfaceBrand' }: MarkProps) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessible={false}>
      <Circle cx={32} cy={27} r={14} fill={c.accent} />
      <Path
        d="M6 40c4.3 0 6.5-4.5 13-4.5S27.7 40 32 40s6.5-4.5 13-4.5S53.7 40 58 40v6c-4.3 0-6.5-4.5-13-4.5S36.3 46 32 46s-6.5-4.5-13-4.5S10.3 46 6 46z"
        fill={c[wave]}
      />
      <Path
        d="M12 52c3.3 0 5-3 10-3s6.7 3 10 3 5-3 10-3 6.7 3 10 3"
        fill="none"
        stroke={c[wave]}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
