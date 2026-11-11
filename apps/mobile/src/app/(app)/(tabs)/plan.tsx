import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { MonthCalendar } from '@/components/plan/month-calendar';
import { SessionRow } from '@/components/plan/session-row';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/ui/fade-up';
import { InfoCard } from '@/components/ui/info-card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { motion, space } from '@/constants/theme';
import { fromIsoDate, todayIso } from '@/features/onboarding/time';
import { generateNextWeeks, type PlanSession } from '@/features/plan/api';
import { allSessions, sessionsByDate, usePlan } from '@/features/plan/plan-provider';
import { PlanStatus } from '@/features/plan/plan-status';
import { useLocale, useT } from '@/hooks/use-t';

/** Zakładka „Plan”: kalendarz miesiąca, treningi wybranego dnia i lista wszystkich tygodni. */
export default function PlanScreen() {
  const t = useT();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { state, reload } = usePlan();
  const today = todayIso();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => fromIsoDate(today));
  const [generating, setGenerating] = useState(false);

  const plan = state.kind === 'ready' ? state.plan : null;
  const byDate = useMemo(() => (plan ? sessionsByDate(plan) : new Map<string, PlanSession[]>()), [plan]);
  const sessions = plan ? allSessions(plan) : [];
  const lastDay = sessions.at(-1)?.scheduled_on;

  const daySessions = byDate.get(selected) ?? [];
  const dayRuns = daySessions.filter((s) => s.type !== 'rest');
  const outsidePlan = !plan || selected < plan.starts_on || (lastDay !== undefined && selected > lastDay);

  const selectedLabel = fromIsoDate(selected).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen title={t('plan.title')} subtitle={t('plan.subtitle')} onRefresh={reload}>
      <PlanStatus />

      {plan ? (
        <>
          <FadeUp delay={40}>
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              onSelect={setSelected}
              today={today}
              sessions={byDate}
            />
          </FadeUp>

          <Animated.View
            key={selected}
            entering={reduced ? undefined : FadeIn.duration(motion.duration.normal)}
            style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1)}
            </Text>
            {dayRuns.length > 0 ? (
              dayRuns.map((s) => <SessionRow key={s.id} session={s} today={s.scheduled_on === today} />)
            ) : daySessions.length > 0 ? (
              <InfoCard title={t('calendar.restDay')} body={t('today.restBody')} />
            ) : (
              <InfoCard body={outsidePlan ? t('calendar.outsidePlan') : t('calendar.noSession')} />
            )}
          </Animated.View>

          <View style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {t('calendar.allWeeks')}
            </Text>
            {plan.weeks
              .filter((week) => week.sessions.length > 0)
              .map((week, i) => (
                <View key={week.id} style={styles.week}>
                  <Text variant="label" color="textMuted">
                    {t(week.focus === 'recovery' ? 'plan.weekRecovery' : 'plan.week', { n: i + 1 })}
                  </Text>
                  {week.sessions.map((s) => (
                    <SessionRow key={s.id} session={s} today={s.scheduled_on === today} />
                  ))}
                </View>
              ))}
            {/* TYMCZASOWE – do testów; usunąć razem z generateNextWeeks i trybem `force` w generate-next-week. */}
            <Button
              variant="secondary"
              label={t('plan.devGenerate')}
              loading={generating}
              onPress={async () => {
                setGenerating(true);
                const result = await generateNextWeeks(2);
                await reload();
                setGenerating(false);
                if (result.problem) Alert.alert(t('plan.devGenerate'), t('plan.devGenerateResult', { n: result.created, problem: result.problem }));
              }}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] },
  week: { gap: space[3] },
});
