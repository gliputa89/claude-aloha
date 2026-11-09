import Constants from 'expo-constants';
import { Heart, Heartbeat, Lightning, Watch, type IconProps } from 'phosphor-react-native';
import { useState, type ComponentType } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FadeUp } from '@/components/ui/fade-up';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/providers/auth-provider';

type Integration = { key: 'appleHealth' | 'healthConnect' | 'strava' | 'garmin'; Icon: ComponentType<IconProps> };

/** Integracje są poza MVP – na razie pokazujemy, co będzie można połączyć. */
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
          {INTEGRATIONS.map(({ key, Icon }, i) => (
            <View
              key={key}
              accessible
              accessibilityLabel={`${t(`profile.${key}`)}, ${t('profile.soon')}`}
              style={[styles.row, i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
                <Icon size={20} weight="bold" color={c.textBrand} />
              </View>
              <Text weight="semibold" style={styles.flex}>
                {t(`profile.${key}`)}
              </Text>
              <View style={[styles.pill, { backgroundColor: c.surfaceAccentSoft }]}>
                <Text variant="caption" weight="semibold" color="textAccentStrong">
                  {t('profile.soon')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </FadeUp>

      <FadeUp delay={200} style={styles.section}>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], minHeight: 60 },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.pill },
});
