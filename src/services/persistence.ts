import AsyncStorage from '@react-native-async-storage/async-storage';

import { StudyBoltState } from '../models';
import { initialState } from '../data/mockStudyPacks';

const STORAGE_KEY = '@studybolt/state/v1';

export async function loadStudyBoltState(): Promise<StudyBoltState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<StudyBoltState>;
    if (!Array.isArray(parsed.decks) || !parsed.plan) return initialState;
    return {
      ...initialState,
      ...parsed,
      plan: { ...initialState.plan, ...parsed.plan },
    };
  } catch {
    return initialState;
  }
}

export async function saveStudyBoltState(state: StudyBoltState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local study data remains in memory if device storage is temporarily unavailable.
  }
}
