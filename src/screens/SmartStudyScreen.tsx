import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoltMark, Card, Header, Icon, Pill, PrimaryButton, ProgressBar, Screen } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { AnswerConfidence, QuizAnswerRecord } from '../models';
import { buildSmartStudyBrief, confidenceLabel } from '../services/adaptiveStudy';
import type { SmartStudyItem, SmartStudyMode } from '../services/adaptiveStudy';

type Phase = 'intro' | 'active' | 'review';
type SessionResult = { item: SmartStudyItem; correct: boolean; confidence: AnswerConfidence; selectedAnswer: string; responseTimeMs: number };

const MODES: Array<{ id: SmartStudyMode; label: string; icon: IconName; detail: string }> = [
  { id: 'smart', label: 'Study Now', icon: 'lightning-bolt', detail: 'Best next session' },
  { id: 'pretest', label: 'Pre-Test', icon: 'radar', detail: 'Skip what you know' },
  { id: 'cram', label: 'Cram', icon: 'fire', detail: 'Highest yield first' },
];

const FORMAT_LABELS: Record<SmartStudyItem['format'], string> = {
  'multiple-choice': 'Recognition',
  'multiple-select': 'Multi-select',
  'true-false': 'True / false',
  'short-answer': 'Free recall',
  'fill-blank': 'Fill in',
  definition: 'Definition',
  application: 'Apply it',
};

export function SmartStudyScreen({ initialMode = 'smart', focusDeckId, onBack }: { initialMode?: SmartStudyMode; focusDeckId?: string; onBack: () => void }) {
  const { colors, recordStudyEvent, state, updateDeck } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SmartStudyMode>(initialMode);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [confidence, setConfidence] = useState<AnswerConfidence | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const questionStartedAt = useRef(Date.now());
  const sessionStartedAt = useRef(Date.now());
  const brief = useMemo(() => buildSmartStudyBrief(state, mode, focusDeckId), [focusDeckId, mode, state]);
  const item = brief.items[index];
  const introPalette = mode === 'smart'
    ? colors.mode === 'dark'
      ? { background: '#17243A', eyebrow: colors.goldText, title: '#F8FBFF', body: '#C1CDDD', estimate: '#D7E1EE', icon: colors.gold }
      : { background: '#EDF4FF', eyebrow: colors.goldText, title: colors.text, body: colors.textSecondary, estimate: colors.textSecondary, icon: colors.goldText }
    : colors.mode === 'dark'
      ? { background: '#151D31', eyebrow: '#8FB6F5', title: '#F6F8FF', body: '#BAC5DD', estimate: '#DDE7FA', icon: '#9EC2FF' }
      : { background: '#EEF4FF', eyebrow: colors.primary, title: colors.text, body: colors.textSecondary, estimate: colors.textSecondary, icon: colors.primary };

  const resetQuestion = () => {
    setConfidence(null);
    setSelected(null);
    setWrittenAnswer('');
    setRevealed(false);
    questionStartedAt.current = Date.now();
  };

  const chooseMode = (nextMode: SmartStudyMode) => {
    setMode(nextMode);
    setIndex(0);
    setResults([]);
    resetQuestion();
  };

  const start = () => {
    setPhase('active');
    setIndex(0);
    setResults([]);
    sessionStartedAt.current = Date.now();
    resetQuestion();
  };

  const persistSession = (completed: SessionResult[]) => {
    const byDeck = new Map<string, SessionResult[]>();
    completed.forEach((result) => byDeck.set(result.item.deckId, [...(byDeck.get(result.item.deckId) ?? []), result]));
    const elapsedMinutes = Math.max(0.2, (Date.now() - sessionStartedAt.current) / 60000);
    byDeck.forEach((deckResults, deckId) => {
      const deck = state.decks.find((candidate) => candidate.id === deckId);
      if (!deck) return;
      const quizAnswers: QuizAnswerRecord[] = deckResults.map((result, answerIndex) => ({
        questionId: result.item.id,
        sourceSectionId: result.item.sectionId,
        correct: result.correct,
        questionType: result.item.format,
        difficulty: result.item.difficulty,
        selectedAnswer: result.selectedAnswer,
        correctAnswer: result.item.answer,
        responseTimeMs: result.responseTimeMs,
        answeredAt: new Date().toISOString(),
        confidence: result.confidence,
        sequence: answerIndex,
      }));
      recordStudyEvent({
        type: 'quiz',
        deckId,
        courseId: deck.courseId,
        durationMinutes: Math.max(0.1, elapsedMinutes * (deckResults.length / completed.length)),
        quizScore: Math.round((deckResults.filter((result) => result.correct).length / deckResults.length) * 100),
        quizAnswers,
        assessmentKind: 'practice',
      });
      updateDeck(deckId, (current) => ({
        ...current,
        flashcards: current.flashcards.map((card) => {
          const result = deckResults.find((candidate) => candidate.item.cardId === card.id);
          if (!result) return card;
          return { ...card, confidence: result.correct ? 'known' : card.confidence === 'known' ? 'learning' : 'new' };
        }),
      }));
    });
  };

  const submitResult = (correct: boolean, selectedAnswer: string) => {
    if (!item) return;
    const result: SessionResult = {
      item,
      correct,
      confidence: confidence ?? 'unsure',
      selectedAnswer,
      responseTimeMs: Math.max(0, Date.now() - questionStartedAt.current),
    };
    const completed = [...results, result];
    setResults(completed);
    setRevealed(true);
  };

  const chooseOption = (optionIndex: number) => {
    if (!item || revealed) return;
    setSelected(optionIndex);
    submitResult(optionIndex === item.correctIndex, item.options?.[optionIndex] ?? '');
  };

  const gradeWritten = (correct: boolean) => {
    if (!item || !revealed) return;
    const prior = results[results.length - 1];
    if (prior?.item.id === item.id) return;
    submitResult(correct, writtenAnswer.trim() || 'Self-graded response');
  };

  const revealWritten = () => {
    if (!writtenAnswer.trim()) return;
    setRevealed(true);
  };

  const next = () => {
    const answered = results.some((result) => result.item.id === item?.id);
    if (!answered) return;
    if (index >= brief.items.length - 1) {
      persistSession(results);
      setPhase('review');
      return;
    }
    setIndex((current) => current + 1);
    resetQuestion();
  };

  if (phase === 'intro') {
    return (
      <Screen>
        <Header title="Adaptive study" onBack={onBack} />
        <View style={[styles.introHero, { backgroundColor: introPalette.background }]}> 
          {mode === 'smart' ? <View style={[styles.heroGoldGlow, { backgroundColor: colors.goldSoft }]} /> : null}
          <View style={styles.heroTop}>
            {mode === 'smart' ? (
              <BoltMark size={48} iconSize={28} backgroundColor={colors.goldBright} color={colors.onGold} style={styles.heroBolt} />
            ) : (
              <View style={[styles.heroBolt, { backgroundColor: mode === 'cram' ? colors.warning : colors.primary }]}>
                <Icon name={mode === 'cram' ? 'fire' : 'radar'} color={mode === 'cram' ? colors.onGold : colors.primaryText} size={27} />
              </View>
            )}
            <Pill label={mode === 'smart' ? 'INTERLEAVED' : mode === 'pretest' ? 'DIAGNOSTIC' : 'SHORT-TERM'} tone={mode === 'smart' ? 'gold' : 'purple'} />
          </View>
          <Text style={[styles.heroEyebrow, { color: introPalette.eyebrow }]}>{mode === 'smart' ? 'YOUR NEXT BEST SESSION' : mode === 'pretest' ? 'FIND YOUR STARTING POINT' : 'EXAM-READY PRIORITIES'}</Text>
          <Text style={[styles.heroTitle, { color: introPalette.title }]}>{mode === 'smart' ? 'No choosing. Just start.' : mode === 'pretest' ? 'Study less of what you know.' : 'Make every minute count.'}</Text>
          <Text style={[styles.heroText, { color: introPalette.body }]}> 
            {mode === 'smart'
              ? 'StudyBolt mixed overdue reviews, weak concepts, recent mistakes, and material likely to fade.'
              : mode === 'pretest'
                ? 'A short diagnostic samples new material first, then adjusts future Study Now sessions.'
                : 'High-yield weak material comes first. This helps tomorrow; spacing is still better for long-term retention.'}
          </Text>
          <View style={styles.heroEstimate}>
            <Icon name="clock-fast" color={introPalette.icon} size={18} />
            <Text style={[styles.heroEstimateText, { color: introPalette.estimate }]}>About {brief.estimatedMinutes} min · {brief.items.length} prompts</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {MODES.map((candidate) => {
            const active = candidate.id === mode;
            const smartAccent = candidate.id === 'smart';
            return (
              <Pressable key={candidate.id} onPress={() => chooseMode(candidate.id)} style={[styles.modeCard, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? (smartAccent ? colors.gold : colors.primary) : colors.border }]}>
                <Icon name={candidate.icon} size={19} color={active ? (smartAccent ? colors.goldText : colors.primary) : colors.textMuted} />
                <View>
                  <Text style={[styles.modeLabel, { color: active ? colors.primary : colors.text }]}>{candidate.label}</Text>
                  <Text style={[styles.modeDetail, { color: colors.textMuted }]}>{candidate.detail}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Why these questions</Text>
        <Card style={[styles.signalCard, styles.flatCard]}>
          <Signal icon="calendar-alert" value={brief.dueReviews} label="due reviews" color={colors.danger} />
          <Signal icon="brain" value={brief.weakTopics} label="weak topics" color={colors.warning} />
          <Signal icon="book-alert-outline" value={brief.recentMistakes} label="mistake areas" color={colors.purple} />
          <Signal icon="chart-timeline-variant-shimmer" value={brief.atRisk} label="at risk" color={colors.mint} />
        </Card>

        {brief.examDaysLeft !== null ? (
          <View style={[styles.examNote, { backgroundColor: colors.primarySoft }]}>
            <Icon name="school-outline" color={colors.primary} size={21} />
            <Text style={[styles.examNoteText, { color: colors.textSecondary }]}><Text style={{ fontWeight: '900', color: colors.text }}>{brief.examDaysLeft} days left</Text> · {brief.examConceptsRemaining} concepts still building. Today’s mix is weighted toward that deadline.</Text>
          </View>
        ) : null}

        <PrimaryButton label={mode === 'pretest' ? 'Start pre-test' : mode === 'cram' ? 'Start cram session' : 'Start smart session'} icon="arrow-right" disabled={!brief.items.length} onPress={start} style={styles.startButton} />
      </Screen>
    );
  }

  if (phase === 'review') {
    const correct = results.filter((result) => result.correct).length;
    const weak = results.filter((result) => !result.correct);
    const confidentWrong = weak.filter((result) => result.confidence === 'very-sure').length;
    const weakCounts = new Map<string, number>();
    weak.forEach((result) => weakCounts.set(result.item.sectionId, (weakCounts.get(result.item.sectionId) ?? 0) + 1));
    const biggestSection = [...weakCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const biggestIssue = weak.find((result) => result.item.sectionId === biggestSection)?.item.prompt;
    const actualMinutes = Math.max(1, Math.round((Date.now() - sessionStartedAt.current) / 60000));
    return (
      <Screen>
        <Header title="Session review" onBack={onBack} right={<Pill label="Saved" tone="mint" />} />
        <View style={[styles.reviewIcon, { backgroundColor: colors.mintSoft }]}><Icon name="check-decagram" size={44} color={colors.mint} /></View>
        <Text style={[styles.reviewTitle, { color: colors.text }]}>{mode === 'pretest' ? 'Diagnostic complete' : 'Good session.'}</Text>
        <Text style={[styles.reviewSubtitle, { color: colors.textSecondary }]}>Your next session has already been adjusted from what happened here.</Text>
        <View style={styles.reviewGrid}>
          <ReviewMetric value={`${actualMinutes}m`} label="studied" color={colors.primary} />
          <ReviewMetric value={`${correct}`} label={mode === 'pretest' ? 'can skip' : 'strengthened'} color={colors.mint} />
          <ReviewMetric value={`${weak.length}`} label="still weak" color={colors.warning} />
        </View>
        {biggestIssue ? (
          <Card style={[styles.issueCard, { backgroundColor: confidentWrong ? `${colors.danger}12` : colors.primarySoft }]}>
            <View style={[styles.issueIcon, { backgroundColor: colors.card }]}><Icon name={confidentWrong ? 'alert-decagram-outline' : 'target'} color={confidentWrong ? colors.danger : colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.issueLabel, { color: confidentWrong ? colors.danger : colors.primary }]}>{confidentWrong ? `${confidentWrong} CONFIDENTLY WRONG` : 'BIGGEST ISSUE'}</Text>
              <Text style={[styles.issueText, { color: colors.text }]}>{biggestIssue}</Text>
              <Text style={[styles.issueHint, { color: colors.textMuted }]}>Moved higher in your Study Now priority.</Text>
            </View>
          </Card>
        ) : (
          <Card style={[styles.issueCard, { backgroundColor: colors.mintSoft }]}>
            <Icon name="shield-check-outline" color={colors.mint} />
            <Text style={[styles.issueText, { color: colors.text }]}>No weak spot surfaced in this round. Future checkpoints will confirm it sticks.</Text>
          </Card>
        )}
        <PrimaryButton label="Done" icon="check" onPress={onBack} style={styles.startButton} />
        <Pressable onPress={start} style={styles.againButton}><Icon name="refresh" size={17} color={colors.primary} /><Text style={[styles.againText, { color: colors.primary }]}>Build another session</Text></Pressable>
      </Screen>
    );
  }

  if (!item) return <Screen><Header title="Adaptive study" onBack={onBack} /><Text style={{ color: colors.text }}>There isn’t enough material to build a session yet.</Text></Screen>;
  const isChoice = Boolean(item.options?.length);
  const currentResult = results.find((result) => result.item.id === item.id);
  const answered = Boolean(currentResult);
  const dangerousMiss = currentResult && !currentResult.correct && currentResult.confidence === 'very-sure';

  return (
    <View style={[styles.activePage, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.activeHeader}>
        <Pressable accessibilityLabel="End session" onPress={onBack} style={styles.closeButton}><Icon name="close" color={colors.text} /></Pressable>
        <View style={{ flex: 1 }}><ProgressBar progress={((index + 1) / brief.items.length) * 100} color={colors.primary} /></View>
        <Text style={[styles.counter, { color: colors.textMuted }]}>{index + 1}/{brief.items.length}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.activeContent} showsVerticalScrollIndicator={false}>
        <View style={styles.metaRow}>
          <Pill label={FORMAT_LABELS[item.format].toUpperCase()} tone={item.difficulty === 'hard' ? 'purple' : 'blue'} />
          {item.checkpoint && revealed ? <Pill label="RETENTION CHECK" tone="mint" /> : null}
        </View>
        <Text style={[styles.courseLabel, { color: colors.textMuted }]}>{item.courseName} · {item.deckTitle}</Text>
        <Text style={[styles.prompt, { color: colors.text }]}>{item.prompt}</Text>
        <View style={[styles.reasonRow, { backgroundColor: colors.cardStrong }]}><Icon name="creation" size={15} color={colors.primary} /><Text style={[styles.reasonText, { color: colors.textSecondary }]}>{item.reason} · {item.difficulty} difficulty</Text></View>

        <Text style={[styles.confidenceTitle, { color: colors.textSecondary }]}>How certain are you?</Text>
        <View style={styles.confidenceChoices}>
          {([
            { id: 'unsure', label: 'Guess', icon: 'dice-5-outline' },
            { id: 'somewhat-sure', label: 'Unsure', icon: 'help-circle-outline' },
            { id: 'very-sure', label: 'Confident', icon: 'shield-check-outline' },
          ] as Array<{ id: AnswerConfidence; label: string; icon: IconName }>).map((choice) => {
            const active = confidence === choice.id;
            return (
              <Pressable key={choice.id} disabled={revealed} onPress={() => setConfidence(choice.id)} style={[styles.confidenceChoice, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? colors.primary : colors.border, opacity: revealed && !active ? 0.5 : 1 }]}>
                <Icon name={choice.icon} size={18} color={active ? colors.primary : colors.textMuted} />
                <Text style={[styles.confidenceChoiceText, { color: active ? colors.primary : colors.textSecondary }]}>{choice.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {isChoice ? (
          <View style={styles.options}>
            {item.options!.map((option, optionIndex) => {
              const isSelected = selected === optionIndex;
              const isCorrect = revealed && optionIndex === item.correctIndex;
              const isWrong = revealed && isSelected && !isCorrect;
              return (
                <Pressable key={`${option}-${optionIndex}`} disabled={revealed} onPress={() => chooseOption(optionIndex)} style={[styles.option, { backgroundColor: isCorrect ? colors.mintSoft : isWrong ? `${colors.danger}12` : colors.card, borderColor: isCorrect ? colors.mint : isWrong ? colors.danger : colors.border }]}>
                  <View style={[styles.optionLetter, { backgroundColor: isCorrect ? colors.mint : isWrong ? colors.danger : colors.cardStrong }]}>
                    {isCorrect || isWrong ? <Icon name={isCorrect ? 'check' : 'close'} size={14} color="#FFFFFF" /> : <Text style={[styles.optionLetterText, { color: colors.textSecondary }]}>{String.fromCharCode(65 + optionIndex)}</Text>}
                  </View>
                  <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.writtenBlock}>
            <TextInput
              multiline
              editable={!revealed}
              value={writtenAnswer}
              onChangeText={setWrittenAnswer}
              placeholder={item.format === 'fill-blank' ? 'Type the missing idea…' : 'Explain it in your own words…'}
              placeholderTextColor={colors.textMuted}
              style={[styles.writtenInput, { color: colors.text, backgroundColor: colors.card, borderColor: revealed ? colors.primary : colors.border }]}
            />
            {!revealed ? <PrimaryButton label="Check my answer" icon="eye-outline" disabled={!writtenAnswer.trim()} onPress={revealWritten} /> : null}
            {revealed && !answered ? (
              <View style={styles.selfGradeRow}>
                <Pressable onPress={() => gradeWritten(false)} style={[styles.selfGrade, { backgroundColor: `${colors.danger}12`, borderColor: colors.danger }]}><Icon name="refresh" color={colors.danger} /><Text style={[styles.selfGradeText, { color: colors.danger }]}>Need work</Text></Pressable>
                <Pressable onPress={() => gradeWritten(true)} style={[styles.selfGrade, { backgroundColor: colors.mintSoft, borderColor: colors.mint }]}><Icon name="check" color={colors.mint} /><Text style={[styles.selfGradeText, { color: colors.mint }]}>I got it</Text></Pressable>
              </View>
            ) : null}
          </View>
        )}

        {revealed ? (
          <Card style={[styles.feedback, { backgroundColor: dangerousMiss ? `${colors.danger}12` : currentResult?.correct ? colors.mintSoft : colors.primarySoft, borderColor: dangerousMiss ? colors.danger : currentResult?.correct ? colors.mint : colors.primary }]}>
            <Icon name={dangerousMiss ? 'alert-decagram-outline' : currentResult?.correct ? 'check-circle' : 'lightbulb-on-outline'} color={dangerousMiss ? colors.danger : currentResult?.correct ? colors.mint : colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.feedbackTitle, { color: colors.text }]}>{dangerousMiss ? 'Confident, but incorrect' : currentResult?.correct ? 'Strong retrieval' : answered ? 'Keep this in rotation' : 'Compare with the source'}</Text>
              <Text style={[styles.feedbackAnswer, { color: colors.text }]}>{item.answer}</Text>
              <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>{item.explanation}</Text>
              {dangerousMiss ? <Text style={[styles.dangerHint, { color: colors.danger }]}>This is a high-priority misconception and was added to your next session.</Text> : null}
            </View>
          </Card>
        ) : null}
      </ScrollView>
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.bottomHint, { color: colors.textMuted }]}>{confidence ? `${confidenceLabel(confidence)} · ` : ''}{item.sourceLabel}</Text>
        <PrimaryButton label={index === brief.items.length - 1 ? 'Review session' : 'Next'} icon="arrow-right" disabled={!answered} onPress={next} style={styles.nextButton} />
      </View>
    </View>
  );
}

function Signal({ icon, value, label, color }: { icon: IconName; value: number; label: string; color: string }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.signal}>
      <View style={[styles.signalIcon, { backgroundColor: `${color}18` }]}><Icon name={icon} color={color} size={19} /></View>
      <Text style={[styles.signalValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.signalLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function ReviewMetric({ value, label, color }: { value: string; label: string; color: string }) {
  const { colors } = useStudyBolt();
  return <View style={[styles.reviewMetric, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.reviewMetricValue, { color }]}>{value}</Text><Text style={[styles.reviewMetricLabel, { color: colors.textMuted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  introHero: { borderRadius: 22, padding: 19, marginTop: 5, overflow: 'hidden' },
  heroGoldGlow: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -72, top: -92, opacity: 0.55 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBolt: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 18 },
  heroTitle: { fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8, marginTop: 7 },
  heroText: { fontSize: 12, lineHeight: 18, marginTop: 7 },
  heroEstimate: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  heroEstimateText: { fontSize: 11, fontWeight: '800' },
  modeRow: { gap: 8, paddingVertical: 14 },
  modeCard: { minWidth: 147, minHeight: 59, borderRadius: 15, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  modeLabel: { fontSize: 11, fontWeight: '900' },
  modeDetail: { fontSize: 8, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginTop: 10, marginBottom: 11 },
  signalCard: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 14 },
  signal: { flex: 1, alignItems: 'center' },
  signalIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  signalValue: { fontSize: 17, fontWeight: '900', marginTop: 6 },
  signalLabel: { textAlign: 'center', fontSize: 8, marginTop: 1 },
  examNote: { borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 11 },
  examNoteText: { flex: 1, fontSize: 10, lineHeight: 15 },
  startButton: { marginTop: 18 },
  activePage: { flex: 1 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 17, minHeight: 48 },
  closeButton: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center' },
  counter: { width: 38, textAlign: 'right', fontSize: 10, fontWeight: '800' },
  activeContent: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 150 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  courseLabel: { fontSize: 10, fontWeight: '700', marginTop: 13 },
  prompt: { fontSize: 25, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7, marginTop: 8 },
  reasonRow: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  reasonText: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  confidenceTitle: { fontSize: 10, fontWeight: '900', marginTop: 23, marginBottom: 9 },
  confidenceChoices: { flexDirection: 'row', gap: 7 },
  confidenceChoice: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 3 },
  confidenceChoiceText: { fontSize: 9, fontWeight: '800' },
  options: { gap: 9, marginTop: 19 },
  option: { minHeight: 62, borderRadius: 16, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  optionLetter: { width: 33, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 11, fontWeight: '900' },
  optionText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  writtenBlock: { gap: 11, marginTop: 19 },
  writtenInput: { minHeight: 130, borderRadius: 17, borderWidth: 1, padding: 15, fontSize: 13, lineHeight: 20, textAlignVertical: 'top' },
  selfGradeRow: { flexDirection: 'row', gap: 9 },
  selfGrade: { flex: 1, minHeight: 51, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  selfGradeText: { fontSize: 11, fontWeight: '900' },
  feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 13, borderWidth: 1 },
  feedbackTitle: { fontSize: 13, fontWeight: '900' },
  feedbackAnswer: { fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 6 },
  feedbackText: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  dangerHint: { fontSize: 9, lineHeight: 13, fontWeight: '800', marginTop: 7 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, padding: 13, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottomHint: { flex: 1, fontSize: 9 },
  nextButton: { minHeight: 48, minWidth: 143 },
  reviewIcon: { width: 88, height: 88, borderRadius: 28, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  reviewTitle: { textAlign: 'center', fontSize: 27, fontWeight: '900', marginTop: 16 },
  reviewSubtitle: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 6, paddingHorizontal: 22 },
  reviewGrid: { flexDirection: 'row', gap: 8, marginTop: 23 },
  reviewMetric: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, alignItems: 'center', paddingVertical: 15 },
  reviewMetricValue: { fontSize: 21, fontWeight: '900' },
  reviewMetricLabel: { fontSize: 9, fontWeight: '700', marginTop: 3 },
  issueCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 15 },
  issueIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  issueLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  issueText: { fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 4 },
  issueHint: { fontSize: 9, marginTop: 5 },
  againButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14 },
  againText: { fontSize: 11, fontWeight: '900' },
  flatCard: { shadowOpacity: 0, elevation: 0 },
});
