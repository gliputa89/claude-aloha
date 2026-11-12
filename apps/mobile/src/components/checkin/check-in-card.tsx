import type { TranslationKey } from '@aloha/i18n';
import { CHECKIN_TAGS, type CheckInTag } from '@aloha/plan-engine';
import { router } from 'expo-router';
import { Smiley, SmileyMeh, SmileyNervous, SmileySad, SmileyWink, type IconProps } from 'phosphor-react-native';
import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { answerCheckIn, fetchCheckIn, submitCheckIn, type CheckIn } from '@/features/checkin/api';
import type { PlanSession } from '@/features/plan/api';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

const SCALE: { value: number; Icon: ComponentType<IconProps> }[] = [
  { value: 1, Icon: SmileySad },
  { value: 2, Icon: SmileyNervous },
  { value: 3, Icon: SmileyMeh },
  { value: 4, Icon: Smiley },
  { value: 5, Icon: SmileyWink },
];

type CheckInCardProps = {
  /** Dzisiejszy, jeszcze niezrobiony trening. */
  session: PlanSession;
  today: string;
  /** Po zaakceptowanej zmianie – wczytaj plan od nowa. */
  onPlanChanged: () => Promise<void> | void;
};

/**
 * Check-in „Jak się dziś czujesz?” pod dzisiejszym treningiem: jedno tapnięcie, bez pisania. Brak odpowiedzi =
 * trening wg planu. Przy słabszym dniu pojawia się łagodna propozycja z reguł (akceptuj / zostaw plan) i podpowiedzi;
 * „coś boli” oraz „chcę pogadać” prowadzą do czatu z trenerem – check-in jest sygnałem, nie rozmową.
 */
export function CheckInCard({ session, today, onPlanChanged }: CheckInCardProps) {
  const c = useColors();
  const t = useT();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'submit' | 'accept' | 'decline' | null>(null);
  const [failed, setFailed] = useState(false);
  const [outcome, setOutcome] = useState<'accepted' | 'declined' | 'expired' | null>(null);

  useEffect(() => {
    let active = true;
    fetchCheckIn(today).then((found) => {
      if (!active) return;
      setCheckIn(found);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [today]);

  const submit = async (wellbeing: number, tags: CheckInTag[]) => {
    if (busy) return;
    setBusy('submit');
    setFailed(false);
    setOutcome(null);
    const saved = await submitCheckIn(wellbeing, tags);
    setBusy(null);
    if (!saved) return setFailed(true);
    setCheckIn(saved);
    setEditing(false);
  };

  const toggleTag = (tag: CheckInTag) => {
    if (!checkIn) return;
    const tags = checkIn.tags.includes(tag) ? checkIn.tags.filter((x) => x !== tag) : [...checkIn.tags, tag];
    // Ból to temat na rozmowę, nie na regułę: zapisujemy sygnał i otwieramy czat przy tym treningu.
    if (tag === 'pain' && !checkIn.tags.includes('pain')) {
      submit(checkIn.wellbeing, tags).then(() => router.push({ pathname: '/coach', params: { sessionId: session.id } }));
    } else {
      submit(checkIn.wellbeing, tags);
    }
  };

  const answer = async (accept: boolean) => {
    if (!checkIn?.proposal || busy) return;
    setBusy(accept ? 'accept' : 'decline');
    setFailed(false);
    const status = await answerCheckIn(checkIn.proposal.id, accept);
    if (status === 'failed') {
      setBusy(null);
      return setFailed(true);
    }
    if (status !== 'declined') await onPlanChanged();
    setBusy(null);
    setOutcome(status);
    setCheckIn({ ...checkIn, proposal: null, decided: status === 'accepted' ? 'accepted' : 'rejected' });
  };

  // Dopóki nie wiemy, czy jest już odpowiedź, nie migamy pytaniem.
  if (!loaded) return null;

  const workout = (type: string) => t(`workout.${type}` as TranslationKey);
  const answered = checkIn && !editing;
  const low = !!checkIn && checkIn.wellbeing <= 2;
  const proposal = checkIn?.proposal ?? null;
  const status = outcome
    ? t(`checkin.outcome.${outcome}` as TranslationKey)
    : checkIn?.decided === 'accepted'
      ? t('checkin.outcome.accepted')
      : checkIn && !proposal
        ? t(low ? 'checkin.noChangeLow' : 'checkin.noChange')
        : null;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.head}>
        <Text weight="bold" style={styles.flex}>
          {answered ? t('checkin.answered', { level: t(`checkin.scale.l${checkIn.wellbeing}` as TranslationKey) }) : t('checkin.question')}
        </Text>
        {busy === 'submit' ? <ActivityIndicator color={c.action} /> : null}
        {answered && !busy ? (
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={space[3]}>
            <Text variant="label" color="textBrand">
              {t('checkin.change')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {!answered ? (
        <View style={styles.scale} accessibilityRole="radiogroup" accessibilityLabel={t('checkin.question')}>
          {SCALE.map(({ value, Icon }) => {
            const selected = checkIn?.wellbeing === value;
            const label = t(`checkin.scale.l${value}` as TranslationKey);
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: busy !== null }}
                accessibilityLabel={label}
                disabled={busy !== null}
                onPress={() => submit(value, [])}
                style={({ pressed }) => [styles.option, { opacity: pressed ? 0.6 : 1 }]}>
                <View style={[styles.face, { backgroundColor: selected ? c.action : c.surfaceBrandSoft }]}>
                  <Icon size={26} weight="bold" color={selected ? c.textOnBrand : c.textBrand} />
                </View>
                <Text variant="caption" align="center" numberOfLines={1} adjustsFontSizeToFit>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {answered && status ? <Text variant="caption">{status}</Text> : null}

      {answered && proposal ? (
        <View style={[styles.proposal, { backgroundColor: c.surfaceBrandSoft }]} accessibilityLiveRegion="polite">
          <Text variant="label" color="textBrand">
            {t('chat.proposal.title')}
          </Text>
          <Text weight="semibold">
            {t(`checkin.proposal.${proposal.reason}` as TranslationKey, {
              from: workout(proposal.from.type).toLowerCase(),
              fromMin: proposal.from.durationMin ?? 0,
              to: workout(proposal.to.type).toLowerCase(),
              toMin: proposal.to.durationMin ?? 0,
            })}
          </Text>
          <View style={styles.actions}>
            <Button label={t('chat.proposal.accept')} loading={busy === 'accept'} disabled={busy !== null} onPress={() => answer(true)} />
            <Button variant="plain" label={t('chat.proposal.decline')} disabled={busy !== null} onPress={() => answer(false)} />
          </View>
        </View>
      ) : null}

      {/* Podpowiedzi tylko przy słabszym dniu – dla tych, którym nie chce się pisać. */}
      {answered && low && checkIn.decided !== 'accepted' ? (
        <View style={styles.chips}>
          {CHECKIN_TAGS.map((tag) => (
            <Chip
              key={tag}
              role="checkbox"
              label={t(`checkin.tag.${tag}` as TranslationKey)}
              selected={checkIn.tags.includes(tag)}
              onPress={() => toggleTag(tag)}
            />
          ))}
        </View>
      ) : null}

      {answered && low ? (
        <Button variant="plain" label={t('checkin.talk')} onPress={() => router.push({ pathname: '/coach', params: { sessionId: session.id } })} />
      ) : null}

      {failed ? (
        <Text variant="caption" color="textAccentStrong">
          {t('checkin.failed')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 24 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', gap: space[1] },
  option: { flex: 1, alignItems: 'center', gap: space[1], minHeight: 44 },
  face: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  proposal: { gap: space[2], padding: space[4], borderRadius: radius.card },
  actions: { gap: space[1], paddingTop: space[1] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
