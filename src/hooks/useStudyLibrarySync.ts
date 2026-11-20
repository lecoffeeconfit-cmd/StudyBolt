import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { initialState } from '../data/mockStudyPacks';
import type { StudyBoltState } from '../models';
import { libraryVersion, mergeLibraryItems } from '../services/libraryData';
import { syncStudyLibrary } from '../services/librarySync';

const sampleIds = new Set(initialState.decks.filter(pack => pack.fileType === 'demo').map(pack => pack.courseId));
export type LibrarySyncStatus = 'idle' | 'syncing' | 'synced' | 'waiting';

export function useStudyLibrarySync(
  userId: string | undefined,
  hydrated: boolean,
  state: StudyBoltState,
  setState: React.Dispatch<React.SetStateAction<StudyBoltState>>,
  getToken: () => Promise<string | null>,
) {
  const [status, setStatus] = useState<LibrarySyncStatus>('idle');
  const current = useRef({ state, getToken });
  current.current = { state, getToken };
  const requestSync = useRef<(() => void) | undefined>(undefined);
  const syncNow = useCallback(() => requestSync.current?.(), []);
  const revisions = [...state.classes, ...state.decks].map(item => [item.id, libraryVersion(item)]);
  const revisionKey = JSON.stringify(revisions);
  const syncEnabled = hydrated && Boolean(userId);

  useEffect(() => {
    if (!syncEnabled || !userId) return;
    const controller = new AbortController();
    let running = false;
    let queued = false;
    const sync = async () => {
      if (controller.signal.aborted) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      setStatus('syncing');
      const operation = new AbortController();
      const cancel = () => operation.abort();
      controller.signal.addEventListener('abort', cancel, { once: true });
      const deadline = setTimeout(cancel, 60_000);
      try {
        const token = await current.current.getToken();
        if (!token || operation.signal.aborted) throw new Error('Account session unavailable');
        await syncStudyLibrary(current.current.state, sampleIds, userId, token, operation.signal, (item) => {
          if (!operation.signal.aborted) setState(previous => mergeLibraryItems(previous, [item]));
        });
        if (!controller.signal.aborted) setStatus('synced');
      } catch {
        if (!controller.signal.aborted) setStatus('waiting');
      } finally {
        clearTimeout(deadline);
        controller.signal.removeEventListener('abort', cancel);
        running = false;
        if (queued && !controller.signal.aborted) {
          queued = false;
          void sync();
        }
      }
    };
    requestSync.current = () => { void sync(); };
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') void sync(); });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void sync();
    }, 90_000);
    void sync();
    return () => {
      requestSync.current = undefined;
      controller.abort();
      subscription.remove();
      clearInterval(interval);
    };
  }, [userId, syncEnabled, setState]);

  useEffect(() => {
    if (!syncEnabled) return;
    const timer = setTimeout(() => requestSync.current?.(), 1800);
    return () => clearTimeout(timer);
  }, [revisionKey, syncEnabled]);

  return { status, syncNow };
}
