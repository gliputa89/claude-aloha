import { Redirect } from 'expo-router';

import { useAuth, useOnboarded } from '@/providers/auth-provider';

/** Wejście do aplikacji: bez sesji → ekran startowy, bez ankiety → ankieta, w pozostałych → ekran główny. */
export default function Index() {
  const { session } = useAuth();
  const onboarded = useOnboarded();
  if (!session) return <Redirect href="/welcome" />;
  return <Redirect href={onboarded ? '/home' : '/goal'} />;
}
