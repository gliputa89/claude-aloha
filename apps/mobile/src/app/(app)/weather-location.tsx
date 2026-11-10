import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { radius, space } from '@/constants/theme';
import { fromIsoDate } from '@/features/onboarding/time';
import { allSessions, usePlan } from '@/features/plan/plan-provider';
import { useSessionPlace, useWeather } from '@/features/weather/weather-provider';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';

/**
 * Arkusz wyboru miejsca dla pogody. Z parametrem `sessionId` (otwarty z karty pogody) ustawia miejsce
 * tylko dla tego treningu – np. wyjazd albo zawody; bez niego – miejsce domyślne dla wszystkich treningów
 * (np. gdy nie ma zgody na lokalizację). Wybór zostaje zapamiętany na telefonie.
 */
export default function WeatherLocationScreen() {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { sessionPlaces, setCustomPlace, switchToDeviceLocation } = useWeather();
  const { state } = usePlan();
  const place = useSessionPlace(sessionId);
  const session = sessionId && state.kind === 'ready' ? allSessions(state.plan).find((s) => s.id === sessionId) : undefined;
  // Powrót do lokalizacji telefonu ma sens, gdy teraz obowiązuje miejsce wpisane ręcznie (albo żadne).
  const canUseDevice = sessionId ? sessionId in sessionPlaces : !place || place.custom;
  const day = session
    ? fromIsoDate(session.scheduled_on).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null;
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<'search' | 'device' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (busy || query.trim().length === 0) return;
    setBusy('search');
    setError(null);
    const found = await setCustomPlace(query, sessionId);
    setBusy(null);
    if (found) router.back();
    else setError(t('weather.location.notFound'));
  };

  const backToDevice = async () => {
    if (busy) return;
    setBusy('device');
    setError(null);
    const ok = await switchToDeviceLocation(sessionId);
    setBusy(null);
    if (ok) router.back();
    else setError(t('weather.location.deviceDenied'));
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
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

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text variant="title" accessibilityRole="header">
            {t('weather.location.title')}
          </Text>
          <Text color="textMuted">
            {day ? t('weather.location.bodySession', { day }) : t('weather.location.body')}
          </Text>
          {place ? (
            <Text variant="label" color="textBrand">
              {t(place.custom ? 'weather.location.currentCustom' : 'weather.location.currentDevice', {
                name: place.name ?? t('weather.location.here'),
              })}
            </Text>
          ) : null}
        </View>

        <TextField
          label={t('weather.location.field')}
          placeholder={t('weather.location.placeholder')}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setError(null);
          }}
          error={error ?? undefined}
          autoFocus
          autoCorrect={false}
          autoCapitalize="words"
          textContentType="addressCity"
          returnKeyType="search"
          onSubmitEditing={search}
        />

        <View style={styles.actions}>
          <Button
            label={t('weather.location.set')}
            loading={busy === 'search'}
            disabled={query.trim().length === 0 || busy !== null}
            onPress={search}
          />
          {canUseDevice ? (
            <Button
              variant="secondary"
              label={t('weather.location.useDevice')}
              loading={busy === 'device'}
              disabled={busy !== null}
              onPress={backToDevice}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

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
  head: { gap: space[2] },
  actions: { gap: space[3] },
});
