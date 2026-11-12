import { assessRaceGoal, type GoalAssessment } from '@aloha/plan-engine';
import type { TranslationKey } from '@aloha/i18n';
import { router } from 'expo-router';
import { CaretDown, CaretUp, Lightbulb } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { OnboardingStep } from '@/components/onboarding/onboarding-step';
import { Button } from '@/components/ui/button';
import { ForecastLoading } from '@/components/onboarding/forecast-loading';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { LEVEL_TO_DB, raceNameOf, recentTimeS, startBeforeRace, targetTimeS, useOnboardingDraft } from '@/features/onboarding/draft';
import { useRaceForecast } from '@/features/onboarding/forecast';
import { goalsToSave } from '@/features/onboarding/goals';
import { completeOnboarding } from '@/features/onboarding/save';
import { goalLikeOfSpec, goalTitle } from '@/features/goals/labels';
import { formatDuration, fromIsoDate } from '@/features/onboarding/time';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';



const LEVEL_TITLE = {
  none: 'onboarding.level.noneTitle',
  occasional: 'onboarding.level.occasionalTitle',
  regular: 'onboarding.level.regularTitle',
} as const;

export default function SummaryStep() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const { draft, update } = useOnboardingDraft();
  const [dismissed, setDismissed] = useState(false);
  // Cel, przy którym biegacz świadomie został („zostaw mój czas”) – po zmianie celu pytamy od nowa.
  const [keptTarget, setKeptTarget] = useState<number | null>(null);
  // Szczegóły prognozy (skąd liczba) są zwinięte – na wierzchu zostają same czasy.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [adjusted, setAdjusted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const formatDate = (iso: string) =>
    fromIsoDate(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const distanceLabel = (d: number) => t(`onboarding.distance.d${d}` as TranslationKey);
  /** Dystans w środku zdania (małą literą: „na maraton”). */
  const distanceInline = (d: number) => t(`onboarding.distanceInline.d${d}` as TranslationKey);

  const isRace = draft.goal === 'race' && !!draft.raceDate && !!draft.level;
  const target = targetTimeS(draft) ?? null;
  // Reguły sprawdzają tylko, czy do startu jest dość tygodni. Realny czas liczy prognoza poniżej.
  const timing: GoalAssessment | null =
    isRace && draft.raceDate && draft.level
      ? assessRaceGoal({
          goal: { distanceM: draft.raceDistanceM, raceDate: draft.raceDate },
          level: LEVEL_TO_DB[draft.level],
          // Tygodnie przygotowań liczymy od startu planu, nie od dziś.
          today: draft.planStartDate,
        })
      : null;

  // Realny czas na start: model (Opus) w widełkach z reguł – tabele Danielsa, objętość, malejąca poprawa formy.
  const forecastState = useRaceForecast(draft);
  const forecast = forecastState.status === 'ready' ? forecastState.forecast : null;
  // Do pełnych minut w górę – łatwiej zapamiętać i nie obiecuje za dużo.
  const realisticS = forecast ? Math.ceil(forecast.raceDayS / 60) * 60 : null;
  // Bursztynowa propozycja zostaje tylko dla zbyt krótkiego terminu; o czasie rozmawia karta prognozy.
  const suggestion = timing && timing.status !== 'ok' && !dismissed ? timing : null;
  const suggestionText = (() => {
    if (!suggestion) return null;
    const distance = distanceInline(draft.raceDistanceM);
    if (suggestion.status === 'target_too_fast') {
      return t('onboarding.summary.tooFast', { suggested: formatDuration(suggestion.suggestion.targetTimeS) });
    }
    if (suggestion.suggestion.kind === 'shorter_distance') {
      return t('onboarding.summary.tooSoonDistance', {
        distance,
        weeks: suggestion.weeks,
        suggested: distanceInline(suggestion.suggestion.distanceM),
      });
    }
    return t('onboarding.summary.tooSoonDate', {
      distance,
      minWeeks: suggestion.minWeeks,
      date: formatDate(suggestion.suggestion.raceDate),
    });
  })();

  const acceptSuggestion = () => {
    if (!suggestion) return;
    if (suggestion.status === 'target_too_fast') {
      update({ targetTime: formatDuration(suggestion.suggestion.targetTimeS) });
    } else if (suggestion.suggestion.kind === 'shorter_distance') {
      // Krótszy dystans: docelowy czas z dłuższego nie ma sensu.
      update({ raceDistanceM: suggestion.suggestion.distanceM, targetTime: '' });
    } else {
      update({ raceDate: suggestion.suggestion.raceDate });
    }
    setAdjusted(true);
  };

  // Karta z prognozą: ile dziś, ile na start i – od modelu – skąd ta liczba. Bez niej przy zbyt krótkim terminie.
  const minutes = (s: number) => formatDuration(Math.round(s / 60) * 60);
  const showForecast = !!forecast && timing?.status === 'ok';
  // Skąd ta liczba – zawsze, niezależnie od tego, czy biegacz wpisał własny cel: wynik wyjściowy, jego odpowiednik
  // z tabel na dystansie zawodów i kilometraż wobec tego, czego dystans wymaga.
  const recent = recentTimeS(draft) ?? null;
  const forecastHow =
    forecast && recent
      ? t(forecast.volume.currentKm < forecast.volume.neededKm ? 'onboarding.summary.forecastHow' : 'onboarding.summary.forecastHowEnough', {
          result: formatDuration(recent),
          resultDistance: distanceInline(draft.recentDistanceM),
          daniels: minutes(forecast.danielsS),
          distance: distanceInline(draft.raceDistanceM),
          current: forecast.volume.currentKm,
          needed: forecast.volume.neededKm,
        })
      : null;
  // Wybór w karcie prognozy: cel wyliczony albo własny. `null` – własnego celu nie ma (pusty albo „podpowiedz mi”).
  const ownTarget = target !== null && target !== realisticS ? target : null;
  const tooFast = ownTarget !== null && forecast !== null && ownTarget < forecast.raceDayS;
  const kept = ownTarget !== null && keptTarget === ownTarget;
  const adoptForecast = () => {
    if (realisticS === null) return;
    update({ targetTime: formatDuration(realisticS), targetSuggest: false });
    setAdjusted(true);
  };

  const goalValue = (() => {
    if (!draft.goal) return '';
    if (draft.goal !== 'race' || !draft.raceDate) {
      const goals = goalsToSave(draft);
      return goals ? goalTitle(t, locale, goalLikeOfSpec(goals.primary)) : '';
    }
    const base = { distance: distanceLabel(draft.raceDistanceM), date: formatDate(draft.raceDate) };
    const value = target
      ? t('onboarding.summary.raceValueTime', { ...base, time: formatDuration(target) })
      : t('onboarding.summary.raceValue', base);
    const name = raceNameOf(draft);
    return name ? t('onboarding.summary.raceValueNamed', { name, value }) : value;
  })();

  // Cele obok z kroku „Twoje cele”.
  const also = goalsToSave(draft)?.secondary ?? [];
  const alsoValue = also.length ? also.map((g) => goalTitle(t, locale, goalLikeOfSpec(g))).join(', ') : t('onboarding.summary.goalsAlsoNone');

  const days = [...draft.days]
    .sort((a, b) => a - b)
    .map((d) => t(`onboarding.day.short${d}` as TranslationKey))
    .join(', ');

  const finish = async () => {
    setSaving(true);
    setError(false);
    try {
      await completeOnboarding(draft);
      // Plan układa się na ekranie „generating” (wschód słońca), który potem przełącza na aplikację.
      router.replace('/generating');
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <OnboardingStep
      step={6}
      title={t('onboarding.summary.title')}
      subtitle={t('onboarding.summary.subtitle')}
      footer={
        <Button label={t('onboarding.finish')} loading={saving} disabled={!startBeforeRace(draft)} onPress={finish} />
      }>
      {suggestionText && suggestion ? (
        <View style={[styles.suggestion, { backgroundColor: c.surfaceAccentSoft }]} accessibilityLiveRegion="polite">
          <View style={styles.suggestionRow}>
            <Lightbulb size={22} weight="bold" color={c.textAccentStrong} />
            <Text weight="medium" color="textAccentStrong" style={styles.flex}>
              {suggestionText}
            </Text>
          </View>
          <View style={styles.suggestionActions}>
            <Button label={t('onboarding.summary.accept')} onPress={acceptSuggestion} />
            <Button variant="plain" label={t('onboarding.summary.keepMine')} onPress={() => setDismissed(true)} />
          </View>
        </View>
      ) : adjusted ? (
        <Notice tone="success" message={t('onboarding.summary.adjusted')} />
      ) : null}

      {timing?.status === 'ok' && forecastState.status === 'loading' ? (
        <ForecastLoading
          title={t('onboarding.summary.forecastTitle', { distance: distanceInline(draft.raceDistanceM) })}
          withHours={draft.raceDistanceM >= 21097}
        />
      ) : showForecast && forecast && realisticS !== null ? (
        <View style={[styles.forecast, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text weight="bold">{t('onboarding.summary.forecastTitle', { distance: distanceInline(draft.raceDistanceM) })}</Text>
          {/* Jedna liczba: realny czas w dniu startu. Reszta (skąd się wzięła) jest w szczegółach. */}
          <Text variant="title" accessibilityLabel={`${t('onboarding.summary.forecastRaceDay')}: ${minutes(forecast.raceDayS)}`}>
            {minutes(forecast.raceDayS)}
          </Text>
          {target === realisticS ? (
            <Text variant="label" color="textBrand">
              {t('onboarding.summary.forecastIsGoal')}
            </Text>
          ) : kept && ownTarget !== null ? (
            // Biegacz został przy swoim: pokazujemy, przy jakim, i zostawiamy drogę powrotu do propozycji.
            <View style={styles.choice}>
              <Text variant="label" color="textBrand">
                {t('onboarding.summary.forecastKept', { target: formatDuration(ownTarget) })}
              </Text>
              <Button variant="plain" label={t('onboarding.summary.forecastSet', { time: formatDuration(realisticS) })} onPress={adoptForecast} />
            </View>
          ) : ownTarget !== null ? (
            <View style={styles.choice}>
              <Text weight="medium" color={tooFast ? 'textAccentStrong' : 'text'}>
                {t(tooFast ? 'onboarding.summary.forecastFaster' : 'onboarding.summary.forecastSlower', { target: formatDuration(ownTarget) })}
              </Text>
              <Button
                variant={tooFast ? 'primary' : 'secondary'}
                label={t('onboarding.summary.forecastSet', { time: formatDuration(realisticS) })}
                onPress={adoptForecast}
              />
              <Button
                variant="plain"
                label={t('onboarding.summary.forecastKeep', { target: formatDuration(ownTarget) })}
                onPress={() => setKeptTarget(ownTarget)}
              />
            </View>
          ) : (
            <View style={styles.choice}>
              {draft.targetSuggest ? <Text weight="medium">{t('onboarding.summary.forecastAsked', { time: formatDuration(realisticS) })}</Text> : null}
              <Button
                variant={draft.targetSuggest ? 'primary' : 'secondary'}
                label={t('onboarding.summary.forecastSet', { time: formatDuration(realisticS) })}
                onPress={adoptForecast}
              />
            </View>
          )}
          {forecast.note || forecastHow ? (
            <View style={[styles.details, { borderTopColor: c.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
                onPress={() => setDetailsOpen((open) => !open)}
                hitSlop={space[2]}
                style={({ pressed }) => [styles.detailsToggle, { opacity: pressed ? 0.6 : 1 }]}>
                <Text variant="label" color="textBrand" style={styles.flex}>
                  {t('onboarding.summary.forecastDetails')}
                </Text>
                {detailsOpen ? <CaretUp size={18} weight="bold" color={c.textBrand} /> : <CaretDown size={18} weight="bold" color={c.textBrand} />}
              </Pressable>
              {detailsOpen ? (
                <View style={styles.choice}>
                  {forecast.note ? <Text variant="caption" color="text">{forecast.note}</Text> : null}
                  {forecastHow ? <Text variant="caption">{forecastHow}</Text> : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Row label={t('onboarding.summary.goal')} value={goalValue} onEdit={() => router.navigate('/goal')} />
        <Divider />
        <Row label={t('onboarding.summary.goalsAlso')} value={alsoValue} onEdit={() => router.navigate('/goals')} />
        <Divider />
        <Row
          label={t('onboarding.summary.level')}
          value={draft.level ? t(LEVEL_TITLE[draft.level]) : ''}
          onEdit={() => router.navigate('/level')}
        />
        <Divider />
        <Row
          label={t('onboarding.summary.start')}
          value={formatDate(draft.planStartDate)}
          onEdit={() => router.navigate('/availability')}
        />
        <Divider />
        <Row
          label={t('onboarding.summary.availability')}
          value={t('onboarding.summary.availabilityValue', { sessions: draft.sessionsPerWeek, days })}
          onEdit={() => router.navigate('/availability')}
        />
        <Divider />
        <Row
          label={t('onboarding.summary.health')}
          value={draft.healthConsent ? t('onboarding.summary.consentOn') : t('onboarding.summary.consentOff')}
          onEdit={() => router.navigate('/health')}
        />
      </View>

      {!startBeforeRace(draft) ? <Notice message={t('onboarding.errors.startAfterRace')} /> : null}
      {error ? <Notice message={t('onboarding.errors.saveFailed')} /> : null}
    </OnboardingStep>
  );
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  const t = useT();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="caption">{label}</Text>
        <Text weight="semibold">{value}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('onboarding.edit')}: ${label}`}
        onPress={onEdit}
        hitSlop={space[2]}
        style={styles.edit}>
        <Text variant="label" color="textBrand">
          {t('onboarding.edit')}
        </Text>
      </Pressable>
    </View>
  );
}

function Divider() {
  const c = useColors();
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  suggestion: { gap: space[4], padding: space[4], borderRadius: radius.card },
  suggestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  suggestionActions: { gap: space[1] },
  card: { borderRadius: radius.card, borderWidth: 1.5, paddingHorizontal: space[4] },
  forecast: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  choice: { gap: space[2] },
  details: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space[1] },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[4] },
  edit: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
});
