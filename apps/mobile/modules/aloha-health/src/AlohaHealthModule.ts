import { NativeModule, requireOptionalNativeModule } from 'expo';

/** Bieg albo marsz z Apple Zdrowie – kształt, który przyjmuje funkcja health-sync. */
export type HealthWorkout = {
  /** UUID treningu w HealthKit. */
  id: string;
  activity: 'run' | 'walk';
  start: string;
  end: string;
  /** Dzień startu w strefie czasowej treningu, `YYYY-MM-DD`. */
  localDate: string;
  durationS: number;
  distanceM: number;
  elevationM?: number;
  avgHr?: number;
  maxHr?: number;
  /** Bieg rozpoczęty z treningu wysłanego przez Aloha na Apple Watch – id treningu z planu. */
  plannedSessionId?: string;
  /** Sekundy od startu i skumulowany dystans w tych chwilach (m); tętno w tych samych punktach. */
  time: number[];
  distance: number[];
  heartrate?: number[];
};

declare class AlohaHealthModule extends NativeModule<Record<string, never>> {
  isAvailable(): boolean;
  requestAuthorization(): Promise<void>;
  getWorkouts(sinceMs: number, limit: number): Promise<HealthWorkout[]>;
}

/** null poza iOS i w buildach bez modułu (np. Expo Go). */
export const AlohaHealth = requireOptionalNativeModule<AlohaHealthModule>('AlohaHealth');
