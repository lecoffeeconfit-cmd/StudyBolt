import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

export type NarrationPreferences = {
  language: string | null;
  voiceIdentifier: string | null;
};

export const NARRATION_PREFERENCES_STORAGE_KEY = '@studybolt/narration-preferences/v1';

export const DEFAULT_NARRATION_PREFERENCES: NarrationPreferences = {
  language: null,
  voiceIdentifier: null,
};

const listeners = new Set<(preferences: NarrationPreferences) => void>();
let cachedPreferences: NarrationPreferences | null = null;
let loadingPreferences: Promise<NarrationPreferences> | null = null;

function normalizePreferences(value: unknown): NarrationPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_NARRATION_PREFERENCES;
  const candidate = value as Partial<NarrationPreferences>;
  return {
    language: typeof candidate.language === 'string' && candidate.language.trim() ? candidate.language : null,
    voiceIdentifier: typeof candidate.voiceIdentifier === 'string' && candidate.voiceIdentifier.trim() ? candidate.voiceIdentifier : null,
  };
}

export function loadNarrationPreferences(): Promise<NarrationPreferences> {
  if (cachedPreferences) return Promise.resolve(cachedPreferences);
  if (loadingPreferences) return loadingPreferences;
  loadingPreferences = AsyncStorage.getItem(NARRATION_PREFERENCES_STORAGE_KEY)
    .then((raw) => {
      cachedPreferences ??= normalizePreferences(raw ? JSON.parse(raw) : null);
      return cachedPreferences;
    })
    .catch(() => {
      cachedPreferences ??= DEFAULT_NARRATION_PREFERENCES;
      return cachedPreferences;
    })
    .finally(() => {
      loadingPreferences = null;
    });
  return loadingPreferences;
}

export async function saveNarrationPreferences(preferences: NarrationPreferences): Promise<NarrationPreferences> {
  const normalized = normalizePreferences(preferences);
  cachedPreferences = normalized;
  listeners.forEach((listener) => listener(normalized));
  await AsyncStorage.setItem(NARRATION_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function subscribeToNarrationPreferences(listener: (preferences: NarrationPreferences) => void): () => void {
  listeners.add(listener);
  if (cachedPreferences) listener(cachedPreferences);
  return () => listeners.delete(listener);
}

export async function getNarrationSpeechOptions(overrides: Speech.SpeechOptions = {}): Promise<Speech.SpeechOptions> {
  const preferences = await loadNarrationPreferences();
  return {
    ...(preferences.language ? { language: preferences.language } : {}),
    ...(preferences.voiceIdentifier ? { voice: preferences.voiceIdentifier } : {}),
    ...overrides,
  };
}
