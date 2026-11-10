import Constants from 'expo-constants';
import { Heart, Heartbeat, Lightning, Watch, type IconProps } from 'phosphor-react-native';
import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { FadeUp } from '@/components/ui/fade-up';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { usePlan } from '@/features/plan/plan-provider';
import { connectStrava, disconnectStrava, fetchRecentStravaRuns, fetchStravaStatus, type StravaStatus } from '@/features/strava/api';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { signOut } from '@/lib/auth';
import { getThemePreference, setThemePreference, THEME_PREFERENCES, type ThemePreference } from '@/lib/theme-preference';
import { useAuth } from '@/providers/auth-provider';

type Integration = { key: 'appleHealth' | 'healthConnect' | 'strava' | 'garmin'; Icon: ComponentType<IconProps> };

/** Działa Strava (łączenie przez ekran zgody Stravy); reszta jest poza MVP – pokazujemy, co będzie można połączyć. */
const INTEGRATIONS: Integration[] = [
  Platform.OS === 'android' ? { key: 'healthConnect', Icon: Heartbeat } : { key: 'appleHealth', Icon: Heart },
  { key: 'strava', Icon: Lightning },
  { key: 'garmin', Icon: Watch },
];

/** Zakładka „Profil”: dane konta, integracje z dostawcami (wkrótce) i wylogowanie. */
export default function ProfileScreen() {
  const c = useColors();
  const t = useT();
  const { profile, session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [theme, setTheme] = useState(getThemePreference);
  const locale = useLocale();
  const [strava, setStrava] = useState<StravaStatus | null>(null);

  useEffect(() => {
    let active = true;
    fetchStravaStatus().then((status) => active && setStrava(status));
    return () => {
      active = false;
    };
  }, []);

  const { reload } = usePlan();
  const [stravaBusy, setStravaBusy] = useState(false);

  const linkStrava = async () => {
    setStravaBusy(true);
    const result = await connectStrava();
    if (result === 'connected') {
      setStrava(await fetchStravaStatus());
      // Pierwsze pobranie biegów i plan z odhaczonymi treningami; potem stan z czasem synchronizacji.
      await reload();
      setStrava(await fetchStravaStatus());
    } else if (result !== 'cancelled') {
      const message = { no_activity_scope: 'profile.stravaNoScope', athlete_limit: 'profile.stravaLimit', failed: 'profile.stravaConnectFailed' } as const;
      Alert.alert(t('profile.strava'), t(message[result]));
    }
    setStravaBusy(false);
  };

  const unlinkStrava = () =>
    Alert.alert(t('profile.stravaDisconnectTitle'), t('profile.stravaDisconnectBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.stravaDisconnect'),
        style: 'destructive',
        onPress: async () => {
          setStravaBusy(true);
          if (await disconnectStrava()) setStrava(null);
          else Alert.alert(t('profile.strava'), t('profile.stravaDisconnectFailed'));
          setStravaBusy(false);
        },
      },
    ]);

  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'pl-PL', { hour: '2-digit', minute: '2-digit' });

  /** Wymuszone pobranie biegów z ostatnich 3 dni – serwer pozwala na nie raz na 3 godziny. */
  const fetchRecent = async () => {
    setStravaBusy(true);
    const result = await fetchRecentStravaRuns();
    if (result.status === 'done') {
      if (result.updated > 0) await reload();
      Alert.alert(t('profile.strava'), t(result.imported > 0 ? 'profile.stravaFetchDone' : 'profile.stravaFetchNone'));
    } else if (result.status === 'limited') {
      Alert.alert(t('profile.strava'), t('profile.stravaFetchWait', { time: clock(result.nextAt) }));
    } else {
      Alert.alert(t('profile.strava'), t('profile.stravaFetchFailed'));
    }
    setStrava(await fetchStravaStatus());
    setStravaBusy(false);
  };

  /** Połączona Strava: pobranie biegów (gdy minęły 3 godziny od poprzedniego ręcznego) albo rozłączenie. */
  const manageStrava = () => {
    const waitUntil = strava?.nextManualAt && Date.parse(strava.nextManualAt) > Date.now() ? strava.nextManualAt : null;
    Alert.alert(
      t('profile.strava'),
      waitUntil ? t('profile.stravaOptionsWait', { time: clock(waitUntil) }) : t('profile.stravaOptionsBody'),
      [
        ...(waitUntil ? [] : [{ text: t('profile.stravaFetch'), onPress: fetchRecent }]),
        { text: t('profile.stravaDisconnect'), style: 'destructive' as const, onPress: unlinkStrava },
        { text: t('profile.cancel'), style: 'cancel' as const },
      ],
    );
  };

  const stravaNote = !strava
    ? null
    : strava.needsReconnect
      ? t('profile.stravaReconnect')
      : strava.lastSyncedAt
        ? t('profile.stravaSynced', {
            when: new Date(strava.lastSyncedAt).toLocaleString(locale === 'en' ? 'en-GB' : 'pl-PL', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
          })
        : t('profile.stravaWaiting');

  const chooseTheme = (next: ThemePreference) => {
    setTheme(next);
    setThemePreference(next);
  };

  const name = profile?.display_name?.trim();
  const email = session?.user.email;
  const initial = (name || email || '?').charAt(0).toUpperCase();
  const version = Constants.expoConfig?.version;

  const confirmSignOut = () =>
    Alert.alert(t('profile.signOutConfirmTitle'), t('profile.signOutConfirmBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          // Po wylogowaniu nawigator sam wraca do ekranu startowego (zmiana sesji).
          await signOut();
        },
      },
    ]);

  return (
    <Screen title={t('profile.title')}>
      <FadeUp delay={40}>
        <View style={[styles.card, styles.person, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.avatar, { backgroundColor: c.surfaceBrand }]}>
            <Text variant="heading" color="textOnBrand">
              {initial}
            </Text>
          </View>
          <View style={styles.flex}>
            {name ? <Text weight="bold">{name}</Text> : null}
            {email ? (
              <Text variant="caption" numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
        </View>
      </FadeUp>

      <FadeUp delay={120} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="heading" accessibilityRole="header">
            {t('profile.integrations')}
          </Text>
          <Text variant="caption">{t('profile.integrationsHint')}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {INTEGRATIONS.map(({ key, Icon }, i) => {
            const isStrava = key === 'strava';
            const active = isStrava && strava !== null && !strava.needsReconnect;
            const note = isStrava && strava ? stravaNote : null;
            // Strava: niepołączona → „Połącz”, wygasła → „Połącz ponownie”, połączona → „Połączono” (tapnięcie: pobierz biegi / rozłącz).
            const badge = !isStrava
              ? t('profile.soon')
              : active
                ? t('profile.connected')
                : t(strava ? 'profile.reconnect' : 'profile.connect');
            const border = i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth };
            const content = (
              <>
                <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
                  <Icon size={20} weight="bold" color={c.textBrand} />
                </View>
                <View style={styles.name}>
                  <Text weight="semibold">{t(`profile.${key}`)}</Text>
                  {note ? <Text variant="caption">{note}</Text> : null}
                </View>
                {isStrava && stravaBusy ? (
                  <ActivityIndicator color={c.textBrand} />
                ) : (
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: !isStrava ? c.surfaceAccentSoft : active ? c.surfaceBrandSoft : c.surfaceBrand },
                    ]}>
                    <Text
                      variant="caption"
                      weight="semibold"
                      color={!isStrava ? 'textAccentStrong' : active ? 'textBrand' : 'textOnBrand'}>
                      {badge}
                    </Text>
                  </View>
                )}
              </>
            );
            const label = [t(`profile.${key}`), badge, note].filter(Boolean).join(', ');
            return isStrava ? (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={active ? t('profile.stravaManage') : undefined}
                accessibilityState={{ busy: stravaBusy }}
                disabled={stravaBusy}
                onPress={active ? manageStrava : linkStrava}
                style={({ pressed }) => [styles.row, border, { opacity: pressed ? 0.6 : 1 }]}>
                {content}
              </Pressable>
            ) : (
              <View key={key} accessible accessibilityLabel={label} style={[styles.row, border]}>
                {content}
              </View>
            );
          })}
        </View>
      </FadeUp>

      <FadeUp delay={200} style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          {t('profile.appearance')}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('profile.appearance')} style={styles.themes}>
          {THEME_PREFERENCES.map((option) => (
            <Chip
              key={option}
              fill
              label={t(`profile.theme.${option}`)}
              selected={theme === option}
              onPress={() => chooseTheme(option)}
            />
          ))}
        </View>
      </FadeUp>

      <FadeUp delay={280} style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          {t('profile.account')}
        </Text>
        <Button variant="secondary" label={t('profile.signOut')} loading={signingOut} onPress={confirmSignOut} />
        {version ? (
          <Text variant="caption" align="center">
            {t('profile.version', { version })}
          </Text>
        ) : null}
      </FadeUp>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: radius.card, borderWidth: 1.5, overflow: 'hidden' },
  person: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[4] },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  section: { gap: space[3] },
  sectionHeader: { gap: space[1] },
  themes: { flexDirection: 'row', gap: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    minHeight: 60,
  },
  name: { flex: 1, gap: 2 },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.pill },
});
