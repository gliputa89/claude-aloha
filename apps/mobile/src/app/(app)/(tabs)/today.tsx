import { router } from 'expo-router';
import { ChatCircleDots } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Mark } from '@/components/brand/mark';
import { CheckInCard } from '@/components/checkin/check-in-card';
import { MatchPrompts } from '@/components/strava/match-prompt';
import { RaceCountdown } from '@/components/plan/race-countdown';
import { SessionRow } from '@/components/plan/session-row';
import { WeatherPrompt, WeatherStrip } from '@/components/plan/weather-card';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/ui/fade-up';
import { InfoCard } from '@/components/ui/info-card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { todayIso } from '@/features/onboarding/time';
import { usePlan } from '@/features/plan/plan-provider';
import { PlanStatus } from '@/features/plan/plan-status';
import { useCheckInEnabled } from '@/features/checkin/api';
import { useDayNote } from '@/features/coach/day-note';
import { daysUntil, useRaceGoal } from '@/features/goal/race-goal';
import { useModule } from '@/features/modules/use-module';
import { todaySessions } from '@/features/today/today-sessions';
import { useWeather } from '@/features/weather/weather-provider';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { useAuth } from '@/providers/auth-provider';

/**
 * Zakładka „Dzisiaj”: powitanie, dzisiejszy trening (albo notka trenera na dzień bez biegu), następny w kolejce –
 * każdy z pogodą i poradą, kiedy najlepiej wyjść – oraz ostatni zrobiony trening z werdyktem. Docelowo też check-in wg makiet.
 */
export default function TodayScreen() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const { profile } = useAuth();
  const { state, reload } = usePlan();
  const weather = useWeather();
  const today = todayIso();
  // Witamy pierwszym imieniem – pełne imię i nazwisko nie mieści się obok awatara.
  const name = profile?.display_name?.trim().split(/\s+/)[0];

  const dateLabel = new Date().toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { todays, todayRuns, next, last, shown } = todaySessions(state.kind === 'ready' ? state.plan : null, today);
  // Dzień bez biegu: notka trenera od AI zamiast stałego tekstu (stały zostaje, gdy notki nie będzie).
  // Ekran startowy czeka na nią i na pogodę (features/today/today-boot) – stan ładowania widać tylko przy wolnej sieci.
  const modules = { weather: useModule('weather'), strava: useModule('strava'), review: useModule('review'), coach: useModule('coach') };
  const chat = { ai: useModule('coach_chat'), human: useModule('coach_human') };
  const dayNote = useDayNote(today, modules.coach && state.kind === 'ready' && todayRuns.length === 0);
  const hasWeather = shown.some((s) => weather.bySession.has(s.id));
  // Check-in jest włączony zgodą na dane o zdrowiu (Profil); pytamy raz dziennie, przy pierwszym niezrobionym treningu.
  const checkIn = useCheckInEnabled();
  const raceGoal = useRaceGoal(state.kind === 'ready' ? state.plan.id : null);
  const checkInFor = checkIn.enabled ? todayRuns.find((s) => s.status === 'planned' && s.type !== 'race') : undefined;

  return (
    <Screen
      title={name ? t('home.greeting', { name }) : t('home.greetingNoName')}
      subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
      onRefresh={async () => {
        await reload();
        await weather.refresh();
      }}
      leading={
        <View style={[styles.avatar, { backgroundColor: c.surfaceBrand }]}>
          <Mark size={36} wave="textOnBrand" />
        </View>
      }>
      <PlanStatus />

      {state.kind === 'ready' ? (
        <>
          {modules.strava ? <MatchPrompts /> : null}
          {raceGoal && daysUntil(raceGoal.raceDate, today) >= 0 ? (
            <FadeUp delay={30}>
              <RaceCountdown goal={raceGoal} today={today} />
            </FadeUp>
          ) : null}
          <FadeUp delay={60} style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {t('today.title')}
            </Text>
            {todayRuns.length > 0 ? (
              todayRuns.map((s) => (
                <View key={s.id} style={styles.section}>
                  <SessionRow session={s} today>
                    {modules.weather ? <WeatherStrip session={s} /> : null}
                  </SessionRow>
                  {checkInFor?.id === s.id ? <CheckInCard session={s} today={today} onPlanChanged={reload} /> : null}
                </View>
              ))
            ) : todays.length > 0 ? (
              <InfoCard title={t('today.restTitle')} body={dayNote.text ?? t('today.restBody')} loading={dayNote.pending} />
            ) : (
              <InfoCard body={dayNote.text ?? t('today.noPlanToday')} loading={dayNote.pending} />
            )}
          </FadeUp>

          {chat.ai || chat.human ? (
            <FadeUp delay={100}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('chat.entryTitle')}. ${t('chat.entryBody')}`}
                onPress={() => router.push('/coach')}
                style={({ pressed }) => [styles.coach, { backgroundColor: c.surfaceBrandSoft, opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.coachAvatar, { backgroundColor: c.surfaceBrand }]}>
                  <Mark size={24} wave="textOnBrand" />
                </View>
                <View style={styles.coachText}>
                  <Text weight="bold">{t('chat.entryTitle')}</Text>
                  <Text variant="caption" color="text">
                    {t('chat.entryBody')}
                  </Text>
                </View>
                <ChatCircleDots size={22} weight="bold" color={c.textBrand} />
              </Pressable>
            </FadeUp>
          ) : null}

          {next ? (
            <FadeUp delay={140} style={styles.section}>
              <Text variant="heading" accessibilityRole="header">
                {t('today.next')}
              </Text>
              <SessionRow session={next} today={false}>
                {modules.weather ? <WeatherStrip session={next} /> : null}
              </SessionRow>
            </FadeUp>
          ) : null}

          {last ? (
            <FadeUp delay={180} style={styles.section}>
              <Text variant="heading" accessibilityRole="header">
                {t('today.last')}
              </Text>
              <SessionRow session={last} today={false} />
              {modules.review && last.review ? (
                <Text variant="caption">{t('today.lastVerdict', { verdict: t(`review.verdict.${last.review.verdict}`) })}</Text>
              ) : null}
            </FadeUp>
          ) : null}

          {modules.weather && shown.length > 0 ? <WeatherPrompt /> : null}
          {modules.weather && hasWeather ? (
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
  },
  section: { gap: space[3] },
  coach: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.card },
  coachAvatar: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  coachText: { flex: 1, gap: 2 },
});
