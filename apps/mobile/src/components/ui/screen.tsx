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
  /** Element po prawej stronie tytułu (np. przycisk „Dodaj”). */
  trailing?: ReactNode;
  /** Pociągnięcie w dół odświeża dane. */
  onRefresh?: () => Promise<void>;
}>;

/** Przewijany ekran zakładki: nagłówek w stylu iOS (duży tytuł) i treść z marginesem 20. */
export function Screen({ title, subtitle, leading, trailing, onRefresh, children }: ScreenProps) {
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
        <View style={[styles.header, leading || trailing ? styles.row : null]}>
          {leading}
          {/* Obok awatara tytuł i data stoją ciasno – jeden blok, dzięki czemu treść zaczyna się wyżej. */}
          <View style={[styles.titles, leading || trailing ? styles.titlesTight : null]}>
            {/* Obok awatara tytuł ma mniej miejsca – za długi kończy się wielokropkiem. Nie zmniejszamy kroju:
                na iOS `minimumFontScale` nie działa i długie imię spadało do nieczytelnych ~9 pt. */}
            <Text variant="title" accessibilityRole="header" numberOfLines={leading ? 1 : undefined}>
              {title}
            </Text>
            {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
          </View>
          {trailing}
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
  titlesTight: { flex: 1, gap: 0 },
});
