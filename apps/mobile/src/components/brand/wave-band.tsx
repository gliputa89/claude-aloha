import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/**
 * Okresowa fala o długości `period`, powtórzona `count` razy – przesunięcie o jeden okres
 * daje identyczny kształt, więc pętla jest bezszwowa.
 */
function wavePath(period: number, count: number, height: number, mid: number, amp: number) {
  let d = `M0 ${mid}`;
  for (let i = 0; i < count; i++) {
    const x = i * period;
    d += ` C${x + period * 0.18} ${mid - amp} ${x + period * 0.32} ${mid - amp} ${x + period * 0.5} ${mid}`;
    d += ` C${x + period * 0.68} ${mid + amp} ${x + period * 0.82} ${mid + amp} ${x + period} ${mid}`;
  }
  return `${d} L${period * count} ${height} L0 ${height} Z`;
}

type Layer = { color: string; opacity?: number; mid: number; amp: number; durationMs: number; reverse?: boolean };

type WaveBandProps = {
  width: number;
  height?: number;
  layers: Layer[];
};

/** Pas fal na dole sekcji: warstwy powoli dryfują w poziomie (przy „Ogranicz ruch” stoją). */
export function WaveBand({ width, height = 56, layers }: WaveBandProps) {
  const reduced = useReducedMotion();
  return (
    <View pointerEvents="none" style={[styles.band, { height }]} accessible={false}>
      {layers.map((layer, i) => (
        <Animated.View
          key={i}
          style={[
            styles.layer,
            { width: width * 2, height },
            !reduced && {
              animationName: layer.reverse
                ? { from: { transform: [{ translateX: -width }] }, to: { transform: [{ translateX: 0 }] } }
                : { from: { transform: [{ translateX: 0 }] }, to: { transform: [{ translateX: -width }] } },
              animationDuration: layer.durationMs,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            },
          ]}>
          <Svg width={width * 2} height={height}>
            <Path
              d={wavePath(width, 2, height, layer.mid, layer.amp)}
              fill={layer.color}
              opacity={layer.opacity ?? 1}
            />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, bottom: -1, overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, bottom: 0 },
});
