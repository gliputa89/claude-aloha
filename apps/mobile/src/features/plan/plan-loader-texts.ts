import type { Locale, TranslationKey } from '@aloha/i18n';

import type { PlanLoaderResult, PlanLoaderTexts } from '@/components/plan/plan-loader';
import { fromIsoDate } from '@/features/onboarding/time';
import type { GeneratedPlan } from '@/features/plan/api';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

export type PlanLoaderContext = {
  name: string | null;
  /** Zawody: dystans (np. „10 km”) i data; `null` przy celu ogólnym. */
  race: { distance: string; date: string } | null;
  /** Wybrane dni, np. „wt, czw, sob”. */
  days: string;
};

/** Teksty ekranu generowania planu, spersonalizowane odpowiedziami z ankiety. */
export function planLoaderTexts(t: Translate, ctx: PlanLoaderContext): PlanLoaderTexts {
  return {
    steps: [
      ctx.name ? t('planLoader.stepHello', { name: ctx.name }) : t('planLoader.stepHelloNoName'),
      ctx.race ? t('planLoader.stepRace', ctx.race) : t('planLoader.stepGoal'),
      t('planLoader.stepDays', { days: ctx.days }),
      t('planLoader.stepTips'),
    ],
    slow: t('planLoader.slow'),
    progressLabel: t('planLoader.progress'),
    doneTitle: t('planLoader.doneTitle'),
    sessionsLabel: t('planLoader.sessions'),
    startLabel: t('planLoader.start'),
    coachLabel: t('planLoader.coach'),
    cta: t('planLoader.cta'),
    fallbackTitle: t('planLoader.fallbackTitle'),
    fallbackBody: t('planLoader.fallbackBody'),
  };
}

/**
 * Odpowiedź funkcji generate-plan → dane finału (data startu słownie, w języku aplikacji).
 * Wiadomość trenera to powitanie napisane przez AI do tego planu; `fallbackNote` – gdy plan powstał z samych reguł.
 */
export function planLoaderResult(plan: GeneratedPlan | null, locale: Locale, fallbackNote: string): PlanLoaderResult | null {
  if (!plan?.startsOn) return null;
  return {
    sessions: plan.sessions,
    startLabel: fromIsoDate(plan.startsOn).toLocaleDateString(locale === 'en' ? 'en-GB' : 'pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    note: plan.welcome?.trim() || fallbackNote,
  };
}
