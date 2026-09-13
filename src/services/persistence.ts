import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FlaggedItem, LibrarySort, QuizQuestionCount, RetentionMode, StudyBoltState, StudyClass, StudyPack, StudyPlan } from '../models';
import { initialState } from '../data/mockStudyPacks';
import { ensureDistinctNoteLayers } from './noteLayers';

const STORAGE_KEY = '@studybolt/state/v1';
const QUIZ_COUNTS: QuizQuestionCount[] = [10, 15, 20];
const LIBRARY_SORTS: LibrarySort[] = ['default', 'recent', 'oldest', 'alphabetical'];

function isFlaggedItem(value: unknown): value is FlaggedItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FlaggedItem>;
  return typeof item.id === 'string'
    && typeof item.deckId === 'string'
    && typeof item.deckTitle === 'string'
    && typeof item.courseId === 'string'
    && typeof item.courseName === 'string'
    && (item.kind === 'note' || item.kind === 'flashcard' || item.kind === 'quiz')
    && typeof item.itemId === 'string'
    && typeof item.title === 'string'
    && typeof item.prompt === 'string'
    && typeof item.answer === 'string'
    && typeof item.flaggedAt === 'string'
    && Boolean(item.source && typeof item.source.sectionId === 'string' && typeof item.source.label === 'string');
}

function isCurrentPlan(plan: unknown): plan is StudyPlan {
  if (!plan || typeof plan !== 'object') return false;
  const candidate = plan as Partial<StudyPlan>;
  return typeof candidate.durationDays === 'number'
    && candidate.durationDays >= 1
    && candidate.durationDays <= 90
    && Boolean(candidate.scope?.type && candidate.scope.id)
    && Array.isArray(candidate.modalities)
    && QUIZ_COUNTS.includes(candidate.quizQuestionCount as QuizQuestionCount)
    && Array.isArray(candidate.days)
    && candidate.days.every((day) => Array.isArray(day.blocks)
      && day.blocks.every((block) => Boolean(block.id && block.modality) && typeof block.complete === 'boolean'));
}

function classesFromDecks(decks: StudyPack[]): StudyClass[] {
  const seen = new Set<string>();
  return decks.reduce<StudyClass[]>((classes, deck) => {
    if (seen.has(deck.courseId)) return classes;
    seen.add(deck.courseId);
    classes.push({
      id: deck.courseId,
      name: deck.courseName,
      emoji: deck.emoji,
      color: deck.color,
      createdAt: deck.createdAt,
    });
    return classes;
  }, []);
}

function withPlanDates(plan: StudyPlan): StudyPlan {
  if (plan.createdAt && plan.targetDate && plan.days.every((day) => day.date)) return plan;
  const createdAt = plan.createdAt ? new Date(plan.createdAt) : new Date();
  const targetDate = plan.targetDate ? new Date(plan.targetDate) : new Date(createdAt);
  if (!plan.targetDate) {
    targetDate.setDate(targetDate.getDate() + plan.durationDays - 1);
    targetDate.setHours(23, 59, 59, 999);
  }
  return {
    ...plan,
    createdAt: createdAt.toISOString(),
    targetDate: targetDate.toISOString(),
    days: plan.days.map((day, index) => {
      if (day.date) return day;
      const date = new Date(createdAt);
      date.setDate(date.getDate() + index);
      return { ...day, date: date.toISOString() };
    }),
  };
}

export async function loadStudyBoltState(): Promise<StudyBoltState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<StudyBoltState>;
    if (!Array.isArray(parsed.decks)) return initialState;
    const storedRetentionMode = (parsed as unknown as { retentionMode?: RetentionMode | 'personalized' }).retentionMode;
    const decks = (parsed.decks as Array<StudyPack & { detailedNotes?: StudyPack['detailedNotes'] }>).map((deck) => ({
      ...deck,
      detailedNotes: ensureDistinctNoteLayers(deck.notes, deck.detailedNotes, deck.originalText, deck.outline),
    }));
    const classes = Array.isArray(parsed.classes) ? (parsed.classes as StudyClass[]) : classesFromDecks(decks);
    return {
      ...initialState,
      ...parsed,
      classes,
      decks,
      flaggedItems: Array.isArray(parsed.flaggedItems) ? parsed.flaggedItems.filter(isFlaggedItem) : [],
      librarySort: LIBRARY_SORTS.includes(parsed.librarySort as LibrarySort)
        ? parsed.librarySort as LibrarySort
        : initialState.librarySort,
      quizQuestionCount: QUIZ_COUNTS.includes(parsed.quizQuestionCount as QuizQuestionCount)
        ? parsed.quizQuestionCount as QuizQuestionCount
        : initialState.quizQuestionCount,
      retentionMode: storedRetentionMode === 'personalized' || storedRetentionMode === 'fsrs'
        ? 'fsrs'
        : storedRetentionMode === 'sm2' ? 'sm2' : 'standard',
      plan: withPlanDates(isCurrentPlan(parsed.plan) ? parsed.plan : initialState.plan),
      activityEvents: Array.isArray(parsed.activityEvents) && parsed.activityEvents.length > 0
        ? parsed.activityEvents
        : decks.every((deck) => deck.fileType === 'demo') ? initialState.activityEvents : [],
      dailyStudyGoalMinutes: typeof parsed.dailyStudyGoalMinutes === 'number' ? parsed.dailyStudyGoalMinutes : initialState.dailyStudyGoalMinutes,
    };
  } catch {
    return initialState;
  }
}

export async function saveStudyBoltState(state: StudyBoltState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local study data remains in memory if device storage is temporarily unavailable.
  }
}
