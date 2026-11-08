import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mark } from '@/components/brand/mark';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

/** Tymczasowy ekran po zalogowaniu – miejsce na onboarding i „Dzisiaj”. Imię czyta z public.profiles (RLS). */
export default function HomeScreen() {
  const t = useT();
  const c = useColors();
  const { session } = useAuth();
  const metaName = session?.user.user_metadata?.display_name as string | undefined;
  const [name, setName] = useState<string | undefined>(metaName);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setName(data.display_name);
      });
  }, [session]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: c.surfaceBrand }]}>
          <Mark size={44} wave="textOnBrand" />
        </View>
        <Text variant="title" accessibilityRole="header">
          {name ? t('home.greeting', { name }) : t('home.greetingNoName')}
        </Text>
        <Text color="textMuted">{t('home.body')}</Text>
      </View>
      <View style={styles.footer}>
        <Button
          variant="secondary"
          label={t('home.signOut')}
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await signOut();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: space[5], gap: space[3] },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  footer: { paddingHorizontal: space[5], paddingBottom: space[4] },
});
