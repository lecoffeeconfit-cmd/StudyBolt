import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StudyEvent } from '../models';
import { supabase } from './auth';

export interface AdminActivity {
  id: string; type: string; occurredAt: string; seconds: number; answers: number; correct: number; screen?: string;
}

const ACTIVITY_TYPES = new Set(['pack-created', 'note-review', 'flashcard-review', 'quiz', 'audio', 'focus']);
const keyFor = (userId: string) => `@studybolt/admin-activity/${userId}`;
// Serialize queue writes and flushes so a completed upload cannot erase a new event.
let pending: Promise<void> = Promise.resolve();
function enqueue(work: () => Promise<void>) {
  pending = pending.then(work).catch(() => undefined);
  return pending;
}

export function summarizeAdminActivity(event: StudyEvent): AdminActivity | null {
  if (!ACTIVITY_TYPES.has(event.type)) return null;
  const answers = event.type === 'quiz' ? Math.min(1000, event.quizAnswers?.length ?? 0) : 0;
  return {
    id: event.id, type: event.type, occurredAt: event.occurredAt,
    seconds: Math.max(0, Math.min(14400, Math.round((event.durationMinutes ?? 0) * 60))),
    answers, correct: Math.min(answers, event.quizAnswers?.filter(answer => answer.correct).length ?? 0),
  };
}

export function queueAdminActivity(userId: string, events: AdminActivity[]) {
  if (!events.length || !supabase) return Promise.resolve();
  return enqueue(async () => {
    const stored = JSON.parse(await AsyncStorage.getItem(keyFor(userId)) ?? '[]') as AdminActivity[];
    const unique = new Map([...stored, ...events].map(event => [event.id, event]));
    const cutoff = Date.now() - 7 * 86400000;
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify([...unique.values()].filter(event => Date.parse(event.occurredAt) >= cutoff).slice(-1000)));
  });
}

export function flushAdminActivity(userId: string) {
  return enqueue(async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.id !== userId) return;
    const { error: registrationError } = await supabase.rpc('register_studybolt_account');
    if (registrationError) return;
    const stored = JSON.parse(await AsyncStorage.getItem(keyFor(userId)) ?? '[]') as AdminActivity[];
    if (!stored.length) return;
    const { error } = await supabase.rpc('record_studybolt_activity', { p_events: stored.slice(0, 100) });
    if (!error) await AsyncStorage.setItem(keyFor(userId), JSON.stringify(stored.slice(100)));
  });
}
