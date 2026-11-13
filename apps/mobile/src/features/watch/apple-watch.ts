import { stepsOf, toWatchWorkout, type WatchStep } from '@aloha/plan-engine';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { AlohaWorkoutKit, type AppleWorkout, type WatchAuthorization } from '../../../modules/aloha-workoutkit/src/AlohaWorkoutKitModule';
import type { PlanSession } from '@/features/plan/api';
import { sessionTitleKey } from '@/features/plan/session-title';
import { useT } from '@/hooks/use-t';

/**
 * Stan wysyłki na zegarek:
 * `idle` – można wysłać · `sending` – trwa · `scheduled` – trening czeka w aplikacji Trening · `error` – coś poszło nie tak.
 * Brak zgody nie jest stanem ekranu – przycisk pokazuje wtedy okienko z instrukcją (AppleWatchButton).
 */
export type WatchState = 'idle' | 'sending' | 'scheduled' | 'error';

/** Wynik wysyłki: `denied` / `restricted` – brak zgody (odmowa albo blokada na iPhonie); iOS drugi raz nie zapyta. */
export type WatchSendResult = 'scheduled' | 'denied' | 'restricted' | 'error';

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

  /** Prosi iOS o zgodę (jeśli jeszcze nie pytał) i planuje trening na dzień z planu. */
  const send = useCallback(async (): Promise<WatchSendResult> => {
    if (!AlohaWorkoutKit || !workout) return 'error';
    setState('sending');
    try {
      let auth = await AlohaWorkoutKit.getAuthorizationState();
      if (auth === 'notDetermined') auth = await AlohaWorkoutKit.requestAuthorization();
      if (auth === 'denied' || auth === 'restricted') {
        setState('idle');
        return auth;
      }
      if (auth !== 'authorized') {
        setState('error');
        return 'error';
      }
      await AlohaWorkoutKit.schedule(workout, dateOf(session.scheduled_on));
      setState('scheduled');
      return 'scheduled';
    } catch {
      setState('error');
      return 'error';
    }
  }, [workout, session.scheduled_on]);

  const preview = useCallback(async () => {
    if (!AlohaWorkoutKit || !workout) return;
    try {
      await AlohaWorkoutKit.preview(workout);
    } catch {
      setState('error');
    }
  }, [workout]);

  return { available, state, authorization, send, preview };
}
