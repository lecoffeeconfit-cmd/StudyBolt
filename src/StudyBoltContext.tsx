import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';

import { initialState } from './data/mockStudyPacks';
import type { ClassDisplayStyle, ExamAttempt, FlaggedItemInput, LibrarySort, QuizQuestionCount, RetentionMode, StudyBoltState, StudyClass, StudyEventInput, StudyPack, StudyPackMaterial, StudyPlan, ThemePreference } from './models';
import { getFlaggedItemId } from './models';
import { useAuth } from './AuthContext';
import { useAdminActivity } from './hooks/useAdminActivity';
import { useSeasonalThemeMonth } from './hooks/useSeasonalThemeMonth';
import { AUTOMATIC_STUDY_PACK_MATERIALS, generateStudyPackMaterial, STUDY_PACK_MATERIAL_LABELS, STUDY_PACK_MATERIAL_STAGES, StudyBoltProcessingError } from './services/documentProcessor';
import { loadGuestStudyLibrary, loadStudyBoltState, saveStudyBoltState } from './services/persistence';
import { copyGuestLibrary, guestPacksToSave, hasLibraryContentChanges, markLibraryEdit, updateClassAppearance } from './services/libraryData';
import { recordClassIconUse } from './data/classIcons';
import { useStudyLibrarySync, type LibrarySyncStatus } from './hooks/useStudyLibrarySync';
import { updateStudyBoltWidgets } from './services/widgets';
import { clearStudyBoltLocalAccountData } from './services/accountDeletionLocal';
import { clearStudyBoltAiResponseCache } from './services/aiRouter';
import { type AppColors, nextThemePreference, resolveColors, themeTogglePresentation } from './theme';

interface StudyBoltContextValue {
  state: StudyBoltState;
  colors: AppColors;
  hydrated: boolean;
  librarySyncStatus: LibrarySyncStatus;
  syncLibraryNow: () => void;
  guestPacksAvailable: number;
  saveGuestPacks: () => void;
  setTheme: (theme: ThemePreference) => void;
  cycleTheme: () => void;
  themeToggle: ReturnType<typeof themeTogglePresentation>;
  setRetentionMode: (mode: RetentionMode) => void;
  completeOnboarding: () => void;
  resetLocalData: (deletedUserId?: string) => Promise<void>;
  setQuizQuestionCount: (count: QuizQuestionCount) => void;
  setLibrarySort: (sort: LibrarySort) => void;
  setClassDisplayStyle: (style: ClassDisplayStyle) => void;
  addClass: (studyClass: StudyClass) => void;
  editClassAppearance: (course: StudyClass, appearance: Partial<Pick<StudyClass, 'iconId' | 'color'>>) => void;
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

export function StudyBoltProvider({ children, loadingColors, increaseContrast, onAppearanceReady }: {
  children: ReactNode;
  loadingColors: AppColors;
  increaseContrast: boolean;
  onAppearanceReady: (colors: AppColors) => void;
}) {
  const { getAccessToken, getDocumentAccessToken, user, recoveryMode } = useAuth();
  const documentAccess = useRef(getDocumentAccessToken);
  documentAccess.current = getDocumentAccessToken;
  const systemScheme = useColorScheme();
  const [state, setState] = useState<StudyBoltState>(initialState);
  const localMonth = useSeasonalThemeMonth(state.theme === 'neon');
  const [hydrated, setHydrated] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const colors = hydrated ? resolveColors(state.theme, systemScheme, localMonth, increaseContrast) : loadingColors;
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [guestLibrary, setGuestLibrary] = useState<StudyBoltState>();
  const activeMaterialJobs = useRef(new Set<string>());
  const runningDecks = useRef(new Set<string>());
  const materialQueues = useRef(new Map<string, StudyPackMaterial[]>());
  const deckSnapshots = useRef(new Map<string, StudyPack>());
  const generationEpoch = useRef(0);
  const stateRef = useRef(state);
  useAdminActivity(user?.id, state.activityEvents, hydrated);
  const { status: librarySyncStatus, syncNow: syncLibraryNow } = useStudyLibrarySync(
    recoveryMode ? undefined : user?.id, hydrated, state, setState, getAccessToken,
  );
  const guestPacksAvailable = guestLibrary ? guestPacksToSave(guestLibrary, state).length : 0;
  const saveGuestPacks = useCallback(() => {
    if (user && guestLibrary) setState(current => copyGuestLibrary(current, guestLibrary));
  }, [user, guestLibrary]);

  // Paint the launch backdrop with the restored palette before revealing the workspace.
  useLayoutEffect(() => {
    if (hydrated || loadFailed) onAppearanceReady(colors);
  }, [colors, hydrated, loadFailed, onAppearanceReady]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let mounted = true;
    setLoadFailed(false);
    setHydrated(false);
    Promise.all([
      loadStudyBoltState(user?.id),
      user?.id ? loadGuestStudyLibrary() : Promise.resolve(undefined),
    ]).then(([accountState, guestState]) => {
      if (!mounted) return;
      setGuestLibrary(guestState);
      // A permanent account automatically inherits all non-demo guest packs
      // and courses. The guest copy remains local as a recovery copy.
      setState(guestState ? copyGuestLibrary(accountState, guestState) : accountState);
      setHydrated(true);
    }).catch(() => { if (mounted) setLoadFailed(true); });
    return () => {
      mounted = false;
      generationEpoch.current += 1;
      materialQueues.current.clear();
      clearStudyBoltAiResponseCache();
    };
  }, [loadAttempt, user?.id]);

  useEffect(() => {
    if (hydrated) void saveStudyBoltState(state, user?.id);
  }, [hydrated, state, user?.id]);

  useEffect(() => {
    // Clear the previous account's widget snapshot while this one hydrates,
    // including the storage-error path where hydration cannot complete.
    updateStudyBoltWidgets(state);
  }, [hydrated, state]);

  const processNextStudyPackMaterial = useCallback((deckId: string) => {
    if (runningDecks.current.has(deckId)) return;
    const queue = materialQueues.current.get(deckId);
    if (!queue?.length) return;

    const material = queue.shift();
    if (!queue.length) materialQueues.current.delete(deckId);
    if (!material) return;

    const deck = stateRef.current.decks.find((item) => item.id === deckId) ?? deckSnapshots.current.get(deckId);
    if (!deck?.generation || !deck.processedSource) {
      processNextStudyPackMaterial(deckId);
      return;
    }

    const currentMaterial = deck.generation.materials[material];
    if (!currentMaterial || currentMaterial.status === 'ready') {
      processNextStudyPackMaterial(deckId);
      return;
    }

    const jobKey = `${deckId}:${material}`;
    const epoch = generationEpoch.current;
    if (activeMaterialJobs.current.has(jobKey)) return;
    activeMaterialJobs.current.add(jobKey);
    runningDecks.current.add(deckId);
    const updatedAt = new Date().toISOString();
    setState((current) => ({
      ...current,
      decks: current.decks.map((item) => item.id !== deckId || !item.generation || item.generation.materials[material]?.status === 'ready' ? item : {
        ...item,
        generation: {
          ...item.generation,
          materials: {
            ...item.generation.materials,
            [material]: { status: 'generating', stage: STUDY_PACK_MATERIAL_STAGES[material], updatedAt },
          },
        },
      }),
    }));

    void documentAccess.current()
      .then((accessToken) => epoch === generationEpoch.current ? generateStudyPackMaterial(deck, material, accessToken) : undefined)
      .then((generated) => {
        if (!generated || epoch !== generationEpoch.current) return;
        setState((current) => ({
          ...current,
          decks: current.decks.map((item) => item.id !== deckId || !item.generation || item.generation.materials[material]?.status === 'ready' ? item : markLibraryEdit({
            ...item,
            ...generated,
            generation: {
              ...item.generation,
              materials: {
                ...item.generation.materials,
                [material]: { status: 'ready', updatedAt: new Date().toISOString() },
              },
            },
          })),
        }));
      })
      .catch((reason: unknown) => {
        if (epoch !== generationEpoch.current) return;
        const error = reason instanceof StudyBoltProcessingError
          ? reason.userMessage
          : `${STUDY_PACK_MATERIAL_LABELS[material]} could not be created. Retry just this item.`;
        setState((current) => ({
          ...current,
          decks: current.decks.map((item) => item.id !== deckId || !item.generation || item.generation.materials[material]?.status === 'ready' ? item : markLibraryEdit({
            ...item,
            generation: {
              ...item.generation,
              materials: {
                ...item.generation.materials,
                [material]: { status: 'failed', error, updatedAt: new Date().toISOString() },
              },
            },
          })),
        }));
      })
      .finally(() => {
        if (epoch !== generationEpoch.current) return;
        activeMaterialJobs.current.delete(jobKey);
        runningDecks.current.delete(deckId);
        processNextStudyPackMaterial(deckId);
      });
  }, []);

  const enqueueStudyPackMaterial = useCallback((deck: StudyPack, material: StudyPackMaterial, prioritize = false) => {
    if (!deck.generation || !deck.processedSource) return;
    deckSnapshots.current.set(deck.id, deck);
    const jobKey = `${deck.id}:${material}`;
    const queue = materialQueues.current.get(deck.id) ?? [];
    if (activeMaterialJobs.current.has(jobKey) || queue.includes(material)) return;
    const currentDeck = stateRef.current.decks.find((item) => item.id === deck.id);
    if (currentDeck?.generation?.materials[material]?.status === 'ready') return;
    materialQueues.current.set(deck.id, prioritize ? [material, ...queue] : [...queue, material]);
    processNextStudyPackMaterial(deck.id);
  }, [processNextStudyPackMaterial]);

  const startStudyPackGeneration = useCallback((deck: StudyPack) => {
    if (!user || !deck.generation || !deck.processedSource) return;
    AUTOMATIC_STUDY_PACK_MATERIALS.forEach((material) => {
      const status = deck.generation?.materials[material]?.status;
      if (status === 'queued' || status === 'generating') enqueueStudyPackMaterial(deck, material);
    });
    processNextStudyPackMaterial(deck.id);
  }, [enqueueStudyPackMaterial, processNextStudyPackMaterial, user]);

  const retryStudyPackMaterial = useCallback((deckId: string, material: StudyPackMaterial) => {
    if (!user) return;
    const deck = stateRef.current.decks.find((item) => item.id === deckId) ?? deckSnapshots.current.get(deckId);
    if (!deck?.processedSource || !deck.generation) return;
    const status = deck.generation.materials[material]?.status;
    if (status === 'ready') return;
    if (status === 'failed') {
      setState((current) => ({
        ...current,
        decks: current.decks.map((item) => item.id !== deckId || !item.generation ? item : {
          ...item,
          generation: {
            ...item.generation,
            materials: {
              ...item.generation.materials,
              [material]: { status: 'queued', stage: STUDY_PACK_MATERIAL_STAGES[material], updatedAt: new Date().toISOString() },
            },
          },
        }),
      }));
    }
    enqueueStudyPackMaterial(deck, material, true);
  }, [enqueueStudyPackMaterial, user]);

  useEffect(() => {
    if (!hydrated || !user) return;
    state.decks.forEach((deck) => {
      if (deck.generation && deck.processedSource) startStudyPackGeneration(deck);
    });
  }, [hydrated, startStudyPackGeneration, state.decks, user]);

  const value = useMemo<StudyBoltContextValue>(
    () => ({
      state,
      hydrated,
      librarySyncStatus,
      syncLibraryNow,
      guestPacksAvailable,
      saveGuestPacks,
      colors,
      setTheme: (theme) => setState((current) => ({ ...current, theme })),
      cycleTheme: () => setState(current => ({ ...current, theme: nextThemePreference(current.theme, systemScheme) })),
      themeToggle: themeTogglePresentation(state.theme, systemScheme),
      setRetentionMode: (retentionMode) => setState((current) => ({ ...current, retentionMode })),
      completeOnboarding: () => setState((current) => ({ ...current, hasCompletedOnboarding: true })),
      resetLocalData: async (deletedUserId) => {
        generationEpoch.current += 1;
        materialQueues.current.clear();
        deckSnapshots.current.clear();
        activeMaterialJobs.current.clear();
        runningDecks.current.clear();
        const clean = { ...initialState, hasCompletedOnboarding: true };
        stateRef.current = clean;
        setState(clean);
        updateStudyBoltWidgets(clean);
        await clearStudyBoltLocalAccountData(deletedUserId);
      },
      setQuizQuestionCount: (quizQuestionCount) => setState((current) => ({ ...current, quizQuestionCount })),
      setLibrarySort: (librarySort) => setState((current) => ({ ...current, librarySort })),
      setClassDisplayStyle: (classDisplayStyle) => setState((current) => ({ ...current, classDisplayStyle })),
      addClass: (studyClass) =>
        setState((current) => ({
          ...current,
          classes: [markLibraryEdit(studyClass), ...current.classes.filter((item) => item.id !== studyClass.id)],
          recentClassIconIds: studyClass.iconId ? recordClassIconUse(current.recentClassIconIds, studyClass.iconId) : current.recentClassIconIds,
        })),
      editClassAppearance: (original, changes) => setState(current => {
        const course = current.classes.find(item => item.id === original.id) ?? original;
        const appearance = { iconId: course.iconId, color: course.color, ...changes };
        const classes = updateClassAppearance(current.classes, original, appearance);
        if (classes === current.classes) return current;
        return {
          ...current,
          classes,
          recentClassIconIds: changes.iconId ? recordClassIconUse(current.recentClassIconIds, changes.iconId) : current.recentClassIconIds,
        };
      }),
      updateDeck: (deckId, updater) =>
        setState((current) => ({
          ...current,
          decks: current.decks.map((deck) => {
            if (deck.id !== deckId) return deck;
            const updated = updater(deck);
            return hasLibraryContentChanges(deck, updated) ? markLibraryEdit(updated) : updated;
          }),
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
          decks: [markLibraryEdit(deck), ...current.decks],
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
    [colors, guestPacksAvailable, hydrated, librarySyncStatus, retryStudyPackMaterial, saveGuestPacks, startStudyPackGeneration, state, syncLibraryNow, systemScheme],
  );

  if (loadFailed) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 16, backgroundColor: colors.background }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Your saved study space couldn't be opened.</Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Your saved data has been kept. Try again, or contact support if this continues.</Text>
      <Pressable accessibilityRole="button" onPress={() => setLoadAttempt((attempt) => attempt + 1)} style={{ padding: 16, borderRadius: 16, backgroundColor: colors.primary }}><Text style={{ color: colors.primaryText, fontWeight: '700' }}>Try again</Text></Pressable>
    </View>;
  }
  return <StudyBoltContext.Provider value={value}>{children}</StudyBoltContext.Provider>;
}

export function useStudyBolt(): StudyBoltContextValue {
  const context = useContext(StudyBoltContext);
  if (!context) throw new Error('useStudyBolt must be used inside StudyBoltProvider');
  return context;
}
