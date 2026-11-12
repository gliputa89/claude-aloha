import { Tabs } from 'expo-router/js-tabs';
import { CalendarBlank, Sun, Target, UserCircle } from 'phosphor-react-native';

import { fontFamily } from '@/components/ui/text';
import { font } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

/** Zakładki po zalogowaniu: Dzisiaj · Plan · Cele · Profil. */
export default function TabsLayout() {
  const c = useColors();
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
        tabBarActiveTintColor: c.action,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: font.size.xs },
        animation: 'shift',
      }}>
      <Tabs.Screen
        name="today"
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ color, size }) => <Sun size={size} weight="bold" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: t('tabs.plan'),
          tabBarIcon: ({ color, size }) => <CalendarBlank size={size} weight="bold" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: t('tabs.goals'),
          tabBarIcon: ({ color, size }) => <Target size={size} weight="bold" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <UserCircle size={size} weight="bold" color={color as string} />,
        }}
      />
    </Tabs>
  );
}
