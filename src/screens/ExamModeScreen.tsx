import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { AskStudyBoltSheet } from '../components/StudyCastSheets';
import { Card, Header, Icon, Pill, PrimaryButton, ProgressBar } from '../components/ui';
import type {
  AiTutorAction,
  AiTutorConversation,
  AiTutorQuota,
  AiTutorResponse,
  AnswerConfidence,
  ExamAttempt,
  ExamDifficulty,
  ExamLengthPreset,
  ExamSettings,
  QuizAnswerRecord,
  QuizQuestion,
  QuizQuestionType,
} from '../models';
import { useStudyBolt } from '../StudyBoltContext';
import { fetchTutorQuota, isAiTutorConfigured, tutorContextAtPosition } from '../services/aiTutor';
import { runStudyBoltAI } from '../services/aiRouter';
import {
  buildAdaptiveExam,
  buildExamConceptResults,
  calculateExamScore,
  evaluateExamAnswer,
  getExamReadiness,
  sourceSectionKey,
  type AdaptiveExamBuild,
} from '../services/assessment';
import { gradeOpenExamAnswers } from '../services/examGrading';
import { canAttemptOnDeviceAI, getOnDeviceAIAvailability, initialOnDeviceAIAvailability } from '../services/onDeviceAI';

const QUESTION_TYPES: Array<{ id: QuizQuestionType; label: string; short: string }> = [
  { id: 'multiple-choice', label: 'Multiple choice', short: 'MC' },
  { id: 'multiple-select', label: 'Multiple select', short: 'Multi' },
  { id: 'true-false', label: 'True / false', short: 'T/F' },
  { id: 'fill-blank', label: 'Fill in the blank', short: 'Blank' },
  { id: 'short-answer', label: 'Short answer', short: 'Recall' },
  { id: 'definition', label: 'Definition / term', short: 'Term' },
  { id: 'application', label: 'Scenario / application', short: 'Apply' },
];

const DEFAULT_TYPES: QuizQuestionType[] = ['multiple-choice', 'true-false', 'short-answer', 'application'];

type ExamView = 'setup' | 'taking' | 'review' | 'results' | 'history';
type DraftAnswer = { selectedIndices: number[]; openAnswer: string; confidence?: AnswerConfidence; responseTimeMs?: number; answeredAt?: string };

function defaultSettings(deckId?: string): ExamSettings {
  return {
    title: 'Adaptive Exam',
    sourceDeckIds: deckId ? [deckId] : [],
    questionCount: 10,
    lengthPreset: 'quick',
    difficulty: 'adaptive',
    questionTypes: DEFAULT_TYPES,
    immediateFeedback: false,
    randomizeQuestions: true,
    randomizeAnswers: true,
    mode: 'adaptive',
  };
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

function questionLabel(type: QuizQuestionType): string {
  return QUESTION_TYPES.find((item) => item.id === type)?.label ?? 'Question';
}

function answerForQuestion(question: QuizQuestion, answer?: QuizAnswerRecord): string {
  if (!answer) return 'Not answered';
  if (answer.openAnswer) return answer.openAnswer;
  if (answer.selectedIndices?.length) return answer.selectedIndices.map((index) => question.options[index] ?? '').filter(Boolean).join(', ');
  return answer.selectedAnswer ?? 'Skipped';
}

export function ExamModeScreen({ deckId, onBack, onStudyWeakAreas, onUpdateStudyPlan, onRequireAuth }: { deckId?: string; onBack: (tool?: 'quiz' | 'flashcards', targetDeckId?: string) => void; onStudyWeakAreas?: (deckId: string) => void; onUpdateStudyPlan?: (deckId: string) => void; onRequireAuth?: () => void }) {
  const { colors, state, recordStudyEvent, saveExamAttempt } = useStudyBolt();
  const { getAccessToken, user } = useAuth();
  const insets = useSafeAreaInsets();
  const firstDeckId = deckId ?? state.decks[0]?.id;
  const [view, setView] = useState<ExamView>('setup');
  const [settings, setSettings] = useState<ExamSettings>(() => defaultSettings(firstDeckId));
  const [customCount, setCustomCount] = useState('10');
  const [build, setBuild] = useState<AdaptiveExamBuild | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, DraftAnswer>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerWarning, setTimerWarning] = useState<number | null>(null);
  const [examPaused, setExamPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [examError, setExamError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [gradingWarning, setGradingWarning] = useState<string>();
  const [historyLimit, setHistoryLimit] = useState(10);
  const [showAllMissed, setShowAllMissed] = useState(false);
  const [tutorVisible, setTutorVisible] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState<QuizQuestion>();
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string>();
  const [tutorResponse, setTutorResponse] = useState<AiTutorResponse>();
  const [tutorQuota, setTutorQuota] = useState<AiTutorQuota>();
  const [onDeviceAI, setOnDeviceAI] = useState(initialOnDeviceAIAvailability);
  const [conversation, setConversation] = useState<AiTutorConversation>({ turns: [] });
  const lastTutorRequest = useRef<{ action: AiTutorAction; question?: string }>({ action: 'ask' });
  const recordedAttempt = useRef(false);
  const finishingAttempt = useRef(false);
  const shownAt = useRef(Date.now());
  const pausedAt = useRef<number | null>(null);
  const pausedDurationMs = useRef(0);

  const selectedDecks = useMemo(() => state.decks.filter((deck) => settings.sourceDeckIds.includes(deck.id)), [settings.sourceDeckIds, state.decks]);
  const selectedSections = useMemo(() => selectedDecks.flatMap((deck) => deck.outline.map((section) => ({ ...section, deckId: deck.id, deckTitle: deck.title }))), [selectedDecks]);
  const questions = build?.questions ?? [];
  const question = questions[index];
  const currentDraft: DraftAnswer = question ? drafts[question.id] ?? { selectedIndices: [], openAnswer: '' } : { selectedIndices: [], openAnswer: '' };
  const answeredCount = questions.filter((item) => {
    const draft = drafts[item.id];
    return Boolean(draft?.openAnswer.trim() || draft?.selectedIndices.length);
  }).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const readiness = useMemo(() => getExamReadiness(state, settings.sourceDeckIds), [settings.sourceDeckIds, state]);

  useEffect(() => {
    let active = true;
    void getOnDeviceAIAvailability().then((availability) => { if (active) setOnDeviceAI(availability); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view !== 'taking' || examPaused || remainingSeconds === null) return undefined;
    const timer = setInterval(() => setRemainingSeconds((current) => current === null ? null : Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [examPaused, view]);

  useEffect(() => {
    if (view !== 'taking' || remainingSeconds === null) return;
    if ((remainingSeconds === 300 || remainingSeconds === 60) && timerWarning !== remainingSeconds) setTimerWarning(remainingSeconds);
    if (remainingSeconds === 0) void finishExam();
  // finishExam deliberately reads the current draft snapshot from this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, view]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && view === 'taking') pauseExam();
    });
    return () => subscription.remove();
  }, [view]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [question?.id]);

  const updateSettings = (patch: Partial<ExamSettings>) => setSettings((current) => ({ ...current, ...patch }));

  function pauseExam() {
    if (pausedAt.current === null) pausedAt.current = Date.now();
    setExamPaused(true);
  }

  function resumeExam() {
    if (pausedAt.current !== null) pausedDurationMs.current += Date.now() - pausedAt.current;
    pausedAt.current = null;
    setExamPaused(false);
    shownAt.current = Date.now();
  }

  const toggleDeck = (id: string) => {
    setSettings((current) => {
      if (current.sourceDeckIds.includes(id)) {
        if (current.sourceDeckIds.length === 1) return current;
        return { ...current, sourceDeckIds: current.sourceDeckIds.filter((item) => item !== id), sourceSectionIds: undefined };
      }
      return { ...current, sourceDeckIds: [...current.sourceDeckIds, id], sourceSectionIds: undefined };
    });
  };

  const toggleSection = (id: string) => {
    setSettings((current) => {
      const currentSections = current.sourceSectionIds ?? [];
      const next = currentSections.includes(id) ? currentSections.filter((item) => item !== id) : [...currentSections, id];
      return { ...current, sourceSectionIds: next.length ? next : undefined };
    });
  };

  const startExam = () => {
    const count = settings.lengthPreset === 'custom' ? Number(customCount) : settings.questionCount;
    if (!selectedDecks.length) { setExamError('Choose at least one Study Pack.'); return; }
    if (!Number.isFinite(count) || count < 1) { setExamError('Enter at least one question.'); return; }
    const nextSettings = { ...settings, questionCount: Math.max(1, Math.min(settings.lengthPreset === 'custom' ? 100 : 50, Math.round(count))) };
    const nextBuild = buildAdaptiveExam(state, nextSettings);
    if (!nextBuild.questions.length) { setExamError('There are not enough source-backed questions for this exam yet. Add notes, flashcards, or quiz questions first.'); return; }
    setExamError(undefined);
    setSettings(nextSettings);
    setBuild(nextBuild);
    setIndex(0);
    setDrafts({});
    setFlags({});
    setStartedAt(Date.now());
    setRemainingSeconds(nextSettings.timeLimitMinutes ? nextSettings.timeLimitMinutes * 60 : null);
    setTimerWarning(null);
    setExamPaused(false);
    pausedAt.current = null;
    pausedDurationMs.current = 0;
    setAttempt(null);
    setShowAllMissed(false);
    setGradingWarning(undefined);
    recordedAttempt.current = false;
    finishingAttempt.current = false;
    recordStudyEvent({ type: 'exam-created', examId: nextBuild.id, examName: nextBuild.title, sourceDeckIds: nextBuild.sourceDeckIds, deckId: nextBuild.sourceDeckIds[0], courseId: selectedDecks[0]?.courseId, assessmentKind: nextSettings.mode === 'targeted' ? 'targeted' : 'adaptive' });
    recordStudyEvent({ type: nextSettings.mode === 'targeted' ? 'weak-area-exam-started' : 'exam-started', examId: nextBuild.id, examName: nextBuild.title, sourceDeckIds: nextBuild.sourceDeckIds, deckId: nextBuild.sourceDeckIds[0], courseId: selectedDecks[0]?.courseId, assessmentKind: nextSettings.mode === 'targeted' ? 'targeted' : 'adaptive' });
    setView('taking');
  };

  const draftFor = (item: QuizQuestion): DraftAnswer => drafts[item.id] ?? { selectedIndices: [], openAnswer: '' };
  const setDraft = (item: QuizQuestion, patch: Partial<DraftAnswer>) => setDrafts((current) => {
    const previous = current[item.id] ?? { selectedIndices: [], openAnswer: '' };
    const next = { ...previous, ...patch };
    const hasAnswer = Boolean(next.openAnswer.trim() || next.selectedIndices.length);
    return {
      ...current,
      [item.id]: {
        ...next,
        ...(hasAnswer && previous.answeredAt === undefined ? { answeredAt: new Date().toISOString(), responseTimeMs: Math.max(0, Date.now() - shownAt.current) } : {}),
      },
    };
  });

  const buildAnswer = (item: QuizQuestion, itemIndex: number): QuizAnswerRecord => {
    const draft = draftFor(item);
    const evaluated = evaluateExamAnswer(item, draft.selectedIndices, draft.openAnswer);
    const hasAnswer = Boolean(draft.openAnswer.trim() || draft.selectedIndices.length);
    return {
      questionId: item.id,
      originQuestionId: item.originQuestionId ?? item.id,
      sourceSectionId: item.source.sectionId,
      sourceDeckId: item.sourceDeckId,
      conceptId: item.conceptId,
      examId: build?.id,
      correct: hasAnswer && evaluated.correct,
      partialCredit: hasAnswer ? evaluated.partialCredit : 0,
      skipped: !hasAnswer,
      flagged: Boolean(flags[item.id]),
      questionType: item.type,
      difficulty: item.difficulty ?? 'medium',
      selectedIndices: draft.selectedIndices,
      selectedIndex: draft.selectedIndices[0],
      correctIndex: item.correctIndex,
      selectedAnswer: draft.selectedIndices[0] === undefined ? undefined : item.options[draft.selectedIndices[0]],
      correctAnswer: item.options[item.correctIndex] ?? item.acceptedAnswers?.[0] ?? item.explanation,
      openAnswer: draft.openAnswer.trim() || undefined,
      responseTimeMs: hasAnswer ? draft.responseTimeMs : undefined,
      answeredAt: hasAnswer ? draft.answeredAt ?? new Date().toISOString() : new Date().toISOString(),
      confidence: draft.confidence,
      gradingProvider: item.options.length ? 'local' : 'local',
      sequence: itemIndex,
    };
  };

  const collectAnswers = (): QuizAnswerRecord[] => questions.map((item, itemIndex) => buildAnswer(item, itemIndex));

  async function finishExam(localAnswers = collectAnswers()) {
    if (!build || recordedAttempt.current || finishingAttempt.current) return;
    finishingAttempt.current = true;
    setSubmitting(true);
    setExamPaused(true);
    const accessToken = await getAccessToken();
    const grading = await gradeOpenExamAnswers({ questions, answers: localAnswers, accessToken });
    const finalAnswers = grading.answers;
    if (grading.warning) setGradingWarning(grading.warning);
    if (grading.quota) {
      setTutorQuota(grading.quota);
      if (grading.quota.softWarning) recordStudyEvent({ type: 'ai-limit-warning', deckId: build.sourceDeckIds[0], sourceDeckIds: build.sourceDeckIds, examId: build.id });
    }
    const score = calculateExamScore(questions, finalAnswers);
    const conceptResults = buildExamConceptResults(state, questions, finalAnswers);
    const evidenceTotal = conceptResults.reduce((sum, result) => sum + result.evidenceCount, 0);
    const before = conceptResults.length ? Math.round(conceptResults.reduce((sum, result) => sum + result.masteryBefore * result.evidenceCount, 0) / Math.max(1, evidenceTotal)) : build.readiness.score;
    const after = conceptResults.length ? Math.round(conceptResults.reduce((sum, result) => sum + result.masteryAfter * result.evidenceCount, 0) / Math.max(1, evidenceTotal)) : before;
    const sourceKey = [...build.sourceDeckIds].sort().join('|');
    const previous = [...(state.examAttempts ?? [])]
      .filter((item) => item.status === 'completed' && [...item.sourceDeckIds].sort().join('|') === sourceKey)
      .sort((a, b) => +new Date(b.completedAt ?? b.createdAt) - +new Date(a.completedAt ?? a.createdAt))[0];
    const completedAt = new Date().toISOString();
    const nextAttempt: ExamAttempt = {
      id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      examId: build.id,
      title: build.title,
      sourceDeckIds: build.sourceDeckIds,
      sourceLabels: build.sourceLabels,
      createdAt: new Date(startedAt ?? Date.now()).toISOString(),
      completedAt,
      status: 'completed',
      score,
      correctCount: finalAnswers.filter((answer) => answer.correct).length,
      questionCount: questions.length,
      durationSeconds: Math.max(0, Math.round((Date.now() - (startedAt ?? Date.now()) - pausedDurationMs.current - (pausedAt.current ? Date.now() - pausedAt.current : 0)) / 1000)),
      masteryBefore: before,
      masteryAfter: after,
      improvement: after - before,
      weakTopics: [...conceptResults].filter((item) => item.score < 70).sort((a, b) => a.score - b.score).slice(0, 5).map((item) => item.title),
      strongestTopics: [...conceptResults].filter((item) => item.score >= 70).sort((a, b) => b.score - a.score).slice(0, 5).map((item) => item.title),
      flaggedQuestionIds: Object.entries(flags).filter(([, flagged]) => flagged).map(([id]) => id),
      settings,
      questions,
      answers: finalAnswers,
      conceptResults,
      scoreChangeFromPrevious: previous ? score - previous.score : undefined,
      gradingMode: grading.usedCloud ? 'cloud-assisted' : 'local',
    };
    recordedAttempt.current = true;
    setAttempt(nextAttempt);
    saveExamAttempt(nextAttempt);
    const durationMinutes = Math.max(0.1, Math.round(nextAttempt.durationSeconds / 6) / 10);
    const firstDeck = selectedDecks[0];
    recordStudyEvent({ type: 'quiz', deckId: firstDeck?.id, courseId: firstDeck?.courseId, sourceDeckIds: build.sourceDeckIds, examId: build.id, examAttemptId: nextAttempt.id, examName: build.title, durationMinutes, quizScore: score, quizAnswers: finalAnswers, assessmentKind: settings.mode === 'targeted' ? 'targeted' : 'adaptive', masteryBefore: before, masteryAfter: after });
    recordStudyEvent({ type: 'exam-completed', deckId: firstDeck?.id, courseId: firstDeck?.courseId, sourceDeckIds: build.sourceDeckIds, examId: build.id, examAttemptId: nextAttempt.id, examName: build.title, durationMinutes, quizScore: score, assessmentKind: settings.mode === 'targeted' ? 'targeted' : 'adaptive', masteryBefore: before, masteryAfter: after });
    setSubmitting(false);
    finishingAttempt.current = false;
    setView('results');
  }

  const nextQuestion = () => {
    if (!question) return;
    if (index < questions.length - 1) { setIndex((current) => current + 1); return; }
    if (unansweredCount > 0) { setView('review'); return; }
    void finishExam();
  };

  const openHistoryAttempt = (historyAttempt: ExamAttempt) => {
    setSettings(historyAttempt.settings);
    setAttempt(historyAttempt);
    setGradingWarning(undefined);
    setShowAllMissed(false);
    setView('results');
  };

  const retake = () => {
    setAttempt(null);
    setBuild(null);
    updateSettings({ mode: settings.mode === 'targeted' ? 'targeted' : 'adaptive', excludedQuestionIds: questions.map((item) => item.originQuestionId ?? item.id) });
    recordStudyEvent({ type: 'exam-retake', examId: build?.id, examName: build?.title, sourceDeckIds: settings.sourceDeckIds, deckId: settings.sourceDeckIds[0], assessmentKind: settings.mode === 'targeted' ? 'targeted' : 'adaptive' });
    setView('setup');
  };

  const startTargeted = () => {
    const topicIds = (attempt?.weakTopics ?? []).map((title) => title);
    const count = Math.min(15, Math.max(10, settings.questionCount));
    setCustomCount(String(count));
    setSettings((current) => ({ ...current, title: 'Weak Area Exam', mode: 'targeted', lengthPreset: 'custom', questionCount: count, targetedConceptIds: topicIds, excludedQuestionIds: attempt?.questions.map((item) => item.originQuestionId ?? item.id) ?? [] }));
    setBuild(null);
    setView('setup');
  };

  const openTutor = (item: QuizQuestion) => {
    setTutorQuestion(item);
    setTutorResponse(undefined);
    setTutorError(undefined);
    setTutorVisible(true);
    setConversation({ turns: [] });
    lastTutorRequest.current = { action: 'ask', question: 'Why was mine wrong?' };
  };

  const tutorContext = tutorQuestion && attempt ? (() => {
    const sourceDeck = state.decks.find((deck) => deck.id === tutorQuestion.sourceDeckId) ?? selectedDecks[0];
    const note = sourceDeck?.notes.find((item) => item.source.sectionId === tutorQuestion.source.sectionId);
    const answer = attempt.answers.find((candidate) => candidate.questionId === tutorQuestion.id);
    return {
      ...tutorContextAtPosition(sourceDeck ?? selectedDecks[0]!, 0, 1),
      studySetTitle: attempt.title,
      subject: sourceDeck?.courseName ?? 'Study materials',
      currentChunk: {
        id: `${attempt.id}:${tutorQuestion.id}`,
        title: tutorQuestion.conceptTitle ?? tutorQuestion.source.label,
        text: [note?.summary, ...(note?.bullets ?? []), `EXAM QUESTION: ${tutorQuestion.prompt}`, `USER ANSWER: ${answerForQuestion(tutorQuestion, answer)}`, `CORRECT ANSWER: ${tutorQuestion.options[tutorQuestion.correctIndex] ?? tutorQuestion.acceptedAnswers?.[0] ?? tutorQuestion.explanation}`, tutorQuestion.explanation].filter(Boolean).join('\n'),
      },
      currentQuestion: {
        prompt: tutorQuestion.prompt,
        userAnswer: answerForQuestion(tutorQuestion, answer),
        correctAnswer: tutorQuestion.options[tutorQuestion.correctIndex] ?? tutorQuestion.acceptedAnswers?.[0] ?? tutorQuestion.explanation,
        concept: tutorQuestion.conceptTitle,
        source: tutorQuestion.source.label,
      },
      mastery: attempt.masteryAfter,
    };
  })() : undefined;

  async function runTutor(action: AiTutorAction, request?: string) {
    if (!tutorContext) return;
    lastTutorRequest.current = { action, ...(request ? { question: request } : {}) };
    setTutorLoading(true);
    setTutorError(undefined);
    try {
      const accessToken = await getAccessToken();
      const depth = action === 'teach' || action === 'deep-dive' ? 'deep' : action === 'quick-answer' ? 'quick' : 'normal';
      const result = await runStudyBoltAI({ action, question: request, context: tutorContext, accessToken, conversation, depth });
      setOnDeviceAI(result.availability);
      if (result.quota) {
        setTutorQuota(result.quota);
        if (result.quota.softWarning && attempt) recordStudyEvent({ type: 'ai-limit-warning', deckId: attempt.sourceDeckIds[0], sourceDeckIds: attempt.sourceDeckIds, examId: attempt.examId, examAttemptId: attempt.id });
      }
      if (result.error || !result.response) setTutorError(result.error ?? 'StudyBolt could not answer that right now.');
      else {
        setTutorResponse(result.response);
        setConversation((current) => ({ turns: [...(current.turns ?? []), ...(request ? [{ role: 'user' as const, content: request }] : []), { role: 'assistant' as const, content: result.response!.answer || result.response!.quiz?.question || '' }].slice(-8) }));
        if (result.routeUsed === 'on-device') setTutorQuota(undefined);
        if (attempt) recordStudyEvent({ type: 'ask-ai-from-exam', deckId: attempt.sourceDeckIds[0], sourceDeckIds: attempt.sourceDeckIds, examId: attempt.examId, examAttemptId: attempt.id, tutorAction: action });
      }
    } catch {
      setTutorError('StudyBolt could not answer that right now. Your exam result is still saved.');
    } finally {
      setTutorLoading(false);
    }
  }

  const provider = tutorResponse?.provider ?? (onDeviceAI.status === 'checking' ? 'checking' : canAttemptOnDeviceAI(onDeviceAI) ? 'on-device' : 'cloud');
  const providerDetail = provider === 'on-device' ? 'Private on-device response when this phone supports it.' : provider === 'checking' ? onDeviceAI.reason : 'Secure StudyBolt backend; usage limits are enforced server-side.';

  const startTutorFromResults = async () => {
    const missed = attempt?.questions.find((item) => !attempt.answers.find((answer) => answer.questionId === item.id)?.correct);
    if (missed) openTutor(missed);
    else if (attempt?.questions[0]) openTutor(attempt.questions[0]);
    const token = await getAccessToken();
    if (token) {
      const quota = await fetchTutorQuota(token);
      if (quota.quota) setTutorQuota(quota.quota);
    }
  };

  const renderSetup = () => (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroRow}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}><Icon name="school-outline" size={25} color={colors.primaryText} /></View>
        <View style={{ flex: 1 }}><Text style={[styles.heroTitle, { color: colors.text }]}>Exam Mode</Text><Text style={[styles.heroText, { color: colors.textSecondary }]}>One adaptive exam system across your Study Packs, notes, flashcards, and existing quiz questions.</Text></View>
        <Pill label="ADAPTIVE" tone="gold" />
      </View>

      <Card style={[styles.adaptiveCard, { backgroundColor: colors.mode === 'dark' ? colors.primarySoft : '#EEF5FF', borderColor: colors.primary }]}>
        <View style={styles.adaptiveTop}><View style={[styles.adaptiveBolt, { backgroundColor: colors.primary }]}><Icon name="lightning-bolt" size={19} color={colors.primaryText} /></View><View style={{ flex: 1 }}><Text style={[styles.adaptiveTitle, { color: colors.text }]}>Adaptive Exam is recommended</Text><Text style={[styles.adaptiveText, { color: colors.textSecondary }]}>Weak 40% · medium 30% · strong 15% · new 15%, adjusted by misses, recency, importance, and repeated exposure.</Text></View></View>
        <View style={styles.readinessRow}><View style={{ flex: 1 }}><Text style={[styles.readinessLabel, { color: colors.textMuted }]}>ESTIMATED READINESS</Text><Text style={[styles.readinessValue, { color: colors.text }]}>{readiness.score}%</Text></View><View style={{ flex: 2 }}><ProgressBar progress={readiness.score} color={colors.mint} /><Text style={[styles.readinessDetail, { color: colors.textSecondary }]}>{readiness.needsReview.length ? `${readiness.needsReview.length} concepts need a confidence check.` : 'Coverage will improve as you test more concepts.'}</Text></View></View>
        {readiness.ready.length || readiness.needsReview.length ? <View style={styles.readinessTopics}>{readiness.ready.slice(0, 2).map((topic) => <TopicPill key={`ready:${topic}`} label={`Ready · ${topic}`} tone="mint" />)}{readiness.needsReview.slice(0, 2).map((topic) => <TopicPill key={`review:${topic}`} label={`Review · ${topic}`} tone="danger" />)}</View> : null}
        <Text style={[styles.readinessDisclaimer, { color: colors.textMuted }]}>This estimate guides study priority; it is not a prediction of your course exam grade.</Text>
      </Card>

      <SectionLabel title="1 · Exam name" />
      <TextInput value={settings.title} onChangeText={(title) => updateSettings({ title })} placeholder="e.g. Anatomy Exam 1" placeholderTextColor={colors.textMuted} style={[styles.textInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} />

      <SectionLabel title="2 · Study material" detail={`${selectedDecks.length} selected`} />
      <View style={styles.deckList}>{state.decks.map((deck) => {
        const active = settings.sourceDeckIds.includes(deck.id);
        return <Pressable key={deck.id} onPress={() => toggleDeck(deck.id)} style={[styles.deckChoice, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? colors.primary : colors.border }]}><View style={[styles.deckEmoji, { backgroundColor: `${deck.color}24` }]}><Text>{deck.emoji}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.deckChoiceTitle, { color: colors.text }]}>{deck.title}</Text><Text numberOfLines={1} style={[styles.deckChoiceMeta, { color: colors.textSecondary }]}>{deck.courseName} · {deck.notes.length} notes · {deck.flashcards.length} cards</Text></View><Icon name={active ? 'check-circle' : 'circle-outline'} color={active ? colors.primary : colors.textMuted} /></Pressable>;
      })}</View>
      {selectedSections.length > 0 ? <><Text style={[styles.microLabel, { color: colors.textMuted }]}>OPTIONAL CHAPTER FOCUS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{selectedSections.map((section) => { const scopedId = sourceSectionKey(section.deckId, section.id); const active = settings.sourceSectionIds?.includes(scopedId) ?? false; return <Pressable key={scopedId} onPress={() => toggleSection(scopedId)} style={[styles.chip, { backgroundColor: active ? colors.mintSoft : colors.card, borderColor: active ? colors.mint : colors.border }]}><Text numberOfLines={1} style={[styles.chipText, { color: active ? colors.mint : colors.textSecondary }]}>{selectedDecks.length > 1 ? `${section.deckTitle} · ${section.title}` : section.title}</Text></Pressable>; })}</ScrollView></> : null}
      <View style={[styles.materialHint, { backgroundColor: colors.mintSoft }]}><Icon name="database-check-outline" color={colors.mint} size={17} /><Text style={[styles.materialHintText, { color: colors.textSecondary }]}>Combines selected sources while retaining each chapter and Study Pack identity. No unrelated textbook content is added.</Text></View>

      <SectionLabel title="3 · Length" />
      <View style={styles.optionRow}>{(['quick', 'standard', 'full', 'custom'] as ExamLengthPreset[]).map((preset) => { const active = settings.lengthPreset === preset; const labels: Record<ExamLengthPreset, string> = { quick: 'Quick\n10', standard: 'Standard\n25', full: 'Full\n50', custom: 'Custom' }; return <Pressable key={preset} onPress={() => updateSettings({ lengthPreset: preset, questionCount: preset === 'quick' ? 10 : preset === 'standard' ? 25 : preset === 'full' ? 50 : Math.max(1, Number(customCount) || 10) })} style={[styles.option, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.optionText, { color: active ? colors.primaryText : colors.textSecondary }]}>{labels[preset]}</Text></Pressable>; })}</View>
      {settings.lengthPreset === 'custom' ? <TextInput value={customCount} onChangeText={(value) => { setCustomCount(value.replace(/[^0-9]/g, '')); updateSettings({ questionCount: Number(value) || 1 }); }} keyboardType="number-pad" placeholder="Number of questions" placeholderTextColor={colors.textMuted} style={[styles.textInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border, marginTop: 9 }]} /> : null}

      <SectionLabel title="4 · Difficulty" />
      <View style={styles.optionRow}>{(['easy', 'balanced', 'hard', 'adaptive'] as ExamDifficulty[]).map((difficulty) => { const active = settings.difficulty === difficulty; return <Pressable key={difficulty} onPress={() => updateSettings({ difficulty, mode: difficulty === 'adaptive' ? 'adaptive' : 'standard' })} style={[styles.smallOption, { backgroundColor: active ? colors.purpleSoft : colors.card, borderColor: active ? colors.purple : colors.border }]}><Text style={[styles.smallOptionText, { color: active ? colors.purple : colors.textSecondary }]}>{difficulty[0]!.toUpperCase() + difficulty.slice(1)}</Text></Pressable>; })}</View>

      <SectionLabel title="5 · Question types" detail="Choose one or more" />
      <View style={styles.typeGrid}>{QUESTION_TYPES.map((item) => { const active = settings.questionTypes.includes(item.id); return <Pressable key={item.id} onPress={() => updateSettings({ questionTypes: active ? settings.questionTypes.length > 1 ? settings.questionTypes.filter((type) => type !== item.id) : settings.questionTypes : [...settings.questionTypes, item.id] })} style={[styles.typeChoice, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.typeShort, { color: active ? colors.primary : colors.textMuted }]}>{item.short}</Text><Text numberOfLines={1} style={[styles.typeLabel, { color: colors.text }]}>{item.label}</Text><Icon name={active ? 'check-circle' : 'circle-outline'} size={16} color={active ? colors.primary : colors.textMuted} /></Pressable>; })}</View>

      <SectionLabel title="6 · Exam controls" />
      <ControlRow label="Exam timer" detail={settings.timeLimitMinutes ? `${settings.timeLimitMinutes} minutes` : 'No time limit'} value={Boolean(settings.timeLimitMinutes)} onValueChange={(value) => updateSettings({ timeLimitMinutes: value ? 30 : undefined })} />
      {settings.timeLimitMinutes ? <View style={styles.optionRow}>{[15, 30, 60].map((minutes) => <Pressable key={minutes} onPress={() => updateSettings({ timeLimitMinutes: minutes })} style={[styles.timerChoice, { backgroundColor: settings.timeLimitMinutes === minutes ? colors.mintSoft : colors.card, borderColor: settings.timeLimitMinutes === minutes ? colors.mint : colors.border }]}><Text style={[styles.smallOptionText, { color: settings.timeLimitMinutes === minutes ? colors.mint : colors.textSecondary }]}>{minutes}m</Text></Pressable>)}</View> : null}
      <ControlRow label="Immediate feedback" detail={settings.immediateFeedback ? 'Explain each answer as you go' : 'Review at the end'} value={settings.immediateFeedback} onValueChange={(value) => updateSettings({ immediateFeedback: value })} />
      <ControlRow label="Randomize questions" detail="Reduce recall from position" value={settings.randomizeQuestions} onValueChange={(value) => updateSettings({ randomizeQuestions: value })} />
      <ControlRow label="Randomize answer order" detail="Keep recognition honest" value={settings.randomizeAnswers} onValueChange={(value) => updateSettings({ randomizeAnswers: value })} />

      {examError ? <View style={[styles.errorBox, { backgroundColor: `${colors.danger}14` }]}><Icon name="alert-circle-outline" color={colors.danger} /><Text style={[styles.errorText, { color: colors.text }]}>{examError}</Text></View> : null}
      <PrimaryButton label={`Start ${settings.mode === 'targeted' ? 'Weak Area Exam' : settings.difficulty === 'adaptive' ? 'Adaptive Exam' : 'Exam'}`} icon="lightning-bolt" onPress={startExam} style={styles.startButton} />
      <Pressable onPress={() => setView('history')} style={styles.historyLink}><Icon name="history" size={18} color={colors.primary} /><Text style={[styles.historyLinkText, { color: colors.primary }]}>View Exam History ({state.examAttempts?.length ?? 0})</Text></Pressable>
    </ScrollView>
  );

  const renderAnswerControls = () => {
    if (!question) return null;
    const isChoice = question.options.length > 0;
    if (!isChoice) return <TextInput value={currentDraft.openAnswer} onChangeText={(openAnswer) => setDraft(question, { openAnswer })} multiline placeholder="Write your answer in your own words…" placeholderTextColor={colors.textMuted} style={[styles.openInput, { color: colors.text, backgroundColor: colors.cardStrong, borderColor: colors.border }]} />;
    return <View style={styles.answerOptions}>{question.options.map((option, optionIndex) => { const selected = currentDraft.selectedIndices.includes(optionIndex); const evaluated = selected && settings.immediateFeedback ? evaluateExamAnswer(question, currentDraft.selectedIndices, '') : null; const correct = evaluated?.correct && selected; return <Pressable key={`${question.id}:${optionIndex}`} onPress={() => { if (question.type === 'multiple-select') setDraft(question, { selectedIndices: selected ? currentDraft.selectedIndices.filter((value) => value !== optionIndex) : [...currentDraft.selectedIndices, optionIndex] }); else setDraft(question, { selectedIndices: [optionIndex] }); }} style={[styles.answerOption, { backgroundColor: correct ? colors.mintSoft : selected ? colors.primarySoft : colors.cardStrong, borderColor: correct ? colors.mint : selected ? colors.primary : colors.border }]}><View style={[styles.answerMarker, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>{selected ? <Icon name={question.type === 'multiple-select' ? 'check' : 'circle' } size={15} color={colors.primaryText} /> : <Text style={[styles.answerMarkerText, { color: colors.textSecondary }]}>{String.fromCharCode(65 + optionIndex)}</Text>}</View><Text style={[styles.answerOptionText, { color: colors.text }]}>{option}</Text></Pressable>; })}</View>;
  };

  const renderTaking = () => {
    if (!question || !build) return <EmptyState title="Exam is empty" detail="Add more source-backed material and try again." />;
    const progress = ((index + 1) / questions.length) * 100;
    const evaluated = settings.immediateFeedback && (currentDraft.openAnswer.trim() || currentDraft.selectedIndices.length) ? evaluateExamAnswer(question, currentDraft.selectedIndices, currentDraft.openAnswer) : null;
    return <View style={styles.takingRoot}>
      <View style={styles.examTop}><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.examTitle, { color: colors.text }]}>{build.title}</Text><Text style={[styles.examMeta, { color: colors.textSecondary }]}>{index + 1} / {questions.length} · {answeredCount} answered</Text></View>{remainingSeconds !== null ? <View style={[styles.timer, { backgroundColor: remainingSeconds <= 60 ? `${colors.danger}18` : colors.cardStrong }]}><Icon name="timer-outline" size={17} color={remainingSeconds <= 60 ? colors.danger : colors.primary} /><Text style={[styles.timerText, { color: remainingSeconds <= 60 ? colors.danger : colors.text }]}>{formatTime(remainingSeconds)}</Text></View> : null}<Pressable accessibilityLabel={examPaused ? 'Resume exam' : 'Pause exam'} onPress={examPaused ? resumeExam : pauseExam}><Icon name={examPaused ? 'play' : 'pause'} color={colors.primary} /></Pressable><Pressable accessibilityLabel="Exit exam" onPress={() => { recordStudyEvent({ type: 'exam-abandoned', examId: build.id, examName: build.title, sourceDeckIds: build.sourceDeckIds, deckId: build.sourceDeckIds[0], assessmentKind: settings.mode === 'targeted' ? 'targeted' : 'adaptive' }); onBack(); }}><Icon name="close" color={colors.textMuted} /></Pressable></View>
      <ProgressBar progress={progress} color={colors.mint} />
      {timerWarning ? <View style={[styles.warningBanner, { backgroundColor: `${colors.warning}18` }]}><Icon name="clock-alert-outline" size={17} color={colors.warning} /><Text style={[styles.warningText, { color: colors.text }]}>{timerWarning === 60 ? 'One minute left.' : 'Five minutes left.'} Finish your current thought, then submit or review unanswered.</Text><Pressable onPress={() => setTimerWarning(null)}><Icon name="close" size={16} color={colors.textMuted} /></Pressable></View> : null}
      <ScrollView contentContainerStyle={styles.questionScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.questionHeading}><Pill label={questionLabel(question.type).toUpperCase()} tone="neutral" /><View style={styles.questionRight}><Text numberOfLines={1} style={[styles.sourceText, { color: colors.textMuted }]}>{question.source.label}</Text><Pressable onPress={() => setFlags((current) => ({ ...current, [question.id]: !current[question.id] }))}><Icon name={flags[question.id] ? 'flag' : 'flag-outline'} size={21} color={flags[question.id] ? colors.warning : colors.textMuted} /></Pressable></View></View>
        <Text style={[styles.questionText, { color: colors.text }]}>{question.prompt}</Text>
        {question.type === 'multiple-select' ? <Text style={[styles.helperText, { color: colors.textSecondary }]}>Select all that apply.</Text> : question.options.length === 0 ? <Text style={[styles.helperText, { color: colors.textSecondary }]}>The idea matters more than exact wording.</Text> : null}
        <View style={styles.confidenceRow}>{(['unsure', 'somewhat-sure', 'very-sure'] as AnswerConfidence[]).map((confidence) => <Pressable key={confidence} onPress={() => setDraft(question, { confidence })} style={[styles.confidenceChoice, { backgroundColor: currentDraft.confidence === confidence ? colors.primarySoft : colors.card, borderColor: currentDraft.confidence === confidence ? colors.primary : colors.border }]}><Text style={[styles.confidenceText, { color: currentDraft.confidence === confidence ? colors.primary : colors.textMuted }]}>{confidence === 'unsure' ? 'Guess' : confidence === 'somewhat-sure' ? 'Unsure' : 'Confident'}</Text></Pressable>)}</View>
        {renderAnswerControls()}
        {evaluated ? <View style={[styles.inlineFeedback, { backgroundColor: evaluated.correct ? colors.mintSoft : `${colors.danger}12`, borderColor: evaluated.correct ? colors.mint : colors.danger }]}><Icon name={evaluated.correct ? 'check-circle' : 'alert-circle-outline'} color={evaluated.correct ? colors.mint : colors.danger} /><View style={{ flex: 1 }}><Text style={[styles.feedbackTitle, { color: colors.text }]}>{evaluated.correct ? 'Correct' : evaluated.partialCredit > 0 ? 'Partially correct' : 'Keep this one in review'}</Text><Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>{question.explanation}</Text></View></View> : null}
        <Card style={[styles.sourceCard, { backgroundColor: colors.primarySoft }]}><Icon name="book-open-page-variant" size={18} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.sourceCardTitle, { color: colors.text }]}>{question.conceptTitle ?? 'Source concept'}</Text><Text style={[styles.sourceCardText, { color: colors.textSecondary }]}>Grounded in {question.source.label}. Adaptive selection weighs mastery, missed history, recency, and source importance.</Text></View></Card>
      </ScrollView>
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}><Pressable disabled={index === 0 || examPaused} onPress={() => setIndex((current) => Math.max(0, current - 1))} style={[styles.navButton, { borderColor: colors.border, opacity: index === 0 || examPaused ? 0.4 : 1 }]}><Icon name="chevron-left" color={colors.textSecondary} /></Pressable><Pressable disabled={examPaused} onPress={() => { setDraft(question, { selectedIndices: [], openAnswer: '' }); if (index < questions.length - 1) setIndex((current) => current + 1); else setView('review'); }} style={styles.skipButton}><Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text></Pressable><PrimaryButton label={index === questions.length - 1 ? unansweredCount ? 'Review exam' : 'Submit exam' : 'Next'} icon="arrow-right" disabled={examPaused || (!currentDraft.openAnswer.trim() && !currentDraft.selectedIndices.length && !unansweredCount)} onPress={nextQuestion} style={styles.nextButton} /></View>
      {examPaused ? <View style={[styles.pauseOverlay, { backgroundColor: colors.mode === 'dark' ? 'rgba(5,10,20,0.94)' : 'rgba(248,250,255,0.96)' }]}><View style={[styles.pauseIcon, { backgroundColor: colors.primarySoft }]}><Icon name="pause" size={34} color={colors.primary} /></View><Text style={[styles.pauseTitle, { color: colors.text }]}>Exam paused</Text><Text style={[styles.pauseText, { color: colors.textSecondary }]}>The timer and response clock are stopped.</Text><PrimaryButton label="Resume exam" icon="play" onPress={resumeExam} style={styles.pauseButton} /></View> : null}
    </View>;
  };

  const renderReview = () => <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.reviewHero}><View style={[styles.heroIcon, { backgroundColor: unansweredCount ? colors.warning : colors.mint }]}>{submitting ? <ActivityIndicator color={colors.primaryText} /> : <Icon name={unansweredCount ? 'clipboard-alert-outline' : 'check'} color={colors.primaryText} size={25} />}</View><Text style={[styles.heroTitle, { color: colors.text }]}>{submitting ? 'Grading your exam' : unansweredCount ? 'Review before submitting' : 'Ready to submit'}</Text><Text style={[styles.heroText, { color: colors.textSecondary }]}>{submitting ? 'StudyBolt is checking open responses semantically when secure AI is available. Offline scoring remains ready as a fallback.' : unansweredCount ? `${unansweredCount} unanswered question${unansweredCount === 1 ? '' : 's'}. You can go back and finish them or submit with skips.` : 'Your answers are recorded. Submit when you are ready to see your full breakdown.'}</Text></View><Card style={styles.reviewList}>{questions.map((item, itemIndex) => { const draft = draftFor(item); const answered = Boolean(draft.openAnswer.trim() || draft.selectedIndices.length); return <Pressable key={item.id} disabled={submitting} onPress={() => { setIndex(itemIndex); setView('taking'); }} style={[styles.reviewRow, { borderBottomColor: colors.border }]}><View style={[styles.reviewNumber, { backgroundColor: answered ? colors.mintSoft : `${colors.warning}18` }]}><Text style={[styles.reviewNumberText, { color: answered ? colors.mint : colors.warning }]}>{itemIndex + 1}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={2} style={[styles.reviewPrompt, { color: colors.text }]}>{item.prompt}</Text><Text style={[styles.reviewMeta, { color: colors.textMuted }]}>{answered ? 'Answered' : 'Unanswered'} · {item.conceptTitle ?? item.source.label}</Text></View><Icon name={flags[item.id] ? 'flag' : 'chevron-right'} color={flags[item.id] ? colors.warning : colors.textMuted} /></Pressable>; })}</Card><PrimaryButton label={submitting ? 'Grading…' : 'Submit exam'} icon="check" disabled={submitting} onPress={() => void finishExam()} style={styles.startButton} /><Pressable onPress={() => setView('taking')} style={[styles.historyLink, submitting && { opacity: 0.4 }]} pointerEvents={submitting ? 'none' : 'auto'}><Text style={[styles.historyLinkText, { color: colors.primary }]}>Continue answering</Text></Pressable></ScrollView>;

  const renderResults = () => {
    if (!attempt) return <EmptyState title="No result yet" detail="Complete an exam to see results." />;
    const answerMap = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const missed = attempt.questions.filter((item) => !answerMap.get(item.id)?.correct);
    const flaggedQuestions = attempt.questions.filter((item) => attempt.flaggedQuestionIds.includes(item.id));
    const breakdown = (key: (question: QuizQuestion) => string) => [...new Set(attempt.questions.map(key))].map((label) => { const subset = attempt.questions.filter((item) => key(item) === label); const points = subset.reduce((sum, item) => sum + (answerMap.get(item.id)?.partialCredit ?? (answerMap.get(item.id)?.correct ? 1 : 0)), 0); return { label, score: Math.round((points / Math.max(1, subset.length)) * 100) }; }).sort((a, b) => b.score - a.score);
    const conceptBreakdown = breakdown((item) => item.conceptTitle ?? item.source.label);
    const sourceBreakdown = breakdown((item) => item.sourceDeckId ? state.decks.find((deck) => deck.id === item.sourceDeckId)?.title ?? item.source.label : item.source.label);
    const chapterBreakdown = breakdown((item) => `${item.sourceDeckId ? state.decks.find((deck) => deck.id === item.sourceDeckId)?.title ?? 'Source' : 'Source'} · ${item.source.label}`);
    const typeBreakdown = breakdown((item) => questionLabel(item.type));
    const difficultyBreakdown = breakdown((item) => item.difficulty ?? 'medium');
    const responseTimes = attempt.answers.map((answer) => answer.responseTimeMs).filter((value): value is number => typeof value === 'number');
    const averageSeconds = responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length / 100) / 10 : 0;
    const slowest = [...(attempt.conceptResults ?? [])].filter((item) => item.responseTimeMs > 0).sort((a, b) => b.responseTimeMs - a.responseTimeMs).slice(0, 3);
    const improved = [...(attempt.conceptResults ?? [])].filter((item) => item.improvement > 0).sort((a, b) => b.improvement - a.improvement).slice(0, 3);
    const visibleMissed = showAllMissed ? missed : missed.slice(0, 5);
    const recommendation = attempt.score >= 80 && attempt.weakTopics.length === 0
      ? 'Your recent evidence is strong across this exam. Space the next check out instead of repeating immediately.'
      : 'Review the weakest concepts, then use a fresh targeted exam to check whether the improvement holds.';
    return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.resultsHero}><View style={[styles.resultIcon, { backgroundColor: attempt.score >= 70 ? colors.mintSoft : colors.primarySoft }]}><Icon name={attempt.score >= 70 ? 'trophy-outline' : 'refresh'} size={39} color={attempt.score >= 70 ? colors.mint : colors.primary} /></View><Text style={[styles.resultTitle, { color: colors.text }]}>{attempt.score >= 80 ? 'Strong work' : attempt.score >= 60 ? 'Good foundation' : 'Keep retrieving'}</Text><Text style={[styles.resultScore, { color: colors.text }]}>{attempt.score}%</Text><Text style={[styles.resultSub, { color: colors.textSecondary }]}>{attempt.correctCount} / {attempt.questionCount} fully correct · {formatTime(attempt.durationSeconds)}</Text>{attempt.scoreChangeFromPrevious !== undefined ? <Pill label={`${attempt.scoreChangeFromPrevious >= 0 ? '+' : ''}${attempt.scoreChangeFromPrevious} pts vs prior attempt`} tone={attempt.scoreChangeFromPrevious >= 0 ? 'mint' : 'neutral'} /> : null}</View>
      <Card style={[styles.masteryChange, { backgroundColor: colors.primarySoft }]}><View><Text style={[styles.microLabel, { color: colors.textMuted }]}>ESTIMATED MASTERY</Text><Text style={[styles.masteryChangeValue, { color: colors.text }]}>{attempt.masteryBefore}% <Icon name="arrow-right" size={17} color={colors.primary} /> {attempt.masteryAfter}%</Text></View><Pill label={`${attempt.improvement >= 0 ? '+' : ''}${attempt.improvement} pts`} tone={attempt.improvement >= 0 ? 'mint' : 'neutral'} /></Card>
      <Text style={[styles.estimateNote, { color: colors.textMuted }]}>Estimated readiness is a study-priority signal based on coverage, difficulty, recency, and repeated retrieval—not a prediction of your real exam grade.</Text>
      {gradingWarning ? <View style={[styles.errorBox, { backgroundColor: `${colors.warning}18` }]}><Icon name="cloud-alert-outline" color={colors.warning} /><Text style={[styles.errorText, { color: colors.text }]}>{gradingWarning}</Text></View> : null}
      <View style={styles.metricGrid}><Metric label="Avg response" value={`${averageSeconds}s`} color={colors.primary} /><Metric label="Flagged" value={`${flaggedQuestions.length}`} color={colors.warning} /><Metric label="Needs review" value={`${missed.length}`} color={colors.danger} /></View>
      <ResultBreakdown title="By source" rows={sourceBreakdown} /><ResultBreakdown title="By chapter / source section" rows={chapterBreakdown} /><ResultBreakdown title="By concept" rows={conceptBreakdown} /><ResultBreakdown title="By question type" rows={typeBreakdown} /><ResultBreakdown title="By difficulty" rows={difficultyBreakdown} />
      <Text style={[styles.subsectionTitle, { color: colors.text }]}>StudyBolt’s read</Text><View style={styles.topicGrid}>{attempt.strongestTopics.slice(0, 4).map((topic) => <TopicPill key={`strong:${topic}`} label={`Strong · ${topic}`} tone="mint" />)}{attempt.weakTopics.slice(0, 4).map((topic) => <TopicPill key={`weak:${topic}`} label={`Review · ${topic}`} tone="danger" />)}</View>
      {slowest.length ? <><Text style={[styles.subsectionTitle, { color: colors.text }]}>Slowest concepts</Text><View style={styles.topicGrid}>{slowest.map((item) => <TopicPill key={`slow:${item.conceptId}`} label={`${item.title} · ${Math.round(item.responseTimeMs / 100) / 10}s`} tone="danger" />)}</View></> : null}
      {improved.length ? <><Text style={[styles.subsectionTitle, { color: colors.text }]}>Most improved</Text><View style={styles.topicGrid}>{improved.map((item) => <TopicPill key={`improved:${item.conceptId}`} label={`${item.title} · +${item.improvement}`} tone="mint" />)}</View></> : null}
      <Card style={[styles.recommendationCard, { backgroundColor: attempt.score >= 80 && !attempt.weakTopics.length ? colors.mintSoft : colors.primarySoft }]}><Icon name="compass-outline" color={attempt.score >= 80 && !attempt.weakTopics.length ? colors.mint : colors.primary} /><Text style={[styles.recommendationText, { color: colors.textSecondary }]}>{recommendation}</Text></Card>
      <Text style={[styles.subsectionTitle, { color: colors.text }]}>Questions to review</Text>{visibleMissed.length ? visibleMissed.map((item) => <MissedQuestion key={item.id} item={item} answer={answerMap.get(item.id)} onAsk={() => openTutor(item)} />) : <Card style={[styles.emptyResult, { backgroundColor: colors.mintSoft }]}><Icon name="check-decagram-outline" color={colors.mint} /><Text style={[styles.emptyResultText, { color: colors.textSecondary }]}>No missed questions. Try a harder adaptive run when you want a sharper confidence check.</Text></Card>}
      {!showAllMissed && missed.length > visibleMissed.length ? <Pressable onPress={() => setShowAllMissed(true)} style={styles.historyLink}><Text style={[styles.historyLinkText, { color: colors.primary }]}>Review all {missed.length} mistakes</Text></Pressable> : null}
      {flaggedQuestions.length ? <><Text style={[styles.subsectionTitle, { color: colors.text }]}>Flagged for review</Text>{flaggedQuestions.slice(0, 5).map((item) => <Pressable key={`flagged:${item.id}`} onPress={() => openTutor(item)} style={[styles.flaggedResultRow, { borderColor: colors.border, backgroundColor: colors.card }]}><Icon name="flag" color={colors.warning} /><Text numberOfLines={2} style={[styles.flaggedResultText, { color: colors.text }]}>{item.prompt}</Text><Icon name="creation" size={17} color={colors.purple} /></Pressable>)}</> : null}
      <View style={styles.actionGrid}><ActionButton label="Review mistakes" icon="clipboard-text-search-outline" onPress={() => setShowAllMissed(true)} /><ActionButton label="Create targeted exam" icon="target" onPress={startTargeted} /><ActionButton label="Ask StudyBolt" icon="creation" onPress={() => void startTutorFromResults()} /><ActionButton label="Study weak areas" icon="brain" onPress={() => attempt.sourceDeckIds[0] && onStudyWeakAreas?.(attempt.sourceDeckIds[0])} /><ActionButton label="Review flashcards" icon="cards-outline" onPress={() => onBack('flashcards', attempt.sourceDeckIds[0])} /><ActionButton label="Update study plan" icon="calendar-check-outline" onPress={() => attempt.sourceDeckIds[0] && onUpdateStudyPlan?.(attempt.sourceDeckIds[0])} /><ActionButton label="Retake with new questions" icon="refresh" onPress={retake} /></View>
      <PrimaryButton label="Back to Exam Mode" icon="arrow-left" onPress={() => setView('setup')} style={styles.startButton} />
    </ScrollView>;
  };

  const renderHistory = () => {
    const attempts = [...(state.examAttempts ?? [])].reverse();
    const visible = attempts.slice(0, historyLimit);
    const legacyCount = state.decks.reduce((sum, deck) => sum + (deck.testAttempts?.length ?? 0), 0);
    return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.toolHeading}><Text style={[styles.heroTitle, { color: colors.text }]}>Exam History</Text><Text style={[styles.heroText, { color: colors.textSecondary }]}>Reopen saved adaptive exams to review questions, mistakes, sources, and mastery changes.</Text></View>{visible.length ? visible.map((historyAttempt) => <Pressable key={historyAttempt.id} onPress={() => openHistoryAttempt(historyAttempt)} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.historyScore, { backgroundColor: historyAttempt.score >= 70 ? colors.mintSoft : colors.primarySoft }]}><Text style={[styles.historyScoreText, { color: historyAttempt.score >= 70 ? colors.mint : colors.primary }]}>{historyAttempt.score}%</Text></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.historyTitle, { color: colors.text }]}>{historyAttempt.title}</Text><Text style={[styles.historyMeta, { color: colors.textMuted }]}>{new Date(historyAttempt.createdAt).toLocaleDateString()} · {historyAttempt.questionCount} questions · {historyAttempt.sourceLabels.length} sources · {formatTime(historyAttempt.durationSeconds)}</Text><Text numberOfLines={1} style={[styles.historyWeak, { color: colors.textSecondary }]}>{historyAttempt.weakTopics.length ? `Review: ${historyAttempt.weakTopics.slice(0, 2).join(' · ')}` : 'No weak topics recorded'}{historyAttempt.scoreChangeFromPrevious !== undefined ? ` · ${historyAttempt.scoreChangeFromPrevious >= 0 ? '+' : ''}${historyAttempt.scoreChangeFromPrevious} pts` : ''}</Text></View><Icon name="chevron-right" color={colors.textMuted} /></Pressable>) : <EmptyState title="No detailed exam history yet" detail={legacyCount ? `${legacyCount} earlier Full Test score${legacyCount === 1 ? '' : 's'} remain preserved in each Study Pack. New attempts add reopenable question-level history here.` : 'Your completed adaptive and targeted exams will appear here.'} />}{historyLimit < attempts.length ? <Pressable onPress={() => setHistoryLimit((value) => value + 10)} style={[styles.loadMore, { borderColor: colors.border }]}><Text style={[styles.historyLinkText, { color: colors.primary }]}>Load 10 older exams</Text></Pressable> : null}<Pressable onPress={() => setView('setup')} style={styles.historyLink}><Icon name="arrow-left" size={18} color={colors.primary} /><Text style={[styles.historyLinkText, { color: colors.primary }]}>Back to setup</Text></Pressable></ScrollView>;
  };

  const sheetContextReady = Boolean(tutorContext);
  return <View style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 5 }]}><View style={styles.headerWrap}><Header title={view === 'taking' ? 'Exam in progress' : 'Exam Mode'} subtitle={view === 'history' ? 'Saved runs' : view === 'results' ? attempt?.title : 'Adaptive preparation'} onBack={view === 'taking' ? () => { if (build) recordStudyEvent({ type: 'exam-abandoned', examId: build.id, examName: build.title, sourceDeckIds: build.sourceDeckIds, deckId: build.sourceDeckIds[0], assessmentKind: settings.mode === 'targeted' ? 'targeted' : 'adaptive' }); onBack(); } : view === 'setup' ? onBack : () => setView('setup')} right={view !== 'taking' ? <Pill label={view === 'history' ? 'HISTORY' : view === 'results' ? 'RESULTS' : 'ONE SYSTEM'} tone="purple" /> : null} /></View>{view === 'setup' ? renderSetup() : view === 'taking' ? renderTaking() : view === 'review' ? renderReview() : view === 'results' ? renderResults() : renderHistory()}<AskStudyBoltSheet visible={tutorVisible && sheetContextReady} sectionTitle={tutorQuestion?.conceptTitle ?? tutorQuestion?.source.label ?? 'Exam question'} signedIn={Boolean(user) || canAttemptOnDeviceAI(onDeviceAI)} configured={canAttemptOnDeviceAI(onDeviceAI) || isAiTutorConfigured} quota={provider === 'cloud' ? tutorQuota : undefined} loading={tutorLoading} error={tutorError} response={tutorResponse} provider={provider} providerDetail={providerDetail} initialQuestion={lastTutorRequest.current.question} onAsk={(action, request) => void runTutor(action, request)} onRetry={() => void runTutor(lastTutorRequest.current.action, lastTutorRequest.current.question)} onSpeak={(text) => { void Speech.stop().then(() => Speech.speak(text)); }} onResume={() => setTutorVisible(false)} onRequireAuth={onRequireAuth} onClose={() => { void Speech.stop(); setTutorVisible(false); }} onQuizAnswered={(correct) => { if (attempt) recordStudyEvent({ type: 'tutor-quiz', deckId: attempt.sourceDeckIds[0], examId: attempt.examId, examAttemptId: attempt.id, tutorQuizCorrect: correct }); }} /></View>;
}

function SectionLabel({ title, detail }: { title: string; detail?: string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.sectionLabelRow}><Text style={[styles.sectionLabel, { color: colors.text }]}>{title}</Text>{detail ? <Text style={[styles.sectionDetail, { color: colors.textMuted }]}>{detail}</Text> : null}</View>;
}

function ControlRow({ label, detail, value, onValueChange }: { label: string; detail: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const { colors } = useStudyBolt();
  return <View style={[styles.controlRow, { borderBottomColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.controlLabel, { color: colors.text }]}>{label}</Text><Text style={[styles.controlDetail, { color: colors.textSecondary }]}>{detail}</Text></View><Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.card} /> </View>;
}

function ResultBreakdown({ title, rows }: { title: string; rows: Array<{ label: string; score: number }> }) {
  const { colors } = useStudyBolt();
  return <View style={styles.breakdown}><Text style={[styles.subsectionTitle, { color: colors.text }]}>{title}</Text>{rows.slice(0, 6).map((row) => <View key={row.label} style={styles.breakdownRow}><Text numberOfLines={1} style={[styles.breakdownLabel, { color: colors.textSecondary }]}>{row.label}</Text><View style={styles.breakdownBar}><ProgressBar progress={row.score} color={row.score >= 75 ? colors.mint : row.score >= 55 ? colors.primary : colors.danger} /></View><Text style={[styles.breakdownScore, { color: row.score >= 75 ? colors.mint : row.score >= 55 ? colors.primary : colors.danger }]}>{row.score}%</Text></View>)}</View>;
}

function MissedQuestion({ item, answer, onAsk }: { item: QuizQuestion; answer?: QuizAnswerRecord; onAsk: () => void }) {
  const { colors } = useStudyBolt();
  const correctAnswer = item.options[item.correctIndex] ?? item.acceptedAnswers?.[0] ?? item.explanation;
  const partialCredit = Math.round((answer?.partialCredit ?? 0) * 100);
  return <Card style={[styles.missedCard, { borderColor: colors.border }]}><View style={styles.missedTop}><Pill label={item.conceptTitle ?? item.source.label} tone="neutral" /><Text style={[styles.missedType, { color: colors.textMuted }]}>{questionLabel(item.type)}{partialCredit > 0 ? ` · ${partialCredit}% credit` : ''}</Text></View><Text style={[styles.missedPrompt, { color: colors.text }]}>{item.prompt}</Text><Text style={[styles.missedLabel, { color: colors.danger }]}>YOUR ANSWER</Text><Text style={[styles.missedAnswer, { color: colors.textSecondary }]}>{answerForQuestion(item, answer)}</Text><Text style={[styles.missedLabel, { color: colors.mint }]}>CORRECT ANSWER</Text><Text style={[styles.missedAnswer, { color: colors.textSecondary }]}>{correctAnswer}</Text><Text style={[styles.missedLabel, { color: colors.primary }]}>WHY</Text><Text style={[styles.missedWhy, { color: colors.textSecondary }]}>{answer?.gradingFeedback ?? item.explanation}</Text>{answer?.missingIdeas?.length ? <Text style={[styles.missedIdeas, { color: colors.textSecondary }]}>Missing ideas: {answer.missingIdeas.join(' · ')}</Text> : null}<View style={[styles.rememberBox, { backgroundColor: colors.primarySoft }]}><Icon name="lightbulb-on-outline" size={16} color={colors.primary} /><Text style={[styles.rememberText, { color: colors.textSecondary }]}><Text style={{ fontWeight: '900' }}>Remember this: </Text>{item.conceptTitle ?? item.source.label} → {correctAnswer}</Text></View><View style={styles.missedActions}><Text style={[styles.missedSource, { color: colors.textMuted }]}>{item.source.label}{answer?.responseTimeMs ? ` · ${Math.round(answer.responseTimeMs / 100) / 10}s` : ''}</Text><Pressable onPress={onAsk} style={[styles.askButton, { backgroundColor: colors.purpleSoft }]}><Icon name="creation" size={16} color={colors.purple} /><Text style={[styles.askButtonText, { color: colors.purple }]}>Ask StudyBolt</Text></Pressable></View></Card>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors } = useStudyBolt();
  return <Card style={styles.metric}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text></Card>;
}

function TopicPill({ label, tone }: { label: string; tone: 'mint' | 'danger' }) {
  const { colors } = useStudyBolt();
  return <View style={[styles.topicPill, { backgroundColor: tone === 'mint' ? colors.mintSoft : `${colors.danger}14` }]}><Text numberOfLines={1} style={[styles.topicPillText, { color: tone === 'mint' ? colors.mint : colors.danger }]}>{label}</Text></View>;
}

function ActionButton({ label, icon, onPress }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return <Pressable onPress={onPress} style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Icon name={icon} size={19} color={colors.primary} /><Text style={[styles.actionButtonText, { color: colors.text }]}>{label}</Text></Pressable>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.emptyState}><Icon name="clipboard-alert-outline" size={44} color={colors.textMuted} /><Text style={[styles.emptyStateTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  headerWrap: { paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 16 },
  heroIcon: { width: 47, height: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.6 },
  heroText: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  adaptiveCard: { padding: 15, marginBottom: 5 },
  adaptiveTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  adaptiveBolt: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  adaptiveTitle: { fontSize: 13, fontWeight: '900' },
  adaptiveText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 13 },
  readinessLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  readinessValue: { fontSize: 25, fontWeight: '900', marginTop: 2 },
  readinessDetail: { fontSize: 9, lineHeight: 13, marginTop: 5 },
  readinessTopics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  readinessDisclaimer: { fontSize: 8, lineHeight: 12, marginTop: 8 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 21, marginBottom: 9 },
  sectionLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0.1 },
  sectionDetail: { fontSize: 9, fontWeight: '700' },
  textInput: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 12, fontWeight: '700' },
  deckList: { gap: 8 },
  deckChoice: { minHeight: 61, borderWidth: 1, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  deckEmoji: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deckChoiceTitle: { fontSize: 11, fontWeight: '900' },
  deckChoiceMeta: { fontSize: 9, marginTop: 3 },
  microLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 15, marginBottom: 8 },
  chips: { gap: 7, paddingBottom: 2 },
  chip: { maxWidth: 180, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 9 },
  chipText: { fontSize: 9, fontWeight: '800' },
  materialHint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 13, padding: 11, marginTop: 11 },
  materialHintText: { flex: 1, fontSize: 9, lineHeight: 14 },
  optionRow: { flexDirection: 'row', gap: 7 },
  option: { flex: 1, minHeight: 49, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  optionText: { textAlign: 'center', fontSize: 10, lineHeight: 14, fontWeight: '900' },
  smallOption: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smallOptionText: { fontSize: 10, fontWeight: '900' },
  timerChoice: { minWidth: 65, minHeight: 37, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  typeChoice: { width: '48.5%', minHeight: 45, borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  typeShort: { width: 34, fontSize: 8, fontWeight: '900' },
  typeLabel: { flex: 1, fontSize: 9, fontWeight: '800' },
  controlRow: { minHeight: 57, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  controlLabel: { fontSize: 11, fontWeight: '900' },
  controlDetail: { fontSize: 9, marginTop: 3 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: 12, marginTop: 14 },
  errorText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  startButton: { marginTop: 18 },
  historyLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, padding: 15 },
  historyLinkText: { fontSize: 11, fontWeight: '900' },
  takingRoot: { flex: 1 },
  examTop: { paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  examTitle: { fontSize: 15, fontWeight: '900' },
  examMeta: { fontSize: 10, marginTop: 3 },
  timer: { minWidth: 79, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  timerText: { fontSize: 12, fontWeight: '900' },
  warningBanner: { marginHorizontal: 20, marginTop: 10, padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  warningText: { flex: 1, fontSize: 9, lineHeight: 13, fontWeight: '800' },
  questionScroll: { padding: 20, paddingBottom: 110 },
  questionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  questionRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  sourceText: { maxWidth: 150, fontSize: 9, fontWeight: '700' },
  questionText: { fontSize: 22, lineHeight: 29, fontWeight: '900', marginTop: 20, letterSpacing: -0.4 },
  helperText: { fontSize: 10, lineHeight: 15, marginTop: 8 },
  confidenceRow: { flexDirection: 'row', gap: 7, marginTop: 18 },
  confidenceChoice: { flex: 1, minHeight: 34, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  confidenceText: { fontSize: 9, fontWeight: '800' },
  answerOptions: { gap: 9, marginTop: 17 },
  answerOption: { minHeight: 62, borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  answerMarker: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  answerMarkerText: { fontSize: 11, fontWeight: '900' },
  answerOptionText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  openInput: { minHeight: 170, borderWidth: 1, borderRadius: 15, padding: 13, marginTop: 17, fontSize: 13, lineHeight: 20, textAlignVertical: 'top' },
  inlineFeedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 13 },
  feedbackTitle: { fontSize: 12, fontWeight: '900' },
  feedbackBody: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  sourceCard: { flexDirection: 'row', gap: 9, marginTop: 14, padding: 12 },
  sourceCardTitle: { fontSize: 11, fontWeight: '900' },
  sourceCardText: { fontSize: 9, lineHeight: 14, marginTop: 3 },
  bottomBar: { borderTopWidth: StyleSheet.hairlineWidth, minHeight: 74, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  navButton: { width: 44, height: 46, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  skipButton: { minHeight: 46, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 10, fontWeight: '900' },
  nextButton: { flex: 1, marginTop: 0 },
  pauseOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 5, alignItems: 'center', justifyContent: 'center', padding: 30 },
  pauseIcon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  pauseTitle: { fontSize: 24, fontWeight: '900', marginTop: 16 },
  pauseText: { fontSize: 11, marginTop: 6 },
  pauseButton: { minWidth: 210, marginTop: 20 },
  reviewHero: { alignItems: 'center', paddingTop: 20, paddingBottom: 15 },
  reviewList: { paddingVertical: 2 },
  reviewRow: { minHeight: 71, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewNumber: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reviewNumberText: { fontSize: 10, fontWeight: '900' },
  reviewPrompt: { fontSize: 10, lineHeight: 14, fontWeight: '800' },
  reviewMeta: { fontSize: 8, marginTop: 3 },
  resultsHero: { alignItems: 'center', paddingTop: 17, gap: 5 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 23, fontWeight: '900', marginTop: 6 },
  resultScore: { fontSize: 54, lineHeight: 58, fontWeight: '900' },
  resultSub: { fontSize: 11 },
  masteryChange: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  masteryChangeValue: { fontSize: 20, fontWeight: '900', marginTop: 4 },
  estimateNote: { fontSize: 9, lineHeight: 14, marginTop: 9 },
  metricGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metric: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 5 },
  metricValue: { fontSize: 18, fontWeight: '900' },
  metricLabel: { fontSize: 8, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  breakdown: { marginTop: 19 },
  subsectionTitle: { fontSize: 14, fontWeight: '900', marginTop: 18, marginBottom: 9 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  breakdownLabel: { width: 105, fontSize: 9, fontWeight: '700' },
  breakdownBar: { flex: 1 },
  breakdownScore: { width: 35, textAlign: 'right', fontSize: 10, fontWeight: '900' },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  topicPill: { maxWidth: '100%', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  topicPillText: { fontSize: 9, fontWeight: '900' },
  missedCard: { marginTop: 10, padding: 13 },
  missedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  missedType: { fontSize: 8, fontWeight: '800' },
  missedPrompt: { fontSize: 13, lineHeight: 18, fontWeight: '900', marginTop: 11 },
  missedLabel: { fontSize: 8, letterSpacing: 0.8, fontWeight: '900', marginTop: 12 },
  missedAnswer: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  missedWhy: { fontSize: 10, lineHeight: 15, marginTop: 11 },
  missedIdeas: { fontSize: 9, lineHeight: 14, marginTop: 7, fontWeight: '800' },
  rememberBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 11, padding: 10, marginTop: 10 },
  rememberText: { flex: 1, fontSize: 9, lineHeight: 14 },
  missedActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  missedSource: { flex: 1, fontSize: 8 },
  askButton: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  askButtonText: { fontSize: 9, fontWeight: '900' },
  emptyResult: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  emptyResultText: { flex: 1, fontSize: 10, lineHeight: 15 },
  recommendationCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 17 },
  recommendationText: { flex: 1, fontSize: 10, lineHeight: 15 },
  flaggedResultRow: { minHeight: 55, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  flaggedResultText: { flex: 1, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  actionButton: { width: '48.5%', minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionButtonText: { flex: 1, fontSize: 9, lineHeight: 13, fontWeight: '900' },
  toolHeading: { marginTop: 10 },
  historyCard: { minHeight: 76, borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9 },
  historyScore: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  historyScoreText: { fontSize: 15, fontWeight: '900' },
  historyTitle: { fontSize: 11, fontWeight: '900' },
  historyMeta: { fontSize: 8, marginTop: 3 },
  historyWeak: { fontSize: 9, marginTop: 5 },
  loadMore: { minHeight: 46, borderWidth: 1, borderRadius: 13, marginTop: 13, alignItems: 'center', justifyContent: 'center' },
  emptyState: { padding: 70, alignItems: 'center', gap: 10 },
  emptyStateTitle: { fontSize: 18, fontWeight: '900' },
  emptyStateText: { maxWidth: 290, textAlign: 'center', fontSize: 11, lineHeight: 16 },
});
