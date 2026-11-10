import type { TranslationKey } from '@aloha/i18n';
import { useEffect, useRef, useState } from 'react';

import { PlanLoader, type PlanLoaderResult } from '@/components/plan/plan-loader';
import { useOnboardingDraft } from '@/features/onboarding/draft';
import { fromIsoDate } from '@/features/onboarding/time';
import { generatePlan } from '@/features/plan/api';
import { planLoaderResult, planLoaderTexts } from '@/features/plan/plan-loader-texts';
import { useLocale, useT } from '@/hooks/use-t';
import { useAuth } from '@/providers/auth-provider';

/**
 * Po zapisaniu ankiety: plan układa się na serwerze, a użytkownik widzi wschód słońca i finał z planem.
 * Ankieta jest już zapisana, więc błąd generowania niczego nie blokuje – ekran główny spróbuje jeszcze raz.
 */
export default function GeneratingScreen() {
  const t = useT();
  const locale = useLocale();
  const { draft } = useOnboardingDraft();
  const { session, refreshProfile } = useAuth();
  const [task, setTask] = useState<Promise<PlanLoaderResult | null> | null>(null);
  const [continuing, setContinuing] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setTask(
      generatePlan()
        .then((plan) => planLoaderResult(plan, locale))
        .catch(() => null),
    );
  }, [locale]);

  const metaName = session?.user.user_metadata?.display_name;
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
