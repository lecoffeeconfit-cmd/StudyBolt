import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import type { StudyEvent } from '../models';
import { flushAdminActivity, queueAdminActivity, summarizeAdminActivity } from '../services/adminActivity';

const isForeground = () => AppState.currentState === 'active'
  && !(Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden);

export function useAdminActivity(userId: string | undefined, events: StudyEvent[], hydrated: boolean) {
  const baseline = useRef<{ userId?: string; seen: Set<string> }>({ seen: new Set() });
  useEffect(() => {
    if (!hydrated) return;
    if (!userId || baseline.current.userId !== userId) {
      baseline.current = { userId, seen: new Set(events.map(event => event.id)) };
      return;
    }
    const added = events.filter(event => !baseline.current.seen.has(event.id));
    baseline.current.seen = new Set(events.map(event => event.id));
    const summaries = added.map(summarizeAdminActivity).filter(item => item !== null);
    void queueAdminActivity(userId, summaries);
  }, [events, hydrated, userId]);

  useEffect(() => {
    if (!userId) return;
    const flush = () => { if (isForeground()) void flushAdminActivity(userId); };
    flush();
    const timer = setInterval(flush, 30000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') flush();
    });
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', flush);
    return () => {
      clearInterval(timer); subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', flush);
    };
  }, [userId]);
}

export function useAdminScreenTime(userId: string | undefined, screen: string | null) {
  useEffect(() => {
    if (!userId || !screen) return;
    let startedAt = isForeground() ? Date.now() : null;
    const finish = () => {
      if (startedAt === null) return;
      const occurredAt = new Date(startedAt).toISOString();
      const seconds = Math.min(60, Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      startedAt = null;
      if (seconds < 3) return;
      void queueAdminActivity(userId, [{ id: `screen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, type: 'screen', occurredAt, seconds, answers: 0, correct: 0, screen }]);
    };
    const change = () => { finish(); startedAt = isForeground() ? Date.now() : null; };
    const subscription = AppState.addEventListener('change', change);
    const timer = setInterval(change, 60000);
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', change);
    return () => {
      finish(); void flushAdminActivity(userId); clearInterval(timer); subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', change);
    };
  }, [screen, userId]);
}
