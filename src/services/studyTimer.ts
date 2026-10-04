import AsyncStorage from '@react-native-async-storage/async-storage';

export type StudyTimerMethod = 'quick-sprint' | 'pomodoro' | 'deep-focus' | 'custom';
export type StudyTimerAlarmMode = 'sound-vibration' | 'vibration' | 'silent';

export interface StudyTimerSettings {
  method: StudyTimerMethod;
  focusMinutes: number;
  breakMinutes: number;
  alarmMode: StudyTimerAlarmMode;
}

export const STUDY_TIMER_STORAGE_KEY = '@studybolt/study-timer-settings/v1';

export const STUDY_TIMER_PRESETS: Array<{
  id: Exclude<StudyTimerMethod, 'custom'>;
  label: string;
  detail: string;
  focusMinutes: number;
  breakMinutes: number;
}> = [
  { id: 'quick-sprint', label: 'Quick sprint', detail: 'Short reset', focusMinutes: 15, breakMinutes: 3 },
  { id: 'pomodoro', label: 'Pomodoro', detail: 'Balanced rhythm', focusMinutes: 25, breakMinutes: 5 },
  { id: 'deep-focus', label: 'Deep focus', detail: 'Long work block', focusMinutes: 50, breakMinutes: 10 },
];

export const DEFAULT_STUDY_TIMER_SETTINGS: StudyTimerSettings = {
  method: 'pomodoro',
  focusMinutes: 25,
  breakMinutes: 5,
  alarmMode: 'sound-vibration',
};

const listeners = new Set<(settings: StudyTimerSettings) => void>();
let cachedSettings: StudyTimerSettings | null = null;

function boundedMinutes(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeSettings(value: unknown): StudyTimerSettings {
  if (!value || typeof value !== 'object') return DEFAULT_STUDY_TIMER_SETTINGS;
  const candidate = value as Partial<StudyTimerSettings>;
  const method: StudyTimerMethod = candidate.method === 'quick-sprint'
    || candidate.method === 'pomodoro'
    || candidate.method === 'deep-focus'
    || candidate.method === 'custom'
    ? candidate.method
    : DEFAULT_STUDY_TIMER_SETTINGS.method;
  const alarmMode: StudyTimerAlarmMode = candidate.alarmMode === 'sound-vibration'
    || candidate.alarmMode === 'vibration'
    || candidate.alarmMode === 'silent'
    ? candidate.alarmMode
    : DEFAULT_STUDY_TIMER_SETTINGS.alarmMode;
  return {
    method,
    focusMinutes: boundedMinutes(candidate.focusMinutes, DEFAULT_STUDY_TIMER_SETTINGS.focusMinutes, 5, 120),
    breakMinutes: boundedMinutes(candidate.breakMinutes, DEFAULT_STUDY_TIMER_SETTINGS.breakMinutes, 1, 30),
    alarmMode,
  };
}

export function studyTimerMethodLabel(settings: Pick<StudyTimerSettings, 'method'>): string {
  if (settings.method === 'quick-sprint') return 'Quick sprint';
  if (settings.method === 'deep-focus') return 'Deep focus';
  if (settings.method === 'custom') return 'Custom timer';
  return 'Pomodoro';
}

export async function loadStudyTimerSettings(): Promise<StudyTimerSettings> {
  if (cachedSettings) return cachedSettings;
  try {
    const raw = await AsyncStorage.getItem(STUDY_TIMER_STORAGE_KEY);
    cachedSettings = normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    cachedSettings = DEFAULT_STUDY_TIMER_SETTINGS;
  }
  return cachedSettings;
}

export async function saveStudyTimerSettings(settings: StudyTimerSettings): Promise<StudyTimerSettings> {
  const normalized = normalizeSettings(settings);
  cachedSettings = normalized;
  await AsyncStorage.setItem(STUDY_TIMER_STORAGE_KEY, JSON.stringify(normalized));
  listeners.forEach((listener) => listener(normalized));
  return normalized;
}

export function subscribeToStudyTimerSettings(listener: (settings: StudyTimerSettings) => void): () => void {
  listeners.add(listener);
  if (cachedSettings) listener(cachedSettings);
  return () => listeners.delete(listener);
}
