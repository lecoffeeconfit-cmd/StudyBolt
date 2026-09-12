import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Header, Icon, Pill, PrimaryButton, ProgressBar, SectionHeader } from '../components/ui';
import type { IconName } from '../components/ui';
import { StudyPackShareSheet } from '../components/StudyPackShareSheet';
import { useStudyBolt } from '../StudyBoltContext';
import type { FlashcardConfidence, QuizAnswerRecord, QuizQuestionCount, StudyPack, StudyTool } from '../models';
import { buildAssessment, getAssessmentCoverage } from '../services/assessment';
import type { AssessmentKind } from '../services/assessment';
import { calculateMastery } from '../services/mastery';

const TABS: Array<{ id: StudyTool; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'notes', label: 'Notes' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'audio', label: 'Listen' },
];

export function StudyPackScreen({
  deckId,
  deckOverride,
  shared = false,
  onSaveShared,
  initialTool = 'overview',
  onBack,
  onPlan,
}: {
  deckId: string;
  deckOverride?: StudyPack;
  shared?: boolean;
  onSaveShared?: () => void;
  initialTool?: StudyTool;
  onBack: () => void;
  onPlan: (deckId: string) => void;
}) {
  const { colors, state } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const [tool, setTool] = useState<StudyTool>(initialTool);
  const [shareVisible, setShareVisible] = useState(false);
  const deck = deckOverride ?? state.decks.find((item) => item.id === deckId);

  if (!deck) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Icon name="file-question-outline" size={42} color={colors.textMuted} />
        <Text style={[styles.missingTitle, { color: colors.text }]}>Study Pack not found</Text>
        <PrimaryButton label="Back to library" onPress={onBack} />
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 5 }]}>
      <View style={styles.horizontalPadding}>
        <Header
          title={deck.courseName}
          subtitle={deck.title}
          onBack={onBack}
          right={
            <View style={styles.headerRightRow}>
              {!shared ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Share Study Pack" onPress={() => setShareVisible(true)} style={[styles.shareButton, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="share-variant" size={19} color={colors.primary} />
                </Pressable>
              ) : null}
              <Pill label={shared ? 'Shared' : 'Offline'} tone={shared ? 'purple' : 'mint'} />
            </View>
          }
        />
      </View>
      {shared && onSaveShared ? (
        <Card style={[styles.sharedBanner, { backgroundColor: colors.purpleSoft, borderColor: `${colors.purple}44` }]}>
          <View style={[styles.sharedBannerIcon, { backgroundColor: colors.card }]}><Icon name="account-multiple-outline" size={20} color={colors.purple} /></View>
          <View style={styles.sharedBannerCopy}>
            <Text style={[styles.sharedBannerTitle, { color: colors.text }]}>Shared Study Pack</Text>
            <Text style={[styles.sharedBannerText, { color: colors.textSecondary }]}>Preview the material, then save your own copy to track progress.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onSaveShared} style={[styles.sharedSaveButton, { backgroundColor: colors.purple }]}>
            <Text style={styles.sharedSaveText}>Save copy</Text>
          </Pressable>
        </Card>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={[styles.tabScroller, { borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const active = tool === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setTool(tab.id)} style={[styles.tab, active && { backgroundColor: colors.primary }]}>
              <Text style={[styles.tabText, { color: active ? colors.primaryText : colors.textSecondary }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tool === 'overview' ? <Overview deck={deck} onTool={setTool} onPlan={() => onPlan(deck.id)} shared={shared} /> : null}
        {tool === 'notes' ? <Notes deck={deck} readOnly={shared} /> : null}
        {tool === 'flashcards' ? <Flashcards deck={deck} readOnly={shared} /> : null}
        {tool === 'quiz' ? <Quiz deck={deck} readOnly={shared} /> : null}
        {tool === 'audio' ? <AudioPlayer deck={deck} readOnly={shared} /> : null}
      </ScrollView>
      {!shared ? <StudyPackShareSheet deck={deck} visible={shareVisible} onClose={() => setShareVisible(false)} /> : null}
    </View>
  );
}

function Overview({ deck, onTool, onPlan, shared }: { deck: StudyPack; onTool: (tool: StudyTool) => void; onPlan: () => void; shared?: boolean }) {
  const { colors, state } = useStudyBolt();
  const mastery = calculateMastery(deck);
  return (
    <>
      <View style={styles.deckHero}>
        <View style={[styles.deckArt, { backgroundColor: `${deck.color}22` }]}><Text style={styles.deckEmoji}>{deck.emoji}</Text></View>
        <View style={styles.deckHeroCopy}>
          <View style={styles.deckLabelRow}>
            <Pill label={deck.fileType === 'demo' ? 'INTERACTIVE SAMPLE' : 'STUDY PACK'} tone={deck.fileType === 'demo' ? 'purple' : 'blue'} />
            <Text style={[styles.slideCount, { color: colors.textMuted }]}>{deck.pageCount} slides</Text>
          </View>
          <Text style={[styles.deckTitle, { color: colors.text }]}>{deck.title}</Text>
          <Text style={[styles.deckSubtitle, { color: colors.textSecondary }]}>{deck.subtitle}</Text>
        </View>
      </View>

      {shared ? (
        <View style={[styles.previewHint, { backgroundColor: colors.primarySoft }]}>
          <Icon name="eye-outline" size={18} color={colors.primary} />
          <Text style={[styles.previewHintText, { color: colors.textSecondary }]}>You’re viewing a read-only preview. Save a copy to make it yours.</Text>
        </View>
      ) : null}

      <Card style={[styles.masteryCard, { backgroundColor: colors.mode === 'dark' ? colors.primarySoft : '#EEF5FF' }]}>
        <View style={styles.masteryTop}>
          <View>
            <Text style={[styles.masteryLabel, { color: colors.textSecondary }]}>ESTIMATED MASTERY</Text>
            <Text style={[styles.masteryValue, { color: colors.text }]}>{mastery.overall}%</Text>
          </View>
          <View style={[styles.masteryRing, { borderColor: colors.primary }]}><Icon name="lightning-bolt" size={24} color={colors.primary} /></View>
        </View>
        <ProgressBar progress={mastery.overall} />
        <Text style={[styles.masteryHint, { color: colors.textSecondary }]}>{mastery.weakCount} flashcards still need retrieval practice.</Text>
      </Card>

      <View style={styles.toolGrid}>
        <ToolCard icon="note-text-outline" title="Simplified Notes" detail={`${deck.notes.length} clear sections`} color={colors.primary} background={colors.primarySoft} onPress={() => onTool('notes')} />
        <ToolCard icon="cards-outline" title="Flashcards" detail={`${deck.flashcards.length} active recall cards`} color={colors.purple} background={colors.purpleSoft} onPress={() => onTool('flashcards')} />
        <ToolCard icon="clipboard-text-outline" title="Quiz & Full Test" detail={`${state.quizQuestionCount} practice questions + cumulative test`} color={colors.mint} background={colors.mintSoft} onPress={() => onTool('quiz')} />
        <ToolCard icon="headphones" title="Audio Review" detail="Original or quick review" color="#A45FEB" background={colors.purpleSoft} onPress={() => onTool('audio')} />
      </View>

      <SectionHeader title="Lecture overview" />
      <Card>
        <Text style={[styles.overviewText, { color: colors.textSecondary }]}>{deck.overview}</Text>
      </Card>

      <SectionHeader title="Slide outline" action="Source order" />
      <View style={styles.outlineList}>
        {deck.outline.map((item, index) => (
          <Card key={item.id} style={styles.outlineCard}>
            <View style={[styles.outlineNumber, { backgroundColor: colors.primarySoft }]}><Text style={[styles.outlineNumberText, { color: colors.primary }]}>{index + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.outlineTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.outlineRange, { color: colors.textMuted }]}>{item.range}</Text>
            </View>
            <Icon name="chevron-right" color={colors.textMuted} />
          </Card>
        ))}
      </View>

      {!shared ? (
        <Card style={[styles.planCard, { backgroundColor: colors.mintSoft }]}>
          <View style={[styles.planIcon, { backgroundColor: colors.mint }]}><Icon name="calendar-check" color={colors.primaryText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.planTitle, { color: colors.text }]}>Need to learn this fast?</Text>
            <Text style={[styles.planText, { color: colors.textSecondary }]}>Build a guided route for this PowerPoint or your entire class.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onPlan} style={[styles.planAction, { backgroundColor: colors.card }]}>
            <Icon name="arrow-right" color={colors.mint} />
          </Pressable>
        </Card>
      ) : null}
    </>
  );
}

function ToolCard({ icon, title, detail, color, background, onPress }: { icon: IconName; title: string; detail: string; color: string; background: string; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <Card onPress={onPress} style={styles.toolCard}>
      <View style={[styles.toolIcon, { backgroundColor: background }]}><Icon name={icon} size={25} color={color} /></View>
      <Text style={[styles.toolTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.toolDetail, { color: colors.textMuted }]}>{detail}</Text>
      <View style={styles.toolArrow}><Icon name="arrow-right" size={18} color={color} /></View>
    </Card>
  );
}

function Notes({ deck, readOnly = false }: { deck: StudyPack; readOnly?: boolean }) {
  const { colors, recordStudyEvent, updateDeck } = useStudyBolt();
  const mastery = calculateMastery(deck);
  const toggleReviewed = (noteId: string) => {
    if (readOnly) return;
    const wasReviewed = deck.reviewedNoteIds.includes(noteId);
    updateDeck(deck.id, (current) => ({
      ...current,
      reviewedNoteIds: current.reviewedNoteIds.includes(noteId)
        ? current.reviewedNoteIds.filter((id) => id !== noteId)
        : [...current.reviewedNoteIds, noteId],
    }));
    if (!wasReviewed) recordStudyEvent({ type: 'note-review', deckId: deck.id, courseId: deck.courseId, noteId, durationMinutes: 3 });
  };
  return (
    <>
      <View style={styles.toolHeadingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toolHeading, { color: colors.text }]}>Simplified Notes</Text>
          <Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>Important ideas, kept in lecture order.</Text>
        </View>
        <Pill label={`${mastery.notes}% read`} tone="blue" />
      </View>
      <View style={[styles.noteGuide, { backgroundColor: colors.primarySoft }]}>
        <Icon name="bookmark-check-outline" color={colors.primary} size={20} />
        <Text style={[styles.noteGuideText, { color: colors.textSecondary }]}>Tap “Reviewed” after you can explain a section without looking.</Text>
      </View>
      <View style={styles.noteList}>
        {deck.notes.map((note, index) => {
          const reviewed = deck.reviewedNoteIds.includes(note.id);
          return (
            <Card key={note.id} style={styles.noteCard}>
              <View style={styles.noteTop}>
                <View style={[styles.noteNumber, { backgroundColor: colors.primarySoft }]}><Text style={[styles.noteNumberText, { color: colors.primary }]}>{index + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noteTitle, { color: colors.text }]}>{note.title}</Text>
                  <Text style={[styles.source, { color: colors.textMuted }]}>{note.source.label}</Text>
                </View>
              </View>
              <View style={styles.bullets}>
                {note.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{bullet}</Text>
                  </View>
                ))}
              </View>
              {note.keyIdea ? (
                <View style={[styles.keyIdea, { backgroundColor: colors.mintSoft }]}>
                  <Icon name="lightbulb-on-outline" size={18} color={colors.mint} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.keyIdeaLabel, { color: colors.mint }]}>KEY IDEA</Text>
                    <Text style={[styles.keyIdeaText, { color: colors.textSecondary }]}>{note.keyIdea}</Text>
                  </View>
                </View>
              ) : null}
              {readOnly ? (
                <View style={[styles.reviewedButton, { backgroundColor: colors.cardStrong }]}>
                  <Icon name="eye-outline" size={18} color={colors.textMuted} />
                  <Text style={[styles.reviewedText, { color: colors.textMuted }]}>Preview only</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => toggleReviewed(note.id)}
                  style={[styles.reviewedButton, { backgroundColor: reviewed ? colors.mintSoft : colors.cardStrong }]}
                >
                  <Icon name={reviewed ? 'check-circle' : 'checkbox-blank-circle-outline'} size={18} color={reviewed ? colors.mint : colors.textMuted} />
                  <Text style={[styles.reviewedText, { color: reviewed ? colors.mint : colors.textSecondary }]}>{reviewed ? 'Reviewed' : 'Mark reviewed'}</Text>
                </Pressable>
              )}
            </Card>
          );
        })}
      </View>
    </>
  );
}

function Flashcards({ deck, readOnly = false }: { deck: StudyPack; readOnly?: boolean }) {
  const { colors, recordStudyEvent, updateDeck } = useStudyBolt();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = deck.flashcards[index];

  if (!card) return <EmptyTool icon="cards-outline" title="No flashcards yet" message="Regenerate this Study Pack after source processing is connected." />;

  const setConfidence = (confidence: FlashcardConfidence) => {
    if (readOnly) return;
    recordStudyEvent({
      type: 'flashcard-review',
      deckId: deck.id,
      courseId: deck.courseId,
      cardId: card.id,
      confidence,
      previousConfidence: card.confidence,
      durationMinutes: 1,
    });
    updateDeck(deck.id, (current) => ({
      ...current,
      flashcards: current.flashcards.map((item) => (item.id === card.id ? { ...item, confidence } : item)),
    }));
    setRevealed(false);
    setIndex((current) => Math.min(deck.flashcards.length - 1, current + 1));
  };

  return (
    <>
      <View style={styles.toolHeadingRow}>
        <View>
          <Text style={[styles.toolHeading, { color: colors.text }]}>Active Recall</Text>
          <Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>Answer before revealing the back.</Text>
        </View>
        <Pill label={`${index + 1} / ${deck.flashcards.length}`} tone="purple" />
      </View>
      <ProgressBar progress={((index + 1) / deck.flashcards.length) * 100} color={colors.purple} />
      <Pressable onPress={() => setRevealed((value) => !value)} style={{ marginTop: 20 }}>
        <Card style={[styles.flashcard, { borderColor: revealed ? colors.purple : colors.border, backgroundColor: revealed ? colors.purpleSoft : colors.card }]}>
          <View style={styles.flashcardTop}>
            <Pill label={revealed ? 'ANSWER' : 'QUESTION'} tone="purple" />
            <Text style={[styles.source, { color: colors.textMuted }]}>{card.source.label}</Text>
          </View>
          <View style={styles.flashcardCenter}>
            <Icon name={revealed ? 'lightbulb-on' : 'brain'} size={35} color={colors.purple} />
            <Text style={[styles.flashcardText, { color: colors.text }]}>{revealed ? card.back : card.front}</Text>
            {revealed && card.explanation ? <Text style={[styles.flashcardExplanation, { color: colors.textSecondary }]}>{card.explanation}</Text> : null}
          </View>
          <View style={[styles.tapHint, { borderTopColor: colors.border }]}>
            <Icon name="gesture-tap" size={18} color={colors.textMuted} />
            <Text style={[styles.tapHintText, { color: colors.textMuted }]}>Tap card to {revealed ? 'show question' : 'reveal answer'}</Text>
          </View>
        </Card>
      </Pressable>

      <View style={styles.cardNav}>
        <Pressable accessibilityLabel="Previous card" disabled={index === 0} onPress={() => { setIndex((value) => Math.max(0, value - 1)); setRevealed(false); }} style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: index === 0 ? 0.4 : 1 }]}>
          <Icon name="chevron-left" color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.confidenceHint, { color: colors.textMuted }]}>{readOnly ? 'Preview the answer, then save a copy to study' : revealed ? 'How well did you know it?' : 'Retrieve, then reveal'}</Text>
        <Pressable accessibilityLabel="Next card" disabled={index === deck.flashcards.length - 1} onPress={() => { setIndex((value) => Math.min(deck.flashcards.length - 1, value + 1)); setRevealed(false); }} style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: index === deck.flashcards.length - 1 ? 0.4 : 1 }]}>
          <Icon name="chevron-right" color={colors.textSecondary} />
        </Pressable>
      </View>

      {revealed && !readOnly ? (
        <View style={styles.confidenceRow}>
          <ConfidenceButton icon="refresh" label="Again" color={colors.danger} background={`${colors.danger}18`} onPress={() => setConfidence('new')} />
          <ConfidenceButton icon="progress-clock" label="Learning" color={colors.warning} background={`${colors.warning}18`} onPress={() => setConfidence('learning')} />
          <ConfidenceButton icon="check-bold" label="Got it" color={colors.mint} background={colors.mintSoft} onPress={() => setConfidence('known')} />
        </View>
      ) : null}
    </>
  );
}

function ConfidenceButton({ icon, label, color, background, onPress }: { icon: IconName; label: string; color: string; background: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.confidenceButton, { backgroundColor: background, borderColor: color }]}>
      <Icon name={icon} size={19} color={color} />
      <Text style={[styles.confidenceButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function Quiz({ deck, readOnly = false }: { deck: StudyPack; readOnly?: boolean }) {
  const { colors, recordStudyEvent, state, setQuizQuestionCount, updateDeck } = useStudyBolt();
  const [kind, setKind] = useState<AssessmentKind>('practice');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswerRecord[]>([]);
  const practicePool = useMemo(() => buildAssessment(deck, 'practice'), [deck.flashcards, deck.id, deck.notes, deck.quiz]);
  const questions = useMemo(
    () => buildAssessment(deck, kind, kind === 'practice' ? state.quizQuestionCount : undefined),
    [deck.flashcards, deck.id, deck.notes, deck.outline, deck.quiz, kind, state.quizQuestionCount],
  );
  const coverage = useMemo(() => getAssessmentCoverage(deck, questions), [deck, questions]);
  const question = questions[index];

  useEffect(() => {
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setAnswers([]);
    setFinished(false);
    setRecorded(false);
  }, [deck.id, kind, state.quizQuestionCount]);

  if (!question) return <EmptyTool icon="clipboard-alert-outline" title="No quiz yet" message="No quiz questions were available for this Study Pack." />;

  const choose = (optionIndex: number) => {
    if (selected !== null) return;
    setSelected(optionIndex);
    const correct = optionIndex === question.correctIndex;
    if (correct) setCorrectCount((count) => count + 1);
    setAnswers((current) => [...current, {
      questionId: question.id,
      sourceSectionId: question.source.sectionId,
      correct,
      questionType: question.type,
      difficulty: question.difficulty ?? (index === 0 ? 'easy' : index === questions.length - 1 ? 'hard' : 'medium'),
    }]);
  };

  const next = () => {
    if (selected === null) return;
    if (index < questions.length - 1) {
      setIndex((value) => value + 1);
      setSelected(null);
      return;
    }
    const finalCorrect = correctCount;
    const score = Math.round((finalCorrect / questions.length) * 100);
    if (!recorded && !readOnly) {
      updateDeck(deck.id, (current) => kind === 'practice'
        ? { ...current, quizAttempts: [...current.quizAttempts, score] }
        : { ...current, testAttempts: [...(current.testAttempts ?? []), score] });
      recordStudyEvent({
        type: 'quiz',
        deckId: deck.id,
        courseId: deck.courseId,
        durationMinutes: Math.max(3, Math.round(questions.length * 1.5)),
        quizScore: score,
        quizAnswers: answers,
      });
      setRecorded(true);
    }
    setFinished(true);
  };

  if (finished) {
    const score = Math.round((correctCount / questions.length) * 100);
    return (
      <View style={styles.results}>
        <View style={[styles.resultIcon, { backgroundColor: score >= 70 ? colors.mintSoft : colors.primarySoft }]}>
          <Icon name={score >= 70 ? 'trophy-outline' : 'refresh'} size={42} color={score >= 70 ? colors.mint : colors.primary} />
        </View>
        <Text style={[styles.resultTitle, { color: colors.text }]}>{score >= 80 ? 'Strong work!' : score >= 60 ? 'Good foundation' : 'Keep retrieving'}</Text>
        <Text style={[styles.resultScore, { color: colors.text }]}>{score}%</Text>
        <Text style={[styles.resultText, { color: colors.textSecondary }]}>{correctCount} of {questions.length} correct on your {kind === 'practice' ? 'practice quiz' : 'full PowerPoint test'}.{readOnly ? ' This preview result was not saved.' : ' Your mastery estimate now includes this attempt.'}</Text>
        <Card style={[styles.resultTip, { backgroundColor: colors.primarySoft }]}>
          <Icon name="brain" color={colors.primary} />
          <Text style={[styles.resultTipText, { color: colors.textSecondary }]}>Try again after a short gap. Retrieval spaced over time is more useful than repeating immediately.</Text>
        </Card>
        <PrimaryButton label="Try a fresh run" icon="refresh" onPress={() => { setIndex(0); setSelected(null); setCorrectCount(0); setAnswers([]); setFinished(false); setRecorded(false); }} />
      </View>
    );
  }

  return (
    <>
      <View style={[styles.assessmentSwitcher, { backgroundColor: colors.cardStrong }]}>
        {(['practice', 'comprehensive'] as const).map((item) => {
          const active = kind === item;
          return (
            <Pressable key={item} onPress={() => setKind(item)} style={[styles.assessmentMode, active && { backgroundColor: colors.card }]}>
              <Icon name={item === 'practice' ? 'clipboard-text-outline' : 'school-outline'} size={18} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.assessmentModeText, { color: active ? colors.text : colors.textMuted }]}>{item === 'practice' ? 'Practice quiz' : 'Full test'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={[styles.quizSetup, { backgroundColor: kind === 'practice' ? colors.primarySoft : colors.mintSoft }]}>
        <View style={styles.quizSetupTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.quizSetupTitle, { color: colors.text }]}>{kind === 'practice' ? 'Choose your quiz length' : 'Complete source coverage'}</Text>
            <Text style={[styles.quizSetupText, { color: colors.textSecondary }]}>{kind === 'practice' ? 'Starts at 10. Increase it when you want a deeper retrieval session.' : 'This test uses a separate question set and checks every source section.'}</Text>
          </View>
          <Pill label={kind === 'practice' ? `${questions.length} Q` : `${coverage.covered}/${coverage.total} sections`} tone={kind === 'practice' ? 'blue' : 'mint'} />
        </View>
        {kind === 'practice' ? (
          <View style={styles.countChoices}>
            {([10, 15, 20] as QuizQuestionCount[]).map((count) => {
              const active = state.quizQuestionCount === count;
              const disabled = practicePool.length < count;
              return (
                <Pressable
                  key={count}
                  disabled={disabled}
                  onPress={() => setQuizQuestionCount(count)}
                  style={[styles.countChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border, opacity: disabled ? 0.4 : 1 }]}
                >
                  <Text style={[styles.countText, { color: active ? colors.primaryText : colors.textSecondary }]}>{count}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.coverageRow}>
            <Icon name="check-decagram" color={colors.mint} size={18} />
            <Text style={[styles.coverageText, { color: colors.textSecondary }]}>{questions.length} distinct questions · cumulative · source ordered</Text>
          </View>
        )}
      </Card>

      <View style={styles.toolHeadingRow}>
        <View>
          <Text style={[styles.toolHeading, { color: colors.text }]}>{kind === 'practice' ? 'Practice Quiz' : 'Full PowerPoint Test'}</Text>
          <Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>{kind === 'practice' ? 'Feedback appears after each answer.' : 'A separate cumulative check across the whole source.'}</Text>
        </View>
        <Pill label={`${index + 1} / ${questions.length}`} tone="mint" />
      </View>
      <ProgressBar progress={((index + 1) / questions.length) * 100} color={colors.mint} />
      <Card style={styles.questionCard}>
        <View style={styles.questionMeta}>
          <Pill label={question.type === 'true-false' ? 'TRUE / FALSE' : 'MULTIPLE CHOICE'} tone="neutral" />
          <Text style={[styles.source, { color: colors.textMuted }]}>{question.source.label}</Text>
        </View>
        <Text style={[styles.question, { color: colors.text }]}>{question.prompt}</Text>
        <View style={styles.options}>
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrect = selected !== null && optionIndex === question.correctIndex;
            const isWrong = isSelected && optionIndex !== question.correctIndex;
            const borderColor = isCorrect ? colors.mint : isWrong ? colors.danger : isSelected ? colors.primary : colors.border;
            const backgroundColor = isCorrect ? colors.mintSoft : isWrong ? `${colors.danger}12` : colors.cardStrong;
            return (
              <Pressable key={option} onPress={() => choose(optionIndex)} style={[styles.option, { borderColor, backgroundColor }]}>
                <View style={[styles.optionLetter, { backgroundColor: isCorrect ? colors.mint : isWrong ? colors.danger : colors.card, borderColor }]}>
                  {isCorrect || isWrong ? <Icon name={isCorrect ? 'check' : 'close'} size={15} color={colors.primaryText} /> : <Text style={[styles.optionLetterText, { color: colors.textSecondary }]}>{String.fromCharCode(65 + optionIndex)}</Text>}
                </View>
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      {selected !== null ? (
        <Card style={[styles.feedback, { backgroundColor: selected === question.correctIndex ? colors.mintSoft : `${colors.danger}12`, borderColor: selected === question.correctIndex ? colors.mint : colors.danger }]}>
          <Icon name={selected === question.correctIndex ? 'check-circle' : 'alert-circle-outline'} color={selected === question.correctIndex ? colors.mint : colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.feedbackTitle, { color: colors.text }]}>{selected === question.correctIndex ? 'Correct' : 'Not quite'}</Text>
            <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>{question.explanation}</Text>
          </View>
        </Card>
      ) : null}
      <PrimaryButton label={index === questions.length - 1 ? 'See results' : 'Next question'} icon="arrow-right" disabled={selected === null} onPress={next} style={styles.nextButton} />
    </>
  );
}

function AudioPlayer({ deck, readOnly = false }: { deck: StudyPack; readOnly?: boolean }) {
  const { colors, recordStudyEvent, updateDeck } = useStudyBolt();
  const [mode, setMode] = useState<'original' | 'summary'>('summary');
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [position, setPosition] = useState(deck.audioPosition);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const text = mode === 'original' ? deck.originalText : deck.quickReview;
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const voice = voices[voiceIndex];

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then((available) => setVoices(available.filter((item) => item.language.toLowerCase().startsWith('en')).slice(0, 12))).catch(() => setVoices([]));
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      setPosition((current) => Math.min(words.length, current + Math.max(1, Math.round(2.25 * rate))));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, rate, words.length]);

  const persistPosition = (nextPosition: number) => {
    if (!readOnly) updateDeck(deck.id, (current) => ({ ...current, audioPosition: nextPosition }));
  };
  const recordAudioProgress = (nextPosition: number) => {
    const startedAt = sessionStartRef.current;
    sessionStartRef.current = null;
    if (startedAt === null || nextPosition <= startedAt) return;
    if (readOnly) return;
    recordStudyEvent({
      type: 'audio',
      deckId: deck.id,
      courseId: deck.courseId,
      durationMinutes: Math.max(1, Math.round((nextPosition - startedAt) / (135 * rate))),
      audioMode: mode,
      completionPercent: words.length ? Math.round((nextPosition / words.length) * 100) : 0,
    });
  };
  const stopAt = async (nextPosition: number) => {
    await Speech.stop();
    setPlaying(false);
    setPosition(nextPosition);
    persistPosition(nextPosition);
    recordAudioProgress(nextPosition);
  };
  const togglePlay = async () => {
    if (playing) {
      await stopAt(position);
      return;
    }
    const start = position >= words.length ? 0 : position;
    if (start !== position) setPosition(start);
    sessionStartRef.current = start;
    setPlaying(true);
    Speech.speak(words.slice(start).join(' '), {
      rate,
      voice: voice?.identifier,
      onDone: () => {
        setPlaying(false);
        setPosition(words.length);
        persistPosition(words.length);
        recordAudioProgress(words.length);
      },
      onStopped: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };
  const switchMode = async (next: 'original' | 'summary') => {
    await Speech.stop();
    setPlaying(false);
    sessionStartRef.current = null;
    setMode(next);
    setPosition(0);
    persistPosition(0);
  };
  const skip = async (amount: number) => stopAt(Math.max(0, Math.min(words.length, position + amount)));
  const progress = words.length ? (position / words.length) * 100 : 0;
  const remainingMinutes = Math.max(0, Math.ceil((words.length - position) / (135 * rate)));

  return (
    <>
      <View style={styles.toolHeadingRow}>
        <View>
          <Text style={[styles.toolHeading, { color: colors.text }]}>Audio Review</Text>
          <Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>Device voices keep playback available offline.</Text>
        </View>
        <Pill label="OFFLINE TTS" tone="purple" />
      </View>
      <View style={[styles.audioModeSwitch, { backgroundColor: colors.cardStrong }]}>
        {(['original', 'summary'] as const).map((item) => (
          <Pressable key={item} onPress={() => void switchMode(item)} style={[styles.audioMode, mode === item && { backgroundColor: colors.card }]}>
            <Icon name={item === 'original' ? 'file-document-outline' : 'creation'} size={18} color={mode === item ? colors.purple : colors.textMuted} />
            <Text style={[styles.audioModeText, { color: mode === item ? colors.text : colors.textMuted }]}>{item === 'original' ? 'Original' : 'Quick Review'}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={[styles.player, { backgroundColor: colors.mode === 'dark' ? '#111820' : '#11162F' }]}>
        <View style={styles.playerArtWrap}>
          <View style={[styles.playerGlow, { backgroundColor: colors.purple }]} />
          <View style={styles.playerArt}><MaterialCommunityIcons name="lightning-bolt" size={50} color="#C8B5FF" /></View>
        </View>
        <Text style={styles.nowPlaying}>{mode === 'original' ? 'ORIGINAL LECTURE' : 'QUICK REVIEW'}</Text>
        <Text style={styles.audioTitle}>{deck.title}</Text>
        <Text style={styles.audioCourse}>{deck.courseName} · {remainingMinutes || '< 1'} min remaining</Text>
        <View style={styles.audioProgress}><ProgressBar progress={progress} color={colors.purple} /></View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{Math.floor(position / (2.25 * rate) / 60)}:{Math.floor((position / (2.25 * rate)) % 60).toString().padStart(2, '0')}</Text>
          <Text style={styles.timeText}>≈ {Math.ceil(words.length / (135 * rate))}:00</Text>
        </View>
        <View style={styles.controls}>
          <Pressable accessibilityLabel="Skip back 15 seconds" onPress={() => void skip(-34)} style={styles.smallControl}>
            <Icon name="rewind-15" color="#D9DCF0" size={29} />
          </Pressable>
          <Pressable accessibilityLabel={playing ? 'Pause audio' : 'Play audio'} onPress={() => void togglePlay()} style={[styles.playButton, { backgroundColor: colors.purple }]}>
            <Icon name={playing ? 'pause' : 'play'} color={colors.primaryText} size={35} />
          </Pressable>
          <Pressable accessibilityLabel="Skip forward 15 seconds" onPress={() => void skip(34)} style={styles.smallControl}>
            <Icon name="fast-forward-15" color="#D9DCF0" size={29} />
          </Pressable>
        </View>
      </Card>
      <View style={styles.audioSettings}>
        <Card onPress={() => { const rates = [0.8, 1, 1.25, 1.5]; const current = rates.indexOf(rate); setRate(rates[(current + 1) % rates.length] ?? 1); if (playing) void stopAt(position); }} style={styles.audioSettingCard}>
          <Icon name="speedometer" color={colors.primary} />
          <View style={{ flex: 1 }}><Text style={[styles.settingLabel, { color: colors.textMuted }]}>SPEED</Text><Text style={[styles.settingValue, { color: colors.text }]}>{rate.toFixed(rate % 1 ? 2 : 1)}×</Text></View>
          <Icon name="chevron-right" color={colors.textMuted} />
        </Card>
        <Card onPress={() => { if (voices.length) { setVoiceIndex((index) => (index + 1) % voices.length); if (playing) void stopAt(position); } }} style={styles.audioSettingCard}>
          <Icon name="account-voice" color={colors.mint} />
          <View style={{ flex: 1 }}><Text style={[styles.settingLabel, { color: colors.textMuted }]}>VOICE</Text><Text numberOfLines={1} style={[styles.settingValue, { color: colors.text }]}>{voice?.name ?? 'Device default'}</Text></View>
          <Icon name="chevron-right" color={colors.textMuted} />
        </Card>
      </View>
      <Card style={[styles.audioInfo, { backgroundColor: colors.primarySoft }]}>
        <Icon name="information-outline" color={colors.primary} />
        <Text style={[styles.audioInfoText, { color: colors.textSecondary }]}>{mode === 'original' ? 'Original mode reads extracted lecture text in its saved source order without summarizing it.' : 'Quick Review is a condensed, spoken-friendly summary of the most testable concepts.'}</Text>
      </Card>
      {Platform.OS === 'web' ? <Text style={[styles.webAudio, { color: colors.textMuted }]}>Browser voice availability varies by operating system.</Text> : null}
    </>
  );
}

function EmptyTool({ icon, title, message }: { icon: IconName; title: string; message: string }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.emptyTool}>
      <Icon name={icon} size={46} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  horizontalPadding: { paddingHorizontal: 20 },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareButton: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sharedBanner: { marginHorizontal: 20, marginBottom: 2, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sharedBannerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sharedBannerCopy: { flex: 1 },
  sharedBannerTitle: { fontSize: 12, fontWeight: '900' },
  sharedBannerText: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  sharedSaveButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11 },
  sharedSaveText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  tabScroller: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  tabs: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 10, gap: 4 },
  tab: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11 },
  tabText: { fontSize: 12, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 80 },
  missing: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 15 },
  missingTitle: { fontSize: 18, fontWeight: '800' },
  deckHero: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 17 },
  deckArt: { width: 73, height: 73, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  deckEmoji: { fontSize: 37 },
  deckHeroCopy: { flex: 1 },
  deckLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  slideCount: { fontSize: 10 },
  deckTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.6, marginTop: 7 },
  deckSubtitle: { fontSize: 12, marginTop: 2 },
  previewHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, marginBottom: 12 },
  previewHintText: { flex: 1, fontSize: 11, lineHeight: 15 },
  masteryCard: { marginBottom: 12 },
  masteryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  masteryLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  masteryValue: { fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 2 },
  masteryRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  masteryHint: { fontSize: 10, marginTop: 8 },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolCard: { width: '48.5%', minHeight: 144 },
  toolIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 13, fontWeight: '800', marginTop: 11 },
  toolDetail: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  toolArrow: { position: 'absolute', right: 13, bottom: 12 },
  overviewText: { fontSize: 13, lineHeight: 20 },
  outlineList: { gap: 8 },
  outlineCard: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 11 },
  outlineNumber: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  outlineNumberText: { fontSize: 12, fontWeight: '900' },
  outlineTitle: { fontSize: 12, fontWeight: '800' },
  outlineRange: { fontSize: 10, marginTop: 3 },
  planCard: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 11 },
  planIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  planTitle: { fontSize: 13, fontWeight: '800' },
  planText: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  planAction: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 15 },
  toolHeading: { fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7 },
  toolSubheading: { fontSize: 12, marginTop: 3 },
  noteGuide: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, padding: 12, marginBottom: 12 },
  noteGuideText: { flex: 1, fontSize: 11, lineHeight: 15 },
  noteList: { gap: 12 },
  noteCard: { padding: 18 },
  noteTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  noteNumber: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  noteNumberText: { fontSize: 12, fontWeight: '900' },
  noteTitle: { fontSize: 16, fontWeight: '900' },
  source: { fontSize: 9, marginTop: 3, fontWeight: '600' },
  bullets: { gap: 10, marginTop: 16 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 12, lineHeight: 18 },
  keyIdea: { flexDirection: 'row', gap: 9, marginTop: 16, padding: 12, borderRadius: 13 },
  keyIdeaLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  keyIdeaText: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  reviewedButton: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
  reviewedText: { fontSize: 11, fontWeight: '800' },
  flashcard: { minHeight: 390, padding: 20 },
  flashcardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flashcardCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 17 },
  flashcardText: { fontSize: 23, lineHeight: 31, textAlign: 'center', fontWeight: '800', letterSpacing: -0.5 },
  flashcardExplanation: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
  tapHint: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center' },
  tapHintText: { fontSize: 10 },
  cardNav: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 45, height: 45, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  confidenceHint: { fontSize: 10, fontWeight: '700' },
  confidenceRow: { flexDirection: 'row', gap: 8, marginTop: 15 },
  confidenceButton: { flex: 1, minHeight: 58, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  confidenceButtonText: { fontSize: 10, fontWeight: '900' },
  assessmentSwitcher: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4, marginBottom: 12 },
  assessmentMode: { flex: 1, minHeight: 43, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  assessmentModeText: { fontSize: 11, fontWeight: '800' },
  quizSetup: { padding: 14, marginBottom: 18 },
  quizSetupTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  quizSetupTitle: { fontSize: 13, fontWeight: '900' },
  quizSetupText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  countChoices: { flexDirection: 'row', gap: 8, marginTop: 13 },
  countChip: { flex: 1, height: 39, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, fontWeight: '900' },
  coverageRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  coverageText: { flex: 1, fontSize: 10, fontWeight: '700' },
  questionCard: { marginTop: 18, padding: 18 },
  questionMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  question: { fontSize: 20, lineHeight: 27, fontWeight: '800', marginTop: 20, letterSpacing: -0.4 },
  options: { gap: 10, marginTop: 21 },
  option: { minHeight: 60, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11 },
  optionLetter: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 11, fontWeight: '900' },
  optionText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  feedback: { marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1 },
  feedbackTitle: { fontSize: 13, fontWeight: '900' },
  feedbackText: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  nextButton: { marginTop: 14 },
  results: { alignItems: 'center', paddingTop: 35, gap: 9 },
  resultIcon: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 23, fontWeight: '900', marginTop: 9 },
  resultScore: { fontSize: 52, lineHeight: 58, fontWeight: '900' },
  resultText: { textAlign: 'center', fontSize: 12, lineHeight: 18, maxWidth: 310 },
  resultTip: { flexDirection: 'row', gap: 10, alignItems: 'center', marginVertical: 15 },
  resultTipText: { flex: 1, fontSize: 11, lineHeight: 16 },
  audioModeSwitch: { flexDirection: 'row', borderRadius: 15, padding: 4, marginBottom: 14 },
  audioMode: { flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
  audioModeText: { fontSize: 11, fontWeight: '800' },
  player: { padding: 22, alignItems: 'center' },
  playerArtWrap: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  playerGlow: { position: 'absolute', width: 112, height: 112, borderRadius: 56, opacity: 0.22 },
  playerArt: { width: 98, height: 98, borderRadius: 49, backgroundColor: '#26224A', borderWidth: 1, borderColor: '#7868C4', alignItems: 'center', justifyContent: 'center' },
  nowPlaying: { color: '#B1A8D0', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 8 },
  audioTitle: { color: '#EDF1F5', fontSize: 20, fontWeight: '900', marginTop: 8 },
  audioCourse: { color: '#B4BEC8', fontSize: 11, marginTop: 4 },
  audioProgress: { width: '100%', marginTop: 24 },
  timeRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeText: { color: '#929EAA', fontSize: 9 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 27, marginTop: 17 },
  smallControl: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 65, height: 65, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  audioSettings: { flexDirection: 'row', gap: 10, marginTop: 12 },
  audioSettingCard: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  settingLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  settingValue: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  audioInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 12 },
  audioInfoText: { flex: 1, fontSize: 10, lineHeight: 15 },
  webAudio: { fontSize: 10, textAlign: 'center', marginTop: 12 },
  emptyTool: { paddingVertical: 80, alignItems: 'center', gap: 11 },
  emptyTitle: { fontSize: 19, fontWeight: '800' },
  emptyText: { textAlign: 'center', fontSize: 12, lineHeight: 18, maxWidth: 300 },
});
