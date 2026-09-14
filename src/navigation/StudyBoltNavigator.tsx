import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';

import { useAuth } from '../AuthContext';
import { BottomTabs } from '../components/BottomTabs';
import type { MainTab } from '../components/BottomTabs';
import { useStudyBolt } from '../StudyBoltContext';
import { AccountScreen } from '../screens/AccountScreen';
import { CommunityClassScreen } from '../screens/CommunityClassScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { ExamModeScreen } from '../screens/ExamModeScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { LegalScreen } from '../screens/LegalScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MistakeNotebookScreen } from '../screens/MistakeNotebookScreen';
import { FlaggedReviewScreen } from '../screens/FlaggedReviewScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PlannerScreen } from '../screens/PlannerScreen';
import { ProcessingScreen } from '../screens/ProcessingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { StudyPackScreen } from '../screens/StudyPackScreen';
import { SharedStudyPackScreen } from '../screens/SharedStudyPackScreen';
import { SmartStudyScreen } from '../screens/SmartStudyScreen';
import { combineStudyPacks } from '../services/studyPack';
import { parseShareToken } from '../services/sharing';
import type { StudyPack, StudyTool } from '../models';
import type { Route } from './routes';

export function StudyBoltNavigator() {
  const { colors, state, addDeck, completeOnboarding, hydrated } = useStudyBolt();
  const { loading: authLoading, recoveryMode, user } = useAuth();
  const [tab, setTab] = useState<MainTab>('home');
  const [route, setRoute] = useState<Route>({ type: 'main' });
  const [plannerFocusDeckId, setPlannerFocusDeckId] = useState<string>();
  const [pendingSharedToken, setPendingSharedToken] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState<Route | null>(null);

  const openDeck = useCallback((deck: StudyPack, tool?: StudyTool) => {
    setRoute({ type: 'deck', deckId: deck.id, tool });
  }, []);

  const openSample = useCallback(() => {
    const sample = state.decks.find((deck) => deck.id === 'biology-cells') ?? state.decks[0];
    if (sample) openDeck(sample);
  }, [openDeck, state.decks]);

  const openFlagged = useCallback(() => setRoute({ type: 'flagged' }), []);

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
    let mounted = true;
    const handleUrl = (url: string) => {
      const token = parseShareToken(url);
      if (mounted && token) setRoute({ type: 'shared', token });
    };
    const initialUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? Promise.resolve(window.location.href)
      : Linking.getInitialURL();
    void initialUrl.then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (user && route.type === 'auth' && !recoveryMode) {
      setRoute(pendingRoute ?? (pendingSharedToken ? { type: 'shared', token: pendingSharedToken } : { type: 'main' }));
      setPendingSharedToken(null);
      setPendingRoute(null);
    }
  }, [pendingRoute, pendingSharedToken, recoveryMode, route.type, user]);

  const mainScreen = useMemo(() => {
    if (tab === 'library') {
      return (
        <LibraryScreen
          onOpenDeck={openDeck}
          onCreateReview={createReview}
          onOpenFlagged={openFlagged}
          onImport={(asset, studyClass) => setRoute({ type: 'processing', asset, courseId: studyClass.id, courseName: studyClass.name })}
        />
      );
    }
    if (tab === 'planner') return <PlannerScreen focusDeckId={plannerFocusDeckId} onFocusApplied={() => setPlannerFocusDeckId(undefined)} />;
    if (tab === 'discover') {
      return (
        <DiscoverScreen
          onPreviewSet={(token) => setRoute({ type: 'shared', token })}
          onOpenClass={(classId) => setRoute({ type: 'community-class', classId })}
          onOpenDeck={openDeck}
        />
      );
    }
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
    return (
      <HomeScreen
        onOpenDeck={openDeck}
        onImport={(asset) => setRoute({ type: 'processing', asset })}
        onStartStudy={(mode) => setRoute({ type: 'smart-study', mode })}
        onOpenMistakes={() => setRoute({ type: 'mistakes' })}
        onOpenFlagged={openFlagged}
        onOpenPlanner={() => setTab('planner')}
      />
    );
  }, [createReview, openDeck, openFlagged, plannerFocusDeckId, tab]);

  if (!hydrated || authLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const showOnboarding = !recoveryMode && (route.type === 'onboarding' || (route.type !== 'shared' && !state.hasCompletedOnboarding));

  return (
    <View style={[styles.app, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      {showOnboarding ? <OnboardingScreen onComplete={finishOnboarding} onTrySample={trySampleFromOnboarding} /> : null}
      {!showOnboarding && route.type === 'auth' ? (
        <LoginScreen
          onAuthenticated={() => {
            setRoute(pendingRoute ?? (pendingSharedToken ? { type: 'shared', token: pendingSharedToken } : { type: 'main' }));
            setPendingSharedToken(null);
            setPendingRoute(null);
          }}
          onContinueAsGuest={() => {
            setRoute(pendingRoute ?? (pendingSharedToken ? { type: 'shared', token: pendingSharedToken } : { type: 'main' }));
            setPendingSharedToken(null);
            setPendingRoute(null);
          }}
        />
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
      {!showOnboarding && route.type === 'smart-study' ? <SmartStudyScreen initialMode={route.mode} focusDeckId={route.deckId} onBack={() => setRoute(route.deckId ? { type: 'deck', deckId: route.deckId } : { type: 'main' })} /> : null}
      {!showOnboarding && route.type === 'exam' ? <ExamModeScreen
        deckId={route.deckId}
        onBack={(tool = 'quiz', targetDeckId) => setRoute(targetDeckId || route.deckId ? { type: 'deck', deckId: targetDeckId ?? route.deckId!, tool } : { type: 'main' })}
        onStudyWeakAreas={(focusDeckId) => setRoute({ type: 'smart-study', mode: 'smart', deckId: focusDeckId })}
        onUpdateStudyPlan={(focusDeckId) => {
          setPlannerFocusDeckId(focusDeckId);
          setTab('planner');
          setRoute({ type: 'main' });
        }}
        onRequireAuth={() => {
          setPendingRoute(route);
          setRoute({ type: 'auth' });
        }}
      /> : null}
      {!showOnboarding && route.type === 'mistakes' ? (
        <MistakeNotebookScreen
          onBack={() => setRoute({ type: 'main' })}
          onOpenDeck={(deckId, tool) => setRoute({ type: 'deck', deckId, tool })}
        />
      ) : null}
      {!showOnboarding && route.type === 'flagged' ? (
        <FlaggedReviewScreen
          onBack={() => setRoute({ type: 'main' })}
          onOpenDeck={(deckId, tool) => setRoute({ type: 'deck', deckId, tool })}
        />
      ) : null}
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
          onPlan={(deckId) => {
            setPlannerFocusDeckId(deckId);
            setTab('planner');
            setRoute({ type: 'main' });
          }}
          onStartStudy={(mode, deckId) => setRoute({ type: 'smart-study', mode, deckId })}
          onOpenExam={(deckId) => setRoute({ type: 'exam', deckId })}
          onRequireAuth={() => {
            setPendingRoute(route);
            setRoute({ type: 'auth' });
          }}
        />
      ) : null}
      {!showOnboarding && route.type === 'shared' ? (
        <SharedStudyPackScreen
          token={route.token}
          onBack={() => setRoute({ type: 'main' })}
          onRequireAuth={() => {
            setPendingSharedToken(route.token);
            setRoute({ type: 'auth' });
          }}
          onOpenSavedDeck={(deckId) => setRoute({ type: 'deck', deckId })}
        />
      ) : null}
      {!showOnboarding && route.type === 'community-class' ? (
        <CommunityClassScreen
          classId={route.classId}
          onBack={() => {
            setTab('discover');
            setRoute({ type: 'main' });
          }}
          onPreviewSet={(token) => setRoute({ type: 'shared', token })}
          onRequireAuth={() => {
            setPendingRoute(route);
            setRoute({ type: 'auth' });
          }}
        />
      ) : null}
      {!showOnboarding && route.type === 'processing' ? (
        <ProcessingScreen
          asset={route.asset}
          courseId={route.courseId}
          courseName={route.courseName}
          onCancel={() => setRoute({ type: 'main' })}
          onSuccess={completeProcessing}
          onTrySample={openSample}
        />
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
