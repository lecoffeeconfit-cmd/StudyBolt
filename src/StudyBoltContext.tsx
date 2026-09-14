import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { initialState } from './data/mockStudyPacks';
import type { ExamAttempt, FlaggedItemInput, LibrarySort, QuizQuestionCount, RetentionMode, StudyBoltState, StudyClass, StudyEventInput, StudyPack, StudyPlan, ThemePreference } from './models';
import { getFlaggedItemId } from './models';
import { loadStudyBoltState, saveStudyBoltState } from './services/persistence';
import { AppColors, resolveColors } from './theme';

interface StudyBoltContextValue {
  state: StudyBoltState;
  colors: AppColors;
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setRetentionMode: (mode: RetentionMode) => void;
  completeOnboarding: () => void;
  resetLocalData: () => void;
  setQuizQuestionCount: (count: QuizQuestionCount) => void;
  setLibrarySort: (sort: LibrarySort) => void;
  addClass: (studyClass: StudyClass) => void;
  updateDeck: (deckId: string, updater: (deck: StudyPack) => StudyPack) => void;
  addDeck: (deck: StudyPack) => void;
  setPlan: (plan: StudyPlan) => void;
  setFocusMinutes: (minutes: number) => void;
  recordStudyEvent: (event: StudyEventInput) => void;
  saveExamAttempt: (attempt: ExamAttempt) => void;
  toggleFlag: (item: FlaggedItemInput) => void;
  removeFlag: (flagId: string) => void;
  isFlagged: (flagId: string) => boolean;
}

const StudyBoltContext = createContext<StudyBoltContextValue | null>(null);

export function StudyBoltProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [state, setState] = useState<StudyBoltState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadStudyBoltState().then((loaded) => {
      if (mounted) {
        setState(loaded);
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void saveStudyBoltState(state);
  }, [hydrated, state]);

  const value = useMemo<StudyBoltContextValue>(
    () => ({
      state,
      hydrated,
      colors: resolveColors(state.theme, systemScheme),
      setTheme: (theme) => setState((current) => ({ ...current, theme })),
      setRetentionMode: (retentionMode) => setState((current) => ({ ...current, retentionMode })),
      completeOnboarding: () => setState((current) => ({ ...current, hasCompletedOnboarding: true })),
      resetLocalData: () => setState({ ...initialState, hasCompletedOnboarding: true }),
      setQuizQuestionCount: (quizQuestionCount) => setState((current) => ({ ...current, quizQuestionCount })),
      setLibrarySort: (librarySort) => setState((current) => ({ ...current, librarySort })),
      addClass: (studyClass) =>
        setState((current) => ({
          ...current,
          classes: [studyClass, ...current.classes.filter((item) => item.id !== studyClass.id)],
        })),
      updateDeck: (deckId, updater) =>
        setState((current) => ({
          ...current,
          decks: current.decks.map((deck) => (deck.id === deckId ? updater(deck) : deck)),
        })),
      addDeck: (deck) =>
        setState((current) => ({
          ...current,
          classes: current.classes.some((studyClass) => studyClass.id === deck.courseId)
            ? current.classes
            : [
                ...current.classes,
                { id: deck.courseId, name: deck.courseName, emoji: deck.emoji, color: deck.color, createdAt: deck.createdAt },
              ],
          decks: [deck, ...current.decks],
          activityEvents: [
            ...current.activityEvents,
            {
              id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'pack-created' as const,
              occurredAt: new Date().toISOString(),
              deckId: deck.id,
              courseId: deck.courseId,
            },
          ],
        })),
      setPlan: (plan) => setState((current) => ({ ...current, plan })),
      setFocusMinutes: (focusMinutes) => setState((current) => ({ ...current, focusMinutes })),
      recordStudyEvent: (event) => setState((current) => ({
        ...current,
        activityEvents: [
          ...current.activityEvents,
          {
            ...event,
            id: event.id ?? `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            occurredAt: event.occurredAt ?? new Date().toISOString(),
          },
        ].slice(-1500),
      })),
      saveExamAttempt: (attempt) => setState((current) => ({
        ...current,
        examAttempts: [...(current.examAttempts ?? []), attempt].slice(-100),
      })),
      toggleFlag: (item) => setState((current) => {
        const id = item.id ?? getFlaggedItemId(item.deckId, item.kind, item.itemId);
        const alreadyFlagged = current.flaggedItems.some((flag) => flag.id === id);
        return {
          ...current,
          flaggedItems: alreadyFlagged
            ? current.flaggedItems.filter((flag) => flag.id !== id)
            : [...current.flaggedItems, { ...item, id, flaggedAt: new Date().toISOString() }],
        };
      }),
      removeFlag: (flagId) => setState((current) => ({
        ...current,
        flaggedItems: current.flaggedItems.filter((flag) => flag.id !== flagId),
      })),
      isFlagged: (flagId) => state.flaggedItems.some((flag) => flag.id === flagId),
    }),
    [hydrated, state, systemScheme],
  );

  return <StudyBoltContext.Provider value={value}>{children}</StudyBoltContext.Provider>;
}

export function useStudyBolt(): StudyBoltContextValue {
  const context = useContext(StudyBoltContext);
  if (!context) throw new Error('useStudyBolt must be used inside StudyBoltProvider');
  return context;
}
