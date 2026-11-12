import type { TranslationKey } from '@aloha/i18n';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GoogleLogo } from '@/components/auth/google-logo';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import {
  appleSignInAvailable,
  googleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  socialSignInAvailable,
  type AuthResult,
} from '@/lib/auth';
import { legalUrl } from '@/lib/links';

type Provider = 'apple' | 'google';

type SocialSignInProps = {
  /** „Zaloguj się przez…” na ekranie logowania, „Kontynuuj z…” w pozostałych miejscach. */
  mode?: 'signIn' | 'continue';
  /** Linia z „albo” nad przyciskami – pod formularzem e-mail + hasło. */
  divider?: boolean;
};

/**
 * Przyciski logowania kontem zewnętrznym z jedną informacją o zgodach pod spodem.
 * Apple: systemowy przycisk (wygląd i tekst narzuca Apple, tłumaczy go system), tylko iOS.
 * Google: przycisk aplikacji z logo „G”, iOS i Android, gdy ustawione są client ID.
 * Bez żadnego dostawcy nic nie renderuje. Po sukcesie nawigator sam przełącza na aplikację albo ankietę.
 */
export function SocialSignIn({ mode = 'continue', divider = false }: SocialSignInProps) {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const dark = useColorScheme() === 'dark';
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);

  if (!socialSignInAvailable) return null;

  const start = async (provider: Provider, signInWith: typeof signInWithApple) => {
    if (busy) return;
    setBusy(provider);
    setError(null);
    const result: AuthResult<{ canceled: boolean }> = await signInWith(locale);
    setBusy(null);
    if (!result.ok) setError(result.error);
  };

  const openLegal = (doc: 'terms' | 'privacy') => WebBrowser.openBrowserAsync(legalUrl(doc, locale));

  const providers =
    appleSignInAvailable && googleSignInAvailable
      ? t('socialSignIn.appleOrGoogle')
      : appleSignInAvailable
        ? 'Apple'
        : 'Google';

  return (
    <View style={styles.box}>
      {divider ? (
        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: c.border }]} />
          <Text variant="caption">{t('socialSignIn.or')}</Text>
          <View style={[styles.line, { backgroundColor: c.border }]} />
        </View>
      ) : null}

      {appleSignInAvailable ? (
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
            style={styles.appleButton}
            onPress={() => start('apple', signInWithApple)}
          />
        </View>
      ) : null}

      {googleSignInAvailable ? (
        <Button
          variant="secondary"
          icon={<GoogleLogo size={20} />}
          label={t(mode === 'signIn' ? 'socialSignIn.googleSignIn' : 'socialSignIn.googleContinue')}
          loading={busy === 'google'}
          disabled={busy === 'apple'}
          onPress={() => start('google', signInWithGoogle)}
        />
      ) : null}

      {error ? <Notice message={t(error)} /> : null}

      <Text variant="caption" align="center">
        {t('socialSignIn.legalPrefix', { providers })}
        <Text
          variant="caption"
          color="textBrand"
          weight="semibold"
          accessibilityRole="link"
          onPress={() => openLegal('terms')}>
          {t('socialSignIn.termsLink')}
        </Text>
        {t('socialSignIn.legalJoin')}
        <Text
          variant="caption"
          color="textBrand"
          weight="semibold"
          accessibilityRole="link"
          onPress={() => openLegal('privacy')}>
          {t('socialSignIn.privacyLink')}
        </Text>
        {t('socialSignIn.legalSuffix')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[3] },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  // Ta sama wysokość co przyciski aplikacji (Button: minHeight 52).
  appleButton: { width: '100%', height: 52 },
  busy: { opacity: 0.5 },
});
