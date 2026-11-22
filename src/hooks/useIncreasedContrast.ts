import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';

export function useIncreasedContrast(): boolean {
  const [increased, setIncreased] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const media = window.matchMedia('(prefers-contrast: more)');
      const refresh = () => setIncreased(media.matches);
      media.addEventListener('change', refresh);
      refresh();
      return () => media.removeEventListener('change', refresh);
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    const ios = Platform.OS === 'ios';
    const read = ios ? AccessibilityInfo.isDarkerSystemColorsEnabled : AccessibilityInfo.isHighTextContrastEnabled;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      void read().then(value => {
        if (revision === request) setIncreased(value);
      }).catch(() => undefined);
    };
    const contrast = AccessibilityInfo.addEventListener(ios ? 'darkerSystemColorsChanged' : 'highTextContrastChanged', value => {
      revision += 1;
      setIncreased(value);
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    refresh();
    return () => {
      revision += 1;
      contrast.remove();
      appState.remove();
    };
  }, []);

  return increased;
}
