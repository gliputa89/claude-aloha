import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlanLoader, type PlanLoaderResult } from '@/components/plan/plan-loader';
import { Chip } from '@/components/ui/chip';
import { space } from '@/constants/theme';
import { planLoaderTexts } from '@/features/plan/plan-loader-texts';
import { useT } from '@/hooks/use-t';

/**
 * Podgląd ekranu generowania planu bez serwera i bez AI – tylko w development buildzie.
 * Otwórz: aloha://dev/plan-loader (albo `npx uri-scheme open aloha://dev/plan-loader --ios`).
 * Etykiety scenariuszy są narzędziem deweloperskim, więc nie idą do słowników.
 */
const SAMPLE: PlanLoaderResult = {
  sessions: 6,
  startLabel: 'poniedziałek, 16 listopada',
  summary:
    'Zaczynamy spokojnie: trzy biegi w tygodniu, w tym jeden dłuższy w sobotę. W drugim tygodniu dokładam kilka krótkich przebieżek, żeby nogi przypomniały sobie szybsze tempo.',
};

type Scenario = { key: string; label: string; ms: number; result: PlanLoaderResult | null };

const SCENARIOS: Scenario[] = [
  { key: 'fast', label: 'Szybko 2 s', ms: 2000, result: SAMPLE },
  { key: 'typical', label: 'Typowo 12 s', ms: 12000, result: SAMPLE },
  { key: 'slow', label: 'Wolno 40 s', ms: 40000, result: SAMPLE },
  { key: 'rules', label: 'Bez AI', ms: 6000, result: { ...SAMPLE, summary: null } },
  { key: 'error', label: 'Błąd', ms: 6000, result: null },
];

const fakeTask = (s: Scenario) => new Promise<PlanLoaderResult | null>((resolve) => setTimeout(() => resolve(s.result), s.ms));

export default function PlanLoaderPreview() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [run, setRun] = useState(() => ({ id: 0, scenario: SCENARIOS[0]!, task: fakeTask(SCENARIOS[0]!) }));

  if (!__DEV__) return <Redirect href="/" />;

  const start = (scenario: Scenario) => setRun((r) => ({ id: r.id + 1, scenario, task: fakeTask(scenario) }));

  return (
    <View style={styles.flex}>
      <PlanLoader
        key={run.id}
        texts={planLoaderTexts(t, {
          name: 'Tomek',
          race: { distance: '10 km', date: '12 kwietnia' },
          days: 'wt, czw, sob',
        })}
        task={run.task}
        onContinue={() => start(run.scenario)}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.bar, { top: insets.top + space[1] }]}
        contentContainerStyle={styles.barContent}>
        {SCENARIOS.map((s) => (
          <Chip key={s.key} label={s.label} selected={run.scenario.key === s.key} onPress={() => start(s)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { position: 'absolute', left: 0, right: 0, flexGrow: 0 },
  barContent: { gap: space[2], paddingHorizontal: space[4] },
});
