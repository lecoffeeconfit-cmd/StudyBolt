import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { seasonalThemeCheckDelay } from '../theme';

const localMonth = () => new Date().getMonth();
const noMonth = () => undefined;
const doNothing = () => {};
const subscribeToNothing = () => doNothing;

function subscribeToLocalMonth(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function pause() {
    clearTimeout(timer);
    timer = undefined;
  }

  function refresh() {
    pause();
    onChange();
    timer = setTimeout(refresh, seasonalThemeCheckDelay(new Date()));
  }

  const subscription = AppState.addEventListener('change', state => {
    if (state === 'active') refresh();
    else pause();
  });
  if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') refresh();

  return () => {
    pause();
    subscription?.remove();
  };
}

export function useSeasonalThemeMonth(enabled: boolean): number | undefined {
  return useSyncExternalStore(
    enabled ? subscribeToLocalMonth : subscribeToNothing,
    enabled ? localMonth : noMonth,
    noMonth,
  );
}
