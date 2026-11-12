import type { TranslationKey } from '@aloha/i18n';
import { Trophy } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { daysUntil, type RaceGoal } from '@/features/goal/race-goal';
import { fromIsoDate } from '@/features/onboarding/time';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

/**
 * Odliczanie do zawodów na ekranie Dzisiaj: ile dni zostało, nazwa (albo dystans) i data startu.
 * Po zawodach karta znika – bez „spóźnionych” komunikatów.
 */
export function RaceCountdown({ goal, today }: { goal: RaceGoal; today: string }) {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const days = daysUntil(goal.raceDate, today);
  if (days < 0) return null;

  const distance = t(`onboarding.distance.d${goal.distanceM}` as TranslationKey);
  const race = goal.name ?? distance;
  const date = fromIsoDate(goal.raceDate).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  const line =
    days === 0
      ? t('today.race.todayLine')
      : days === 1
        ? t('today.race.tomorrowLine')
        : goal.name
          ? t('today.race.untilStartDistance', { distance, date })
          : t('today.race.untilStart', { date });
  const a11y =
    days === 0
      ? t('today.race.a11yToday', { race })
      : days === 1
        ? t('today.race.a11yTomorrow', { race, date })
        : t('today.race.a11yDays', { race, n: days, date });

  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.badge, { backgroundColor: c.surfaceBrandSoft }]}>
        {days === 0 ? (
          <Trophy size={28} weight="bold" color={c.textBrand} />
        ) : (
          <Text variant="title" color="textBrand" align="center">
            {days}
          </Text>
        )}
        <Text variant="label" color="textBrand" align="center">
          {days === 0 ? t('today.race.raceDay') : days === 1 ? t('today.race.dayOne') : t('today.race.dayMany')}
        </Text>
      </View>
      <View style={styles.text}>
        <Text weight="bold" numberOfLines={2}>
          {race}
        </Text>
        <Text variant="caption">{line}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: 1.5,
  },
  // Stała szerokość – liczba dni (do 3 cyfr) nie przesuwa tekstu obok.
  badge: { minWidth: 72, paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radius.button, alignItems: 'center' },
  text: { flex: 1, gap: space[1] },
});
