import type { TranslationKey } from '@aloha/i18n';
import { useEffect, useRef, useState } from 'react';

import { PlanLoader, type PlanLoaderResult } from '@/components/plan/plan-loader';
import { useModule } from '@/features/modules/use-module';
import { useOnboardingDraft } from '@/features/onboarding/draft';
import { fromIsoDate } from '@/features/onboarding/time';
import { generatePlan } from '@/features/plan/api';
import { planLoaderResult, planLoaderTexts } from '@/features/plan/plan-loader-texts';
import { prefetchToday } from '@/features/today/prefetch';
import { useLocale, useT } from '@/hooks/use-t';
import { useUnits } from '@/lib/locale-preference';
import { useAuth } from '@/providers/auth-provider';

/** Po „Zobacz plan” czekamy na dane „Dzisiaj” najwyżej tyle – słaby internet nie blokuje wejścia. */
const PREFETCH_WAIT_MS = 4000;

/**
 * Po zapisaniu ankiety: plan układa się na serwerze, a użytkownik widzi wschód słońca i finał z planem.
 * Ankieta jest już zapisana, więc błąd generowania niczego nie blokuje – ekran główny spróbuje jeszcze raz.
 */
export default function GeneratingScreen() {
  const t = useT();
  const locale = useLocale();
  const { draft } = useOnboardingDraft();
  const units = useUnits();
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user.id ?? null;
  const modules = { weather: useModule('weather'), coach: useModule('coach') };
  const [task, setTask] = useState<Promise<PlanLoaderResult | null> | null>(null);
  const [continuing, setContinuing] = useState(false);
  const started = useRef(false);
  /** Plan, pogoda i notka dnia pobierane, gdy biegacz czyta podsumowanie – „Dzisiaj” ma je od razu. */
  const prefetch = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setTask(
      generatePlan()
        .then((plan) => {
          if (plan && userId) prefetch.current = prefetchToday({ userId, locale, units, modules });
          return planLoaderResult(plan, locale, t('planLoader.welcome'));
        })
        .catch(() => null),
    );
    // Jedno generowanie na wejście na ekran (`started`); późniejsze zmiany niczego nie powtarzają.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, t]);

  // Imię z profilu (konto z Apple podaje je dopiero w kroku powitania), awaryjnie z danych rejestracji.
  const metaName = profile?.display_name ?? session?.user.user_metadata?.display_name;
  const days = [...draft.days]
    .sort((a, b) => a - b)
    .map((d) => t(`onboarding.day.short${d}` as TranslationKey))
    .join(', ');
  const race =
    draft.goal === 'race' && draft.raceDate
      ? {
          distance: t(`onboarding.distanceInline.d${draft.raceDistanceM}` as TranslationKey),
          date: fromIsoDate(draft.raceDate).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
            day: 'numeric',
            month: 'long',
          }),
        }
      : null;

  const onContinue = async () => {
    setContinuing(true);
    if (prefetch.current) {
      await Promise.race([prefetch.current, new Promise((resolve) => setTimeout(resolve, PREFETCH_WAIT_MS))]);
    }
    // Profil z onboarding_completed_at → nawigator sam przełączy na aplikację.
    await refreshProfile();
  };

  return (
    <PlanLoader
      texts={planLoaderTexts(t, { name: typeof metaName === 'string' ? metaName.trim() || null : null, race, days })}
      task={task}
      continuing={continuing}
      onContinue={onContinue}
    />
  );
}
