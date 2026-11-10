import type { WeatherCondition } from '@aloha/plan-engine';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  WarningCircle,
  type IconProps,
} from 'phosphor-react-native';
import { useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radius, space } from '@/constants/theme';
import type { PlanSession } from '@/features/plan/api';
import type { SessionForecast } from '@/features/weather/api';
import { useSessionForecast, useWeather } from '@/features/weather/weather-provider';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';

const DAY_ICON: Record<WeatherCondition, ComponentType<IconProps>> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudRain,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};
const NIGHT_ICON: Partial<Record<WeatherCondition, ComponentType<IconProps>>> = { clear: Moon, partly: CloudMoon };

/** Porada, gdy AI jej nie napisało: zdanie o porze + wskazówka do najważniejszego ostrzeżenia. */
function useFallbackAdvice(f: SessionForecast, race: boolean) {
  const t = useT();
  const flag = f.flags[0];
  const tip = flag ? t(`weather.tip.${flag}`) : null;
  // Zawody mają swoją godzinę – bez AI zostaje sama wskazówka do ostrzeżenia (albo nic).
  if (race) return tip;
  const main = f.allDay && f.quality === 'good' ? t('weather.fallback.allDay') : t(`weather.fallback.${f.quality}`, f.window);
  return tip ? `${main} ${tip}` : main;
}

/**
 * Pogoda do treningu: warunki w najlepszym oknie, pora, parę słów od trenera i pory do unikania.
 * Nic nie renderuje, gdy pogody nie ma (brak zgody na lokalizację, sieci albo prognozy na ten dzień).
 */
export function WeatherCard({ session, credit = false }: { session: PlanSession; credit?: boolean }) {
  const forecast = useSessionForecast(session.id);
  return forecast ? <WeatherCardView forecast={forecast} race={session.type === 'race'} credit={credit} /> : null;
}

type WeatherCardViewProps = {
  forecast: SessionForecast;
  /** Zawody mają swoją godzinę startu – nie podpowiadamy pory. */
  race?: boolean;
  /** Podpis źródła danych (wymóg licencji) – tam, gdzie karta stoi sama. */
  credit?: boolean;
};

/** Sama karta – bez danych z serwera (używa jej też podgląd deweloperski). */
export function WeatherCardView({ forecast: f, race = false, credit = false }: WeatherCardViewProps) {
  const c = useColors();
  const t = useT();
  const fallback = useFallbackAdvice(f, race);
  const advice = f.advice ?? fallback;

  const Icon = (f.isDay ? undefined : NIGHT_ICON[f.condition]) ?? DAY_ICON[f.condition];
  const headline = race
    ? t('weather.raceDay')
    : f.quality === 'poor'
      ? t('weather.leastBad', f.window)
      : f.allDay
        ? t('weather.anytime')
        : t('weather.best', f.window);
  const facts = [
    `${t('weather.temp', { n: f.tempC })} ${t(`weather.condition.${f.condition}`).toLowerCase()}`,
    Math.abs(f.feelsC - f.tempC) >= 2 ? t('weather.feels', { n: f.feelsC }) : null,
    f.precipProb !== null && f.precipProb >= 10 ? t('weather.precip', { n: f.precipProb }) : null,
    f.windKmh >= 10 ? t('weather.wind', { n: f.windKmh }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.row} accessible accessibilityLabel={`${headline}, ${facts}`}>
        <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
          <Icon size={22} weight="bold" color={c.textBrand} />
        </View>
        <View style={styles.flex}>
          <Text weight="bold">{headline}</Text>
          <Text variant="caption">{facts}</Text>
        </View>
      </View>

      {advice ? <Text>{advice}</Text> : null}

      {f.avoid.map((a) => (
        <View key={`${a.reason}-${a.from}`} style={[styles.avoid, { backgroundColor: c.surfaceAccentSoft }]}>
          <WarningCircle size={18} weight="bold" color={c.textAccentStrong} />
          <Text variant="caption" weight="medium" color="textAccentStrong" style={styles.flex}>
            {t('weather.avoid', { from: a.from, to: a.to, reason: t(`weather.reason.${a.reason}`) })}
          </Text>
        </View>
      ))}

      {credit ? <Text variant="caption">{t('weather.credit')}</Text> : null}
    </View>
  );
}

/** Zachęta do włączenia pogody – tylko dopóki system jeszcze nie pytał o lokalizację. */
export function WeatherPrompt() {
  const c = useColors();
  const t = useT();
  const { access, enable } = useWeather();
  const [asking, setAsking] = useState(false);
  if (access !== 'undetermined') return null;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
          <CloudSun size={22} weight="bold" color={c.textBrand} />
        </View>
        <View style={styles.flex}>
          <Text weight="bold">{t('weather.enableTitle')}</Text>
          <Text variant="caption">{t('weather.enableBody')}</Text>
        </View>
      </View>
      <Button
        variant="secondary"
        label={t('weather.enableCta')}
        loading={asking}
        onPress={async () => {
          setAsking(true);
          await enable();
          setAsking(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avoid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.button,
  },
});
