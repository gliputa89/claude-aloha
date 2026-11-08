import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Mark } from '@/components/brand/mark';
import { PlumeriaPattern } from '@/components/brand/plumeria-pattern';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

/** Fala oddzielająca turkusowe „niebo” od tła – nawiązanie do znaku „Słońce nad falą”. */
function WaveEdge({ color, width }: { color: string; width: number }) {
  return (
    <Svg
      width={width}
      height={40}
      viewBox="0 0 390 40"
      preserveAspectRatio="none"
      style={styles.wave}
      accessible={false}>
      <Path d="M0 18c48 0 72-14 130-14s82 22 130 22 82-18 130-18v32H0z" fill={color} />
    </Svg>
  );
}

export default function WelcomeScreen() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Tekst na turkusie ma kolor textOnBrand: jasny w trybie jasnym, ciemny w ciemnym – pasek statusu tak samo.
  const statusBarStyle = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <StatusBar style={statusBarStyle} />
      <View
        style={[
          styles.hero,
          { backgroundColor: c.surfaceBrand, paddingTop: insets.top + space[8] },
        ]}>
        <PlumeriaPattern />
        <View style={styles.heroContent}>
          <Mark size={112} wave="textOnBrand" />
          <Text variant="display" color="textOnBrand" align="center" accessibilityRole="header" style={styles.greeting}>
            {t('welcome.greeting')}
          </Text>
          <Text color="textOnBrandMuted" align="center" weight="medium" style={styles.tagline}>
            {t('welcome.tagline')}
          </Text>
        </View>
        <WaveEdge color={c.background} width={width} />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space[4] }]}>
        <Button label={t('welcome.createAccount')} onPress={() => router.push('/sign-up')} />
        <Button variant="secondary" label={t('welcome.haveAccount')} onPress={() => router.push('/sign-in')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: space[5],
    paddingBottom: space[12],
  },
  heroContent: { alignItems: 'center', gap: space[3] },
  greeting: { marginTop: space[4] },
  tagline: { maxWidth: 300 },
  wave: { position: 'absolute', left: 0, right: 0, bottom: -1 },
  actions: {
    paddingHorizontal: space[5],
    paddingTop: space[6],
    gap: space[3],
  },
});
