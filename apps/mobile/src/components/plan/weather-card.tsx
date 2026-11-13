import type { DayHour, WeatherCondition, WeatherFlag } from '@aloha/plan-engine';
import {
  CaretDown,
  CaretUp,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Factory,
  MapPin,
  Moon,
  Snowflake,
  Sun,
  ThermometerHot,
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


type WeatherStripViewProps = {
  forecast: SessionForecast;
  /** Zawody mają swoją godzinę startu – nie podpowiadamy pory. */
  race?: boolean;
  /** Nazwa miejsca prognozy (null – „Twoja okolica”). */
  place?: string | null;
  /** Otwiera wybór miejsca dla tego treningu; bez tego wiersz miejsca się nie pokazuje. */
  onChangePlace?: () => void;
  /**
   * Pogoda stojąca sama (szczegóły treningu): własna karta, od razu rozwinięta i bez chowania –
   * tu jest na nią miejsce, a biegacz przyszedł po szczegóły.
   */
  standalone?: boolean;
  /** Podpis źródła danych (wymóg licencji) – tam, gdzie karta stoi sama. */
  credit?: boolean;
};

const FLAG_ICON: Record<WeatherFlag, ComponentType<IconProps>> = {
  storm: CloudLightning,
  ice: Snowflake,
  heat: ThermometerHot,
  frost: Snowflake,
  smog: Factory,
  wind: Wind,
  rain: CloudRain,
  uv: Sun,
  dark: Moon,
};
/** Na zwiniętej karcie ostrzegamy tylko o tym, co naprawdę zmienia bieg (zmrok i słońce zostają w rozwinięciu). */
const SERIOUS: readonly WeatherFlag[] = ['storm', 'ice', 'heat', 'frost', 'smog', 'wind'];

const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2));

/** Co co dwie godziny, od pierwszej dostępnej – tyle mieści się w jednym rzędzie. */
function dayColumns(day: DayHour[]) {
  const first = day[0]?.hour ?? 0;
  return day.filter((h) => (h.hour - first) % 2 === 0).slice(0, 8);
}

/**
 * Pogoda do treningu: nagłówek „Pogoda”, najlepsza pora z liczbami i – gdy trzeba – jedna linijka ostrzeżenia.
 * „Cały dzień” rozwija godziny, poradę, pozostałe ostrzeżenia i miejsce prognozy.
 * W karcie treningu („Dzisiaj”) jest paskiem na dole karty; z `standalone` – własną kartą, od razu rozwiniętą.
 * Nic nie renderuje, gdy pogody nie ma (brak zgody na lokalizację, sieci albo prognozy na ten dzień).
 */
export function WeatherStrip({
  session,
  standalone = false,
  credit = false,
}: {
  session: PlanSession;
  standalone?: boolean;
  credit?: boolean;
}) {
  const forecast = useSessionForecast(session.id);
  const place = useSessionPlace(session.id);
  const { settled } = useWeather();
  const visible = useWeatherVisible();
  if (!visible) return null;
  if (!forecast) return settled ? null : <WeatherStripSkeleton standalone={standalone} />;
  return (
    <WeatherStripView
      forecast={forecast}
      race={session.type === 'race'}
      standalone={standalone}
      credit={credit}
      place={place?.name ?? null}
      onChangePlace={() => router.push({ pathname: '/weather-location', params: { sessionId: session.id } })}
    />
  );
}

function WeatherStripSkeleton({ standalone = false }: { standalone?: boolean }) {
  const c = useColors();
  return (
    <View
      style={standalone ? [styles.card, { backgroundColor: c.surface, borderColor: c.border }] : [styles.strip, { borderTopColor: c.border }]}
      accessible={false}>
      <Skeleton width="25%" />
      <Skeleton width="70%" />
      {standalone ? <Skeleton width="90%" height={space[8]} /> : null}
    </View>
  );
}

export function WeatherStripView({
  forecast: f,
  race = false,
  place = null,
  onChangePlace,
  standalone = false,
  credit = false,
}: WeatherStripViewProps) {
  const c = useColors();
  const t = useT();
  const u = useUnitFormat();
  // Sama karta jest od razu rozwinięta i nie da się jej zwinąć – chowanie ma sens tylko w karcie treningu.
  const [expanded, setExpanded] = useState(false);
  const open = standalone || expanded;
  const fallback = useFallbackAdvice(f, race);
  const advice = f.advice ?? fallback;
  const time = `${f.window.from}–${f.window.to}`;
  const hasDay = (f.day?.length ?? 0) > 0;

  const flag = f.flags.find((x) => SERIOUS.includes(x));
  const shown = flag ? null : f.avoid[0];
  const alert = flag
    ? { Icon: FLAG_ICON[flag], text: t(`weather.tip.${flag}`) }
    : shown
      ? { Icon: FLAG_ICON[shown.reason], text: t('weather.avoid', { from: shown.from, to: shown.to, reason: t(`weather.reason.${shown.reason}`) }) }
      : null;
  const moreAvoid = f.avoid.filter((a) => a !== shown);

  const wind = { n: u.speed(f.windKmh), unit: u.speedUnit };
  const label = race ? t('weather.raceDay') : f.allDay ? t('weather.anytime') : t(f.quality === 'poor' ? 'weather.leastBadLabel' : 'weather.bestLabel');
  const showTime = !race && !f.allDay;
  const summary = [
    t('weather.a11yTemp', { n: u.temp(f.tempC) }),
    f.precipProb !== null ? t('weather.a11yPrecip', { n: f.precipProb }) : null,
    t('weather.a11yWind', wind),
  ]
    .filter(Boolean)
    .join(', ');

  // Sama karta ma miejsce na warunki i odczuwalną – w pasku na karcie treningu byłyby zbędnym szumem.
  const condition = t(`weather.condition.${f.condition}`);
  const feels = Math.abs(f.feelsC - f.tempC) >= 2 ? t('weather.feels', { n: u.temp(f.feelsC) }) : null;
  const temp = [t('weather.temp', { n: u.temp(f.tempC) }), standalone ? feels : null].filter(Boolean).join(' · ');

  const columns = open ? dayColumns(f.day ?? []) : [];
  const from = hourOf(f.window.from);
  const to = hourOf(f.window.to);

  return (
    <View
      style={standalone ? [styles.card, { backgroundColor: c.surface, borderColor: c.border }] : [styles.strip, { borderTopColor: c.border }]}>
      <View style={styles.stripHead}>
        <Text variant="caption" weight="semibold">
          {t('weather.title')}
        </Text>
        {standalone ? (
          <Text variant="caption">{condition}</Text>
        ) : hasDay ? (
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 8 }}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={t(open ? 'weather.allDayA11yHide' : 'weather.allDayA11yShow')}
            style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.6 : 1 }]}>
            <Text variant="label" color="textBrand">
              {t(open ? 'weather.allDayHide' : 'weather.allDayShow')}
            </Text>
            {open ? <CaretUp size={14} weight="bold" color={c.textBrand} /> : <CaretDown size={14} weight="bold" color={c.textBrand} />}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.stripMain} accessible accessibilityLabel={`${label}${showTime ? ` ${time}` : ''}, ${summary}`}>
        <Text variant={standalone ? 'body' : 'caption'} color="text" style={standalone ? styles.stripBestBlock : styles.stripBest}>
          {label}
          {showTime ? (
            <Text variant={standalone ? 'body' : 'caption'} weight="semibold" color="textBrand">
              {` ${time}`}
            </Text>
          ) : null}
        </Text>
        <Text variant="caption">{temp}</Text>
        {f.precipProb !== null ? <Text variant="caption">{t('weather.percent', { n: f.precipProb })}</Text> : null}
        <Text variant="caption">{t('weather.speed', wind)}</Text>
      </View>

      {alert ? (
        <View style={[styles.avoid, { backgroundColor: c.surfaceAccentSoft }]}>
          <alert.Icon size={16} weight="bold" color={c.textAccentStrong} />
          <Text variant="caption" weight="medium" color="textAccentStrong" style={styles.flex}>
            {alert.text}
          </Text>
        </View>
      ) : null}

      {open ? (
        <View style={styles.stripOpen}>
          {columns.length > 0 ? (
            <View style={styles.hours}>
              {columns.map((h) => {
                const next = f.day?.find((x) => x.hour === h.hour + 1);
                const best = !f.allDay && !race && h.hour < to && h.hour + 2 > from;
                const severe = !best && (h.severe !== null || (next?.severe ?? null) !== null);
                const Icon = (h.isDay ? undefined : NIGHT_ICON[h.condition]) ?? DAY_ICON[h.condition];
                const bg = best ? c.surfaceBrand : severe ? c.surfaceAccentSoft : 'transparent';
                const main = best ? 'textOnBrand' : severe ? 'textAccentStrong' : 'text';
                const dim = best ? 'textOnBrand' : severe ? 'textAccentStrong' : 'textMuted';
                const iconColor = c[main];
                return (
                  <View
                    key={h.hour}
                    style={[styles.hour, { backgroundColor: bg }]}
                    accessible
                    accessibilityLabel={`${best ? `${t('weather.bestHour')}, ` : ''}${
                      h.precipProb !== null
                        ? t('weather.hourA11y', { hour: h.hour, temp: u.temp(h.tempC), n: h.precipProb })
                        : t('weather.hourA11yNoRain', { hour: h.hour, temp: u.temp(h.tempC) })
                    }`}>
                    <Text variant="caption" color={dim} style={styles.small}>
                      {h.hour}
                    </Text>
                    <Icon size={18} weight="bold" color={iconColor} />
                    <Text variant="label" color={main}>
                      {t('weather.temp', { n: u.temp(h.tempC) })}
                    </Text>
                    <Text variant="caption" color={dim} style={styles.small}>
                      {h.precipProb !== null ? t('weather.percent', { n: h.precipProb }) : ' '}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {advice ? (
            <Text variant="caption" color="text">
              {advice}
            </Text>
          ) : null}

          {moreAvoid.map((a) => (
            <View key={`${a.reason}-${a.from}`} style={[styles.avoid, { backgroundColor: c.surfaceAccentSoft }]}>
              <WarningCircle size={16} weight="bold" color={c.textAccentStrong} />
              <Text variant="caption" weight="medium" color="textAccentStrong" style={styles.flex}>
                {t('weather.avoid', { from: a.from, to: a.to, reason: t(`weather.reason.${a.reason}`) })}
              </Text>
            </View>
          ))}

          {onChangePlace ? (
            <Pressable
              onPress={onChangePlace}
              accessibilityRole="button"
              accessibilityLabel={t('weather.location.a11y', { name: place ?? t('weather.location.here') })}
              style={({ pressed }) => [styles.location, styles.stripLocation, { borderTopColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
              <MapPin size={16} weight="bold" color={c.textMuted} />
              <Text variant="label" color="textMuted" numberOfLines={1} style={styles.flex}>
                {place ?? t('weather.location.here')}
              </Text>
              <Text variant="label" color="textBrand">
                {t('weather.location.change')}
              </Text>
            </Pressable>
          ) : null}
        </View>
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
  strip: {
    gap: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -space[4],
    marginBottom: -space[1],
    paddingTop: space[3],
    paddingHorizontal: space[4],
  },
  stripHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stripMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space[3], rowGap: space[1] },
  stripBest: { flexGrow: 1 },
  // Sama karta: pora w swoim wierszu, liczby pod nią – inaczej ostatnia wartość zawija się samotnie.
  stripBestBlock: { width: '100%' },
  stripOpen: { gap: space[3] },
  hours: { flexDirection: 'row', gap: 2 },
  hour: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space[2], borderRadius: radius.button },
  stripLocation: { marginBottom: 0 },
  small: { fontSize: font.size.xs, lineHeight: 17 },
  card: { gap: space[3], padding: space[4], borderRadius: radius.card, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
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
