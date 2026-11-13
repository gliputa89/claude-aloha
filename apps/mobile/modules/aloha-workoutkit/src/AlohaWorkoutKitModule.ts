import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { WatchWorkout } from '@aloha/plan-engine';

export type WatchAuthorization = 'notDetermined' | 'restricted' | 'denied' | 'authorized' | 'unsupported';

/** Odcinek dla zegarka z opcjonalną nazwą (WorkoutKit pokazuje ją od iOS 18). */
type NamedStep = { durationS: number; speed: { lowMps: number; highMps: number } | null; name?: string };

/** Trening w kształcie WorkoutKit: rozgrzewka, bloki z powtórzeniami, schłodzenie. */
export type AppleWorkout = {
  /** UUID treningu z planu. */
  id: string;
  name: string;
  warmup: NamedStep | null;
  blocks: { iterations: number; steps: { purpose: 'work' | 'recovery'; step: NamedStep }[] }[];
  cooldown: NamedStep | null;
};

export type AppleDate = { year: number; month: number; day: number; hour?: number; minute?: number };

export type ScheduledWorkout = { id: string; date: string; complete: boolean };

declare class AlohaWorkoutKitModule extends NativeModule<Record<string, never>> {
  readonly maxScheduled: number;
  isSupported(): boolean;
  getAuthorizationState(): Promise<WatchAuthorization>;
  requestAuthorization(): Promise<WatchAuthorization>;
  schedule(workout: AppleWorkout, date: AppleDate): Promise<void>;
  remove(id: string): Promise<void>;
  getScheduled(): Promise<ScheduledWorkout[]>;
  preview(workout: AppleWorkout): Promise<void>;
}

/** null poza iOS i w buildach bez modułu (np. Expo Go). */
export const AlohaWorkoutKit = requireOptionalNativeModule<AlohaWorkoutKitModule>('AlohaWorkoutKit');

export type { WatchWorkout };
