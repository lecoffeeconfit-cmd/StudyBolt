import AsyncStorage from '@react-native-async-storage/async-storage';

import type { QuizQuestionCount, StudyBoltState, StudyClass, StudyPack, StudyPlan } from '../models';
import { initialState } from '../data/mockStudyPacks';

const STORAGE_KEY = '@studybolt/state/v1';
const QUIZ_COUNTS: QuizQuestionCount[] = [10, 15, 20];

function isCurrentPlan(plan: unknown): plan is StudyPlan {
  if (!plan || typeof plan !== 'object') return false;
  const candidate = plan as Partial<StudyPlan>;
  return [1, 3, 7, 14].includes(candidate.durationDays ?? 0)
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

export async function loadStudyBoltState(): Promise<StudyBoltState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<StudyBoltState>;
    if (!Array.isArray(parsed.decks)) return initialState;
    const decks = parsed.decks as StudyPack[];
    const classes = Array.isArray(parsed.classes) ? (parsed.classes as StudyClass[]) : classesFromDecks(decks);
    return {
      ...initialState,
      ...parsed,
      classes,
      decks,
      quizQuestionCount: QUIZ_COUNTS.includes(parsed.quizQuestionCount as QuizQuestionCount)
        ? parsed.quizQuestionCount as QuizQuestionCount
        : initialState.quizQuestionCount,
      plan: isCurrentPlan(parsed.plan) ? parsed.plan : initialState.plan,
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
