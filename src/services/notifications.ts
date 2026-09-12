import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { StudyPlan } from '../models';

const REMINDER_IDS_KEY = '@studybolt/study-reminder-ids/v1';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function cancelSavedReminders(): Promise<void> {
  const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
  let identifiers: string[] = [];
  try {
    identifiers = raw ? JSON.parse(raw) as string[] : [];
  } catch {
    identifiers = [];
  }
  await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined)));
  await AsyncStorage.removeItem(REMINDER_IDS_KEY);
}

export async function disableStudyReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelSavedReminders();
  } catch {
    // The saved preference can still be turned off if the OS scheduler is unavailable.
  }
}

export async function scheduleStudyPlanReminders(
  plan: StudyPlan,
  subject: string,
): Promise<{ scheduled: number; error?: string }> {
  if (Platform.OS === 'web') {
    return { scheduled: 0, error: 'Study reminders are available in the iOS and Android app.' };
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('study-plan', {
        name: 'Study plan',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const permission = await Notifications.getPermissionsAsync();
    const finalStatus = permission.status === 'granted'
      ? permission.status
      : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') {
      return { scheduled: 0, error: 'Notifications are off. You can enable them in your device settings.' };
    }

    await cancelSavedReminders();
    const identifiers: string[] = [];
    const now = new Date();

    for (const [index, day] of plan.days.entries()) {
      if (!day.blocks.length || day.complete) continue;
      const date = new Date(now);
      date.setDate(now.getDate() + index);
      date.setHours(18, 0, 0, 0);
      if (index === 0 && date.getTime() <= now.getTime()) date.setTime(now.getTime() + 2 * 60 * 1000);
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: index === plan.days.length - 1 ? `Ready for your ${subject} check?` : `A small step toward ${subject}`,
          body: `${day.minutes} min · ${day.blocks.map((block) => block.label).join(' + ')}`,
          data: { studyBolt: true, dayId: day.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: Platform.OS === 'android' ? 'study-plan' : undefined,
        },
      });
      identifiers.push(identifier);
    }

    await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(identifiers));
    return { scheduled: identifiers.length };
  } catch {
    return { scheduled: 0, error: 'StudyBolt could not schedule reminders on this device.' };
  }
}
