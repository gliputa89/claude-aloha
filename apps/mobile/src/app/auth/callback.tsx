import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';
import { exchangeCode } from '@/lib/auth';

/**
 * Cel linków z e-maili (aloha://auth/callback?code=…): potwierdzenie konta i reset hasła.
 * Wymienia kod PKCE na sesję i przekierowuje dalej.
 */
export default function AuthCallbackScreen() {
  const t = useT();
  const c = useColors();
  const { code, next, error_description } = useLocalSearchParams<{
    code?: string;
    next?: string;
    error_description?: string;
  }>();
  const invalidLink = !code || !!error_description;
  const [exchangeFailed, setExchangeFailed] = useState(false);
  const failed = invalidLink || exchangeFailed;
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !code || invalidLink) return;
    handled.current = true;

    exchangeCode(code).then((result) => {
      if (!result.ok) {
        setExchangeFailed(true);
        return;
      }
      router.replace(next === 'reset-password' ? '/auth/reset-password' : '/');
    });
  }, [code, next, invalidLink]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={styles.center}>
        {failed ? (
          <>
            <Text align="center">{t('authCallback.failed')}</Text>
            <Button label={t('authCallback.toSignIn')} onPress={() => router.replace('/sign-in')} />
          </>
        ) : (
          <>
            <ActivityIndicator color={c.action} size="large" />
            <Text align="center" color="textMuted">
              {t('authCallback.loading')}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: space[5], gap: space[6] },
});
