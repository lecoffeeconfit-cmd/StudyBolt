export interface AccountStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const LEGACY_STUDY_STATE_KEY = '@studybolt/state/v1';
const STATE_PREFIX = '@studybolt/state/v2/';
const LEGACY_OWNER_KEY = '@studybolt/state/legacy-owner';

export function studyStateKey(userId?: string | null): string {
  return `${STATE_PREFIX}${userId ? `account/${encodeURIComponent(userId)}` : 'guest'}`;
}

/** Serialize migration and writes across account changes, including slow storage. */
export function createAccountStateStorage(storage: AccountStorage) {
  let pending: Promise<unknown> = Promise.resolve();
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work);
    pending = result.catch(() => undefined);
    return result;
  }
  return {
    read: (userId?: string | null) => enqueue(async () => {
      const key = studyStateKey(userId);
      const saved = await storage.getItem(key);
      if (saved !== null) return saved;
      // The pre-upgrade device library has no owner metadata. Preserve it once
      // for the session present at first launch; never import it into a second
      // account. Auth hydration must finish before this migration runs.
      const legacy = await storage.getItem(LEGACY_STUDY_STATE_KEY);
      if (legacy === null) return null;
      const legacyOwner = await storage.getItem(LEGACY_OWNER_KEY);
      if (legacyOwner !== null && legacyOwner !== key) return null;
      if (legacyOwner === null) await storage.setItem(LEGACY_OWNER_KEY, key);
      await storage.setItem(key, legacy);
      // Ownership remains recorded if removal fails, preventing a second
      // account from importing an old copy after a device storage failure.
      try {
        await storage.removeItem(LEGACY_STUDY_STATE_KEY);
        await storage.removeItem(LEGACY_OWNER_KEY);
      } catch { /* Keep ownership while an old copy may still exist. */ }
      return legacy;
    }),
    write: (serialized: string, userId?: string | null) => {
      const key = studyStateKey(userId);
      return enqueue(() => storage.setItem(key, serialized));
    },
    flush: async () => { await pending; },
  };
}

