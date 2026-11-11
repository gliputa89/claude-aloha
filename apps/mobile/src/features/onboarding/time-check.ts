import type { TranslationKey } from '@aloha/i18n';
import { timeSanity, type TimeSanity } from '@aloha/plan-engine';
import { Alert } from 'react-native';

import { formatDuration } from './time';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Wiarygodność wpisanego czasu; pusty albo błędny wpis sprawdza osobna walidacja formatu. */
export function sanityOf(distanceM: number, timeS: number | null | undefined): TimeSanity {
  return timeS ? timeSanity(distanceM, timeS) : 'ok';
}

/**
 * Czas z poziomu zawodowego: zanim pójdziemy dalej, pytamy, czy to nie pomyłka – i mówimy uczciwie, że takiego
 * biegacza lepiej poprowadzi prawdziwy trener. „Tak, to mój czas” przepuszcza dalej.
 */
export function confirmEliteTime(t: Translate, distanceM: number, timeS: number, onConfirm: () => void) {
  Alert.alert(
    t('onboarding.elite.title', { time: formatDuration(timeS), distance: t(`onboarding.distanceInline.d${distanceM}` as TranslationKey) }),
    t('onboarding.elite.body'),
    [
      { text: t('onboarding.elite.fix'), style: 'cancel' },
      { text: t('onboarding.elite.confirm'), onPress: onConfirm },
    ],
  );
}
