import React, { useCallback, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomTabs, MainTab } from './src/components/BottomTabs';
import { StudyBoltProvider, useStudyBolt } from './src/StudyBoltContext';
import { ImportAsset, StudyPack } from './src/models';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { PlannerScreen } from './src/screens/PlannerScreen';
import { ProcessingScreen } from './src/screens/ProcessingScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { StudyPackScreen, StudyTool } from './src/screens/StudyPackScreen';

type Route =
  | { type: 'main' }
  | { type: 'deck'; deckId: string; tool?: StudyTool }
  | { type: 'processing'; asset: ImportAsset };

export default function App() {
  return (
    <SafeAreaProvider>
      <StudyBoltProvider>
        <StudyBoltApp />
      </StudyBoltProvider>
    </SafeAreaProvider>
  );
}

function StudyBoltApp() {
  const { colors, state, addDeck } = useStudyBolt();
  const [tab, setTab] = useState<MainTab>('home');
  const [route, setRoute] = useState<Route>({ type: 'main' });
  const openDeck = useCallback((deck: StudyPack, tool?: StudyTool) => setRoute({ type: 'deck', deckId: deck.id, tool }), []);
  const openSample = useCallback(() => {
    const sample = state.decks.find((deck) => deck.id === 'biology-cells') ?? state.decks[0];
    if (sample) openDeck(sample);
  }, [openDeck, state.decks]);
  const completeProcessing = useCallback((deck: StudyPack) => {
    addDeck(deck);
    setRoute({ type: 'deck', deckId: deck.id });
  }, [addDeck]);

  const createReview = useCallback((deckIds: string[]) => {
    const sourceDecks = state.decks.filter((deck) => deckIds.includes(deck.id)).sort((a, b) => a.order - b.order);
    if (sourceDecks.length < 2) return;
    const review = combineDecks(sourceDecks);
    addDeck(review);
    setRoute({ type: 'deck', deckId: review.id });
  }, [addDeck, state.decks]);

  const mainScreen = useMemo(() => {
    if (tab === 'library') return <LibraryScreen onOpenDeck={openDeck} onCreateReview={createReview} />;
    if (tab === 'planner') return <PlannerScreen />;
    if (tab === 'stats') return <StatsScreen />;
    if (tab === 'profile') return <ProfileScreen />;
    return <HomeScreen onOpenDeck={openDeck} onImport={(asset) => setRoute({ type: 'processing', asset })} />;
  }, [createReview, openDeck, tab]);

  return (
    <View style={[styles.app, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      {route.type === 'main' ? (
        <>
          {mainScreen}
          <BottomTabs active={tab} onChange={setTab} />
        </>
      ) : null}
      {route.type === 'deck' ? (
        <StudyPackScreen
          deckId={route.deckId}
          initialTool={route.tool}
          onBack={() => setRoute({ type: 'main' })}
          onPlan={() => { setTab('planner'); setRoute({ type: 'main' }); }}
        />
      ) : null}
      {route.type === 'processing' ? (
        <ProcessingScreen asset={route.asset} onCancel={() => setRoute({ type: 'main' })} onSuccess={completeProcessing} onTrySample={openSample} />
      ) : null}
    </View>
  );
}

function combineDecks(decks: StudyPack[]): StudyPack {
  const first = decks[0];
  if (!first) throw new Error('At least one Study Pack is required');
  const stamp = Date.now().toString();
  const title = `${first.courseName} Exam Review`;
  return {
    ...first,
    id: `exam-review-${stamp}`,
    title,
    subtitle: `${decks.length} decks combined`,
    fileName: `${title.replaceAll(' ', '_')}.studybolt`,
    pageCount: decks.reduce((sum, deck) => sum + deck.pageCount, 0),
    createdAt: new Date().toISOString(),
    order: Math.max(...decks.map((deck) => deck.order)) + 1,
    emoji: '⚡',
    overview: `An exam review built from ${decks.map((deck) => deck.title).join(', ')} in course order.`,
    originalText: decks.map((deck) => `${deck.title}. ${deck.originalText}`).join('\n\n'),
    quickReview: decks.map((deck) => `${deck.title}. ${deck.quickReview}`).join('\n\n'),
    outline: decks.map((deck, index) => ({ id: `review-outline-${stamp}-${deck.id}`, title: deck.title, range: `Deck ${index + 1} · ${deck.pageCount} slides` })),
    notes: decks.flatMap((deck) => deck.notes.map((note) => ({ ...note, id: `${deck.id}-${note.id}`, title: `${deck.title} · ${note.title}` }))),
    flashcards: decks.flatMap((deck) => deck.flashcards.map((card) => ({ ...card, id: `${deck.id}-${card.id}`, confidence: 'new' as const }))),
    quiz: decks.flatMap((deck) => deck.quiz.map((question) => ({ ...question, id: `${deck.id}-${question.id}` }))),
    quizAttempts: [],
    reviewedNoteIds: [],
    audioPosition: 0,
    studyMinutes: 0,
  };
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : undefined,
    alignSelf: 'center',
  },
});
