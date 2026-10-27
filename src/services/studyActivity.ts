import type { StudyEvent } from '../models';

const STUDY_EVENT_TYPES = new Set<StudyEvent['type']>([
  'note-review',
  'flashcard-review',
  'quiz',
  'audio',
  'focus',
]);

export function getStudyEventMinutes(event: StudyEvent): number {
  if (!STUDY_EVENT_TYPES.has(event.type) || !Number.isFinite(event.durationMinutes)) return 0;
  return Math.max(0, event.durationMinutes ?? 0);
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatStudyDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  return hours ? `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}` : `${remainingMinutes}m`;
}

export function getStudyActivitySummary(events: StudyEvent[], now = new Date()) {
  const nowTime = now.getTime();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const trackedEvents = events.filter((event) => {
    const occurredAt = Date.parse(event.occurredAt);
    return Number.isFinite(occurredAt)
      && occurredAt <= nowTime
      && getStudyEventMinutes(event) > 0;
  });

  const weekStartTime = weekStart.getTime();
  let weekMinutes = 0;
  const classMinutes = new Map<string, number>();
  const activeDays = new Set<string>();

  trackedEvents.forEach((event) => {
    const occurredAt = Date.parse(event.occurredAt);
    const day = localDayKey(new Date(occurredAt));
    activeDays.add(day);
    if (occurredAt >= weekStartTime) weekMinutes += event.durationMinutes ?? 0;
    if (event.courseId) {
      classMinutes.set(event.courseId, (classMinutes.get(event.courseId) ?? 0) + (event.durationMinutes ?? 0));
    }
  });

  let streakDays = 0;
  const firstStreakOffset = activeDays.has(localDayKey(today)) ? 0 : 1;
  for (let offset = firstStreakOffset; offset < 365; offset += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    if (!activeDays.has(localDayKey(day))) break;
    streakDays += 1;
  }

  return {
    weekMinutes,
    streakDays,
    studiedToday: activeDays.has(localDayKey(today)),
    classMinutes,
  };
}
