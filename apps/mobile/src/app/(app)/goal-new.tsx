import {
  PERFORMANCE_WEEKS,
  RACE_DISTANCES_M,
  realisticTargetS,
  timeSanity,
  type GoalKind,
  type GoalSpec,
  type RaceDistanceM,
} from '@aloha/plan-engine';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChatCircleDots, X } from 'phosphor-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepSection } from '@/components/onboarding/onboarding-step';
import { GOAL_ICON } from '@/components/goals/goal-cards';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { OptionCard } from '@/components/ui/option-card';
import { Stepper } from '@/components/ui/stepper';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { radius, space } from '@/constants/theme';
import { addGoal } from '@/features/goals/api';
import { useGoals } from '@/features/goals/goals-provider';
import { formatDate, goalLikeOfRow, goalTitle } from '@/features/goals/labels';
import { touchesPlanSpec } from '@/features/goals/plan-impact';
import { RACE_NAME_MAX } from '@/features/onboarding/draft';
import { addDays, formatDuration, fromIsoDate, parseDuration, toIsoDate, todayIso } from '@/features/onboarding/time';
import { usePlan } from '@/features/plan/plan-provider';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { useUnitFormat } from '@/lib/units';

const KIND_TEXT = {
  race: ['goalNew.kindRace', 'goalNew.kindRaceDesc'],
  performance: ['goalNew.kindPerformance', 'goalNew.kindPerformanceDesc'],
  continuous: ['goalNew.kindContinuous', 'goalNew.kindContinuousDesc'],
  consistency: ['goalNew.kindConsistency', 'goalNew.kindConsistencyDesc'],
  volume: ['goalNew.kindVolume', 'goalNew.kindVolumeDesc'],
} as const;
const KIND_ORDER: GoalKind[] = ['race', 'performance', 'continuous', 'consistency', 'volume'];
const MINUTES = [10, 20, 30, 45, 60, 90] as const;

/** Rola nowego celu: prowadzi plan, zawody B / C albo zwykły cel obok. */
type Role = 'primary' | 'B' | 'C' | 'secondary';

const isKind = (k: string | undefined): k is GoalKind => !!k && (KIND_ORDER as string[]).includes(k);

/** Arkusz „Nowy cel” (makieta „Dodaj cel”): rodzaj → kilka pytań → co się zmieni w planie → zapis. */
export default function GoalNewScreen() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const u = useUnitFormat();
  const miles = u.units === 'imperial';
  const params = useLocalSearchParams<{ kind?: string; primary?: string }>();
  const { state, primary, secondary, changed } = useGoals();
  const plan = usePlan();
  const planEndsOn = plan.state.kind === 'ready' ? (plan.state.plan.weeks.at(-1)?.sessions.at(-1)?.scheduled_on ?? plan.state.plan.ends_on) : null;
  const context = state.kind === 'ready' ? state.data.context : null;

  const [kind, setKind] = useState<GoalKind | null>(isKind(params.kind) ? params.kind : null);
  const [name, setName] = useState('');
  const [distanceM, setDistanceM] = useState<RaceDistanceM>(isKind(params.kind) && params.kind === 'race' ? 10000 : 5000);
  const [date, setDate] = useState(toIsoDate(addDays(new Date(), 10 * 7)));
  const [withDue, setWithDue] = useState(true);
  const [time, setTime] = useState('');
  const [byMinutes, setByMinutes] = useState(true);
  const [minutes, setMinutes] = useState<number>(30);
  const [sessions, setSessions] = useState(3);
  const [weeks, setWeeks] = useState(8);
  const [kmText, setKmText] = useState('');
  const [until, setUntil] = useState(toIsoDate(addDays(new Date(), 4 * 7)));
  const forcedPrimary = params.primary === '1' || !primary;
  const [roleChoice, setRoleChoice] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayIso();
  // Przykład w opisie celu „kilometraż”: 100 km albo 60 mil.
  const descParams = { n: miles ? 60 : 100, unit: u.unit };
  const role: Role = forcedPrimary ? 'primary' : (roleChoice ?? (kind === 'race' ? 'B' : 'secondary'));
  const timeS = time.trim() ? parseDuration(time) : null;
  const timeInvalid = time.trim() !== '' && timeS === null;
  const sanity = timeS ? timeSanity(distanceM, timeS) : 'ok';
  // Wpis w km albo milach (jak w Profilu); cel w bazie zawsze w pełnych km.
  const volumeEntry = Number(kmText.trim().replace(',', '.'));
  const kmValid = Number.isInteger(volumeEntry) && volumeEntry >= 1 && volumeEntry <= 20000;
  const km = Math.round(u.toMeters(volumeEntry) / 1000);
  const fullSecondary = secondary.length >= 3 && role !== 'primary';

  // Realny czas na dystansie w wybranym terminie (reguły – ta sama prognoza co w ankiecie).
  const weeksToDate = Math.max(1, Math.floor((fromIsoDate(date).getTime() - fromIsoDate(today).getTime()) / (7 * 86_400_000)));
  const realistic =
    context && (kind === 'race' || kind === 'performance')
      ? realisticTargetS({
          distanceM,
          weeks: kind === 'performance' && !withDue ? PERFORMANCE_WEEKS : weeksToDate,
          level: context.level,
          recent: context.recent,
          weeklyKm: context.weeklyKm,
          runsPerWeek: context.runsPerWeek,
          weeklyMinutesCap: context.weeklyMinutesCap,
        })
      : null;

  const spec: GoalSpec | null = (() => {
    switch (kind) {
      case 'race':
        return { kind, distanceM, date, name: name.trim().slice(0, RACE_NAME_MAX) || null, targetTimeS: timeS, priority: role === 'C' ? 'C' : 'B' };
      case 'performance':
        return timeS ? { kind, distanceM, targetTimeS: timeS, date: withDue ? date : null } : null;
      case 'continuous':
        return byMinutes ? { kind, targetMinutes: minutes, distanceM: null } : { kind, distanceM, targetMinutes: null, focus: 'run_regularly' };
      case 'consistency':
        return { kind, sessionsPerWeek: sessions, periodStart: today, periodEnd: toIsoDate(addDays(fromIsoDate(today), weeks * 7 - 1)) };
      case 'volume':
        return kmValid ? { kind, volumeKm: km, periodStart: today, periodEnd: until } : null;
      default:
        return null;
    }
  })();
  const valid = !!spec && !timeInvalid && sanity !== 'impossible' && !fullSecondary;

  const currentTitle = primary ? goalTitle(t, locale, goalLikeOfRow(primary)) : '';
  const impact = (() => {
    if (!spec) return null;
    if (role === 'primary') return primary ? t('goalNew.impactPrimary', { current: currentTitle }) : t('goalNew.impactPrimaryFirst');
    if (spec.kind === 'race') return role === 'C' ? t('goalNew.impactC') : t('goalNew.impactB', { current: currentTitle, date: formatDate(locale, date) });
    if (spec.kind === 'performance' && spec.date) return t('goalNew.impactTrial', { date: formatDate(locale, spec.date) });
    return t('goalNew.impactNone');
  })();

  const save = async () => {
    if (!spec || !valid) return;
    setSaving(true);
    setError(null);
    const result = await addGoal(spec, role === 'primary');
    if ('error' in result) {
      setError(result.error === 'too_many_goals' ? t('goals.tooMany') : t('goals.saveFailed'));
      setSaving(false);
      return;
    }
    await changed({ rebuildPlan: role === 'primary' || touchesPlanSpec(spec, planEndsOn) });
    router.back();
  };

  const roles: { id: Role; title: string; desc: string }[] =
    kind === 'race'
      ? [
          { id: 'primary', title: t('goalNew.rolePrimary'), desc: t('goalNew.rolePrimaryDesc') },
          { id: 'B', title: t('goalNew.roleB'), desc: t('goalNew.roleBDesc') },
          { id: 'C', title: t('goalNew.roleC'), desc: t('goalNew.roleCDesc') },
        ]
      : [
          { id: 'primary', title: t('goalNew.rolePrimary'), desc: t('goalNew.rolePrimaryDesc') },
          { id: 'secondary', title: t('goalNew.roleSecondary'), desc: t('goalNew.roleSecondaryDesc') },
        ];

  const header = (
    <View style={styles.header}>
      {kind && !isKind(params.kind) ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('goalNew.back')} onPress={() => setKind(null)} hitSlop={space[2]} style={styles.iconButton}>
          <ArrowLeft size={22} weight="bold" color={c.text} />
        </Pressable>
      ) : null}
      <Text variant="title" accessibilityRole="header" style={styles.flex}>
        {kind ? t(KIND_TEXT[kind][0]) : t('goalNew.title')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('goalNew.close')}
        onPress={() => router.back()}
        hitSlop={space[2]}
        style={[styles.iconButton, { backgroundColor: c.surface }]}>
        <X size={18} weight="bold" color={c.textMuted} />
      </Pressable>
    </View>
  );

  if (!kind) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: c.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <Text color="textMuted">{t('goalNew.subtitle')}</Text>
          <View style={[styles.kinds, { backgroundColor: c.surface, borderColor: c.border }]}>
            {KIND_ORDER.map((k, i) => {
              const IconCmp = GOAL_ICON[k];
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(KIND_TEXT[k][0])}. ${t(KIND_TEXT[k][1], descParams)}`}
                  onPress={() => {
                    setKind(k);
                    if (k === 'race') setDistanceM(10000);
                  }}
                  style={({ pressed }) => [
                    styles.kindRow,
                    i < KIND_ORDER.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
                    { opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <View style={[styles.kindIcon, { backgroundColor: k === 'race' ? c.surfaceAccentSoft : c.surfaceBrandSoft }]}>
                    <IconCmp size={22} weight="bold" color={k === 'race' ? c.textAccentStrong : c.textBrand} />
                  </View>
                  <View style={styles.flex}>
                    <Text weight="bold">{t(KIND_TEXT[k][0])}</Text>
                    <Text variant="caption">{t(KIND_TEXT[k][1], descParams)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/coach')}
            style={({ pressed }) => [styles.coach, { backgroundColor: c.surfaceBrandSoft, opacity: pressed ? 0.7 : 1 }]}>
            <ChatCircleDots size={22} weight="bold" color={c.textBrand} />
            <Text variant="caption" color="text" style={styles.flex}>
              {t('goalNew.askCoach')}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const distances = (
    <StepSection label={t('goalNew.distanceLabel')}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {RACE_DISTANCES_M.map((d) => (
          <Chip key={d} label={t(`onboarding.distance.d${d}`)} selected={distanceM === d} onPress={() => setDistanceM(d)} />
        ))}
      </View>
    </StepSection>
  );

  const datePicker = (value: string, onChange: (iso: string) => void, maxDays = 2 * 365) => (
    <DateTimePicker
      value={fromIsoDate(value)}
      mode="date"
      display="compact"
      minimumDate={addDays(new Date(), 1)}
      maximumDate={addDays(new Date(), maxDays)}
      accentColor={c.action}
      onValueChange={(_e, d) => onChange(toIsoDate(d))}
      style={styles.date}
    />
  );

  const timeField = (required: boolean) => (
    <StepSection label={required ? t('goalNew.timeRequired') : t('goalNew.timeOptional')} hint={realistic ? t('goalNew.timeRealistic', { time: formatDuration(realistic) }) : undefined}>
      <TextField
        label={t('goalNew.timeField')}
        placeholder={t('goalNew.timePlaceholder')}
        hint={t('goalNew.timeHint')}
        value={time}
        onChangeText={setTime}
        error={timeInvalid ? t('onboarding.errors.timeInvalid') : sanity === 'impossible' ? t('onboarding.errors.timeImpossible') : undefined}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        maxLength={8}
      />
    </StepSection>
  );

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {header}

          {kind === 'race' ? (
            <>
              <TextField
                label={t('onboarding.goal.nameLabel')}
                placeholder={t('onboarding.goal.namePlaceholder')}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={RACE_NAME_MAX}
                returnKeyType="done"
              />
              {distances}
              <StepSection label={t('goalNew.dateLabel')}>{datePicker(date, setDate)}</StepSection>
              {timeField(false)}
            </>
          ) : null}

          {kind === 'performance' ? (
            <>
              {distances}
              {timeField(true)}
              <StepSection label={t('goalNew.dueLabel')} hint={withDue ? t('goalNew.dueHint') : undefined}>
                <Checkbox checked={withDue} onChange={setWithDue} label={t('goalNew.dueToggle')} />
                {withDue ? datePicker(date, setDate, 365) : null}
              </StepSection>
            </>
          ) : null}

          {kind === 'continuous' ? (
            <>
              <StepSection label={t('goalNew.continuousBy')}>
                <View style={styles.chips} accessibilityRole="radiogroup">
                  <Chip fill label={t('goalNew.modeMinutes')} selected={byMinutes} onPress={() => setByMinutes(true)} />
                  <Chip fill label={t('goalNew.modeDistance')} selected={!byMinutes} onPress={() => setByMinutes(false)} />
                </View>
              </StepSection>
              {byMinutes ? (
                <StepSection label={t('goalNew.minutesLabel')}>
                  <View style={styles.chips} accessibilityRole="radiogroup">
                    {MINUTES.map((m) => (
                      <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />
                    ))}
                  </View>
                </StepSection>
              ) : (
                distances
              )}
            </>
          ) : null}

          {kind === 'consistency' ? (
            <>
              <StepSection label={t('goalNew.sessionsLabel')}>
                <Stepper
                  value={sessions}
                  min={1}
                  max={7}
                  onChange={setSessions}
                  label={t('goalNew.sessionsLabel')}
                  decreaseLabel={t('goalNew.decrease')}
                  increaseLabel={t('goalNew.increase')}
                />
              </StepSection>
              <StepSection label={t('goalNew.weeksLabel')}>
                <Stepper
                  value={weeks}
                  min={2}
                  max={26}
                  onChange={setWeeks}
                  label={t('goalNew.weeksLabel')}
                  decreaseLabel={t('goalNew.decrease')}
                  increaseLabel={t('goalNew.increase')}
                />
              </StepSection>
            </>
          ) : null}

          {kind === 'volume' ? (
            <>
              <TextField
                label={t(miles ? 'goalNew.miLabel' : 'goalNew.kmLabel')}
                placeholder={t(miles ? 'goalNew.miPlaceholder' : 'goalNew.kmPlaceholder')}
                value={kmText}
                onChangeText={setKmText}
                error={kmText.trim() !== '' && !kmValid ? t(miles ? 'goalNew.miInvalid' : 'goalNew.kmInvalid') : undefined}
                keyboardType="number-pad"
                maxLength={5}
              />
              <StepSection label={t('goalNew.untilLabel')}>{datePicker(until, setUntil, 366)}</StepSection>
            </>
          ) : null}

          {forcedPrimary ? null : (
            <StepSection label={t('goalNew.roleLabel')}>
              <View style={styles.roles} accessibilityRole="radiogroup">
                {roles.map((r) => (
                  <OptionCard key={r.id} title={r.title} description={r.desc} selected={role === r.id} onPress={() => setRoleChoice(r.id)} />
                ))}
              </View>
            </StepSection>
          )}

          {impact ? (
            <View style={[styles.impact, { backgroundColor: c.surfaceAccentSoft }]} accessibilityLiveRegion="polite">
              <Text variant="label" weight="extrabold" color="textOnAccent">
                {t('goalNew.impactTitle')}
              </Text>
              <Text variant="caption" color="textOnAccent">
                {impact}
              </Text>
            </View>
          ) : null}

          {fullSecondary ? <Notice message={t('goals.tooMany')} /> : null}
          {error ? <Notice message={error} /> : null}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Button label={t('goalNew.save')} disabled={!valid} loading={saving} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[6], gap: space[5] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  kinds: { borderRadius: radius.card, borderWidth: 1.5, overflow: 'hidden' },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], minHeight: 64 },
  kindIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  coach: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.card },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  date: { alignSelf: 'flex-start' },
  roles: { gap: space[2] },
  impact: { gap: space[1], padding: space[4], borderRadius: radius.card },
  footer: { paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2], borderTopWidth: StyleSheet.hairlineWidth },
});
