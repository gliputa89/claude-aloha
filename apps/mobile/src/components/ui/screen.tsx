import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Element obok tytułu, po lewej (np. awatar) – tytuł i podtytuł stoją wtedy w jednym wierszu z nim. */
  leading?: ReactNode;
  /** Pociągnięcie w dół odświeża dane. */
  onRefresh?: () => Promise<void>;
}>;

/** Przewijany ekran zakładki: nagłówek w stylu iOS (duży tytuł) i treść z marginesem 20. */
export function Screen({ title, subtitle, leading, onRefresh, children }: ScreenProps) {
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
        <View style={[styles.header, leading ? styles.row : null]}>
          {leading}
          <View style={[styles.titles, leading ? styles.flex : null]}>
            {/* Obok awatara tytuł ma mniej miejsca – długie imię zmniejsza krój zamiast łamać wiersz. */}
            <Text variant="title" accessibilityRole="header" numberOfLines={leading ? 1 : undefined} adjustsFontSizeToFit={!!leading} minimumFontScale={0.7}>
              {title}
            </Text>
            {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
          </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  titles: { gap: space[1] },
});
