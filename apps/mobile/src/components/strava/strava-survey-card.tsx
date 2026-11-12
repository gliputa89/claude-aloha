import type { StravaSurveyProposal } from '@aloha/plan-engine';
import type { TranslationKey } from '@aloha/i18n';
import { CheckCircle, Lightning } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { motion, radius, space } from '@/constants/theme';
import { formatDuration, fromIsoDate } from '@/features/onboarding/time';
import { connectStrava, fetchStravaSurvey } from '@/features/strava/api';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

type Phase = 'idle' | 'connecting' | 'analyzing';

const RESULT_NOTE = {
  race: 'onboarding.level.strava.resultRace',
  effort: 'onboarding.level.strava.resultEffort',
  run: 'onboarding.level.strava.resultRun',
} as const;

const MIN_ANALYZING_MS = 2600;
const ANALYZING_STEP_MS = 1300;
const ANALYZING_STEPS = [
  'onboarding.level.strava.analyzing',
  'onboarding.level.strava.analyzingEfforts',
  'onboarding.level.strava.analyzingDays',
] as const;
/** Słupki „tygodni” – wysokości (0–1) dobrane tak, żeby rząd wyglądał jak kilka miesięcy biegania, nie jak równa fala. */
const WEEK_BARS = [0.45, 0.7, 0.55, 0.85, 0.6, 0.35, 0.75, 0.95, 0.65, 0.8, 0.5, 0.9];
const BAR_HEIGHT = 40;

/**
 * Analiza biegów w toku: po słupkach tygodni przechodzi fala (trener „czyta” kolejne tygodnie), a pod spodem
 * zmienia się opis tego, co właśnie sprawdza. Przy „Ogranicz ruch” słupki stoją, zmienia się tylko tekst.
 */
function AnalyzingRuns() {
  const c = useColors();
  const t = useT();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, ANALYZING_STEPS.length - 1)), ANALYZING_STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <View
      style={styles.analyzing}
      accessible
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t(ANALYZING_STEPS[step]!)}>
      <View style={styles.bars}>
        {WEEK_BARS.map((h, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              { height: BAR_HEIGHT * h, backgroundColor: c.action },
              reduced
                ? { opacity: 0.6 }
                : {
                    transformOrigin: 'bottom',
                    animationName: {
                      '0%': { opacity: 0.25, transform: [{ scaleY: 0.55 }] },
                      '30%': { opacity: 1, transform: [{ scaleY: 1 }] },
                      '60%': { opacity: 0.25, transform: [{ scaleY: 0.55 }] },
                      '100%': { opacity: 0.25, transform: [{ scaleY: 0.55 }] },
                    },
                    animationDuration: 1500,
                    animationDelay: i * 90,
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'ease-in-out',
                    animationFillMode: 'backwards',
                  },
            ]}
          />
        ))}
      </View>
      <View style={styles.analyzingText}>
        <Animated.View
          key={step}
          entering={reduced ? FadeIn.duration(motion.duration.normal) : FadeInDown.duration(motion.duration.normal)}
          exiting={FadeOut.duration(motion.duration.fast)}>
          <Text variant="caption" weight="medium" color="text" align="center">
            {t(ANALYZING_STEPS[step]!)}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

type StravaSurveyCardProps = {
  /** Propozycja już wczytana do ankiety (`null` – jeszcze nie połączono). */
  proposal: StravaSurveyProposal | null;
  onProposal: (proposal: StravaSurveyProposal) => void;
};

/**
 * Ankieta startowa, krok „Jak teraz biegasz?”: zamiast odpowiadać na pytania, biegacz łączy Stravę, a my
 * uzupełniamy odpowiedzi z jego biegów z ostatniego półrocza. Pytania zostają pod kartą – dla osób bez Stravy
 * i do poprawienia propozycji.
 */
export function StravaSurveyCard({ proposal, onProposal }: StravaSurveyCardProps) {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<TranslationKey | null>(null);

  const start = async () => {
    setError(null);
    // Konto mogło być połączone wcześniej (np. powrót do ankiety) – wtedy ekran zgody Stravy nie jest potrzebny.
    setPhase('analyzing');
    let analyzingSince = Date.now();
    let result = await fetchStravaSurvey();
    if (result.status === 'not_connected') {
      setPhase('connecting');
      const connected = await connectStrava('/level');
      if (connected !== 'connected') {
        setPhase('idle');
        if (connected !== 'cancelled') {
          setError(
            ({ no_activity_scope: 'profile.stravaNoScope', athlete_limit: 'profile.stravaLimit', failed: 'profile.stravaConnectFailed' } as const)[
              connected
            ],
          );
        }
        return;
      }
      setPhase('analyzing');
      analyzingSince = Date.now();
      result = await fetchStravaSurvey();
    }
    // Analiza bywa szybsza niż mrugnięcie – animacja ma zdążyć powiedzieć, co się stało.
    if (result.status === 'ready') await new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_ANALYZING_MS - (Date.now() - analyzingSince))));
    setPhase('idle');
    if (result.status === 'ready') onProposal(result.proposal);
    else setError('onboarding.level.strava.failed');
  };

  const tag = locale === 'en' ? 'en-GB' : 'pl-PL';
  const km = (m: number) => (m / 1000).toLocaleString(tag, { maximumFractionDigits: m < 10_000 ? 1 : 0 });

  if (proposal) {
    const enough = proposal.level !== 'beginner';
    const result = proposal.recentResult;
    // Skąd wziął się czas: zawody, najszybszy odcinek wewnątrz biegu albo szacunek z całego biegu – z dniem tego biegu.
    const resultNote = result
      ? t(RESULT_NOTE[result.source], {
          distance: t(`onboarding.distanceInline.d${result.distanceM}` as TranslationKey),
          time: formatDuration(result.timeS),
          date: fromIsoDate(result.date).toLocaleDateString(tag, { day: 'numeric', month: 'long' }),
        })
      : null;
    return (
      <View style={[styles.card, { backgroundColor: c.surfaceBrandSoft, borderColor: c.surfaceBrandSoft }]} accessibilityRole="summary">
        <View style={styles.head}>
          <CheckCircle size={24} weight="bold" color={c.textBrand} />
          <Text weight="bold" color="textBrand" style={styles.flex}>
            {t(enough ? 'onboarding.level.strava.doneTitle' : 'onboarding.level.strava.tooFewTitle')}
          </Text>
        </View>
        {enough ? (
          <>
            <Text variant="caption" weight="medium" color="text">
              {t('onboarding.level.strava.doneStats', {
                runs: proposal.runs,
                weeklyKm: km(proposal.weeklyDistanceM),
                longestKm: km(proposal.longestRunM),
              })}
            </Text>
            <Text variant="caption" color="text">
              {[resultNote, t('onboarding.level.strava.doneCheck')].filter(Boolean).join(' ')}
            </Text>
          </>
        ) : (
          <Text variant="caption" color="text">
            {t('onboarding.level.strava.tooFew')}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
            <Lightning size={20} weight="bold" color={c.textBrand} />
          </View>
          <Text variant="heading" style={styles.flex}>
            {t('onboarding.level.strava.title')}
          </Text>
        </View>
        {phase === 'analyzing' ? (
          <AnalyzingRuns />
        ) : (
          <>
            <Text variant="caption">{t('onboarding.level.strava.body')}</Text>
            <Button label={t('onboarding.level.strava.connect')} loading={phase === 'connecting'} onPress={start} />
          </>
        )}
      </View>
      {error ? <Notice message={t(error)} /> : null}
      <Text variant="label" color="textMuted">
        {t('onboarding.level.strava.manual')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  card: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  analyzing: { alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: space[1], height: BAR_HEIGHT },
  bar: { width: space[2], borderRadius: radius.pill },
  // Stała wysokość na dwa wiersze – karta nie skacze przy zmianie opisu.
  analyzingText: { minHeight: 40, alignSelf: 'stretch', justifyContent: 'center' },
  flex: { flex: 1 },
});
