import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '../AuthContext';
import { resolveBackendUrl } from '../config/backend';
import { guideStorage, withGuideStorage } from '../services/guideStorage';
import {
  emptyGuideState, enrollGuidance, guideMetadataPatch, guideStateKey, mergeGuideProgress,
  parseGuideState, readRemoteGuideState, removeSyncedGuides,
  type GuideDefinition, type GuideState, type GuideStatus,
} from '../services/studyGuidance';

const empty = emptyGuideState();
type Snapshot = { key: string; value: GuideState; storageAvailable: boolean };

export function useGuidePreferences(newAccountId?: string) {
  const { user, getAccessToken } = useAuth();
  const userId = user?.id;
  const key = guideStateKey(userId);
  const enroll = Boolean(userId && newAccountId === userId);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [retry, setRetry] = useState(0);
  const visible = snapshot?.key === key ? snapshot : undefined;
  const remoteMetadata = user?.user_metadata;
  const auth = useRef({ key, getAccessToken, remoteMetadata });
  auth.current = { key, getAccessToken, remoteMetadata };

  useEffect(() => {
    let cancelled = false;
    void withGuideStorage(async () => {
      let value = parseGuideState(await guideStorage.getItem(key));
      if (cancelled) return;
      const remote = readRemoteGuideState(auth.current.remoteMetadata);
      if (enroll && userId && !value.enrolled && !remote.enrolled) {
        const guestKey = guideStateKey();
        const guest = parseGuideState(await guideStorage.getItem(guestKey));
        if (cancelled) return;
        const linked = enrollGuidance(value, guest, userId);
        value = linked.account;
        if (linked.guest !== guest) await guideStorage.setItem(guestKey, JSON.stringify(linked.guest));
        await guideStorage.setItem(key, JSON.stringify(value));
      }
      if (!cancelled) setSnapshot({ key, value: {
        ...value, enrolled: value.enrolled || remote.enrolled,
        records: mergeGuideProgress(value.records, remote.records),
        pending: removeSyncedGuides(value.pending, remote.records),
      }, storageAvailable: true });
    }).catch(() => {
      if (!cancelled) setSnapshot({ key, value: empty, storageAvailable: false });
    });
    return () => { cancelled = true; };
  }, [key, enroll, userId]);

  useEffect(() => {
    if (!visible?.storageAvailable) return;
    void withGuideStorage(() => guideStorage.setItem(visible.key, JSON.stringify(visible.value))).catch(() => undefined);
  }, [visible]);

  useEffect(() => {
    if (!remoteMetadata) return;
    const remote = readRemoteGuideState(remoteMetadata);
    if (!remote.enrolled && !Object.keys(remote.records).length) return;
    setSnapshot(current => {
      if (current?.key !== key || !current.storageAvailable) return current;
      return { ...current, value: { ...current.value, enrolled: current.value.enrolled || remote.enrolled,
        records: mergeGuideProgress(current.value.records, remote.records), pending: removeSyncedGuides(current.value.pending, remote.records) } };
    });
  }, [remoteMetadata, key]);

  useEffect(() => {
    if (!userId) return;
    const retrySync = () => setRetry(value => value + 1);
    const listener = AppState.addEventListener('change', next => { if (next === 'active') retrySync(); });
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('online', retrySync);
    return () => {
      listener.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('online', retrySync);
    };
  }, [userId]);

  useEffect(() => {
    const pending = visible?.value.pending;
    if (!userId || !pending || !Object.keys(pending).length) return;
    const host = resolveBackendUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
    const apikey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!host || !apikey) return;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 8_000);
    const send = setTimeout(() => {
      void (async () => {
        if (auth.current.key !== key || controller.signal.aborted) return;
        // Bind the request to this account's captured token, rather than a
        // mutable client session that may have changed during a sign-in.
        const token = await auth.current.getAccessToken();
        if (!token || auth.current.key !== key || controller.signal.aborted) return;
        const response = await fetch(`${host}/auth/v1/user`, {
          method: 'PUT', signal: controller.signal,
          headers: { apikey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: guideMetadataPatch(pending, visible.value.enrolled) }),
        });
        if (!response.ok || controller.signal.aborted) return;
        setSnapshot(current => current?.key === key ? {
          ...current, value: { ...current.value, pending: removeSyncedGuides(current.value.pending, pending) },
        } : current);
      })().catch(() => undefined).finally(() => clearTimeout(deadline));
    }, 250);
    return () => { clearTimeout(send); clearTimeout(deadline); controller.abort(); };
  }, [key, retry, userId, visible]);

  const finish = useCallback((guide: GuideDefinition, status: GuideStatus) => {
    setSnapshot(current => {
      if (current?.key !== key || (current.value.records[guide.id]?.version ?? 0) >= guide.version) return current;
      const entry = { [guide.id]: { version: guide.version, status, seenAt: Date.now() } };
      return { ...current, value: { ...current.value, records: { ...current.value.records, ...entry },
        pending: userId && current.storageAvailable ? { ...current.value.pending, ...entry } : current.value.pending } };
    });
  }, [key, userId]);

  return { key, ready: Boolean(visible?.storageAvailable), state: visible?.value ?? empty, finish };
}
