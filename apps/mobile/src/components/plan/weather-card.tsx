import type { WeatherCondition } from '@aloha/plan-engine';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Drop,
  MapPin,
  Moon,
  Sun,
  Thermometer,
  WarningCircle,
  Wind,
  type IconProps,
} from 'phosphor-react-native';
import { router } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { font, radius, space } from '@/constants/theme';
import type { PlanSession } from '@/features/plan/api';
import type { SessionForecast } from '@/features/weather/api';
import { useSessionForecast, useSessionPlace, useWeather } from '@/features/weather/weather-provider';
import { useColors } from '@/hooks/use-colors';
import { useT } from '@/hooks/use-t';
import { useUnitFormat } from '@/lib/units';
import { useWeatherVisible } from '@/lib/weather-preference';

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
 * Dopóki pierwsze wczytanie trwa – spokojny zarys karty, żeby treść pod spodem nie przeskakiwała.
 */
export function WeatherCard({ session, credit = false }: { session: PlanSession; credit?: boolean }) {
  const forecast = useSessionForecast(session.id);
  const place = useSessionPlace(session.id);
  const { settled } = useWeather();
  // Pogoda ukryta w Profilu – ani karty, ani jej zarysu.
  const visible = useWeatherVisible();
  if (!visible) return null;
  if (!forecast) return settled ? null : <WeatherCardSkeleton />;
  return (
    <WeatherCardView
      forecast={forecast}
      race={session.type === 'race'}
      credit={credit}
      place={place?.name ?? null}
      onChangePlace={() => router.push({ pathname: '/weather-location', params: { sessionId: session.id } })}
    />
  );
}

/** Zarys karty pogody na czas wczytywania – układ jak w gotowej karcie. */
function WeatherCardSkeleton() {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} accessible={false}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]} />
        <View style={[styles.flex, styles.skeletonLines]}>
          <Skeleton width="70%" height={space[4]} />
          <Skeleton width="40%" />
        </View>
      </View>
      <Skeleton width="55%" />
      <View style={styles.skeletonLines}>
        <Skeleton />
        <Skeleton width="80%" />
      </View>
    </View>
  );
}

type WeatherCardViewProps = {
  forecast: SessionForecast;
  /** Zawody mają swoją godzinę startu – nie podpowiadamy pory. */
  race?: boolean;
  /** Podpis źródła danych (wymóg licencji) – tam, gdzie karta stoi sama. */
  credit?: boolean;
  /** Nazwa miejsca prognozy (null – „Twoja okolica”). */
  place?: string | null;
  /** Otwiera wybór miejsca dla tego treningu; bez tego wiersz miejsca się nie pokazuje. */
  onChangePlace?: () => void;
};

/** Sama karta – bez danych z serwera (używa jej też podgląd deweloperski). */
export function WeatherCardView({ forecast: f, race = false, credit = false, place = null, onChangePlace }: WeatherCardViewProps) {
  const c = useColors();
  const t = useT();
  const u = useUnitFormat();
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
  const condition = t(`weather.condition.${f.condition}`);
  const feels = Math.abs(f.feelsC - f.tempC) >= 2 ? t('weather.feels', { n: u.temp(f.feelsC) }) : null;
  const wind = { n: u.speed(f.windKmh), unit: u.speedUnit };
  const metrics = [
    {
      Icon: Thermometer,
      value: [t('weather.temp', { n: u.temp(f.tempC) }), feels].filter(Boolean).join(' · '),
      label: [t('weather.a11yTemp', { n: u.temp(f.tempC) }), feels].filter(Boolean).join(', '),
    },
    f.precipProb !== null
      ? { Icon: Drop, value: t('weather.percent', { n: f.precipProb }), label: t('weather.a11yPrecip', { n: f.precipProb }) }
      : null,
    { Icon: Wind, value: t('weather.speed', wind), label: t('weather.a11yWind', wind) },
  ].filter((m) => m !== null);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.row} accessible accessibilityLabel={`${headline}, ${condition}`}>
        <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
          <Icon size={22} weight="bold" color={c.textBrand} />
        </View>
        <View style={styles.flex}>
          <Text weight="bold" style={styles.headline}>
            {headline}
          </Text>
          <Text variant="caption">{condition}</Text>
        </View>
      </View>

      {/* Temperatura, szansa opadów i wiatr w najlepszym oknie – każda wartość z ikoną. */}
      <View style={styles.metrics}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metric} accessible accessibilityLabel={m.label}>
            <m.Icon size={16} weight="bold" color={c.textMuted} />
            <Text variant="label">{m.value}</Text>
          </View>
        ))}
      </View>

      {/* Karta jest dodatkiem do treningu – tekst o stopień mniejszy niż w karcie treningu. */}
      {advice ? (
        <Text variant="caption" color="text">
          {advice}
        </Text>
      ) : null}

      {f.avoid.map((a) => (
        <View key={`${a.reason}-${a.from}`} style={[styles.avoid, { backgroundColor: c.surfaceAccentSoft }]}>
          <WarningCircle size={18} weight="bold" color={c.textAccentStrong} />
          <Text variant="caption" weight="medium" color="textAccentStrong" style={styles.flex}>
            {t('weather.avoid', { from: a.from, to: a.to, reason: t(`weather.reason.${a.reason}`) })}
          </Text>
        </View>
      ))}

      {/* Dla jakiego miejsca jest prognoza – każdy trening może mieć własne (wyjazd, zawody). */}
      {onChangePlace ? (
        <Pressable
          onPress={onChangePlace}
          accessibilityRole="button"
          accessibilityLabel={t('weather.location.a11y', { name: place ?? t('weather.location.here') })}
          style={({ pressed }) => [styles.location, { borderTopColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
          <MapPin size={16} weight="bold" color={c.textMuted} />
          <Text variant="label" color="textMuted" numberOfLines={1} style={styles.flex}>
            {place ?? t('weather.location.here')}
          </Text>
          <Text variant="label" color="textBrand">
            {t('weather.location.change')}
          </Text>
        </Pressable>
      ) : null}

      {credit ? (
        <Text variant="caption" style={styles.small}>
          {t('weather.credit')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Zachęta do włączenia pogody, dopóki nie znamy miejsca: system jeszcze nie pytał o lokalizację
 * (zgoda albo wpisanie miejscowości) albo zgody nie ma (zostaje wpisanie miejscowości).
 */
export function WeatherPrompt() {
  const c = useColors();
  const t = useT();
  const { access, place, enable } = useWeather();
  const [asking, setAsking] = useState(false);
  const visible = useWeatherVisible();
  if (!visible || place || access === null || access === 'granted') return null;
  const canAsk = access === 'undetermined';

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: c.surfaceBrandSoft }]}>
          <CloudSun size={22} weight="bold" color={c.textBrand} />
        </View>
        <View style={styles.flex}>
          <Text weight="bold">{t('weather.enableTitle')}</Text>
          <Text variant="caption">{t(canAsk ? 'weather.enableBody' : 'weather.deniedBody')}</Text>
        </View>
      </View>
      {canAsk ? (
        <Button
          variant="secondary"
          label={t('weather.enableCta')}
          loading={asking}
          onPress={async () => {
            setAsking(true);
            const answer = await enable();
            setAsking(false);
            // Bez zgody na lokalizację pogoda i tak może działać – od razu pytamy o miejscowość.
            if (answer !== 'granted') router.push('/weather-location');
          }}
        />
      ) : null}
      <Button
        variant={canAsk ? 'plain' : 'secondary'}
        label={t('weather.enableManual')}
        onPress={() => router.push('/weather-location')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skeletonLines: { gap: space[2] },
  headline: { fontSize: font.size.md, lineHeight: 21 },
  small: { fontSize: font.size.xs, lineHeight: 17 },
  card: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[5], rowGap: space[2] },
  metric: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 44,
    marginBottom: -space[2],
    paddingTop: space[1],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  avoid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.button,
  },
});
