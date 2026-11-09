import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Element nad tytułem (np. awatar). */
  above?: ReactNode;
  /** Pociągnięcie w dół odświeża dane. */
  onRefresh?: () => Promise<void>;
}>;

/** Przewijany ekran zakładki: nagłówek w stylu iOS (duży tytuł) i treść z marginesem 20. */
export function Screen({ title, subtitle, above, onRefresh, children }: ScreenProps) {
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={c.action}
              onRefresh={async () => {
                setRefreshing(true);
                await onRefresh();
                setRefreshing(false);
              }}
            />
          ) : undefined
        }>
        <View style={styles.header}>
          {above}
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[6], paddingBottom: space[8], gap: space[6] },
  header: { gap: space[2] },
});
