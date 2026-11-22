import AsyncStorage from '@react-native-async-storage/async-storage';

export const guideStorage = AsyncStorage;
let storageWork: Promise<unknown> = Promise.resolve();

/** Keep guest transfer, preference edits, and local account cleanup ordered. */
export function withGuideStorage<T>(operation: () => Promise<T>) {
  const result = storageWork.then(operation);
  storageWork = result.catch(() => undefined);
  return result;
}
