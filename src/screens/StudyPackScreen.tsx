import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { AskStudyBoltSheet, SpeedPickerSheet, VoicePickerSheet } from '../components/StudyCastSheets';
import { Card, FlagButton, Header, Icon, Pill, PrimaryButton, ProgressBar, SectionHeader } from '../components/ui';
import type { IconName } from '../components/ui';
import { StudyPackShareSheet } from '../components/StudyPackShareSheet';
import { useStudyBolt } from '../StudyBoltContext';
import { getFlaggedItemId } from '../models';
import type { AiRequestChannel, AiTutorAction, AiTutorConversation, AiTutorQuota, AiTutorResponse, AnswerConfidence, FlaggedItemInput, Flashcard, FlashcardConfidence, NoteBlock, QuizAnswerRecord, QuizQuestion, QuizQuestionCount, SharedStudyPackMetadata, StudyPack, StudyTool } from '../models';
import { fetchTutorQuota, isAiTutorConfigured, tutorContextAtPosition } from '../services/aiTutor';
import { runStudyBoltAI } from '../services/aiRouter';
import { canAttemptOnDeviceAI, getOnDeviceAIAvailability, initialOnDeviceAIAvailability } from '../services/onDeviceAI';
import { buildAssessment, getAssessmentCoverage } from '../services/assessment';
import type { AssessmentKind } from '../services/assessment';
import { calculateMastery } from '../services/mastery';
import { pageLabel } from '../services/documentTypes';
import type { SmartStudyMode } from '../services/adaptiveStudy';
import { interactionStateLabel, parseVoiceCommand, startBrowserSpeechInput, type BrowserSpeechInput, type VoiceSessionState } from '../services/voiceInteraction';

const TABS: Array<{ id: StudyTool; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'notes', label: 'Notes' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Exam' },
  { id: 'audio', label: 'Listen' },
  { id: 'coach', label: 'Coach' },
];

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

function noteFlag(deck: StudyPack, note: NoteBlock): FlaggedItemInput {
  return {
    id: getFlaggedItemId(deck.id, 'note', note.id),
    deckId: deck.id,
    deckTitle: deck.title,
    courseId: deck.courseId,
    courseName: deck.courseName,
    kind: 'note',
    itemId: note.id,
    title: note.title,
    prompt: note.summary ?? note.bullets[0] ?? note.title,
    answer: note.bullets.join(' '),
    explanation: note.keyIdea,
    source: note.source,
  };
}

function flashcardFlag(deck: StudyPack, card: Flashcard): FlaggedItemInput {
  return {
    id: getFlaggedItemId(deck.id, 'flashcard', card.id),
    deckId: deck.id,
    deckTitle: deck.title,
    courseId: deck.courseId,
    courseName: deck.courseName,
    kind: 'flashcard',
    itemId: card.id,
    title: 'Flashcard',
    prompt: card.front,
    answer: card.back,
    explanation: card.explanation,
    source: card.source,
  };
}

function quizFlag(deck: StudyPack, question: QuizQuestion): FlaggedItemInput {
  return {
    id: getFlaggedItemId(deck.id, 'quiz', question.id),
    deckId: deck.id,
    deckTitle: deck.title,
    courseId: deck.courseId,
    courseName: deck.courseName,
    kind: 'quiz',
    itemId: question.id,
    title: 'Quiz question',
    prompt: question.prompt,
    answer: question.options[question.correctIndex] ?? question.explanation,
    explanation: question.explanation,
    source: question.source,
  };
}

export function StudyPackScreen({
  deckId,
  deckOverride,
  shared = false,
  sharedMetadata,
  onSaveShared,
  initialTool = 'overview',
  onBack,
  onPlan,
  onStartStudy,
  onOpenExam,
  onRequireAuth,
}: {
  deckId: string;
  deckOverride?: StudyPack;
  shared?: boolean;
  sharedMetadata?: SharedStudyPackMetadata;
  onSaveShared?: () => void;
  initialTool?: StudyTool;
  onBack: () => void;
  onPlan: (deckId: string) => void;
  onStartStudy?: (mode: SmartStudyMode, deckId: string) => void;
  onOpenExam?: (deckId?: string) => void;
  onRequireAuth?: () => void;
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
            <Text style={[styles.sharedBannerTitle, { color: colors.text }]}>Shared by {sharedMetadata?.creatorDisplayName ?? 'a StudyBolt student'}</Text>
            <Text numberOfLines={2} style={[styles.sharedBannerText, { color: colors.textSecondary }]}>{sharedMetadata?.description || `${sharedMetadata?.itemCount ?? deck.notes.length + deck.flashcards.length} study items · Save your own editable copy.`}</Text>
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
            <Pressable key={tab.id} onPress={() => setTool(tab.id)} style={[styles.tab, active && { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tool === 'overview' ? <Overview deck={deck} onTool={setTool} onPlan={() => onPlan(deck.id)} onStartStudy={onStartStudy ? (mode) => onStartStudy(mode, deck.id) : undefined} shared={shared} /> : null}
        {tool === 'notes' ? <Notes deck={deck} readOnly={shared} /> : null}
        {tool === 'flashcards' ? <Flashcards deck={deck} readOnly={shared} /> : null}
        {tool === 'quiz' ? <Quiz deck={deck} readOnly={shared} onOpenExam={onOpenExam} /> : null}
        {tool === 'audio' ? <AudioPlayer deck={deck} readOnly={shared} onRequireAuth={onRequireAuth} /> : null}
        {tool === 'coach' ? <StudyCoach deck={deck} onTool={setTool} onStartStudy={onStartStudy ? (mode) => onStartStudy(mode, deck.id) : undefined} /> : null}
      </ScrollView>
      {!shared ? <StudyPackShareSheet deck={deck} visible={shareVisible} onClose={() => setShareVisible(false)} onRequireAuth={onRequireAuth} /> : null}
    </View>
  );
}

function Overview({ deck, onTool, onPlan, onStartStudy, shared }: { deck: StudyPack; onTool: (tool: StudyTool) => void; onPlan: () => void; onStartStudy?: (mode: SmartStudyMode) => void; shared?: boolean }) {
  const { colors, state } = useStudyBolt();
  const mastery = calculateMastery(deck);
  return (
    <>
      <View style={styles.deckHero}>
        <View style={[styles.deckArt, { backgroundColor: `${deck.color}22` }]}><Text style={styles.deckEmoji}>{deck.emoji}</Text></View>
        <View style={styles.deckHeroCopy}>
          <View style={styles.deckLabelRow}>
            <Pill label={deck.fileType === 'demo' ? 'INTERACTIVE SAMPLE' : 'STUDY PACK'} tone={deck.fileType === 'demo' ? 'purple' : 'blue'} />
            <Text style={[styles.slideCount, { color: colors.textMuted }]}>{deck.pageCount} {pageLabel(deck.fileType)}</Text>
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

      <Card style={[styles.masteryCard, styles.flatCard, { backgroundColor: colors.mode === 'dark' ? colors.primarySoft : '#EEF5FF' }]}>
        <View style={styles.masteryTop}>
          <View>
            <Text style={[styles.masteryLabel, { color: colors.textSecondary }]}>ESTIMATED MASTERY</Text>
            <Text style={[styles.masteryValue, { color: colors.text }]}>{mastery.overall}%</Text>
          </View>
          <View style={[styles.masteryRing, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}><Icon name="lightning-bolt" size={24} color={colors.goldText} /></View>
        </View>
        <ProgressBar progress={mastery.overall} />
        <Text style={[styles.masteryHint, { color: colors.textSecondary }]}>{mastery.weakCount} flashcards still need retrieval practice.</Text>
      </Card>

      <View style={styles.toolGrid}>
        <ToolCard icon="note-text-outline" title="Layered Notes" detail="Simplified + full-detail views" color={colors.primary} background={colors.primarySoft} onPress={() => onTool('notes')} />
        <ToolCard icon="cards-outline" title="Flashcards" detail={`${deck.flashcards.length} active recall cards`} color={colors.purple} background={colors.purpleSoft} onPress={() => onTool('flashcards')} />
        <ToolCard icon="clipboard-text-outline" title="Quiz & Full Test" detail={`${state.quizQuestionCount} practice questions + cumulative test`} color={colors.mint} background={colors.mintSoft} onPress={() => onTool('quiz')} />
        <ToolCard icon="headphones" title="StudyCast" detail="Listen and ask about any section" color="#A45FEB" background={colors.purpleSoft} onPress={() => onTool('audio')} />
      </View>

      <Card onPress={() => onTool('coach')} style={[styles.coachBanner, styles.flatCard, { backgroundColor: colors.mode === 'dark' ? colors.primarySoft : '#EEF5FF' }]}>
        <View style={[styles.coachBannerIcon, { backgroundColor: colors.primary }]}><Icon name="creation" size={23} color={colors.primaryText} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.coachBannerTitle, { color: colors.text }]}>Ask, connect, or teach it back</Text>
          <Text style={[styles.coachBannerText, { color: colors.textSecondary }]}>Use your own material to surface key ideas, misconceptions, and concept links.</Text>
        </View>
        <Icon name="arrow-right" color={colors.primary} />
      </Card>

      {!shared && onStartStudy ? (
        <View style={styles.deckAdaptiveActions}>
          <Pressable onPress={() => onStartStudy('smart')} style={[styles.deckAdaptivePrimary, { backgroundColor: colors.primary }]}><Icon name="lightning-bolt" color={colors.goldBright} /><View><Text style={[styles.deckAdaptiveTitle, { color: colors.primaryText }]}>Study this pack</Text><Text style={[styles.deckAdaptiveText, { color: colors.primaryText }]}>Adaptive mix</Text></View></Pressable>
          <Pressable onPress={() => onStartStudy('pretest')} style={[styles.deckAdaptiveSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}><Icon name="radar" color={colors.primary} /><View><Text style={[styles.deckAdaptiveTitle, { color: colors.text }]}>Pre-test</Text><Text style={[styles.deckAdaptiveText, { color: colors.textMuted }]}>Find your baseline</Text></View></Pressable>
        </View>
      ) : null}

      <SectionHeader title="Lecture overview" />
      <Card style={styles.flatCard}>
        <Text style={[styles.overviewText, { color: colors.textSecondary }]}>{deck.overview}</Text>
      </Card>

      <SectionHeader title="Slide outline" action="Source order" />
      <View style={styles.outlineList}>
        {deck.outline.map((item, index) => (
          <Card key={item.id} style={[styles.outlineCard, styles.flatCard]}>
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
        <Card style={[styles.planCard, styles.flatCard, { backgroundColor: colors.mintSoft }]}>
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
    <Card onPress={onPress} style={[styles.toolCard, styles.flatCard]}>
      <View style={[styles.toolIcon, { backgroundColor: background }]}><Icon name={icon} size={25} color={color} /></View>
      <View style={styles.toolCopy}>
        <Text style={[styles.toolTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.toolDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.textMuted} />
    </Card>
  );
}

type NoteMode = 'simplified' | 'detailed';

function NoteBulletList({ points, color }: { points: string[]; color: string }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.bullets}>
      {points.map((point) => (
        <View key={point} style={styles.bulletRow}>
          <View style={[styles.bullet, { backgroundColor: color }]} />
          <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{point}</Text>
        </View>
      ))}
    </View>
  );
}

function Notes({ deck, readOnly = false }: { deck: StudyPack; readOnly?: boolean }) {
  const { colors, recordStudyEvent, updateDeck, toggleFlag, isFlagged } = useStudyBolt();
  const [mode, setMode] = useState<NoteMode>('simplified');
  const mastery = calculateMastery(deck);
  const notes: NoteBlock[] = mode === 'detailed' && deck.detailedNotes.length ? deck.detailedNotes : deck.notes;
  const coverageTotal = deck.outline.length || notes.length;
  const coveredSections = Math.min(new Set(notes.map((note) => note.source.sectionId)).size, coverageTotal);
  const completeCoverage = coverageTotal > 0 && coveredSections >= coverageTotal;
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
      <View style={[styles.noteModeSwitcher, { backgroundColor: colors.cardStrong }]}>
        {([
          { id: 'simplified', label: 'Simplified', icon: 'lightning-bolt-outline' },
          { id: 'detailed', label: 'Detailed', icon: 'text-box-multiple-outline' },
        ] as Array<{ id: NoteMode; label: string; icon: IconName }>).map((item) => {
          const active = mode === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setMode(item.id)}
              style={[styles.noteMode, active && { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
            >
              <Icon name={item.icon} size={18} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.noteModeText, { color: active ? colors.text : colors.textMuted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.toolHeadingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toolHeading, { color: colors.text }]}>{mode === 'simplified' ? 'Simplified Notes' : 'Detailed Notes'}</Text>
          <Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>
            {mode === 'simplified' ? 'A condensed map of the ideas you need first.' : 'More of the source wording, organized into a full study outline.'}
          </Text>
        </View>
        <Pill label={mode === 'detailed' ? `${coveredSections}/${coverageTotal} covered` : `${mastery.notes}% read`} tone={mode === 'detailed' && completeCoverage ? 'mint' : 'blue'} />
      </View>
      <View style={[styles.noteGuide, { backgroundColor: mode === 'detailed' ? colors.purpleSoft : colors.primarySoft }]}>
        <Icon name={mode === 'detailed' ? 'layers-triple-outline' : 'bookmark-check-outline'} color={mode === 'detailed' ? colors.purple : colors.primary} size={20} />
        <Text style={[styles.noteGuideText, { color: colors.textSecondary }]}>
          {mode === 'simplified'
            ? 'Use this for a fast first pass, quick review, and deciding what deserves deeper study.'
            : 'Use this when you need the fuller lecture model, supporting claims, relationships, and source-linked recall.'}
        </Text>
      </View>
      <View style={styles.noteList}>
        {notes.map((note, index) => {
          const reviewed = deck.reviewedNoteIds.includes(note.id);
          return (
            <Card key={note.id} style={styles.noteCard}>
              <View style={styles.noteTop}>
                <View style={[styles.noteNumber, { backgroundColor: colors.primarySoft }]}><Text style={[styles.noteNumberText, { color: colors.primary }]}>{index + 1}</Text></View>
                <View style={styles.noteHeadingCopy}>
                  <Text style={[styles.noteTitle, { color: colors.text }]}>{note.title}</Text>
                  <Text style={[styles.source, { color: colors.textMuted }]}>{note.source.label}</Text>
                </View>
                {!readOnly ? <FlagButton flagged={isFlagged(getFlaggedItemId(deck.id, 'note', note.id))} onPress={() => toggleFlag(noteFlag(deck, note))} /> : null}
              </View>
              {note.summary ? (
                <View style={[styles.noteSummary, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.noteBlockLabel, { color: colors.primary }]}>BIG PICTURE</Text>
                  <Text style={[styles.noteSummaryText, { color: colors.text }]}>{note.summary}</Text>
                </View>
              ) : null}
              <Text style={[styles.noteSectionLabel, { color: colors.textMuted }]}>CORE IDEAS</Text>
              <NoteBulletList points={note.bullets} color={colors.primary} />
              {mode === 'detailed' ? note.sections?.map((section) => (
                <View key={section.heading} style={[styles.detailSection, { borderTopColor: colors.border }]}>
                  <View style={styles.detailSectionHeading}>
                    <View style={[styles.detailSectionIcon, { backgroundColor: colors.cardStrong }]}><Icon name="subdirectory-arrow-right" size={16} color={colors.primary} /></View>
                    <Text style={[styles.detailSectionTitle, { color: colors.text }]}>{section.heading}</Text>
                  </View>
                  <NoteBulletList points={section.points} color={colors.textMuted} />
                </View>
              )) : null}
              {mode === 'detailed' && note.connections?.length ? (
                <View style={[styles.connectionBlock, { backgroundColor: colors.purpleSoft }]}>
                  <View style={styles.noteBlockHeading}><Icon name="transit-connection-variant" size={17} color={colors.purple} /><Text style={[styles.noteBlockLabel, { color: colors.purple }]}>HOW IT CONNECTS</Text></View>
                  <NoteBulletList points={note.connections} color={colors.purple} />
                </View>
              ) : null}
              {mode === 'detailed' && note.examples?.length ? (
                <View style={[styles.exampleBlock, { backgroundColor: `${colors.warning}18` }]}>
                  <View style={styles.noteBlockHeading}><Icon name="flask-outline" size={17} color={colors.warning} /><Text style={[styles.noteBlockLabel, { color: colors.warning }]}>EXAMPLE</Text></View>
                  {note.examples.map((example) => <Text key={example} style={[styles.exampleText, { color: colors.textSecondary }]}>{example}</Text>)}
                </View>
              ) : null}
              {note.keyIdea ? (
                <View style={[styles.keyIdea, { backgroundColor: colors.mintSoft }]}>
                  <Icon name="lightbulb-on-outline" size={18} color={colors.mint} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.keyIdeaLabel, { color: colors.mint }]}>KEY IDEA</Text>
                    <Text style={[styles.keyIdeaText, { color: colors.textSecondary }]}>{note.keyIdea}</Text>
                  </View>
                </View>
              ) : null}
              {note.recallPrompts?.length ? (
                <View style={[styles.recallBlock, { borderColor: `${colors.purple}55`, backgroundColor: colors.purpleSoft }]}>
                  <View style={styles.noteBlockHeading}><Icon name="brain" size={18} color={colors.purple} /><Text style={[styles.noteBlockLabel, { color: colors.purple }]}>RETRIEVE IT</Text></View>
                  <Text style={[styles.recallHint, { color: colors.textMuted }]}>Look away from the notes and answer:</Text>
                  {note.recallPrompts.map((prompt, promptIndex) => (
                    <View key={prompt} style={styles.recallPrompt}>
                      <Text style={[styles.recallNumber, { color: colors.purple }]}>{promptIndex + 1}</Text>
                      <Text style={[styles.recallText, { color: colors.textSecondary }]}>{prompt}</Text>
                    </View>
                  ))}
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
  const { colors, recordStudyEvent, updateDeck, toggleFlag, isFlagged } = useStudyBolt();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const cardShownAt = useRef(Date.now());
  const answerRevealedAt = useRef<number | null>(null);
  const card = deck.flashcards[index];

  useEffect(() => {
    cardShownAt.current = Date.now();
    answerRevealedAt.current = null;
  }, [card?.id]);

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
      responseTimeMs: answerRevealedAt.current === null ? undefined : Math.max(0, answerRevealedAt.current - cardShownAt.current),
      durationMinutes: Math.max(0.1, Math.round(((Date.now() - cardShownAt.current) / 6000)) / 10),
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
      <View style={styles.flashcardToolbar}>
        <View style={styles.flashcardSource}>
          <Icon name="source-branch" size={15} color={colors.textMuted} />
          <Text style={[styles.source, { color: colors.textMuted }]}>{card.source.label}</Text>
        </View>
        {!readOnly ? <FlagButton flagged={isFlagged(getFlaggedItemId(deck.id, 'flashcard', card.id))} onPress={() => toggleFlag(flashcardFlag(deck, card))} /> : null}
      </View>
      <Pressable onPress={() => setRevealed((value) => {
        if (!value && answerRevealedAt.current === null) answerRevealedAt.current = Date.now();
        return !value;
      })} style={{ marginTop: 20 }}>
        <Card style={[styles.flashcard, { borderColor: revealed ? colors.purple : colors.border, backgroundColor: revealed ? colors.purpleSoft : colors.card }]}>
          <View style={styles.flashcardTop}>
            <Pill label={revealed ? 'ANSWER' : 'QUESTION'} tone="purple" />
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

function Quiz({ deck, readOnly = false, onOpenExam }: { deck: StudyPack; readOnly?: boolean; onOpenExam?: (deckId?: string) => void }) {
  const { colors, recordStudyEvent, state, setQuizQuestionCount, updateDeck, toggleFlag, isFlagged } = useStudyBolt();
  const [kind, setKind] = useState<AssessmentKind>('practice');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerConfidence, setAnswerConfidence] = useState<AnswerConfidence | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswerRecord[]>([]);
  const quizStartedAt = useRef(Date.now());
  const questionShownAt = useRef(Date.now());
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
    setAnswerConfidence(null);
    setCorrectCount(0);
    setAnswers([]);
    setFinished(false);
    setRecorded(false);
    quizStartedAt.current = Date.now();
  }, [deck.id, kind, state.quizQuestionCount]);

  useEffect(() => {
    questionShownAt.current = Date.now();
    setAnswerConfidence(null);
  }, [question?.id]);

  if (!question) return <EmptyTool icon="clipboard-alert-outline" title="No quiz yet" message="No quiz questions were available for this Study Pack." />;

  const choose = (optionIndex: number) => {
    if (selected !== null) return;
    setSelected(optionIndex);
    const correct = optionIndex === question.correctIndex;
    if (correct) setCorrectCount((count) => count + 1);
    setAnswers((current) => [...current, {
      questionId: question.id,
      originQuestionId: question.originQuestionId ?? question.id,
      sourceSectionId: question.source.sectionId,
      sourceDeckId: deck.id,
      conceptId: question.conceptId ?? `${deck.id}:${question.source.sectionId}`,
      correct,
      partialCredit: correct ? 1 : 0,
      questionType: question.type,
      difficulty: question.difficulty ?? (index === 0 ? 'easy' : index === questions.length - 1 ? 'hard' : 'medium'),
      selectedIndex: optionIndex,
      correctIndex: question.correctIndex,
      selectedAnswer: question.options[optionIndex],
      correctAnswer: question.options[question.correctIndex],
      responseTimeMs: Math.max(0, Date.now() - questionShownAt.current),
      answeredAt: new Date().toISOString(),
      confidence: answerConfidence ?? undefined,
      sequence: index,
    }]);
  };

  const next = () => {
    if (selected === null) return;
    if (index < questions.length - 1) {
      setIndex((value) => value + 1);
      setSelected(null);
      setAnswerConfidence(null);
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
        durationMinutes: Math.max(0.1, Math.round(((Date.now() - quizStartedAt.current) / 6000)) / 10),
        quizScore: score,
        quizAnswers: answers,
        assessmentKind: kind,
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
        <PrimaryButton label="Try a fresh run" icon="refresh" onPress={() => { setIndex(0); setSelected(null); setAnswerConfidence(null); setCorrectCount(0); setAnswers([]); setFinished(false); setRecorded(false); quizStartedAt.current = Date.now(); questionShownAt.current = Date.now(); }} />
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
        {!readOnly && onOpenExam ? (
          <Pressable onPress={() => onOpenExam(deck.id)} style={[styles.adaptiveExamLink, { backgroundColor: colors.card, borderColor: colors.primary }]}> 
            <Icon name="lightning-bolt" size={17} color={colors.primary} />
            <View style={{ flex: 1 }}><Text style={[styles.adaptiveExamLinkTitle, { color: colors.text }]}>Open Adaptive Exam</Text><Text style={[styles.adaptiveExamLinkText, { color: colors.textSecondary }]}>Multi-pack sources, targeted concepts, timer, and full analytics</Text></View>
            <Icon name="arrow-right" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
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
          <View style={styles.questionMetaRight}>
            <Text style={[styles.source, { color: colors.textMuted }]}>{question.source.label}</Text>
            {!readOnly ? <FlagButton flagged={isFlagged(getFlaggedItemId(deck.id, 'quiz', question.id))} onPress={() => toggleFlag(quizFlag(deck, question))} /> : null}
          </View>
        </View>
        <Text style={[styles.question, { color: colors.text }]}>{question.prompt}</Text>
        <View style={styles.answerConfidenceBlock}>
          <View style={styles.answerConfidenceHeading}>
            <Text style={[styles.answerConfidenceLabel, { color: colors.textSecondary }]}>How sure are you?</Text>
            <Text style={[styles.answerConfidenceOptional, { color: colors.textMuted }]}>Optional · choose before answering</Text>
          </View>
          <View style={styles.answerConfidenceChoices}>
            {([
              { id: 'unsure', label: 'Guess' },
              { id: 'somewhat-sure', label: 'Unsure' },
              { id: 'very-sure', label: 'Confident' },
            ] as Array<{ id: AnswerConfidence; label: string }>).map((item) => {
              const active = answerConfidence === item.id;
              return (
                <Pressable
                  key={item.id}
                  disabled={selected !== null}
                  onPress={() => setAnswerConfidence(item.id)}
                  style={[styles.answerConfidenceChoice, { backgroundColor: active ? colors.primarySoft : colors.cardStrong, borderColor: active ? colors.primary : colors.border, opacity: selected !== null && !active ? 0.55 : 1 }]}
                >
                  <Text style={[styles.answerConfidenceChoiceText, { color: active ? colors.primary : colors.textMuted }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
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
            <Text style={[styles.feedbackTitle, { color: colors.text }]}>{selected === question.correctIndex ? 'Correct' : answerConfidence === 'very-sure' ? 'Confident, but incorrect' : 'Not quite'}</Text>
            <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>{question.explanation}</Text>
            {selected !== question.correctIndex && answerConfidence === 'very-sure' ? <Text style={[styles.confidentWrongText, { color: colors.danger }]}>High-priority misconception · added to adaptive review</Text> : null}
          </View>
        </Card>
      ) : null}
      <PrimaryButton label={index === questions.length - 1 ? 'See results' : 'Next question'} icon="arrow-right" disabled={selected === null} onPress={next} style={styles.nextButton} />
    </>
  );
}

type CoachView = 'ask' | 'teach' | 'connect';
type CoachAnswer = { title: string; lines: string[] };

function StudyCoach({ deck, onTool, onStartStudy }: { deck: StudyPack; onTool: (tool: StudyTool) => void; onStartStudy?: (mode: SmartStudyMode) => void }) {
  const { colors } = useStudyBolt();
  const { getAccessToken } = useAuth();
  const [view, setView] = useState<CoachView>('ask');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<CoachAnswer>();
  const [noteIndex, setNoteIndex] = useState(0);
  const [teaching, setTeaching] = useState('');
  const [feedback, setFeedback] = useState<{ score: number; covered: string[]; missing: string[] }>();
  const [coachLoading, setCoachLoading] = useState(false);
  const note = deck.notes[noteIndex] ?? deck.notes[0];

  const answerPrompt = async (kind: 'important' | 'confuse' | 'weak' | 'custom') => {
    if (kind === 'important' || kind === 'confuse' || kind === 'custom') {
      setCoachLoading(true);
      const accessToken = await getAccessToken();
      const result = await runStudyBoltAI({
        action: kind === 'custom' ? 'ask' : kind,
        question: kind === 'custom' ? question : undefined,
        context: tutorContextAtPosition(deck, 0, Math.max(1, deck.quickReview.split(/\s+/).length)),
        accessToken,
        depth: kind === 'important' ? 'deep' : 'normal',
      });
      setCoachLoading(false);
      if (result.response?.answer) {
        setAnswer({ title: kind === 'important' ? 'The highest-yield ideas' : kind === 'confuse' ? 'Likely points of confusion' : 'From your material', lines: result.response.answer.split(/\n+/).map((line) => line.replace(/^[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 7) });
        return;
      }
      if (result.error && kind === 'important') {
        setAnswer({ title: 'The highest-yield ideas', lines: deck.notes.slice(0, 5).map((item) => `${item.title}: ${item.keyIdea ?? item.summary ?? item.bullets[0]}`) });
      } else if (result.error && kind === 'confuse') {
        const connectionLines = deck.detailedNotes.flatMap((item) => item.connections ?? []).slice(0, 4);
        setAnswer({ title: 'Likely points of confusion', lines: connectionLines.length ? connectionLines : deck.notes.slice(0, 3).map((item, index) => `Keep “${item.title}” separate from “${deck.notes[index + 1]?.title ?? deck.notes[0]?.title}”: ${item.keyIdea ?? item.bullets[0]}`) });
      } else if (result.error && kind === 'custom') {
        const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
        const matches = deck.notes.filter((item) => terms.some((term) => [item.title, item.summary, item.keyIdea, ...item.bullets].filter(Boolean).join(' ').toLowerCase().includes(term)));
        setAnswer({ title: matches.length ? 'From your material' : 'StudyBolt is taking a pause', lines: matches.length ? matches.slice(0, 4).map((item) => `${item.title}: ${item.summary ?? item.keyIdea ?? item.bullets[0]}`) : [result.error] });
      }
      return;
    }
    if (kind === 'weak') {
      const weak = deck.flashcards.filter((card) => card.confidence !== 'known');
      setAnswer({ title: 'Your weak-area test', lines: weak.length ? weak.slice(0, 5).map((card) => card.front) : ['No weak cards are marked right now. Run a mastery checkpoint to verify they still hold.'] });
      return;
    }
  };

  const checkTeaching = async () => {
    if (!note) return;
    const response = teaching.toLowerCase();
    const ideas = note.bullets.slice(0, 5);
    const matchesIdea = (idea: string) => idea.toLowerCase().split(/\W+/).filter((word) => word.length >= 6).some((word) => response.includes(word));
    const covered = ideas.filter(matchesIdea);
    const missing = ideas.filter((idea) => !matchesIdea(idea));
    setFeedback({ score: Math.round((covered.length / Math.max(1, ideas.length)) * 100), covered, missing });
    setCoachLoading(true);
    const accessToken = await getAccessToken();
    const result = await runStudyBoltAI({
      action: 'teach-back',
      question: `Student explanation for ${note.title}: ${teaching.trim()}`,
      context: tutorContextAtPosition(deck, 0, Math.max(1, deck.quickReview.split(/\s+/).length)),
      accessToken,
      depth: 'normal',
    });
    setCoachLoading(false);
    if (result.response?.answer) {
      setFeedback((current) => current ? { ...current, missing: [...current.missing, result.response!.answer] } : current);
    }
  };

  if (!note) return <EmptyTool icon="creation" title="Coach is getting ready" message="Add notes to this Study Pack to unlock source-grounded coaching." />;

  return (
    <>
      <View style={[styles.coachSwitcher, { backgroundColor: colors.cardStrong }]}>
        {([
          { id: 'ask', label: 'Ask', icon: 'message-text-outline' },
          { id: 'teach', label: 'Teach it', icon: 'account-voice' },
          { id: 'connect', label: 'Connect', icon: 'transit-connection-variant' },
        ] as Array<{ id: CoachView; label: string; icon: IconName }>).map((item) => {
          const active = view === item.id;
          return (
            <Pressable key={item.id} onPress={() => setView(item.id)} style={[styles.coachMode, active && { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name={item.icon} size={17} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.coachModeText, { color: active ? colors.text : colors.textMuted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {view === 'ask' ? (
        <>
          <View style={styles.toolHeadingRow}>
            <View style={{ flex: 1 }}><Text style={[styles.toolHeading, { color: colors.text }]}>Ask from my material</Text><Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>Answers stay grounded in this Study Pack.</Text></View>
            <View style={[styles.coachSpark, { backgroundColor: colors.primarySoft }]}><Icon name="creation" color={colors.primary} /></View>
          </View>
          <View style={styles.askSuggestions}>
            <AskSuggestion icon="numeric-5-circle-outline" label="5 most important things" onPress={() => void answerPrompt('important')} />
            <AskSuggestion icon="swap-horizontal" label="What might I confuse?" onPress={() => void answerPrompt('confuse')} />
            <AskSuggestion icon="target" label="Test only weak areas" onPress={() => void answerPrompt('weak')} />
          </View>
          <Card style={styles.askBox}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              multiline
              placeholder="Ask anything about this Study Pack…"
              placeholderTextColor={colors.textMuted}
              style={[styles.askInput, { color: colors.text }]}
            />
            <Pressable disabled={!question.trim() || coachLoading} onPress={() => void answerPrompt('custom')} style={[styles.askSend, { backgroundColor: colors.primary, opacity: question.trim() && !coachLoading ? 1 : 0.4 }]}><Icon name={coachLoading ? 'timer-sand' : 'arrow-up'} color={colors.primaryText} /></Pressable>
          </Card>
          {answer ? (
            <Card style={[styles.coachAnswer, { backgroundColor: colors.primarySoft }]}>
              <View style={styles.coachAnswerHeading}><Icon name="creation" color={colors.primary} /><Text style={[styles.coachAnswerTitle, { color: colors.text }]}>{answer.title}</Text></View>
              {answer.lines.map((line, index) => <View key={`${line}-${index}`} style={styles.coachAnswerLine}><View style={[styles.coachAnswerNumber, { backgroundColor: colors.card }]}><Text style={[styles.coachAnswerNumberText, { color: colors.primary }]}>{index + 1}</Text></View><Text style={[styles.coachAnswerText, { color: colors.textSecondary }]}>{line}</Text></View>)}
              {answer.title === 'Your weak-area test' ? <PrimaryButton label="Start weak-area quiz" icon="brain" onPress={() => onStartStudy ? onStartStudy('smart') : onTool('quiz')} style={styles.coachAnswerButton} /> : null}
            </Card>
          ) : null}
        </>
      ) : null}

      {view === 'teach' ? (
        <>
          <View style={styles.toolHeadingRow}>
            <View style={{ flex: 1 }}><Text style={[styles.toolHeading, { color: colors.text }]}>Teach it back</Text><Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>Explain naturally. StudyBolt checks ideas, not exact wording.</Text></View>
            <Pill label="FEYNMAN" tone="purple" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicChips}>
            {deck.notes.map((item, index) => <Pressable key={item.id} onPress={() => { setNoteIndex(index); setTeaching(''); setFeedback(undefined); }} style={[styles.topicChip, { backgroundColor: index === noteIndex ? colors.primary : colors.card, borderColor: index === noteIndex ? colors.primary : colors.border }]}><Text style={[styles.topicChipText, { color: index === noteIndex ? colors.primaryText : colors.textSecondary }]}>{item.title}</Text></Pressable>)}
          </ScrollView>
          <Card style={[styles.teachPromptCard, { backgroundColor: colors.purpleSoft }]}>
            <Text style={[styles.teachEyebrow, { color: colors.purple }]}>EXPLAIN IT TO A CLASSMATE</Text>
            <Text style={[styles.teachPrompt, { color: colors.text }]}>{note.recallPrompts?.[0] ?? `What is ${note.title}, and why does it matter?`}</Text>
            <TextInput
              multiline
              value={teaching}
              onChangeText={(value) => { setTeaching(value); setFeedback(undefined); }}
              placeholder="Use your own words…"
              placeholderTextColor={colors.textMuted}
              style={[styles.teachInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
            />
            <PrimaryButton label={coachLoading ? 'Checking ideas…' : 'Check my explanation'} icon="creation" disabled={teaching.trim().length < 12 || coachLoading} onPress={() => void checkTeaching()} />
          </Card>
          {feedback ? (
            <Card style={[styles.teachFeedback, { borderColor: feedback.score >= 70 ? colors.mint : colors.warning }]}>
              <View style={styles.teachFeedbackTop}><View><Text style={[styles.teachFeedbackLabel, { color: colors.textMuted }]}>IDEA COVERAGE</Text><Text style={[styles.teachScore, { color: feedback.score >= 70 ? colors.mint : colors.warning }]}>{feedback.score}%</Text></View><Icon name={feedback.score >= 70 ? 'check-decagram-outline' : 'puzzle-outline'} size={35} color={feedback.score >= 70 ? colors.mint : colors.warning} /></View>
              <ProgressBar progress={feedback.score} color={feedback.score >= 70 ? colors.mint : colors.warning} />
              <Text style={[styles.feedbackSectionLabel, { color: colors.mint }]}>YOU COVERED</Text>
              <Text style={[styles.feedbackSectionText, { color: colors.textSecondary }]}>{feedback.covered.length ? feedback.covered.join(' ') : 'You started an explanation, but the source’s central ideas did not appear clearly yet.'}</Text>
              {feedback.missing.length ? <><Text style={[styles.feedbackSectionLabel, { color: colors.warning }]}>ADD OR CLARIFY</Text><Text style={[styles.feedbackSectionText, { color: colors.textSecondary }]}>{feedback.missing.slice(0, 2).join(' ')}</Text></> : null}
            </Card>
          ) : null}
        </>
      ) : null}

      {view === 'connect' ? (
        <>
          <View style={styles.toolHeadingRow}>
            <View style={{ flex: 1 }}><Text style={[styles.toolHeading, { color: colors.text }]}>Concept connections</Text><Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>Tap a concept to see how it fits the system.</Text></View>
            <Pill label={`${deck.notes.length} NODES`} tone="mint" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicChips}>
            {deck.notes.map((item, index) => <Pressable key={item.id} onPress={() => setNoteIndex(index)} style={[styles.topicChip, { backgroundColor: index === noteIndex ? colors.purple : colors.card, borderColor: index === noteIndex ? colors.purple : colors.border }]}><Text style={[styles.topicChipText, { color: index === noteIndex ? colors.primaryText : colors.textSecondary }]}>{item.title}</Text></Pressable>)}
          </ScrollView>
          <View style={styles.mapWrap}>
            <View style={[styles.mapNode, styles.mapNodeCenter, { backgroundColor: colors.primary, shadowColor: colors.shadow }]}><Icon name="hexagon-multiple-outline" color={colors.primaryText} /><Text style={styles.mapCenterTitle}>{note.title}</Text></View>
            <View style={[styles.mapLine, { backgroundColor: colors.border }]} />
            <View style={styles.connectionList}>
              {(note.connections?.length ? note.connections : [note.keyIdea ?? note.summary ?? note.bullets[0]]).slice(0, 4).map((connection, index) => (
                <Card key={`${connection}-${index}`} style={styles.connectionNode}>
                  <View style={[styles.connectionDot, { backgroundColor: index % 2 ? colors.mintSoft : colors.purpleSoft }]}><Icon name={index % 2 ? 'arrow-decision-outline' : 'link-variant'} size={17} color={index % 2 ? colors.mint : colors.purple} /></View>
                  <Text style={[styles.connectionText, { color: colors.textSecondary }]}>{connection}</Text>
                </Card>
              ))}
            </View>
          </View>
          <View style={[styles.connectionHint, { backgroundColor: colors.mintSoft }]}><Icon name="gesture-tap" color={colors.mint} size={18} /><Text style={[styles.connectionHintText, { color: colors.textSecondary }]}>Connections come from the relationships and sequences in your uploaded material—not from a generic topic graph.</Text></View>
        </>
      ) : null}
    </>
  );
}

function AskSuggestion({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return <Pressable onPress={onPress} style={[styles.askSuggestion, { backgroundColor: colors.card, borderColor: colors.border }]}><Icon name={icon} size={19} color={colors.primary} /><Text style={[styles.askSuggestionText, { color: colors.textSecondary }]}>{label}</Text><Icon name="chevron-right" size={17} color={colors.textMuted} /></Pressable>;
}

function AudioPlayer({ deck, readOnly = false, onRequireAuth }: { deck: StudyPack; readOnly?: boolean; onRequireAuth?: () => void }) {
  const { colors, recordStudyEvent, updateDeck } = useStudyBolt();
  const { user, getAccessToken } = useAuth();
  const [mode, setMode] = useState<'original' | 'summary'>('summary');
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [position, setPosition] = useState(deck.audioPosition);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [voiceIdentifier, setVoiceIdentifier] = useState<string>();
  const [speedSheetVisible, setSpeedSheetVisible] = useState(false);
  const [voiceSheetVisible, setVoiceSheetVisible] = useState(false);
  const [askVisible, setAskVisible] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [driveModeVisible, setDriveModeVisible] = useState(false);
  const [voiceSessionState, setVoiceSessionState] = useState<VoiceSessionState>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceReply, setVoiceReply] = useState('');
  const [voiceTextInput, setVoiceTextInput] = useState('');
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceRecognizerAvailable, setVoiceRecognizerAvailable] = useState<boolean | null>(null);
  const [voiceError, setVoiceError] = useState<string>();
  const voiceInputRef = useRef<BrowserSpeechInput | null>(null);
  const voiceReplyRef = useRef('');
  const driveModeActiveRef = useRef(false);
  const voiceAutoListenRef = useRef(true);
  const voiceSpeechGenerationRef = useRef(0);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string>();
  const [tutorResponse, setTutorResponse] = useState<AiTutorResponse>();
  const [tutorQuota, setTutorQuota] = useState<AiTutorQuota>();
  const [tutorConversation, setTutorConversation] = useState<AiTutorConversation>({ turns: [] });
  const tutorConversationRef = useRef<AiTutorConversation>({ turns: [] });
  const tutorResponseRef = useRef<AiTutorResponse | undefined>(undefined);
  const [onDeviceAI, setOnDeviceAI] = useState(initialOnDeviceAIAvailability);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const askResumePositionRef = useRef(deck.audioPosition);
  const lastTutorRequestRef = useRef<{ action: AiTutorAction; question?: string }>({ action: 'explain' });
  const text = mode === 'original' ? deck.originalText : deck.quickReview;
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const voice = voices.find((item) => item.identifier === voiceIdentifier);
  const tutorContext = useMemo(() => tutorContextAtPosition(deck, position, words.length), [deck, position, words.length]);

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then((available) => {
      const english = available.filter((item) => item.language.toLowerCase().startsWith('en'));
      setVoices((english.length ? english : available).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60));
    }).catch(() => setVoices([]));
    return () => {
      driveModeActiveRef.current = false;
      voiceAutoListenRef.current = false;
      voiceSpeechGenerationRef.current += 1;
      if (intervalRef.current) clearInterval(intervalRef.current);
      voiceInputRef.current?.stop();
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getOnDeviceAIAvailability().then((availability) => {
      if (!active) return;
      setOnDeviceAI(availability);
      if (canAttemptOnDeviceAI(availability)) setTutorQuota(undefined);
    });
    return () => { active = false; };
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
    if (startedAt === null || nextPosition <= startedAt || readOnly) return;
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
  const playFrom = (requestedPosition: number) => {
    if (!words.length) return;
    const start = requestedPosition >= words.length ? 0 : Math.max(0, requestedPosition);
    setPosition(start);
    sessionStartRef.current = start;
    setPlaying(true);
    setVoiceSessionState(interactiveMode ? 'speaking' : 'idle');
    Speech.speak(words.slice(start).join(' '), {
      rate,
      voice: voice?.identifier,
      onDone: () => {
        setPlaying(false);
        setVoiceSessionState(interactiveMode ? 'paused' : 'idle');
        setPosition(words.length);
        persistPosition(words.length);
        recordAudioProgress(words.length);
      },
      onStopped: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };
  const togglePlay = async () => {
    if (playing) { await stopAt(position); setVoiceSessionState(interactiveMode ? 'paused' : 'idle'); }
    else playFrom(position);
  };
  const switchMode = async (next: 'original' | 'summary') => {
    await Speech.stop();
    setPlaying(false);
    sessionStartRef.current = null;
    setMode(next);
    setPosition(0);
    persistPosition(0);
  };
  const changeRate = (direction: -1 | 1) => {
    const currentIndex = PLAYBACK_RATES.indexOf(rate);
    const safeIndex = currentIndex < 0 ? PLAYBACK_RATES.indexOf(1) : currentIndex;
    const nextIndex = Math.max(0, Math.min(PLAYBACK_RATES.length - 1, safeIndex + direction));
    if (nextIndex === safeIndex) return;
    setRate(PLAYBACK_RATES[nextIndex] ?? 1);
    if (playing) void stopAt(position);
  };
  const selectRate = (nextRate: number) => {
    setRate(nextRate);
    setSpeedSheetVisible(false);
    if (playing) void stopAt(position);
  };
  const selectVoice = (nextVoice?: Speech.Voice) => {
    setVoiceIdentifier(nextVoice?.identifier);
    setVoiceSheetVisible(false);
    if (playing) void stopAt(position);
  };
  const previewVoice = (nextVoice?: Speech.Voice) => {
    void Speech.stop().then(() => Speech.speak('Hi, I’m ready to study with you.', { rate: 1, voice: nextVoice?.identifier }));
  };
  const skip = async (amount: number) => stopAt(Math.max(0, Math.min(words.length, position + amount)));

  const loadQuota = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const result = await fetchTutorQuota(accessToken);
    if (result.quota) setTutorQuota(result.quota);
  };
  const runTutor = async (action: AiTutorAction, question?: string, channel: AiRequestChannel = 'text'): Promise<AiTutorResponse | undefined> => {
    lastTutorRequestRef.current = { action, ...(question ? { question } : {}) };
    setTutorLoading(true);
    setTutorError(undefined);
    setTutorResponse(undefined);
    try {
      const accessToken = await getAccessToken();
      const result = await runStudyBoltAI({
        action,
        question,
        context: tutorContextAtPosition(deck, channel === 'voice' ? position : askResumePositionRef.current, words.length),
        accessToken,
        conversation: tutorConversationRef.current,
        depth: action === 'teach' || action === 'deep-dive' ? 'deep' : action === 'quick-answer' ? 'quick' : 'normal',
        channel,
      });
      setOnDeviceAI(result.availability);
      if (result.quota) {
        setTutorQuota(result.quota);
        if (result.quota.softWarning && !readOnly) recordStudyEvent({ type: 'ai-limit-warning', deckId: deck.id, courseId: deck.courseId });
      }
      if (result.error || !result.response) {
        setTutorError(result.error ?? 'StudyBolt couldn’t answer that right now.');
        return undefined;
      }
      if (result.routeUsed === 'on-device') setTutorQuota(undefined);
      setTutorResponse(result.response);
      tutorResponseRef.current = result.response;
      const nextConversation: AiTutorConversation = { turns: [
        ...(tutorConversationRef.current.turns ?? []),
        ...(question?.trim() ? [{ role: 'user' as const, content: question.trim() }] : []),
        { role: 'assistant' as const, content: result.response.answer || result.response.quiz?.question || '' },
      ].slice(-8) };
      tutorConversationRef.current = nextConversation;
      setTutorConversation(nextConversation);
      if (!readOnly) recordStudyEvent({ type: 'ai-tutor-question', deckId: deck.id, courseId: deck.courseId, tutorAction: action });
      return result.response;
    } catch {
      setTutorError('StudyBolt couldn’t answer that right now. Your StudyCast remains available.');
      return undefined;
    } finally {
      setTutorLoading(false);
    }
  };
  const openAsk = async (action?: AiTutorAction) => {
    const currentPosition = position;
    askResumePositionRef.current = currentPosition;
    if (playing) await stopAt(currentPosition);
    else await Speech.stop();
    setTutorError(undefined);
    setTutorResponse(undefined);
    tutorConversationRef.current = { turns: [] };
    setTutorConversation({ turns: [] });
    setAskVisible(true);
    if (!action && canAttemptOnDeviceAI(onDeviceAI)) setTutorQuota(undefined);
    else if (user && !action) void loadQuota();
    if (action && (user || canAttemptOnDeviceAI(onDeviceAI))) void runTutor(action);
  };
  const closeAsk = () => {
    void Speech.stop();
    setAskVisible(false);
    setTutorLoading(false);
  };
  const toggleInteractive = async () => {
    if (interactiveMode) {
      voiceAutoListenRef.current = false;
      voiceInputRef.current?.stop();
      voiceInputRef.current = null;
      setInteractiveMode(false);
      setVoiceSessionState('idle');
      return;
    }
    setInteractiveMode(true);
    setVoiceSessionState('paused');
    if (playing) await stopAt(position);
  };
  const openDriveMode = async () => {
    if (playing) await stopAt(position);
    driveModeActiveRef.current = true;
    voiceAutoListenRef.current = true;
    voiceSpeechGenerationRef.current += 1;
    tutorConversationRef.current = { turns: [] };
    tutorResponseRef.current = undefined;
    setTutorConversation({ turns: [] });
    setTutorResponse(undefined);
    setVoiceTranscript('');
    setVoiceReply('');
    setVoiceTextInput('');
    setVoiceError(undefined);
    setInteractiveMode(true);
    setVoiceSessionState('listening');
    setDriveModeVisible(true);
    if (!readOnly) recordStudyEvent({ type: 'voice-tutor-started', deckId: deck.id, courseId: deck.courseId });
    setTimeout(() => startVoiceInput(), 100);
  };
  const closeDriveMode = async () => {
    const wasActive = driveModeActiveRef.current;
    driveModeActiveRef.current = false;
    voiceAutoListenRef.current = false;
    voiceSpeechGenerationRef.current += 1;
    voiceInputRef.current?.stop();
    voiceInputRef.current = null;
    await Speech.stop();
    setPlaying(false);
    setDriveModeVisible(false);
    setVoiceSessionState('ended');
    if (wasActive && !readOnly) recordStudyEvent({ type: 'voice-tutor-completed', deckId: deck.id, courseId: deck.courseId });
  };

  const speakVoiceReply = (textToSpeak: string) => {
    const clean = textToSpeak.trim();
    if (!clean || !driveModeActiveRef.current) return;
    setVoiceReply(clean);
    voiceReplyRef.current = clean;
    setVoiceError(undefined);
    if (voiceMuted) {
      setVoiceSessionState('paused');
      if (voiceAutoListenRef.current) setTimeout(() => startVoiceInput(), 120);
      return;
    }
    const generation = ++voiceSpeechGenerationRef.current;
    setVoiceSessionState('speaking');
    void Speech.stop().then(() => Speech.speak(clean, {
      rate: 1,
      voice: voice?.identifier,
      onDone: () => {
        if (generation !== voiceSpeechGenerationRef.current || !driveModeActiveRef.current) return;
        if (voiceAutoListenRef.current) startVoiceInput();
        else setVoiceSessionState('paused');
      },
      onError: () => {
        if (generation !== voiceSpeechGenerationRef.current) return;
        setVoiceError('The device voice could not speak this answer. You can still read it below.');
        setVoiceSessionState('error');
      },
    }));
  };

  const quizOptionFromTranscript = (transcript: string, response: AiTutorResponse): number | null => {
    const quiz = response.quiz;
    if (!quiz) return null;
    const normalized = transcript.trim().toLowerCase().replace(/[.,!?]/g, '');
    const letterMatch = normalized.match(/^(?:option\s+)?([a-z])(?:\b|$)/);
    if (letterMatch) {
      const index = letterMatch[1]!.charCodeAt(0) - 97;
      if (index >= 0 && index < quiz.options.length) return index;
    }
    const exactIndex = quiz.options.findIndex((option) => option.toLowerCase().replace(/[.,!?]/g, '') === normalized);
    return exactIndex >= 0 ? exactIndex : null;
  };

  const handleVoiceTranscript = async (rawTranscript: string) => {
    const transcript = rawTranscript.trim();
    if (!transcript || !driveModeActiveRef.current) return;
    setVoiceTranscript(transcript);
    setVoiceError(undefined);

    const command = parseVoiceCommand(transcript);
    if (command === 'pause') {
      voiceAutoListenRef.current = false;
      setVoiceSessionState('paused');
      return;
    }
    if (command === 'exit') { await closeDriveMode(); return; }
    if (command === 'continue') { voiceAutoListenRef.current = false; playFrom(position); return; }
    if (command === 'back') { await skip(-34); speakVoiceReply('Moved back about fifteen seconds.'); return; }
    if (command === 'skip') { await skip(34); speakVoiceReply('Moved forward about fifteen seconds.'); return; }
    if (command === 'repeat') {
      if (voiceReplyRef.current) speakVoiceReply(voiceReplyRef.current);
      else playFrom(Math.max(0, position - 34));
      return;
    }

    const currentResponse = tutorResponseRef.current;
    if (currentResponse?.kind === 'quiz' && currentResponse.quiz) {
      const selectedIndex = quizOptionFromTranscript(transcript, currentResponse);
      if (selectedIndex !== null) {
        const correct = selectedIndex === currentResponse.quiz.correctIndex;
        if (!readOnly) recordStudyEvent({ type: 'tutor-quiz', deckId: deck.id, courseId: deck.courseId, tutorQuizCorrect: correct });
        speakVoiceReply(`${correct ? 'Correct.' : `Not quite. The correct answer is ${currentResponse.quiz.options[currentResponse.quiz.correctIndex]}.`} ${currentResponse.quiz.explanation} You can say quiz me for another question.`);
        return;
      }
    }

    setVoiceSessionState('processing');
    const action: AiTutorAction = /\bquiz me|question me|test me\b/i.test(transcript) ? 'quiz' : /\bsocratic|guide me\b/i.test(transcript) ? 'socratic' : /\bdeep dive|go deeper\b/i.test(transcript) ? 'deep-dive' : /\bteach me\b/i.test(transcript) ? 'teach' : /\bquick answer|briefly\b/i.test(transcript) ? 'quick-answer' : 'ask';
    const response = await runTutor(action, action === 'ask' ? transcript : undefined, 'voice');
    if (!driveModeActiveRef.current) return;
    if (!response) {
      setVoiceError('I could not answer that. Check your connection, sign in if needed, or type another question.');
      setVoiceSessionState('error');
      return;
    }
    const reply = response.kind === 'quiz' && response.quiz
      ? `${response.quiz.question} ${response.quiz.options.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`).join('. ')}`
      : response.answer;
    speakVoiceReply(reply);
  };

  const startVoiceInput = () => {
    if (!driveModeActiveRef.current) return;
    voiceAutoListenRef.current = true;
    voiceSpeechGenerationRef.current += 1;
    voiceInputRef.current?.stop();
    void Speech.stop();
    setPlaying(false);
    setVoiceError(undefined);
    let handled = false;
    const input = startBrowserSpeechInput((transcript) => {
      handled = true;
      voiceInputRef.current = null;
      void handleVoiceTranscript(transcript);
    }, () => {
      handled = true;
      voiceInputRef.current = null;
      setVoiceError('Speech recognition stopped. Tap the microphone to retry, or type your question.');
      setVoiceSessionState('error');
    }, { onEnd: () => {
      voiceInputRef.current = null;
      if (!handled && driveModeActiveRef.current) setVoiceSessionState('paused');
    } });
    voiceInputRef.current = input;
    setVoiceRecognizerAvailable(Boolean(input));
    if (input) setVoiceSessionState('listening');
    else {
      setVoiceError('Automatic speech recognition is unavailable in this build. Type below; StudyBolt can still answer aloud with your device voice.');
      setVoiceSessionState('paused');
    }
  };

  const pauseVoiceSession = async () => {
    voiceAutoListenRef.current = false;
    voiceSpeechGenerationRef.current += 1;
    voiceInputRef.current?.stop();
    voiceInputRef.current = null;
    await Speech.stop();
    setVoiceSessionState('paused');
  };

  const interruptVoice = async () => {
    voiceSpeechGenerationRef.current += 1;
    await Speech.stop();
    setVoiceSessionState('interrupted');
    if (!readOnly) recordStudyEvent({ type: 'voice-tutor-interrupted', deckId: deck.id, courseId: deck.courseId });
    startVoiceInput();
  };

  const submitVoiceText = () => {
    const question = voiceTextInput.trim();
    if (!question || voiceSessionState === 'processing') return;
    setVoiceTextInput('');
    voiceInputRef.current?.stop();
    voiceInputRef.current = null;
    void Speech.stop();
    void handleVoiceTranscript(question);
  };
  const resumeStudy = () => {
    void Speech.stop().then(() => {
      setAskVisible(false);
      setTutorResponse(undefined);
      setTutorError(undefined);
      playFrom(askResumePositionRef.current);
    });
  };

  const progress = words.length ? (position / words.length) * 100 : 0;
  const remainingMinutes = Math.max(0, Math.ceil((words.length - position) / (135 * rate)));
  const rateIndex = PLAYBACK_RATES.indexOf(rate);
  const canSlowDown = rateIndex > 0;
  const canSpeedUp = rateIndex >= 0 && rateIndex < PLAYBACK_RATES.length - 1;
  const formattedRate = `${Number.isInteger(rate) ? rate.toFixed(1) : rate.toString()}×`;
  const onDeviceTutorPossible = canAttemptOnDeviceAI(onDeviceAI);
  const tutorProvider = tutorResponse?.provider
    ?? (onDeviceAI.status === 'checking' ? 'checking' : onDeviceTutorPossible ? 'on-device' : 'cloud');
  const tutorProviderDetail = tutorProvider === 'on-device'
    ? onDeviceAI.status === 'available'
      ? 'Questions stay on this phone and do not use your monthly Tutor quota.'
      : onDeviceAI.reason
    : tutorProvider === 'checking'
      ? onDeviceAI.reason
      : 'Uses the authenticated StudyBolt backend when phone AI is unavailable.';

  return (
    <>
      <View style={styles.toolHeadingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toolHeading, { color: colors.text }]}>StudyCast</Text>
          <Text style={[styles.toolSubheading, { color: colors.textSecondary }]}>Listen offline. Ask AI only when you choose.</Text>
        </View>
        <Pill label="DEVICE TTS" tone="purple" />
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
        <Text style={styles.nowPlaying}>{mode === 'original' ? 'ORIGINAL STUDYCAST' : 'QUICK REVIEW'}</Text>
        <Text style={styles.audioTitle}>{deck.title}</Text>
        <Text style={styles.audioCourse}>{deck.courseName} · {remainingMinutes || '< 1'} min remaining</Text>
        <View style={styles.currentSection}><Text style={styles.currentSectionLabel}>NOW STUDYING</Text><Text numberOfLines={1} style={styles.currentSectionTitle}>{tutorContext.currentChunk.title}</Text></View>
        <View style={styles.audioProgress}><ProgressBar progress={progress} color={colors.purple} /></View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{Math.floor(position / (2.25 * rate) / 60)}:{Math.floor((position / (2.25 * rate)) % 60).toString().padStart(2, '0')}</Text>
          <Text style={styles.timeText}>≈ {Math.ceil(words.length / (135 * rate))}:00</Text>
        </View>
        <View style={styles.controls}>
          <Pressable accessibilityLabel="Skip back 15 seconds" onPress={() => void skip(-34)} style={styles.smallControl}><Icon name="rewind-15" color="#D9DCF0" size={29} /></Pressable>
          <Pressable accessibilityLabel={playing ? 'Pause audio' : 'Play audio'} onPress={() => void togglePlay()} style={[styles.playButton, { backgroundColor: colors.purple }]}><Icon name={playing ? 'pause' : 'play'} color={colors.primaryText} size={35} /></Pressable>
          <Pressable accessibilityLabel="Skip forward 15 seconds" onPress={() => void skip(34)} style={styles.smallControl}><Icon name="fast-forward-15" color="#D9DCF0" size={29} /></Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void openAsk()} style={styles.askStudyBoltButton}>
          <View style={styles.askStudyBoltIcon}><Icon name="creation" size={20} color="#C8B5FF" /></View>
          <View style={styles.askStudyBoltCopy}><Text style={styles.askStudyBoltTitle}>Ask StudyBolt</Text><Text style={styles.askStudyBoltText}>Pause and ask about this part</Text></View>
          <Icon name="chevron-right" size={20} color="#B1A8D0" />
        </Pressable>
      </Card>
      <View style={styles.audioSettings}>
        <Card style={styles.audioSettingCard}>
          <Pressable accessibilityRole="button" accessibilityLabel="Slow down audio" disabled={!canSlowDown} hitSlop={8} onPress={() => changeRate(-1)} style={[styles.settingArrow, !canSlowDown && styles.settingArrowDisabled]}><Icon name="chevron-left" color={colors.textMuted} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose playback speed" onPress={() => setSpeedSheetVisible(true)} style={styles.settingCenter}>
            <Icon name="speedometer" color={colors.primary} />
            <View style={styles.settingCopy}><Text style={[styles.settingLabel, { color: colors.textMuted }]}>SPEED</Text><Text style={[styles.settingValue, { color: colors.text }]}>{formattedRate}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Speed up audio" disabled={!canSpeedUp} hitSlop={8} onPress={() => changeRate(1)} style={[styles.settingArrow, !canSpeedUp && styles.settingArrowDisabled]}><Icon name="chevron-right" color={colors.textMuted} /></Pressable>
        </Card>
        <Card onPress={() => setVoiceSheetVisible(true)} style={styles.audioSettingCard}>
          <Icon name="account-voice" color={colors.mint} />
          <View style={styles.settingCopy}><Text style={[styles.settingLabel, { color: colors.textMuted }]}>VOICE</Text><Text numberOfLines={1} style={[styles.settingValue, { color: colors.text }]}>{voice?.name ?? 'Device default'}</Text></View>
          <Icon name="chevron-down" color={colors.textMuted} />
        </Card>
      </View>
      <View style={styles.contextActions}>
        {([{ id: 'explain', label: 'Explain', icon: 'lightbulb-on-outline' }, { id: 'simplify', label: 'Simplify', icon: 'creation' }, { id: 'example', label: 'Example', icon: 'flask-outline' }, { id: 'quiz', label: 'Quiz me', icon: 'brain' }] as Array<{ id: AiTutorAction; label: string; icon: IconName }>).map((action) => (
          <Pressable key={action.id} onPress={() => void openAsk(action.id)} style={[styles.contextAction, { backgroundColor: colors.purpleSoft }]}><Icon name={action.icon} size={16} color={colors.purple} /><Text style={[styles.contextActionText, { color: colors.purple }]}>{action.label}</Text></Pressable>
        ))}
      </View>
      <View style={styles.interactiveRow}>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: interactiveMode }} onPress={() => void toggleInteractive()} style={[styles.interactiveCard, { backgroundColor: interactiveMode ? colors.mintSoft : colors.card, borderColor: interactiveMode ? colors.mint : colors.border }]}>
          <View style={[styles.interactiveIcon, { backgroundColor: interactiveMode ? colors.mint : colors.primarySoft }]}><Icon name="account-voice" size={18} color={interactiveMode ? colors.primaryText : colors.primary} /></View>
          <View style={styles.interactiveCopy}><Text style={[styles.interactiveTitle, { color: colors.text }]}>Interactive StudyCast</Text><Text style={[styles.interactiveText, { color: colors.textSecondary }]}>{interactiveMode ? `${interactionStateLabel(voiceSessionState)} · pauses for recall` : 'Pause after sections and quiz yourself'}</Text></View>
          <Icon name={interactiveMode ? 'check-circle' : 'chevron-right'} size={19} color={interactiveMode ? colors.mint : colors.textMuted} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void openDriveMode()} style={[styles.driveButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Icon name="car" size={18} color={colors.purple} /><Text style={[styles.driveButtonText, { color: colors.text }]}>Drive mode</Text></Pressable>
      </View>
      <Card style={[styles.audioInfo, { backgroundColor: colors.primarySoft }]}><Icon name="information-outline" color={colors.primary} /><Text style={[styles.audioInfoText, { color: colors.textSecondary }]}>{mode === 'original' ? 'Original mode reads extracted lecture text in source order. Normal listening never calls AI.' : 'Quick Review uses the saved summary and device speech. AI runs only after you choose an Ask action.'}</Text></Card>
      {Platform.OS === 'web' ? <Text style={[styles.webAudio, { color: colors.textMuted }]}>Browser voice availability varies by operating system.</Text> : null}

      <SpeedPickerSheet visible={speedSheetVisible} rates={PLAYBACK_RATES} selected={rate} onSelect={selectRate} onClose={() => setSpeedSheetVisible(false)} />
      <VoicePickerSheet visible={voiceSheetVisible} voices={voices} selectedIdentifier={voiceIdentifier} onSelect={selectVoice} onPreview={previewVoice} onClose={() => { void Speech.stop(); setVoiceSheetVisible(false); }} />
      <AskStudyBoltSheet
        visible={askVisible}
        sectionTitle={tutorContext.currentChunk.title}
        signedIn={onDeviceTutorPossible || Boolean(user)}
        configured={onDeviceTutorPossible || isAiTutorConfigured}
        quota={tutorProvider === 'cloud' ? tutorQuota : undefined}
        loading={tutorLoading}
        error={tutorError}
        response={tutorResponse}
        provider={tutorProvider}
        providerDetail={tutorProviderDetail}
        onAsk={(action, question) => void runTutor(action, question)}
        onRetry={() => void runTutor(lastTutorRequestRef.current.action, lastTutorRequestRef.current.question)}
        onSpeak={(answer) => { void Speech.stop().then(() => Speech.speak(answer, { rate: 1, voice: voice?.identifier })); }}
        onResume={resumeStudy}
        onRequireAuth={onRequireAuth}
        onClose={closeAsk}
        onQuizAnswered={(correct) => { if (!readOnly) recordStudyEvent({ type: 'tutor-quiz', deckId: deck.id, courseId: deck.courseId, tutorQuizCorrect: correct }); }}
      />
      <Modal visible={driveModeVisible} animationType="fade" onRequestClose={() => void closeDriveMode()}>
        <View style={[styles.driveRoot, { backgroundColor: colors.mode === 'dark' ? '#09111B' : '#11162F' }]}>
          <View style={styles.driveTop}><View><Text style={styles.driveEyebrow}>STUDYBOLT DRIVE MODE</Text><Text style={styles.driveTitle}>{deck.title}</Text></View><Pressable accessibilityLabel="Exit Drive mode" onPress={() => void closeDriveMode()} style={styles.driveClose}><Icon name="close" color="#E8E9F7" size={23} /></Pressable></View>
          <View style={styles.driveCenter}>
            <View style={[styles.driveOrb, { backgroundColor: colors.purple }]}>{voiceSessionState === 'processing' || tutorLoading ? <ActivityIndicator color={colors.primaryText} size="large" /> : <Icon name={playing || voiceSessionState === 'speaking' ? 'volume-high' : voiceSessionState === 'listening' || voiceSessionState === 'interrupted' ? 'microphone' : 'pause'} color={colors.primaryText} size={44} />}</View>
            <Text style={styles.driveState}>{playing ? 'StudyCast is playing' : interactionStateLabel(voiceSessionState)}</Text>
            <Text style={styles.driveSection}>{tutorContext.currentChunk.title}</Text>
            <View style={styles.driveProgress}><ProgressBar progress={progress} color={colors.purple} /></View>
            {voiceTranscript ? <View style={styles.driveTranscript}><Text style={styles.driveMessageLabel}>YOU</Text><Text numberOfLines={2} style={styles.driveTranscriptText}>{voiceTranscript}</Text></View> : null}
            {voiceReply ? <View style={styles.driveReply}><Text style={styles.driveMessageLabel}>STUDYBOLT</Text><Text numberOfLines={5} style={styles.driveReplyText}>{voiceReply}</Text></View> : null}
            {voiceError ? <Text style={styles.driveError}>{voiceError}</Text> : <Text style={styles.driveHint}>{voiceRecognizerAvailable === false ? 'Text fallback is active. Answers still use your device voice unless muted.' : 'Ask about this section, say “quiz me,” or say pause, repeat, back, skip, continue, or exit.'}</Text>}
            {!user && !onDeviceTutorPossible && onRequireAuth ? <Pressable onPress={onRequireAuth} style={styles.driveSignIn}><Icon name="account-lock-outline" color="#C8B5FF" /><Text style={styles.driveSignInText}>Sign in for secure cloud answers</Text></Pressable> : null}
          </View>
          <View style={styles.driveInputRow}><TextInput accessibilityLabel="Type a voice tutor question" value={voiceTextInput} onChangeText={setVoiceTextInput} onSubmitEditing={submitVoiceText} returnKeyType="send" placeholder="Type if speech input is unavailable…" placeholderTextColor="#7F819E" style={styles.driveInput} /><Pressable accessibilityLabel="Send typed tutor question" disabled={!voiceTextInput.trim() || voiceSessionState === 'processing'} onPress={submitVoiceText} style={[styles.driveSend, (!voiceTextInput.trim() || voiceSessionState === 'processing') && styles.driveControlDisabled]}><Icon name="arrow-up" color="#FFFFFF" size={20} /></Pressable></View>
          <View style={styles.driveControls}><Pressable onPress={() => voiceSessionState === 'paused' || voiceSessionState === 'error' ? startVoiceInput() : void pauseVoiceSession()} style={styles.driveControl}><Icon name={voiceSessionState === 'paused' || voiceSessionState === 'error' ? 'play' : 'pause'} color="#E8E9F7" size={28} /><Text style={styles.driveControlText}>{voiceSessionState === 'paused' || voiceSessionState === 'error' ? 'Resume' : 'Pause'}</Text></Pressable><Pressable accessibilityLabel={voiceSessionState === 'speaking' ? 'Interrupt StudyBolt and speak' : 'Start listening'} onPress={() => voiceSessionState === 'speaking' ? void interruptVoice() : startVoiceInput()} style={[styles.drivePlay, { backgroundColor: colors.purple }]}><Icon name={voiceSessionState === 'speaking' ? 'hand-back-right-outline' : 'microphone'} color={colors.primaryText} size={35} /></Pressable><Pressable onPress={() => { const nextMuted = !voiceMuted; setVoiceMuted(nextMuted); if (nextMuted && voiceSessionState === 'speaking') void interruptVoice(); }} style={styles.driveControl}><Icon name={voiceMuted ? 'volume-off' : 'volume-high'} color="#E8E9F7" size={27} /><Text style={styles.driveControlText}>{voiceMuted ? 'Unmute' : 'Mute'}</Text></Pressable></View>
        </View>
      </Modal>
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
  tabScroller: { flexGrow: 0, flexShrink: 0, minHeight: 45, borderBottomWidth: StyleSheet.hairlineWidth },
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
  toolGrid: { gap: 8 },
  toolCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11 },
  toolIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolCopy: { flex: 1, minWidth: 0 },
  toolTitle: { fontSize: 13, fontWeight: '800' },
  toolDetail: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  coachBanner: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  coachBannerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  coachBannerTitle: { fontSize: 13, fontWeight: '900' },
  coachBannerText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  deckAdaptiveActions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  deckAdaptivePrimary: { flex: 1, minHeight: 62, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  deckAdaptiveSecondary: { flex: 1, minHeight: 62, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  deckAdaptiveTitle: { fontSize: 11, fontWeight: '900' },
  deckAdaptiveText: { fontSize: 8, marginTop: 2, opacity: 0.78 },
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
  flatCard: { shadowOpacity: 0, elevation: 0 },
  noteModeSwitcher: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4, marginBottom: 20 },
  noteMode: { flex: 1, minHeight: 43, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  noteModeText: { fontSize: 11, fontWeight: '900' },
  toolHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 15 },
  toolHeading: { fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7 },
  toolSubheading: { fontSize: 12, marginTop: 3 },
  noteGuide: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, padding: 12, marginBottom: 12 },
  noteGuideText: { flex: 1, fontSize: 11, lineHeight: 15 },
  noteList: { gap: 12 },
  noteCard: { padding: 18 },
  noteTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  noteNumber: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  noteNumberText: { fontSize: 12, fontWeight: '900' },
  noteHeadingCopy: { flex: 1, minWidth: 0 },
  noteTitle: { flexShrink: 1, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  source: { fontSize: 9, marginTop: 3, fontWeight: '600' },
  noteSummary: { borderRadius: 13, padding: 13, marginTop: 16 },
  noteSummaryText: { fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 4 },
  noteSectionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 17 },
  bullets: { gap: 10, marginTop: 16 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 12, lineHeight: 18 },
  detailSection: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 16 },
  detailSectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailSectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  detailSectionTitle: { flex: 1, fontSize: 13, lineHeight: 17, fontWeight: '900' },
  noteBlockHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  noteBlockLabel: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.7 },
  connectionBlock: { borderRadius: 13, padding: 13, marginTop: 17 },
  exampleBlock: { borderRadius: 13, padding: 13, marginTop: 10, gap: 7 },
  exampleText: { fontSize: 11, lineHeight: 16 },
  keyIdea: { flexDirection: 'row', gap: 9, marginTop: 16, padding: 12, borderRadius: 13 },
  keyIdeaLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  keyIdeaText: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  recallBlock: { borderRadius: 13, borderWidth: 1, padding: 13, marginTop: 10 },
  recallHint: { fontSize: 10, lineHeight: 14, marginTop: 5, marginBottom: 8 },
  recallPrompt: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 7 },
  recallNumber: { width: 18, height: 18, fontSize: 9, lineHeight: 18, textAlign: 'center', fontWeight: '900' },
  recallText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  reviewedButton: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
  reviewedText: { fontSize: 11, fontWeight: '800' },
  flashcard: { minHeight: 390, padding: 20 },
  flashcardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flashcardToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 },
  flashcardSource: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
  adaptiveExamLink: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, padding: 10, marginTop: 13 },
  adaptiveExamLinkTitle: { fontSize: 11, fontWeight: '900' },
  adaptiveExamLinkText: { fontSize: 9, lineHeight: 13, marginTop: 2 },
  questionCard: { marginTop: 18, padding: 18 },
  questionMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  question: { fontSize: 20, lineHeight: 27, fontWeight: '800', marginTop: 20, letterSpacing: -0.4 },
  answerConfidenceBlock: { marginTop: 18, gap: 9 },
  answerConfidenceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  answerConfidenceLabel: { fontSize: 10, fontWeight: '900' },
  answerConfidenceOptional: { fontSize: 8 },
  answerConfidenceChoices: { flexDirection: 'row', gap: 7 },
  answerConfidenceChoice: { flex: 1, minHeight: 34, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  answerConfidenceChoiceText: { fontSize: 9, fontWeight: '800' },
  options: { gap: 10, marginTop: 14 },
  option: { minHeight: 60, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11 },
  optionLetter: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 11, fontWeight: '900' },
  optionText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  feedback: { marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1 },
  feedbackTitle: { fontSize: 13, fontWeight: '900' },
  feedbackText: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  confidentWrongText: { fontSize: 9, lineHeight: 13, fontWeight: '900', marginTop: 6 },
  nextButton: { marginTop: 14 },
  results: { alignItems: 'center', paddingTop: 35, gap: 9 },
  resultIcon: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 23, fontWeight: '900', marginTop: 9 },
  resultScore: { fontSize: 52, lineHeight: 58, fontWeight: '900' },
  resultText: { textAlign: 'center', fontSize: 12, lineHeight: 18, maxWidth: 310 },
  resultTip: { flexDirection: 'row', gap: 10, alignItems: 'center', marginVertical: 15 },
  resultTipText: { flex: 1, fontSize: 11, lineHeight: 16 },
  coachSwitcher: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4, marginBottom: 20 },
  coachMode: { flex: 1, minHeight: 43, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  coachModeText: { fontSize: 10, fontWeight: '900' },
  coachSpark: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  askSuggestions: { gap: 8 },
  askSuggestion: { minHeight: 53, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  askSuggestionText: { flex: 1, fontSize: 11, fontWeight: '800' },
  askBox: { marginTop: 11, padding: 11, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  askInput: { flex: 1, minHeight: 48, maxHeight: 110, paddingHorizontal: 4, paddingVertical: 8, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' },
  askSend: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  coachAnswer: { marginTop: 12 },
  coachAnswerHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  coachAnswerTitle: { fontSize: 14, fontWeight: '900' },
  coachAnswerLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 9 },
  coachAnswerNumber: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  coachAnswerNumberText: { fontSize: 9, fontWeight: '900' },
  coachAnswerText: { flex: 1, fontSize: 11, lineHeight: 16 },
  coachAnswerButton: { minHeight: 48, marginTop: 15 },
  topicChips: { gap: 7, paddingBottom: 13 },
  topicChip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 9 },
  topicChipText: { fontSize: 10, fontWeight: '800' },
  teachPromptCard: { padding: 16 },
  teachEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  teachPrompt: { fontSize: 19, lineHeight: 26, fontWeight: '900', marginTop: 7 },
  teachInput: { minHeight: 150, borderWidth: 1, borderRadius: 15, padding: 13, marginVertical: 15, fontSize: 12, lineHeight: 19, textAlignVertical: 'top' },
  teachFeedback: { marginTop: 12, borderWidth: 1 },
  teachFeedbackTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  teachFeedbackLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  teachScore: { fontSize: 28, fontWeight: '900', marginTop: 2 },
  feedbackSectionLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 14 },
  feedbackSectionText: { fontSize: 11, lineHeight: 17, marginTop: 5 },
  mapWrap: { alignItems: 'center', paddingTop: 9 },
  mapNode: { borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  mapNodeCenter: { minWidth: 175, maxWidth: 250, minHeight: 86, padding: 15, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 4 },
  mapCenterTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  mapLine: { width: 2, height: 28 },
  connectionList: { alignSelf: 'stretch', gap: 9 },
  connectionNode: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  connectionDot: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  connectionText: { flex: 1, fontSize: 10, lineHeight: 15 },
  connectionHint: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 14, marginTop: 12 },
  connectionHintText: { flex: 1, fontSize: 9, lineHeight: 14 },
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
  currentSection: { alignSelf: 'stretch', alignItems: 'center', marginTop: 14 },
  currentSectionLabel: { color: '#857DA8', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  currentSectionTitle: { maxWidth: '90%', color: '#CFCAE5', fontSize: 10, fontWeight: '800', marginTop: 3 },
  audioProgress: { width: '100%', marginTop: 18 },
  timeRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeText: { color: '#929EAA', fontSize: 9 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 27, marginTop: 17 },
  smallControl: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 65, height: 65, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  askStudyBoltButton: { alignSelf: 'stretch', minHeight: 58, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#4B456E', backgroundColor: '#1B1D3C', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, marginTop: 18 },
  askStudyBoltIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#29264E', alignItems: 'center', justifyContent: 'center' },
  askStudyBoltCopy: { flex: 1 },
  askStudyBoltTitle: { color: '#F4F0FF', fontSize: 12, fontWeight: '900' },
  askStudyBoltText: { color: '#9F9AB9', fontSize: 8, marginTop: 2 },
  audioSettings: { flexDirection: 'row', gap: 10, marginTop: 12 },
  audioSettingCard: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  settingArrow: { width: 22, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  settingArrowDisabled: { opacity: 0.35 },
  settingCenter: { flex: 1, minWidth: 0, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingCopy: { flex: 1, minWidth: 0 },
  settingLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  settingValue: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  contextActions: { flexDirection: 'row', gap: 6, marginTop: 9 },
  contextAction: { flex: 1, minHeight: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  contextActionText: { fontSize: 8, fontWeight: '900' },
  interactiveRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  interactiveCard: { flex: 1, minHeight: 66, borderRadius: 16, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  interactiveIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  interactiveCopy: { flex: 1 },
  interactiveTitle: { fontSize: 11, fontWeight: '900' },
  interactiveText: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  driveButton: { width: 92, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  driveButtonText: { fontSize: 10, fontWeight: '900' },
  audioInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 12 },
  audioInfoText: { flex: 1, fontSize: 10, lineHeight: 15 },
  webAudio: { fontSize: 10, textAlign: 'center', marginTop: 12 },
  driveRoot: { flex: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 36 },
  driveTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  driveEyebrow: { color: '#AFA9D4', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  driveTitle: { color: '#F4F4FF', fontSize: 20, lineHeight: 25, fontWeight: '900', maxWidth: 280, marginTop: 7 },
  driveClose: { width: 42, height: 42, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  driveCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  driveOrb: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  driveState: { color: '#F4F4FF', fontSize: 16, fontWeight: '900' },
  driveSection: { color: '#B9BAD0', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  driveProgress: { width: '100%', marginTop: 26 },
  driveHint: { color: '#8F91AB', fontSize: 11, lineHeight: 17, textAlign: 'center', maxWidth: 300, marginTop: 22 },
  driveTranscript: { width: '100%', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', padding: 11, marginTop: 16 },
  driveReply: { width: '100%', borderRadius: 14, backgroundColor: 'rgba(139,92,246,0.18)', padding: 11, marginTop: 8 },
  driveMessageLabel: { color: '#AFA9D4', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  driveTranscriptText: { color: '#E4E5F2', fontSize: 11, lineHeight: 16, marginTop: 4 },
  driveReplyText: { color: '#F4F4FF', fontSize: 11, lineHeight: 17, marginTop: 4 },
  driveError: { color: '#FFB9C2', fontSize: 10, lineHeight: 15, textAlign: 'center', maxWidth: 330, marginTop: 15 },
  driveSignIn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.09)', paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  driveSignInText: { color: '#E7E3FF', fontSize: 10, fontWeight: '900' },
  driveInputRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.09)', paddingLeft: 13, paddingRight: 6, marginBottom: 14 },
  driveInput: { flex: 1, minWidth: 0, color: '#F4F4FF', fontSize: 11, paddingVertical: 11 },
  driveSend: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#7656F6', alignItems: 'center', justifyContent: 'center' },
  driveControlDisabled: { opacity: 0.35 },
  driveControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  driveControl: { width: 74, minHeight: 66, alignItems: 'center', justifyContent: 'center', gap: 6 },
  driveControlText: { color: '#D9DCF0', fontSize: 10, fontWeight: '900' },
  drivePlay: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  emptyTool: { paddingVertical: 80, alignItems: 'center', gap: 11 },
  emptyTitle: { fontSize: 19, fontWeight: '800' },
  emptyText: { textAlign: 'center', fontSize: 12, lineHeight: 18, maxWidth: 300 },
});
