import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { initialState } from './data/mockStudyPacks';
import type { ExamAttempt, FlaggedItemInput, LibrarySort, QuizQuestionCount, RetentionMode, StudyBoltState, StudyClass, StudyEventInput, StudyPack, StudyPackMaterial, StudyPlan, ThemePreference } from './models';
import { getFlaggedItemId } from './models';
import { useAuth } from './AuthContext';
import { AUTOMATIC_STUDY_PACK_MATERIALS, generateStudyPackMaterial, STUDY_PACK_MATERIAL_LABELS, STUDY_PACK_MATERIAL_STAGES, StudyBoltProcessingError } from './services/documentProcessor';
import { loadStudyBoltState, saveStudyBoltState } from './services/persistence';
import { updateStudyBoltWidgets } from './services/widgets';
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
  startStudyPackGeneration: (deck: StudyPack) => void;
  retryStudyPackMaterial: (deckId: string, material: StudyPackMaterial) => void;
}

const StudyBoltContext = createContext<StudyBoltContextValue | null>(null);

export function StudyBoltProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const systemScheme = useColorScheme();
  const [state, setState] = useState<StudyBoltState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const activeMaterialJobs = useRef(new Set<string>());

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

  useEffect(() => {
    if (hydrated) updateStudyBoltWidgets(state);
  }, [hydrated, state]);

  const runMaterialJob = useCallback((deck: StudyPack, material: StudyPackMaterial) => {
    const jobKey = `${deck.id}:${material}`;
    if (activeMaterialJobs.current.has(jobKey)) return;
    activeMaterialJobs.current.add(jobKey);
    const updatedAt = new Date().toISOString();
    setState((current) => ({
      ...current,
      decks: current.decks.map((item) => item.id !== deck.id ? item : {
        ...item,
        generation: item.generation ? {
          ...item.generation,
          materials: {
            ...item.generation.materials,
            [material]: { status: 'generating', stage: STUDY_PACK_MATERIAL_STAGES[material], updatedAt },
          },
        } : item.generation,
      }),
    }));
    void getAccessToken()
      .catch(() => null)
      .then((accessToken) => generateStudyPackMaterial(deck, material, accessToken))
      .then((generated) => {
        setState((current) => ({
          ...current,
          decks: current.decks.map((item) => item.id !== deck.id ? item : {
            ...item,
            ...generated,
            generation: item.generation ? {
              ...item.generation,
              materials: {
                ...item.generation.materials,
                [material]: { status: 'ready', updatedAt: new Date().toISOString() },
              },
            } : item.generation,
          }),
        }));
      })
      .catch((reason: unknown) => {
        const error = reason instanceof StudyBoltProcessingError
          ? reason.userMessage
          : `${STUDY_PACK_MATERIAL_LABELS[material]} could not be created. Retry just this item.`;
        setState((current) => ({
          ...current,
          decks: current.decks.map((item) => item.id !== deck.id ? item : {
            ...item,
            generation: item.generation ? {
              ...item.generation,
              materials: {
                ...item.generation.materials,
                [material]: { status: 'failed', error, updatedAt: new Date().toISOString() },
              },
            } : item.generation,
          }),
        }));
      })
      .finally(() => activeMaterialJobs.current.delete(jobKey));
  }, [getAccessToken]);

  const startStudyPackGeneration = useCallback((deck: StudyPack) => {
    if (!deck.generation || !deck.processedSource) return;
    AUTOMATIC_STUDY_PACK_MATERIALS.forEach((material) => {
      const status = deck.generation?.materials[material].status;
      if (status === 'queued' || status === 'generating') runMaterialJob(deck, material);
    });
  }, [runMaterialJob]);

  const retryStudyPackMaterial = useCallback((deckId: string, material: StudyPackMaterial) => {
    const deck = state.decks.find((item) => item.id === deckId);
    if (!deck?.processedSource || !deck.generation) return;
    runMaterialJob(deck, material);
  }, [runMaterialJob, state.decks]);

  useEffect(() => {
    if (!hydrated) return;
    state.decks.forEach((deck) => {
      if (deck.generation && deck.processedSource) startStudyPackGeneration(deck);
    });
  }, [hydrated, startStudyPackGeneration, state.decks]);

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
        decks: attempt.status !== 'completed' ? current.decks : current.decks.map((deck) => {
          if (!attempt.sourceDeckIds.includes(deck.id)) return deck;
          const conceptResults = attempt.conceptResults?.filter((result) => result.sourceDeckId === deck.id) ?? [];
          const deckScore = conceptResults.length
            ? Math.round(conceptResults.reduce((sum, result) => sum + result.score * result.evidenceCount, 0) / conceptResults.reduce((sum, result) => sum + result.evidenceCount, 0))
            : attempt.score;
          return { ...deck, testAttempts: [...(deck.testAttempts ?? []), deckScore] };
        }),
        conceptMastery: attempt.status !== 'completed' ? current.conceptMastery ?? [] : (attempt.conceptResults ?? []).reduce((records, result) => {
          const question = attempt.questions.find((item) => item.conceptId === result.conceptId);
          const existing = records.find((item) => item.conceptId === result.conceptId);
          const next = {
            conceptId: result.conceptId,
            title: result.title,
            sourceDeckId: result.sourceDeckId,
            sourceSectionId: question?.source.sectionId ?? existing?.sourceSectionId ?? result.sourceLabel,
            mastery: result.masteryAfter,
            evidenceCount: (existing?.evidenceCount ?? 0) + result.evidenceCount,
            correctStreak: result.score >= 80 ? (existing?.correctStreak ?? 0) + 1 : 0,
            lastAnsweredAt: attempt.completedAt ?? attempt.createdAt,
            lastDifficulty: question?.difficulty ?? existing?.lastDifficulty ?? 'medium' as const,
            lastQuestionType: question?.type ?? existing?.lastQuestionType ?? 'multiple-choice' as const,
          };
          return [...records.filter((item) => item.conceptId !== result.conceptId), next];
        }, [...(current.conceptMastery ?? [])]),
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
      startStudyPackGeneration,
      retryStudyPackMaterial,
    }),
    [hydrated, retryStudyPackMaterial, startStudyPackGeneration, state, systemScheme],
  );

  return <StudyBoltContext.Provider value={value}>{children}</StudyBoltContext.Provider>;
}

export function useStudyBolt(): StudyBoltContextValue {
  const context = useContext(StudyBoltContext);
  if (!context) throw new Error('useStudyBolt must be used inside StudyBoltProvider');
  return context;
}
