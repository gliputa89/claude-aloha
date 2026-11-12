import type { Locale, Translator } from '@aloha/i18n';
import type { GoalProgress, GoalRow } from '@aloha/plan-engine';
import { CalendarCheck, CaretRight, ChartLineUp, Flag, PersonSimpleRun, Timer, Trophy, type Icon } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ladder, ProgressBar, WeekDots, type ProgressTone } from '@/components/goals/goal-progress';
import { Text } from '@/components/ui/text';
import { radius, space, type ColorRole } from '@/constants/theme';
import { distanceLabel, formatDate, formatShortDate, goalLikeOfRow, goalTitle, inDays } from '@/features/goals/labels';
import { formatDuration } from '@/features/onboarding/time';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

export const GOAL_ICON: Record<GoalRow['kind'], Icon> = {
  race: Flag,
  performance: Timer,
  continuous: PersonSimpleRun,
  consistency: CalendarCheck,
  volume: ChartLineUp,
};

const km = (m: number) => String(Math.round(m / 100) / 10).replace('.', ',');

/** Teksty i wskaźnik postępu celu – wspólne dla karty prowadzącego i wiersza listy. */
function describe(t: Translator, locale: Locale, goal: GoalRow, p: GoalProgress | null) {
  const title = goalTitle(t, locale, goalLikeOfRow(goal));
  let badge: string | null = null;
  let meta: string | null = null;
  let line: string | null = null;
  let tiles: { label: string; value: string }[] = [];
  let cta: string | null = null;
  const distance = goal.distance_m ? distanceLabel(t, goal.distance_m) : '';

  if (!p) return { title, badge, meta, line, tiles, cta };
  switch (p.kind) {
    case 'race': {
      const base = { distance, date: goal.race_date ? formatDate(locale, goal.race_date) : '' };
      meta = goal.target_time_s ? t('goals.raceMetaTarget', { ...base, time: formatDuration(goal.target_time_s) }) : t('goals.raceMeta', base);
      if (goal.role === 'secondary') {
        badge = goal.priority === 'C' ? 'C' : 'B';
        meta = `${goal.race_date ? formatShortDate(locale, goal.race_date) : ''} · ${inDays(t, p.daysLeft)} · ${t(goal.priority === 'C' ? 'goals.raceCMeta' : 'goals.raceBMeta')}`;
      } else {
        badge = p.past ? null : inDays(t, p.daysLeft);
        line = t('goals.week', { week: p.week, weeks: p.weeks });
      }
      if (p.past) cta = t('goals.racePast');
      tiles = [
        ...(p.forecastTodayS ? [{ label: t('goals.forecastToday'), value: formatDuration(p.forecastTodayS) }] : []),
        ...(p.forecastRaceDayS ? [{ label: t('goals.forecastRace'), value: formatDuration(p.forecastRaceDayS) }] : []),
      ];
      if (!tiles.length && goal.target_time_s) tiles = [{ label: t('goals.target'), value: formatDuration(goal.target_time_s) }];
      break;
    }
    case 'performance':
      meta = goal.due_on ? t('goals.performanceTrial', { date: formatShortDate(locale, goal.due_on) }) : null;
      line = p.bestS ? t('goals.performanceBest', { time: formatDuration(p.bestS) }) : t('goals.performanceNone');
      if (goal.role === 'primary' && p.daysLeft !== null && p.daysLeft >= 0) badge = inDays(t, p.daysLeft);
      if (p.achieved) cta = t('goals.achievedCta');
      break;
    case 'continuous':
      if (p.mode === 'minutes') {
        const next = p.steps.find((s) => s > p.current);
        line = p.current > 0 && next ? t('goals.continuousNow', { min: p.current, next }) : next ? t('goals.continuousStart', { next }) : null;
      } else {
        line = t('goals.continuousDistance', { km: km(p.current), target: km(p.target) });
      }
      if (p.achieved) cta = t('goals.achievedCta');
      break;
    case 'consistency':
      line = t('goals.consistencyLine', { done: p.doneWeeks, total: p.totalWeeks, week: p.thisWeek, per: p.perWeek });
      meta = p.streak > 0 ? t('goals.consistencyStreak', { n: p.streak }) : null;
      if (p.achieved) cta = t('goals.achievedCta');
      break;
    case 'volume':
      line = t('goals.volumeLine', { km: String(p.km).replace('.', ','), target: p.targetKm, days: p.daysLeft });
      if (p.achieved) cta = t('goals.achievedCta');
      break;
  }
  return { title, badge, meta, line, tiles, cta };
}

/** Wskaźnik postępu dopasowany do rodzaju celu. */
function Indicator({ p, tone, label }: { p: GoalProgress | null; tone: ProgressTone; label: string }) {
  if (!p) return null;
  switch (p.kind) {
    case 'race':
      return <ProgressBar tone={tone} fraction={p.weeks > 0 ? p.week / p.weeks : 0} label={label} />;
    case 'consistency':
      return <WeekDots tone={tone} weeks={p.weeks} label={label} />;
    case 'continuous':
      return p.mode === 'minutes' && tone === 'brand' ? (
        <Ladder steps={p.steps} current={p.current} label={label} />
      ) : (
        <ProgressBar tone={tone} fraction={p.fraction} label={label} />
      );
    default:
      return <ProgressBar tone={tone} fraction={p.fraction} label={label} />;
  }
}

/** Duża turkusowa karta celu prowadzącego. */
export function PrimaryGoalCard({ goal, progress, onPress }: { goal: GoalRow; progress: GoalProgress | null; onPress: () => void }) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const d = describe(t, locale, goal, progress);
  const label = [d.title, d.line].filter(Boolean).join('. ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[goal.kind === 'race' ? t('goals.leadsRace') : t('goals.leads'), d.title, d.badge, d.meta, d.line, d.cta].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, { backgroundColor: c.surfaceBrand, transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
      <View style={styles.headerRow}>
        <Text variant="caption" weight="bold" color="textOnBrandMuted" style={styles.overline}>
          {goal.kind === 'race' ? t('goals.leadsRace') : t('goals.leads')}
        </Text>
        {d.badge ? (
          <View style={[styles.badge, { backgroundColor: c.accent }]}>
            <Text variant="caption" weight="bold" color="textOnAccent">
              {d.badge}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.titleBlock}>
        <Text variant="heading" weight="extrabold" color="textOnBrand">
          {d.title}
        </Text>
        {d.meta ? (
          <Text variant="caption" color="textOnBrandMuted">
            {d.meta}
          </Text>
        ) : null}
      </View>
      <Indicator p={progress} tone="brand" label={label} />
      {d.line ? (
        <Text variant="caption" weight="semibold" color="textOnBrandMuted">
          {d.line}
        </Text>
      ) : null}
      {d.tiles.length ? (
        <View style={styles.tiles}>
          {d.tiles.map((tile) => (
            <View key={tile.label} style={[styles.tile, { backgroundColor: c.actionHover }]}>
              <Text variant="caption" weight="semibold" color="textOnBrandMuted">
                {tile.label}
              </Text>
              <Text variant="bodyStrong" weight="extrabold" color="textOnBrand">
                {tile.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {d.cta ? <Cta text={d.cta} /> : null}
    </Pressable>
  );
}

function Cta({ text }: { text: string }) {
  const c = useColors();
  return (
    <View style={[styles.cta, { backgroundColor: c.accent }]}>
      <Trophy size={18} weight="bold" color={c.textOnAccent} />
      <Text variant="label" color="textOnAccent" style={styles.flex}>
        {text}
      </Text>
      <CaretRight size={16} weight="bold" color={c.textOnAccent} />
    </View>
  );
}

const ICON_TONE: Record<GoalRow['kind'], { bg: ColorRole; fg: ColorRole }> = {
  race: { bg: 'surfaceAccentSoft', fg: 'textAccentStrong' },
  performance: { bg: 'surfaceBrandSoft', fg: 'textBrand' },
  continuous: { bg: 'surfaceBrandSoft', fg: 'textBrand' },
  consistency: { bg: 'surfaceBrandSoft', fg: 'textBrand' },
  volume: { bg: 'surfaceBrandSoft', fg: 'textBrand' },
};

/** Wiersz celu obok – ikona, nazwa, data / znacznik B/C, wskaźnik postępu i jedno zdanie. */
export function GoalListRow({ goal, progress, onPress, last }: { goal: GoalRow; progress: GoalProgress | null; onPress: () => void; last: boolean }) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const d = describe(t, locale, goal, progress);
  const IconCmp = GOAL_ICON[goal.kind];
  const tone = ICON_TONE[goal.kind];
  const isRace = goal.kind === 'race';
  const caption = isRace ? d.meta : [d.line, d.meta].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[d.title, d.badge, d.meta, d.line, d.cta].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.rowIcon, { backgroundColor: c[tone.bg] }]}>
        <IconCmp size={20} weight="bold" color={c[tone.fg]} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitle}>
          <Text weight="bold" style={styles.flex} numberOfLines={2}>
            {d.title}
          </Text>
          {d.badge ? (
            <View style={[styles.smallBadge, { backgroundColor: c.surfaceAccentSoft }]}>
              <Text variant="caption" weight="bold" color="textAccentStrong">
                {d.badge}
              </Text>
            </View>
          ) : null}
        </View>
        {isRace ? null : <Indicator p={progress} tone="surface" label={[d.title, d.line].filter(Boolean).join('. ')} />}
        {caption ? <Text variant="caption">{caption}</Text> : null}
        {d.cta ? (
          <Text variant="caption" weight="bold" color="textBrand">
            {d.cta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Karta osiągniętego / ukończonego celu na półce. */
export function FinishedGoalCard({ goal }: { goal: GoalRow }) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const title = goalTitle(t, locale, goalLikeOfRow(goal));
  const date = goal.finished_at ? formatDate(locale, goal.finished_at.slice(0, 10)) : '';
  const sub = goal.result_time_s ? t('goals.finishedResult', { result: formatDuration(goal.result_time_s), date }) : t('goals.finishedOn', { date });
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${goal.status === 'completed' ? t('goals.completed') : t('goals.achieved')}. ${sub}`}
      style={[styles.finished, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Trophy size={20} weight="bold" color={c.textAccentStrong} />
      <Text variant="label" numberOfLines={2}>
        {title}
      </Text>
      <Text variant="caption">{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  primary: { gap: space[3], padding: space[4], borderRadius: radius.card },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  overline: { textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  badge: { paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill },
  titleBlock: { gap: 2 },
  tiles: { flexDirection: 'row', gap: space[2] },
  tile: { flex: 1, paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.button },
  cta: { flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[3], borderRadius: radius.button },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 64 },
  rowIcon: { width: 40, height: 40, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: space[1] },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  smallBadge: { paddingHorizontal: space[2], paddingVertical: 1, borderRadius: radius.pill },
  finished: { flex: 1, gap: space[1], padding: space[3], borderRadius: radius.card, borderWidth: 1.5 },
});
