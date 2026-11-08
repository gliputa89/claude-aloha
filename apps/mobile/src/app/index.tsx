import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

/** Wejście do aplikacji: z sesją → ekran główny, bez sesji → ekran startowy. */
export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/home' : '/welcome'} />;
}
