import type { TranslationKey } from '@aloha/i18n';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { signInWithApple } from '@/lib/auth';
import { legalUrl } from '@/lib/links';

type AppleSignInProps = {
  /** „Zaloguj się przez Apple” na ekranie logowania, „Kontynuuj z Apple” w pozostałych miejscach. */
  mode?: 'signIn' | 'continue';
  /** Linia z „albo” nad przyciskiem – pod formularzem e-mail + hasło. */
  divider?: boolean;
};

/**
 * Systemowy przycisk Apple (wygląd i tekst narzuca Apple, tłumaczy go system) z informacją o zgodach.
 * Renderuj tylko, gdy `appleSignInAvailable` (iOS).
 * Po sukcesie nawigator sam przełącza na aplikację albo ankietę (zmiana sesji).
 */
export function AppleSignIn({ mode = 'continue', divider = false }: AppleSignInProps) {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const dark = useColorScheme() === 'dark';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await signInWithApple(locale);
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  const openLegal = (doc: 'terms' | 'privacy') => WebBrowser.openBrowserAsync(legalUrl(doc, locale));

  return (
    <View style={styles.box}>
      {divider ? (
        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: c.border }]} />
          <Text variant="caption">{t('appleSignIn.or')}</Text>
          <View style={[styles.line, { backgroundColor: c.border }]} />
        </View>
      ) : null}

      <View pointerEvents={busy ? 'none' : 'auto'} style={busy && styles.busy}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            mode === 'signIn'
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
          }
          buttonStyle={
            dark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius.button}
          style={styles.button}
          onPress={onPress}
        />
      </View>

      {error ? <Notice message={t(error)} /> : null}

      <Text variant="caption" align="center">
        {t('appleSignIn.legalPrefix')}
        <Text
          variant="caption"
          color="textBrand"
          weight="semibold"
          accessibilityRole="link"
          onPress={() => openLegal('terms')}>
          {t('appleSignIn.termsLink')}
        </Text>
        {t('appleSignIn.legalJoin')}
        <Text
          variant="caption"
          color="textBrand"
          weight="semibold"
          accessibilityRole="link"
          onPress={() => openLegal('privacy')}>
          {t('appleSignIn.privacyLink')}
        </Text>
        {t('appleSignIn.legalSuffix')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[3] },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  // Ta sama wysokość co przyciski aplikacji (Button: minHeight 52).
  button: { width: '100%', height: 52 },
  busy: { opacity: 0.5 },
});
