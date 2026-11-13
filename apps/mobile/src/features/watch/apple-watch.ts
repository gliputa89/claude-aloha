import { stepsOf, toWatchWorkout, type WatchStep } from '@aloha/plan-engine';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { AlohaWorkoutKit, type AppleWorkout, type WatchAuthorization } from '../../../modules/aloha-workoutkit/src/AlohaWorkoutKitModule';
import type { PlanSession } from '@/features/plan/api';
import { sessionTitleKey } from '@/features/plan/session-title';
import { useT } from '@/hooks/use-t';

/**
 * Stan wysyłki na zegarek:
 * `idle` – można wysłać · `sending` – trwa · `scheduled` – trening czeka w aplikacji Trening ·
 * `pending` – iOS po zgodzie dalej mówi „nie zdecydowano” i trening się nie zapisał (zgoda jeszcze nie dotarła) ·
 * `error` – coś poszło nie tak.
 * Brak zgody nie jest stanem ekranu – przycisk pokazuje wtedy okienko z instrukcją (AppleWatchButton).
 */
export type WatchState = 'idle' | 'sending' | 'scheduled' | 'pending' | 'error';

/** Wynik wysyłki: `denied` / `restricted` – brak zgody (odmowa albo blokada na iPhonie); iOS drugi raz nie zapyta. */
export type WatchSendResult = 'scheduled' | 'pending' | 'denied' | 'restricted' | 'error';

/** Po prośbie o zgodę iOS bywa, że jeszcze chwilę zwraca „nie zdecydowano” – sprawdzamy ponownie tyle razy, co tyle ms. */
const AUTH_RETRIES = 5;
const AUTH_RETRY_MS = 600;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Czy ten telefon może planować treningi na Apple Watch (iOS 17+, moduł w buildzie, zegarek obsługiwany). */
export function appleWatchAvailable(): boolean {
  if (Platform.OS !== 'ios' || !AlohaWorkoutKit) return false;
  try {
    return AlohaWorkoutKit.isSupported();
  } catch {
    return false;
  }
}

/** Trening z planu w kształcie WorkoutKit; null, gdy nie ma czego wysłać (dzień wolny, start, brak odcinków). */
export function toAppleWorkout(session: PlanSession, t: ReturnType<typeof useT>): AppleWorkout | null {
  if (session.type === 'rest') return null;
  const w = toWatchWorkout(stepsOf(session));
  if (!w) return null;
  const named = (s: WatchStep) => ({ durationS: s.durationS, speed: s.speed, name: t(`workout.zone.${s.zone}`) });
  return {
    id: session.id,
    name: `Aloha · ${t(sessionTitleKey(session))}`,
    warmup: w.warmup ? named(w.warmup) : null,
    blocks: w.blocks.map((b) => ({
      iterations: b.iterations,
      steps: b.steps.map((s) => ({ purpose: s.purpose, step: named(s.step) })),
    })),
    cooldown: w.cooldown ? named(w.cooldown) : null,
  };
}

const dateOf = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
};

/** Wysyłka jednego treningu na Apple Watch: planuje go na dzień z planu i pamięta, czy już tam jest. */
export function useAppleWatch(session: PlanSession) {
  const t = useT();
  const [state, setState] = useState<WatchState>('idle');
  /** Techniczny powód ostatniego błędu – pokazywany tylko w buildzie deweloperskim, do diagnozy na telefonie. */
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const fail = (detail: string): WatchSendResult => {
    console.warn('[apple-watch]', detail);
    setErrorDetail(detail);
    setState('error');
    return 'error';
  };
  const workout = toAppleWorkout(session, t);
  const available = appleWatchAvailable() && workout !== null;

  useEffect(() => {
    if (!available || !AlohaWorkoutKit) return;
    let alive = true;
    AlohaWorkoutKit.getScheduled()
      .then((list) => {
        const id = session.id.toLowerCase();
        if (alive && list.some((w) => w.id === id && w.date === session.scheduled_on)) setState('scheduled');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [available, session.id, session.scheduled_on]);

  /** Zgoda na dodawanie treningów: `notDetermined` – iOS jeszcze nie pytał (przed pytaniem pokazujemy wyjaśnienie). */
  const authorization = useCallback(async (): Promise<WatchAuthorization> => {
    if (!AlohaWorkoutKit) return 'unsupported';
    try {
      return await AlohaWorkoutKit.getAuthorizationState();
    } catch {
      return 'unsupported';
    }
  }, []);

  /**
   * Prosi iOS o zgodę (jeśli jeszcze nie pytał) i planuje trening na dzień z planu.
   * Sukces sprawdzamy na liście zaplanowanych treningów, a nie tylko po stanie zgody: na telefonie zdarza się, że po
   * „Pozwól” iOS dalej zwraca `notDetermined` (np. gdy zegarek nie jest akurat połączony).
   */
  const send = useCallback(async (): Promise<WatchSendResult> => {
    if (!AlohaWorkoutKit || !workout) return fail('no module or workout');
    setState('sending');
    setErrorDetail(null);
    let step = 'getAuthorizationState';
    try {
      let auth = await AlohaWorkoutKit.getAuthorizationState();
      if (auth === 'notDetermined') {
        step = 'requestAuthorization';
        auth = await AlohaWorkoutKit.requestAuthorization();
      }
      for (let i = 0; auth === 'notDetermined' && i < AUTH_RETRIES; i++) {
        await sleep(AUTH_RETRY_MS);
        auth = await AlohaWorkoutKit.getAuthorizationState();
      }
      if (auth === 'denied' || auth === 'restricted') {
        setState('idle');
        return auth;
      }
      if (auth !== 'authorized' && auth !== 'notDetermined') return fail(`authorization: ${auth}`);
      step = 'schedule';
      await AlohaWorkoutKit.schedule(workout, dateOf(session.scheduled_on));
      step = 'getScheduled';
      const id = session.id.toLowerCase();
      const saved = (await AlohaWorkoutKit.getScheduled()).some((w) => w.id === id && w.date === session.scheduled_on);
      if (saved) {
        setState('scheduled');
        return 'scheduled';
      }
      if (auth === 'notDetermined') {
        console.warn('[apple-watch] authorization still notDetermined, workout not saved');
        setErrorDetail('authorization: notDetermined, not in scheduledWorkouts');
        setState('pending');
        return 'pending';
      }
      return fail('schedule: workout missing from scheduledWorkouts');
    } catch (e) {
      return fail(`${step}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [workout, session.id, session.scheduled_on]);

  const preview = useCallback(async () => {
    if (!AlohaWorkoutKit || !workout) return;
    try {
      await AlohaWorkoutKit.preview(workout);
    } catch (e) {
      fail(`preview: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [workout]);

  return { available, state, errorDetail, authorization, send, preview };
}
