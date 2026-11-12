import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { CalendarBlank } from 'phosphor-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useLocale } from '@/hooks/use-t';

type DateFieldProps = {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Opis dla czytnika ekranu (np. „Data startu planu”). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wybór daty.
 * iOS: natywny „compact” (pigułka z datą, kalendarz w dymku).
 * Android: systemowe okno Material jest widoczne tak długo, jak komponent jest zamontowany – dlatego
 * pokazujemy przycisk z datą, a okno montujemy tylko na czas wyboru i zdejmujemy po „OK” albo „Anuluj”.
 */
export function DateField({ value, onChange, minimumDate, maximumDate, accessibilityLabel, style }: DateFieldProps) {
  const c = useColors();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  if (Platform.OS !== 'android') {
    return (
      <DateTimePicker
        value={value}
        mode="date"
        display="compact"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        accentColor={c.action}
        onValueChange={(_e, date) => onChange(date)}
        style={[styles.ios, style]}
      />
    );
  }

  const label = value.toLocaleDateString(locale === 'en' ? 'en-US' : 'pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ? `${accessibilityLabel}: ${label}` : label}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: c.surface, borderColor: c.border, transform: [{ scale: pressed ? 0.97 : 1 }] },
          style,
        ]}>
        <CalendarBlank size={20} weight="bold" color={c.action} />
        <Text variant="label">{label}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode="date"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={c.action}
          onValueChange={(_e, date) => {
            setOpen(false);
            onChange(date);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  ios: { alignSelf: 'flex-start' },
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
