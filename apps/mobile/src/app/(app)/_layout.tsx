import { Stack } from 'expo-router';

import { useColors } from '@/hooks/use-colors';

export default function AppLayout() {
  const c = useColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }} />;
}
