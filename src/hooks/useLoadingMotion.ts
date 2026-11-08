import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform } from 'react-native';

import { useReducedMotion } from './useReducedMotion';

/** One native-driven clock for each visible loader; no work while backgrounded. */
export function useLoadingMotion() {
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const phase = useRef(new Animated.Value(0)).current;
  const moving = foreground && !reducedMotion;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    phase.setValue(0);
    if (!moving) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(phase, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(phase, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [moving, phase]);

  return { phase, moving };
}
