import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { useAuth } from '../AuthContext';
import { BottomTabs } from '../components/BottomTabs';
import type { MainTab } from '../components/BottomTabs';
import { useStudyBolt } from '../StudyBoltContext';
import { AccountScreen } from '../screens/AccountScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { LegalScreen } from '../screens/LegalScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PlannerScreen } from '../screens/PlannerScreen';
import { ProcessingScreen } from '../screens/ProcessingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { StudyPackScreen } from '../screens/StudyPackScreen';
import { combineStudyPacks } from '../services/studyPack';
import type { StudyPack, StudyTool } from '../models';
import type { Route } from './routes';

export function StudyBoltNavigator() {
  const { colors, state, addDeck, completeOnboarding, hydrated } = useStudyBolt();
  const { loading: authLoading, recoveryMode, user } = useAuth();
  const [tab, setTab] = useState<MainTab>('home');
  const [route, setRoute] = useState<Route>({ type: 'main' });

  const openDeck = useCallback((deck: StudyPack, tool?: StudyTool) => {
    setRoute({ type: 'deck', deckId: deck.id, tool });
  }, []);

  const openSample = useCallback(() => {
    const sample = state.decks.find((deck) => deck.id === 'biology-cells') ?? state.decks[0];
    if (sample) openDeck(sample);
  }, [openDeck, state.decks]);

  const completeProcessing = useCallback((deck: StudyPack) => {
    addDeck(deck);
    setRoute({ type: 'deck', deckId: deck.id });
  }, [addDeck]);

  const finishOnboarding = useCallback(() => {
    const replayingTour = route.type === 'onboarding';
    completeOnboarding();
    setRoute({ type: replayingTour ? 'main' : 'auth' });
  }, [completeOnboarding, route.type]);

  const trySampleFromOnboarding = useCallback(() => {
    completeOnboarding();
    openSample();
  }, [completeOnboarding, openSample]);

  const createReview = useCallback((deckIds: string[]) => {
    const sourceDecks = state.decks.filter((deck) => deckIds.includes(deck.id)).sort((a, b) => a.order - b.order);
    if (sourceDecks.length < 2) return;
    const review = combineStudyPacks(sourceDecks);
    addDeck(review);
    setRoute({ type: 'deck', deckId: review.id });
  }, [addDeck, state.decks]);

  useEffect(() => {
    if (recoveryMode) setRoute({ type: 'reset-password' });
  }, [recoveryMode]);

  useEffect(() => {
    if (user && route.type === 'auth' && !recoveryMode) setRoute({ type: 'main' });
  }, [recoveryMode, route.type, user]);

  const mainScreen = useMemo(() => {
    if (tab === 'library') return <LibraryScreen onOpenDeck={openDeck} onCreateReview={createReview} />;
    if (tab === 'planner') return <PlannerScreen />;
    if (tab === 'stats') return <StatsScreen />;
    if (tab === 'profile') {
      return (
        <ProfileScreen
          onOpenOnboarding={() => setRoute({ type: 'onboarding' })}
          onOpenAuth={() => setRoute({ type: 'auth' })}
          onManageAccount={() => setRoute({ type: 'account' })}
          onOpenLegal={() => setRoute({ type: 'legal' })}
        />
      );
    }
    return <HomeScreen onOpenDeck={openDeck} onImport={(asset) => setRoute({ type: 'processing', asset })} />;
  }, [createReview, openDeck, tab]);

  if (!hydrated || authLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const showOnboarding = !recoveryMode && (route.type === 'onboarding' || !state.hasCompletedOnboarding);

  return (
    <View style={[styles.app, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      {showOnboarding ? <OnboardingScreen onComplete={finishOnboarding} onTrySample={trySampleFromOnboarding} /> : null}
      {!showOnboarding && route.type === 'auth' ? (
        <LoginScreen onAuthenticated={() => setRoute({ type: 'main' })} onContinueAsGuest={() => setRoute({ type: 'main' })} />
      ) : null}
      {!showOnboarding && route.type === 'account' ? (
        <AccountScreen
          onBack={() => setRoute({ type: 'main' })}
          onSignedOut={() => setRoute({ type: 'auth' })}
          onDeleted={() => setRoute({ type: 'auth' })}
        />
      ) : null}
      {!showOnboarding && route.type === 'legal' ? <LegalScreen onBack={() => setRoute({ type: 'main' })} /> : null}
      {!showOnboarding && route.type === 'reset-password' ? <ResetPasswordScreen onComplete={() => setRoute({ type: 'main' })} /> : null}
      {!showOnboarding && route.type === 'main' ? (
        <>
          {mainScreen}
          <BottomTabs active={tab} onChange={setTab} />
        </>
      ) : null}
      {!showOnboarding && route.type === 'deck' ? (
        <StudyPackScreen
          deckId={route.deckId}
          initialTool={route.tool}
          onBack={() => setRoute({ type: 'main' })}
          onPlan={() => {
            setTab('planner');
            setRoute({ type: 'main' });
          }}
        />
      ) : null}
      {!showOnboarding && route.type === 'processing' ? (
        <ProcessingScreen asset={route.asset} onCancel={() => setRoute({ type: 'main' })} onSuccess={completeProcessing} onTrySample={openSample} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : undefined,
    alignSelf: 'center',
  },
});
