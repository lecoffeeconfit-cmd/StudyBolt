import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';

import {
  DEFAULT_NARRATION_PREFERENCES,
  loadNarrationPreferences,
  saveNarrationPreferences,
  subscribeToNarrationPreferences,
  type NarrationPreferences,
} from '../services/narration';

export function useNarrationPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_NARRATION_PREFERENCES);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToNarrationPreferences((next) => {
      if (mounted) setPreferences(next);
    });
    void Promise.all([
      loadNarrationPreferences(),
      Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]),
    ]).then(async ([, availableVoices]) => {
      if (!mounted) return;
      const nextPreferences = await loadNarrationPreferences();
      if (!mounted) return;
      setPreferences(nextPreferences);
      setVoices([...availableVoices].sort((a, b) => a.language.localeCompare(b.language) || Number(b.quality === Speech.VoiceQuality.Enhanced) - Number(a.quality === Speech.VoiceQuality.Enhanced) || a.name.localeCompare(b.name)));
      if (nextPreferences.voiceIdentifier && !availableVoices.some((voice) => voice.identifier === nextPreferences.voiceIdentifier)) {
        const fallbackVoice = availableVoices.find((voice) => voice.language === nextPreferences.language && voice.quality === Speech.VoiceQuality.Enhanced)
          ?? availableVoices.find((voice) => voice.language === nextPreferences.language);
        void saveNarrationPreferences({ ...nextPreferences, voiceIdentifier: fallbackVoice?.identifier ?? null }).catch(() => undefined);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const updatePreferences = (next: NarrationPreferences) => saveNarrationPreferences(next);
  return { preferences, voices, loading, updatePreferences };
}
