import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { initialState } from './data/mockStudyPacks';
import { StudyBoltState, StudyPack, StudyPlan, ThemePreference } from './models';
import { loadStudyBoltState, saveStudyBoltState } from './services/persistence';
import { AppColors, resolveColors } from './theme';

interface StudyBoltContextValue {
  state: StudyBoltState;
  colors: AppColors;
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  updateDeck: (deckId: string, updater: (deck: StudyPack) => StudyPack) => void;
  addDeck: (deck: StudyPack) => void;
  setPlan: (plan: StudyPlan) => void;
  setFocusMinutes: (minutes: number) => void;
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
      updateDeck: (deckId, updater) =>
        setState((current) => ({
          ...current,
          decks: current.decks.map((deck) => (deck.id === deckId ? updater(deck) : deck)),
        })),
      addDeck: (deck) => setState((current) => ({ ...current, decks: [deck, ...current.decks] })),
      setPlan: (plan) => setState((current) => ({ ...current, plan })),
      setFocusMinutes: (focusMinutes) => setState((current) => ({ ...current, focusMinutes })),
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
