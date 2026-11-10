import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Mark } from '@/components/brand/mark';
import { SessionRow } from '@/components/plan/session-row';
import { WeatherCard, WeatherPrompt } from '@/components/plan/weather-card';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/ui/fade-up';
import { InfoCard } from '@/components/ui/info-card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { todayIso } from '@/features/onboarding/time';
import { allSessions, usePlan } from '@/features/plan/plan-provider';
import { PlanStatus } from '@/features/plan/plan-status';
import { useWeather } from '@/features/weather/weather-provider';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { useAuth } from '@/providers/auth-provider';

/**
 * Zakładka „Dzisiaj”: powitanie, dzisiejszy trening i następny w kolejce – każdy z pogodą i poradą,
 * kiedy najlepiej wyjść. Docelowo też check-in wg makiet.
 */
export default function TodayScreen() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const { profile } = useAuth();
  const { state, reload } = usePlan();
  const weather = useWeather();
  const today = todayIso();
  const name = profile?.display_name;

  const dateLabel = new Date().toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const sessions = state.kind === 'ready' ? allSessions(state.plan) : [];
  const todays = sessions.filter((s) => s.scheduled_on === today);
  const todayRuns = todays.filter((s) => s.type !== 'rest');
  const next = sessions.find((s) => s.scheduled_on > today && s.type !== 'rest');
  const shown = [...todayRuns, ...(next ? [next] : [])];
  const hasWeather = shown.some((s) => weather.bySession.has(s.id));

  return (
    <Screen
      title={name ? t('home.greeting', { name }) : t('home.greetingNoName')}
      subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
      onRefresh={async () => {
        await reload();
        await weather.refresh();
      }}
      above={
        <View style={[styles.avatar, { backgroundColor: c.surfaceBrand }]}>
          <Mark size={36} wave="textOnBrand" />
        </View>
      }>
      <PlanStatus />

      {state.kind === 'ready' ? (
        <>
          <FadeUp delay={60} style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {t('today.title')}
            </Text>
            {todayRuns.length > 0 ? (
              todayRuns.map((s) => (
                <View key={s.id} style={styles.section}>
                  <SessionRow session={s} today />
                  <WeatherCard session={s} />
                </View>
              ))
            ) : todays.length > 0 ? (
              <InfoCard title={t('today.restTitle')} body={t('today.restBody')} />
            ) : (
              <InfoCard body={t('today.noPlanToday')} />
            )}
          </FadeUp>

          {next ? (
            <FadeUp delay={140} style={styles.section}>
              <Text variant="heading" accessibilityRole="header">
                {t('today.next')}
              </Text>
              <SessionRow session={next} today={false} />
              <WeatherCard session={next} />
            </FadeUp>
          ) : null}

          {shown.length > 0 ? <WeatherPrompt /> : null}
          {hasWeather ? (
            <Text variant="caption" align="center">
              {t('weather.credit')}
            </Text>
          ) : null}

          <FadeUp delay={220}>
            <Button variant="plain" label={t('today.seePlan')} onPress={() => router.navigate('/plan')} />
          </FadeUp>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  section: { gap: space[3] },
});
