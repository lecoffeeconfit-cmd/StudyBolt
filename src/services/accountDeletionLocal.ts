import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import BackgroundPlayback from '../../modules/studybolt-background-playback';
import { studyBoltLocalAccountKeys } from './accountDeletionClient';
import { clearAdminActivityForDeletion } from './adminActivity';
import { flushStudyBoltStateWrites } from './persistence';

/** Remove only StudyBolt's namespace and this app's private cache, never other apps or source files. */
export async function clearStudyBoltLocalAccountData(userId?: string): Promise<void> {
  const errors: unknown[] = [];
  if (userId) await clearAdminActivityForDeletion(userId).catch((error) => { errors.push(error); });
  await flushStudyBoltStateWrites();
  await Speech.stop().catch(() => undefined);
  await BackgroundPlayback?.stop().catch(() => undefined);
  if (Platform.OS !== 'web') {
    await Notifications.cancelAllScheduledNotificationsAsync().catch((error) => { errors.push(error); });
    const cache = FileSystem.cacheDirectory;
    if (cache) {
      await FileSystem.readDirectoryAsync(cache).then(async (entries) => {
        const results = await Promise.allSettled(entries.map((name) => FileSystem.deleteAsync(cache + name, { idempotent: true })));
        if (results.some((result) => result.status === 'rejected')) errors.push(new Error('cache_cleanup_failed'));
      }).catch((error) => { errors.push(error); });
    }
  }
  const legacyOwner = userId ? await AsyncStorage.getItem('@studybolt/state/legacy-owner') : undefined;
  const keys = studyBoltLocalAccountKeys(await AsyncStorage.getAllKeys(), userId, legacyOwner);
  if (keys.length) await AsyncStorage.multiRemove(keys);
  if (errors.length) throw new Error('Some local files or reminders could not be cleared.');
}
