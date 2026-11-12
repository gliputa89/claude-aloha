import { createContext, use, useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOut, ReduceMotion } from 'react-native-reanimated';

import { BootScreen } from '@/components/brand/boot-screen';
import { motion } from '@/constants/theme';

/** Po tylu ms ekran pokazuje się mimo braku wolniejszych danych – słaby internet nie blokuje aplikacji. */
const MAX_WAIT_MS = 5000;
/** Słońce zdąży wzejść – szybka odpowiedź nie może „mignąć”. */
const MIN_VISIBLE_MS = 1300;

type BootValue = {
  /** Ekran startowy jeszcze zasłania aplikację. */
  holding: boolean;
  /** Pierwszy widok ma komplet danych – można odsłonić aplikację. */
  markReady: () => void;
};

const BootContext = createContext<BootValue>({ holding: false, markReady: () => {} });

/**
 * Zimny start: nad aplikacją leży ekran ze wschodzącym słońcem (wygląda jak natywny splash, więc przejście
 * jest niewidoczne), dopóki ekran „Dzisiaj” nie zgłosi kompletu danych albo nie minie limit czasu.
 * Aplikacja renderuje się pod spodem, więc po odsłonięciu nic już nie doskakuje.
 */
export function BootGate({ active, children }: PropsWithChildren<{ active: boolean }>) {
  const [released, setReleased] = useState(false);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    startedAt.current = Date.now();
    const limit = setTimeout(() => setReleased(true), MAX_WAIT_MS);
    return () => {
      clearTimeout(limit);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active]);

  const markReady = useCallback(() => {
    if (timer.current) return;
    const left = MIN_VISIBLE_MS - (Date.now() - startedAt.current);
    timer.current = setTimeout(() => setReleased(true), Math.max(0, left));
  }, []);

  const holding = active && !released;

  return (
    <BootContext value={{ holding, markReady }}>
      {children}
      {holding ? (
        // Samo przenikanie – bez ruchu, więc zostaje także przy „Ogranicz ruch”.
        <Animated.View
          exiting={FadeOut.duration(motion.duration.slow).reduceMotion(ReduceMotion.Never)}
          style={StyleSheet.absoluteFill}>
          <BootScreen />
        </Animated.View>
      ) : null}
    </BootContext>
  );
}

export function useBoot() {
  return use(BootContext);
}
