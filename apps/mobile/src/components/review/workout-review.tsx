import type { TranslationKey } from '@aloha/i18n';
import type { ReviewAxis } from '@aloha/plan-engine';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Mark } from '@/components/brand/mark';
import { FadeUp } from '@/components/ui/fade-up';
import { Text } from '@/components/ui/text';
import { EASE_OUT } from '@/constants/easing';
import { radius, space } from '@/constants/theme';
import type { SessionReview } from '@/features/plan/api';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

/** Skala paska objętości: 100% planu wypada w 5/7 szerokości, żeby „za dużo” też było widać. */
const BAR_MAX_PERCENT = 140;

/**
 * Ocena zrobionego treningu: pasek „plan kontra wykonanie”, dwie osie (objętość, intensywność), obserwacje
 * z liczbami i notka trenera AI. Werdykt słowny jest tytułem karty „Zrobione”. Bez czerwieni i bez punktów.
 * `play` – pierwsze otwarcie: pasek się wypełnia, a kolejne elementy wchodzą po kolei od `delay`.
 */
export function WorkoutReview({ review, play, delay }: { review: SessionReview; play: boolean; delay: number }) {
  const c = useColors();
  const t = useT();
  const reduced = useReducedMotion();
  const animate = play && !reduced;
  const axes: { key: 'volume' | 'intensity'; level: ReviewAxis }[] = [
    { key: 'volume', level: review.volume },
    ...(review.intensity ? [{ key: 'intensity' as const, level: review.intensity }] : []),
  ];
  const percent = review.facts.find((f) => f.code.startsWith('volume_'))?.values.percent;
  const fill = percent === undefined ? null : (Math.min(percent, BAR_MAX_PERCENT) / BAR_MAX_PERCENT) * 100;
  // Kolejność wejścia: pasek → osie → obserwacje → notka trenera.
  const step = (i: number) => (animate ? delay + i * 110 : 0);

  return (
    <View style={styles.box}>
      {fill !== null ? (
        <View accessible={false} style={[styles.track, { backgroundColor: c.surface }]}>
          <Animated.View
            style={[
              styles.fill,
              { width: `${fill}%`, backgroundColor: review.volume === 'ok' ? c.surfaceBrand : c.accent },
              animate && {
                animationName: { from: { width: '0%' }, to: { width: `${fill}%` } },
                animationDuration: 900,
                animationDelay: delay,
                animationTimingFunction: EASE_OUT,
                animationFillMode: 'both',
              },
            ]}
          />
          <View style={[styles.mark, { left: `${(100 / BAR_MAX_PERCENT) * 100}%`, backgroundColor: c.text }]} />
        </View>
      ) : null}

      <FadeUp delay={step(2)} distance={8}>
        <View style={styles.axes}>
          {axes.map(({ key, level }) => (
            <View
              key={key}
              accessible
              accessibilityLabel={`${t(`review.axis.${key}`)}: ${t(`review.${key}.${level}`)}`}
              style={[styles.axis, { backgroundColor: level === 'ok' ? c.surfaceBrand : c.surfaceAccentSoft }]}>
              <Text variant="caption" weight="semibold" color={level === 'ok' ? 'textOnBrand' : 'textAccentStrong'}>
                {t(`review.axis.${key}`)} · {t(`review.${key}.${level}`)}
              </Text>
            </View>
          ))}
        </View>
      </FadeUp>

      <View style={styles.facts}>
        {review.facts.map((fact, i) => (
          <FadeUp key={fact.code} delay={step(3 + i)} distance={8}>
            <Text variant="caption" color="text">
              {t(`review.fact.${fact.code}` as TranslationKey, fact.values)}
            </Text>
          </FadeUp>
        ))}
      </View>

      {review.note ? (
        <FadeUp delay={step(4 + review.facts.length)} distance={8}>
          <View style={[styles.note, { backgroundColor: c.surface }]}>
            <View style={styles.noteHead}>
              <View style={[styles.avatar, { backgroundColor: c.surfaceBrand }]}>
                <Mark size={18} wave="textOnBrand" />
              </View>
              <Text variant="label" color="textBrand">
                {t('review.coach')}
              </Text>
            </View>
            <Text variant="caption" color="text">
              {review.note}
            </Text>
          </View>
        </FadeUp>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[3] },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  mark: { position: 'absolute', top: 0, width: 2, height: 8 },
  axes: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  axis: { paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.pill },
  facts: { gap: space[2] },
  note: { gap: space[2], padding: space[3], borderRadius: radius.card },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  avatar: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
