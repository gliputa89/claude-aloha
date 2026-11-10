import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeatherCardView } from '@/components/plan/weather-card';
import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import type { SessionForecast } from '@/features/weather/api';
import { useColors } from '@/hooks/use-colors';

/**
 * Podgląd karty pogody bez serwera, lokalizacji i AI – tylko w development buildzie.
 * Otwórz: aloha://dev/weather (albo `npx uri-scheme open aloha://dev/weather --ios`).
 * Etykiety scenariuszy są narzędziem deweloperskim, więc nie idą do słowników.
 */
const base: SessionForecast = {
  sessionId: 'dev',
  date: '2026-11-12',
  window: { from: '11:00', to: '14:00' },
  allDay: false,
  quality: 'good',
  tempC: 6,
  feelsC: 3,
  precipProb: 10,
  windKmh: 9,
  condition: 'partly',
  isDay: true,
  pm25: 18,
  flags: [],
  avoid: [],
  advice: null,
};

const SCENARIOS: { label: string; race?: boolean; forecast: SessionForecast }[] = [
  {
    label: 'Porada od AI, smog wieczorem',
    forecast: {
      ...base,
      advice: 'Wyjdź koło południa – jest najcieplej i powietrze najczystsze. Wieczorem smog, więc lepiej nie zostawiaj biegu na po pracy.',
      avoid: [{ from: '18:00', to: '22:00', reason: 'smog' }],
    },
  },
  { label: 'Bez AI, cały dzień dobry', forecast: { ...base, allDay: true, window: { from: '06:00', to: '22:00' }, condition: 'clear' } },
  {
    label: 'Bez AI, wieczór po zmroku z deszczem',
    forecast: {
      ...base,
      quality: 'ok',
      window: { from: '18:00', to: '20:00' },
      condition: 'rain',
      isDay: false,
      precipProb: 70,
      windKmh: 24,
      flags: ['rain', 'dark'],
    },
  },
  {
    label: 'Upał, dwie pory do unikania',
    forecast: {
      ...base,
      date: '2026-07-10',
      quality: 'ok',
      window: { from: '06:00', to: '08:00' },
      tempC: 22,
      feelsC: 24,
      precipProb: 0,
      condition: 'clear',
      flags: ['uv'],
      avoid: [
        { from: '16:00', to: '18:00', reason: 'storm' },
        { from: '11:00', to: '16:00', reason: 'heat' },
      ],
      advice: 'Wstań wcześniej – między 6 a 8 jest jeszcze rześko. Od 11 robi się gorąco, a po południu idzie burza.',
    },
  },
  {
    label: 'Kiepsko: burza, bez AI',
    forecast: { ...base, quality: 'poor', window: { from: '15:00', to: '16:00' }, condition: 'storm', precipProb: 95, windKmh: 38, flags: ['storm', 'wind', 'rain'] },
  },
  { label: 'Zawody, noc bezchmurna', race: true, forecast: { ...base, condition: 'clear', isDay: false, flags: ['dark'] } },
];

export default function WeatherPreview() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[8] }]}>
      {SCENARIOS.map((s, i) => (
        <View key={s.label} style={styles.item}>
          <Text variant="label" color="textMuted">
            {s.label}
          </Text>
          <WeatherCardView forecast={s.forecast} race={s.race} credit={i === 0} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[5], gap: space[5] },
  item: { gap: space[2] },
});
