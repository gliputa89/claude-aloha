import { estimateDistanceM, stepsOf } from '@aloha/plan-engine';
import { openURL } from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import {
  FlagCheckered,
  Gauge,
  Lightning,
  Moon,
  RoadHorizon,
  PersonSimpleRun,
  PersonSimpleWalk,
  X,
  type IconProps,
} from 'phosphor-react-native';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Mark } from '@/components/brand/mark';
import { TYPE_COLOR, useDetail } from '@/components/plan/session-row';
import { WeatherStrip } from '@/components/plan/weather-card';
import { WorkoutChart, WorkoutSteps } from '@/components/plan/workout-intervals';
import { MatchPrompts } from '@/components/strava/match-prompt';
import { ReviewBadge, useCountUp, type Celebration } from '@/components/review/review-celebration';
import { WorkoutReview } from '@/components/review/workout-review';
import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/ui/fade-up';
import { InfoCard } from '@/components/ui/info-card';
import { Text } from '@/components/ui/text';
import { AppleWatchButton } from '@/components/watch/apple-watch-button';
import { EASE_BACK, EASE_OUT } from '@/constants/easing';
import { radius, space } from '@/constants/theme';
import { formatDuration, fromIsoDate, todayIso } from '@/features/onboarding/time';
import { isReviewNew, markReviewSeen, type PlanSession } from '@/features/plan/api';
import { useModule } from '@/features/modules/use-module';
import { useCoachTip } from '@/features/plan/coach-tips';
import { allSessions, usePlan } from '@/features/plan/plan-provider';
import { stravaActivityUrl } from '@/features/strava/api';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { useUnitFormat } from '@/lib/units';
import { sessionTitleKey } from '@/features/plan/session-title';

const TYPE_ICON: Record<PlanSession['type'], ComponentType<IconProps>> = {
  walk_run: PersonSimpleWalk,
  easy: PersonSimpleRun,
  recovery: PersonSimpleRun,
  long: RoadHorizon,
  intervals: Lightning,
  tempo: Gauge,
  race: FlagCheckered,
  rest: Moon,
};

/**
 * Choreografia otwarcia (ms, po wysunięciu arkusza):
 * 120 ikona wskakuje z obrotem · 200+ data, tytuł, opis · 380+ kafelki jeden po drugim
 * 560 słupki przebiegu rosną od dołu · 700+ odcinki i rada trenera
 * Zrobiony trening: 580 karta oceny – znaczek wskakuje (przy dobrym werdykcie z pierścieniem i iskrami),
 * liczby dobiegają, pasek „plan kontra wykonanie” się wypełnia, potem osie, obserwacje i notka trenera.
 */
const T = { icon: 120, head: 200, stats: 380, done: 580, chart: 560, rest: 700 };

/** Arkusz ze szczegółami treningu: typ, data, czas/dystans/intensywność, przebieg, odcinki i rada trenera. */
export default function WorkoutDetailScreen() {
  const c = useColors();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = usePlan();
  const session = state.kind === 'ready' ? allSessions(state.plan).find((s) => s.id === id) : undefined;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      {/* Stały pasek arkusza: uchwyt do przeciągnięcia i przycisk zamknięcia – treść przewija się pod nim. */}
      <View style={[styles.bar, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <View style={[styles.grabber, { backgroundColor: c.borderStrong }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workoutDetail.close')}
          onPress={() => router.back()}
          hitSlop={space[2]}
          style={({ pressed }) => [styles.close, { backgroundColor: c.surface, opacity: pressed ? 0.6 : 1 }]}>
          <X size={18} weight="bold" color={c.text} />
        </Pressable>
      </View>

      {session ? (
        <Detail session={session} />
      ) : (
        <View style={styles.content}>
          <InfoCard body={t('workoutDetail.notFound')} />
        </View>
      )}
    </View>
  );
}

function Detail({ session }: { session: PlanSession }) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const u = useUnitFormat();
  const reduced = useReducedMotion();
  const detail = useDetail(session);
  const tip = useCoachTip(session);
  const modules = { weather: useModule('weather'), strava: useModule('strava'), review: useModule('review'), coach: useModule('coach') };
  const chatEnabled = [useModule('coach_chat'), useModule('coach_human')].some(Boolean);
  // Ocena i notka trenera to osobne moduły pakietu: bez „oceny” zostaje samo „Zrobione”, bez „notek” – ocena bez notki.
  const review = modules.review && session.review ? { ...session.review, note: modules.coach ? session.review.note : null } : null;

  // Pierwsze otwarcie oceny: świętowanie zależne od werdyktu, liczby „dobiegają”. Potem karta jest już spokojna.
  const [firstOpen] = useState(() => isReviewNew(session.id, session.review));
  const hasReview = session.review !== null;
  useEffect(() => {
    if (hasReview) markReviewSeen(session.id);
  }, [hasReview, session.id]);
  const celebration: Celebration = !firstOpen
    ? 'none'
    : session.review?.verdict === 'spot_on'
      ? 'full'
      : session.review?.verdict === 'good'
        ? 'calm'
        : 'none';
  const counted = useCountUp(firstOpen, T.done + 150);

  const isToday = session.scheduled_on === todayIso();
  const dateLabel = fromIsoDate(session.scheduled_on).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const custom = 'custom' in session.structure && session.structure.custom === true;
  const steps = session.type === 'rest' ? [] : stepsOf(session);
  const hasSteps = steps.length > 0;
  const km = (m: number) => u.distance(m);
  const distance = session.distance_m
    ? km(session.distance_m)
    : session.duration_min && hasSteps
      ? u.approxDistance(estimateDistanceM(steps))
      : null;

  const stats = [
    session.duration_min
      ? { label: t('workoutDetail.duration'), value: t('workout.minutes', { n: session.duration_min }) }
      : null,
    distance ? { label: t('workoutDetail.distance'), value: distance } : null,
    session.intensity
      ? { label: t('workoutDetail.intensity'), value: t(`workoutDetail.level.${session.intensity}`) }
      : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  const completed = session.status === 'done' || session.status === 'partial';
  const pace = u.paceOf(session.actual_distance_m, session.actual_duration_s);
  const actual = [
    session.actual_distance_m ? { label: t('workoutDetail.distance'), value: km(session.actual_distance_m * counted) } : null,
    session.actual_duration_s
      ? { label: t('workoutDetail.duration'), value: formatDuration(Math.round(session.actual_duration_s * counted)) }
      : null,
    pace ? { label: t('workoutDetail.pace'), value: t('workoutDetail.paceValue', { pace, unit: u.paceUnit }) } : null,
  ].filter((s): s is { label: string; value: string } => s !== null);
  const lastActivity = session.activities.at(-1);

  const Icon = TYPE_ICON[session.type];
  const typeColor = c[TYPE_COLOR[session.type]];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Nagłówek: ikona po lewej, data / tytuł / opis obok. */}
      <View style={styles.hero}>
        {/* Ikona wskakuje z lekkim obrotem, a za nią raz rozchodzi się krąg w kolorze rodzaju treningu. */}
        <View style={styles.iconWrap}>
          {!reduced ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ring,
                { borderColor: typeColor },
                {
                  animationName: {
                    '0%': { transform: [{ scale: 0.8 }], opacity: 0 },
                    '15%': { opacity: 0.8 },
                    '100%': { transform: [{ scale: 1.9 }], opacity: 0 },
                  },
                  animationDuration: 1100,
                  animationDelay: T.icon + 220,
                  animationTimingFunction: EASE_OUT,
                  animationFillMode: 'both',
                },
              ]}
            />
          ) : null}
          <Animated.View
            style={[
              styles.icon,
              // Kolor rodzaju treningu – od razu widać, czy to spokojny bieg, czy mocny akcent.
            { backgroundColor: typeColor },
              {
                animationName: reduced
                  ? { from: { opacity: 0 }, to: { opacity: 1 } }
                  : {
                      from: { opacity: 0, transform: [{ scale: 0.3 }, { rotate: '-25deg' }] },
                      to: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
                    },
                animationDuration: 650,
                animationDelay: T.icon,
                animationTimingFunction: EASE_BACK,
                animationFillMode: 'both',
              },
            ]}>
            <Icon size={30} weight="bold" color={c.textOnWorkout} />
          </Animated.View>
        </View>

        <View style={styles.head}>
          <FadeUp delay={T.head}>
            <View style={styles.eyebrow}>
              <View style={[styles.dot, { backgroundColor: typeColor }]} />
              <Text variant="label" color={isToday ? 'textBrand' : 'textMuted'}>
                {[isToday ? t('workoutDetail.today') : null, dateLabel].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </FadeUp>
          <FadeUp delay={T.head + 60}>
            <Text variant="title" accessibilityRole="header">
              {t(sessionTitleKey(session))}
            </Text>
          </FadeUp>
          {detail && !custom ? (
            <FadeUp delay={T.head + 120}>
              <Text variant="caption">{detail}</Text>
            </FadeUp>
          ) : null}
        </View>
      </View>

      {modules.strava ? <MatchPrompts sessionId={session.id} /> : null}

      {stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map((s, i) => (
            <PopIn key={s.label} delay={T.stats + i * 90} style={styles.statWrap}>
              <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text variant="caption" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {s.label}
                </Text>
                <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit>
                  {s.value}
                </Text>
              </View>
            </PopIn>
          ))}
        </View>
      ) : null}

      {completed ? (
        <FadeUp delay={T.done}>
          <View style={[styles.done, { backgroundColor: c.surfaceBrandSoft }]}>
            <View style={styles.doneHead}>
              <ReviewBadge celebration={celebration} delay={T.done + 200} />
              <Text weight="bold" style={styles.flex}>
                {review
                  ? t(`review.verdict.${review.verdict}`)
                  : t(session.status === 'done' ? 'workoutDetail.done' : 'workoutDetail.donePartial')}
              </Text>
            </View>
            {actual.length > 0 ? (
              <View style={styles.stats}>
                {actual.map((s) => (
                  <View key={s.label} style={styles.statWrap}>
                    <Text variant="caption" color="text" numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit>
                      {s.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {review ? <WorkoutReview review={review} play={firstOpen} delay={T.done + 450} /> : null}
            {lastActivity ? (
              <View style={styles.source}>
                <Text variant="caption" color="text" style={styles.flex}>
                  {t(lastActivity.source === 'apple_health' ? 'workoutDetail.fromHealth' : 'workoutDetail.fromStrava')}
                </Text>
                {lastActivity.source === 'apple_health' ? null : (
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={space[3]}
                    onPress={() => openURL(stravaActivityUrl(lastActivity.id)).catch(() => {})}>
                    <Text variant="label" color="textBrand" style={styles.link}>
                      {t('workoutDetail.viewOnStrava')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        </FadeUp>
      ) : null}

      {/* Rada trenera: zaraz pod kafelkami, przed przebiegiem; treść na całą szerokość karty.
          Po treningu jej nie ma – wtedy liczy się ocena, a rada „na przed” nic już nie wnosi. */}
      {completed ? null : (
        <FadeUp delay={T.stats + 260}>
          <View style={[styles.coach, { backgroundColor: c.surfaceBrandSoft }]}>
            <View style={styles.coachHead}>
              <View style={[styles.avatar, { backgroundColor: c.surfaceBrand }]}>
                <Mark size={18} wave="textOnBrand" />
              </View>
              <Text variant="label" color="textBrand">
                {t('workoutDetail.coach')}
              </Text>
            </View>
            <Text>{tip}</Text>
          </View>
        </FadeUp>
      )}

      {/* Pytania do trenera o ten trening: przed (jak go pobiec) albo po (co wyszło). */}
      {chatEnabled && session.type !== 'rest' ? (
        <FadeUp delay={T.stats + 300}>
          <Button
            variant="secondary"
            label={t(completed ? 'chat.askAfter' : 'chat.askBefore')}
            onPress={() => router.push({ pathname: '/coach', params: { sessionId: session.id } })}
          />
        </FadeUp>
      ) : null}

      {/* Na zegarek tylko treningi przed nami – przeszłych nie ma sensu planować. */}
      {!completed && hasSteps && session.scheduled_on >= todayIso() ? (
        <FadeUp delay={T.stats + 320}>
          <AppleWatchButton session={session} />
        </FadeUp>
      ) : null}

      {hasSteps ? (
        <>
          <FadeUp delay={T.chart - 80} style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {t('workoutDetail.structure')}
            </Text>
            <WorkoutChart steps={steps} height={96} growDelay={T.chart} />
          </FadeUp>

          <FadeUp delay={T.rest} style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {t('workoutDetail.steps')}
            </Text>
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <WorkoutSteps steps={steps} />
            </View>
          </FadeUp>
        </>
      ) : null}

      {/* Pogoda tylko przed treningiem – po biegu prognoza nie ma już znaczenia. */}
      {completed || !modules.weather ? null : (
        <FadeUp delay={hasSteps ? T.rest + 60 : T.stats + 80}>
          <WeatherStrip session={session} standalone credit />
        </FadeUp>
      )}
    </ScrollView>
  );
}

/** Wejście kafelka: uniesienie z lekkim „przestrzeleniem” skali. */
function PopIn({ delay, style, children }: { delay: number; style?: object; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={[
        style,
        {
          animationName: reduced
            ? { from: { opacity: 0 }, to: { opacity: 1 } }
            : {
                from: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.85 }] },
                to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
              },
          animationDuration: 560,
          animationDelay: delay,
          animationTimingFunction: EASE_BACK,
          animationFillMode: 'both',
        },
      ]}>
      {children}
    </Animated.View>
  );
}

const ICON = 64;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { height: 56, alignItems: 'center', justifyContent: 'center' },
  grabber: { position: 'absolute', top: space[2], width: 36, height: 5, borderRadius: radius.pill },
  close: {
    position: 'absolute',
    top: space[3],
    right: space[4],
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[12], gap: space[6] },
  iconWrap: { width: ICON, height: ICON, alignItems: 'center', justifyContent: 'center' },
  icon: { width: ICON, height: ICON, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: ICON, height: ICON, borderRadius: radius.pill, borderWidth: 2 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  head: { flex: 1, gap: space[1] },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  stats: { flexDirection: 'row', gap: space[3] },
  statWrap: { flex: 1 },
  stat: { gap: space[1], padding: space[3], borderRadius: radius.card, borderWidth: 1.5 },
  section: { gap: space[3] },
  done: { gap: space[3], padding: space[4], borderRadius: radius.card },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  source: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  link: { textDecorationLine: 'underline' },
  card: { padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  coach: { gap: space[2], padding: space[4], borderRadius: radius.card },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  avatar: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
