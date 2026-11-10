import type { TranslationKey } from '@aloha/i18n';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { TYPE_COLOR } from '@/components/plan/session-row';
import { Text } from '@/components/ui/text';
import { motion, radius, space } from '@/constants/theme';
import { addDays, toIsoDate } from '@/features/onboarding/time';
import type { PlanSession } from '@/features/plan/api';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

type MonthCalendarProps = {
  /** Dowolny dzień wyświetlanego miesiąca. */
  month: Date;
  onMonthChange: (month: Date) => void;
  selected: string;
  onSelect: (iso: string) => void;
  today: string;
  sessions: Map<string, PlanSession[]>;
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Dni do pokazania: pełne tygodnie od poniedziałku, obejmujące cały miesiąc. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const rows = Math.ceil((offset + daysInMonth) / 7);
  const start = addDays(first, -offset);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: 7 }, (_, d) => addDays(start, r * 7 + d)));
}

/**
 * Kalendarz miesiąca: tydzień od poniedziałku, kropka w kolorze rodzaju treningu,
 * zaznaczony dzisiejszy i wybrany dzień. Strzałki zmieniają miesiąc.
 */
export function MonthCalendar({ month, onMonthChange, selected, onSelect, today, sessions }: MonthCalendarProps) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const intl = locale === 'en' ? 'en-GB' : 'pl-PL';

  const title = month.toLocaleDateString(intl, { month: 'long', year: 'numeric' });
  const monthLabel = title.charAt(0).toUpperCase() + title.slice(1);
  const grid = monthGrid(month);
  const shift = (delta: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendar.prevMonth')}
          onPress={() => shift(-1)}
          hitSlop={space[1]}
          style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.5 : 1 }]}>
          <CaretLeft size={20} weight="bold" color={c.text} />
        </Pressable>
        <Text variant="bodyStrong" weight="bold" accessibilityRole="header" accessibilityLiveRegion="polite">
          {monthLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}
          onPress={() => shift(1)}
          hitSlop={space[1]}
          style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.5 : 1 }]}>
          <CaretRight size={20} weight="bold" color={c.text} />
        </Pressable>
      </View>

      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEKDAYS.map((d) => (
          <Text key={d} variant="caption" weight="semibold" align="center" style={styles.weekday}>
            {t(`onboarding.day.short${d}` as TranslationKey)}
          </Text>
        ))}
      </View>

      <Animated.View
        key={`${month.getFullYear()}-${month.getMonth()}`}
        entering={reduced ? undefined : FadeIn.duration(motion.duration.normal)}
        style={styles.grid}>
        {grid.map((week) => (
          <View key={toIsoDate(week[0]!)} style={styles.row}>
            {week.map((day) => {
              const iso = toIsoDate(day);
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = iso === today;
              const isSelected = iso === selected;
              const runs = (sessions.get(iso) ?? []).filter((s) => s.type !== 'rest');
              const weekday = ((day.getDay() + 6) % 7) + 1;
              const label = [
                isToday ? t('plan.today') : null,
                `${t(`onboarding.day.long${weekday}` as TranslationKey)} ${day.toLocaleDateString(intl, { day: 'numeric', month: 'long' })}`,
                ...runs.map((s) => t(`workout.${s.type}` as TranslationKey)),
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <Pressable
                  key={iso}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onSelect(iso);
                    if (!inMonth) onMonthChange(new Date(day.getFullYear(), day.getMonth(), 1));
                  }}
                  style={styles.cell}>
                  <View
                    style={[
                      styles.day,
                      isSelected && { backgroundColor: c.action },
                      !isSelected && isToday && { borderColor: c.action, borderWidth: 1.5 },
                    ]}>
                    <Text
                      weight={isSelected || isToday ? 'bold' : 'medium'}
                      color={isSelected ? 'textOnBrand' : inMonth ? 'text' : 'textMuted'}
                      style={!inMonth && !isSelected ? styles.outside : undefined}>
                      {day.getDate()}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {runs.slice(0, 2).map((s) => (
                      <View key={s.id} style={[styles.dot, { backgroundColor: c[TYPE_COLOR[s.type]] }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1.5,
    paddingHorizontal: space[2],
    paddingTop: space[2],
    paddingBottom: space[3],
    gap: space[2],
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { gap: space[1] },
  row: { flexDirection: 'row' },
  weekday: { flex: 1 },
  cell: { flex: 1, alignItems: 'center', minHeight: 48, gap: 2 },
  day: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outside: { opacity: 0.45 },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
});
