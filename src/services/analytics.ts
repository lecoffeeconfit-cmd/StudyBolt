import type {
  FlashcardConfidence,
  QuizAnswerRecord,
  QuizDifficulty,
  QuizQuestionType,
  StudyBoltState,
  StudyEvent,
  StudyPack,
} from '../models';
import { calculateCourseMastery, calculateMastery } from './mastery';
import { getRetentionCardSchedule } from './retentionScheduler';

export type EvidenceLevel = 'early' | 'building' | 'strong';
export type ConceptStatus = 'mastered' | 'learning' | 'weak' | 'unseen' | 'at-risk' | 'improving' | 'forgotten';

export interface ConceptInsight {
  id: string;
  title: string;
  deckId: string;
  deckTitle: string;
  courseName: string;
  mastery: number;
  status: ConceptStatus;
  reviewCount: number;
  due: boolean;
  recallProbability: number | null;
  forgettingRisk: number | null;
  lastEvidenceAt: string | null;
}

export interface BreakdownValue {
  label: string;
  value: number | null;
  count: number;
}

export interface DistributionValue {
  label: string;
  count: number;
  percent: number;
}

export interface AdvancedAnalytics {
  recallProbability: { value: number | null; concepts: number };
  forgettingRisk: ConceptInsight[];
  recognitionRecallGap: { value: number | null; recognition: number | null; recall: number | null; samples: number };
  confidenceCalibration: {
    score: number | null;
    samples: number;
    confidentlyRight: number;
    confidentlyWrong: number;
    unsureRight: number;
    unsureWrong: number;
  };
  learningVelocity: { pointsPerWeek: number | null; samples: number };
  masteryGainPerHour: {
    topMethod: string | null;
    topMethodValue: number | null;
    topCourse: string | null;
    topCourseValue: number | null;
  };
  confusionPairs: Array<{ id: string; selected: string; correct: string; count: number }>;
  questionTypePerformance: BreakdownValue[];
  responseTime: { averageSeconds: number | null; medianSeconds: number | null; samples: number };
  fluency: { correctPerMinute: number | null; samples: number };
  bestStudyTime: { label: string; accuracy: number; samples: number } | null;
  sessionFatigue: { drop: number; earlyAccuracy: number; lateAccuracy: number; samples: number } | null;
  idealSessionLength: { label: string; accuracy: number; sessions: number } | null;
  consistency: { score: number; activeDays: number; activeWeeks: number };
  spacingQuality: { score: number | null; spaced: number; total: number };
  crammingIndex: { value: number; finalWindowMinutes: number; totalMinutes: number } | null;
  planAdherence: { value: number | null; completedMinutes: number; plannedMinutes: number };
  reviewLoad: { tomorrow: number; nextSevenDays: number };
  masteryDistribution: DistributionValue[];
  difficultyDistribution: DistributionValue[];
  readinessForecast: { value: number; targetDate: string; daysRemaining: number } | null;
  efficiencyTrend: { changePercent: number; recent: number; previous: number } | null;
}

export interface AnalyticsSnapshot {
  evidenceLevel: EvidenceLevel;
  historyMessage: string;
  readiness: {
    score: number | null;
    components: Array<{ label: string; value: number; weight: number }>;
  };
  overallMastery: number;
  recentQuizAverage: number | null;
  studyTimeThisWeek: number;
  streakDays: number;
  masteredCount: number;
  learningCount: number;
  dueTodayCount: number;
  weakConcepts: ConceptInsight[];
  strongestConcepts: ConceptInsight[];
  unseenConcepts: ConceptInsight[];
  atRiskConcepts: ConceptInsight[] | null;
  improvingConcepts: ConceptInsight[] | null;
  forgottenConcepts: ConceptInsight[] | null;
  topicMastery: Array<{ id: string; title: string; courseName: string; value: number }>;
  classes: Array<{ id: string; name: string; emoji: string; color: string; mastery: number; studyMinutes: number }>;
  packs: Array<{ id: string; title: string; courseName: string; color: string; completion: number; remaining: number; studyMinutes: number }>;
  packCompletion: number;
  materialRemaining: number;
  advanced: AdvancedAnalytics;
  retention: {
    rate: number | null;
    confidence: number | null;
    longTermSuccess: number | null;
    spacedAttempts: number;
  };
  quizzes: {
    overallAccuracy: number | null;
    averageScore: number | null;
    bestScore: number | null;
    recentResults: Array<{ id: string; deckTitle: string; score: number; date: string }>;
    answered: number;
    correct: number;
    incorrect: number;
    firstTryAccuracy: number | null;
    repeatAccuracy: number | null;
    repeatedMisses: Array<{ id: string; prompt: string; misses: number; deckTitle: string }>;
    byDifficulty: BreakdownValue[];
    byType: BreakdownValue[];
    perfectQuizzes: number;
    completed: number;
    trend: number[];
  };
  activity: {
    today: number;
    week: number;
    month: number;
    total: number;
    averageDaily: number;
    averageSession: number;
    longestSession: number | null;
    sessions: number;
    daysThisWeek: number;
    activeDays: number;
    sevenDays: Array<{ key: string; label: string; minutes: number }>;
    thirtyDays: Array<{ key: string; minutes: number }>;
    productiveDay: string | null;
    productiveTime: string | null;
  };
  methods: {
    notesMinutes: number;
    notesSectionsReviewed: number;
    flashcardsReviewed: number;
    flashcardsMastered: number;
    flashcardsLearning: number;
    quizzesCompleted: number;
    questionsAnswered: number;
    listeningMinutes: number;
    listeningCompletion: number | null;
    quickReviewsCompleted: number;
    fullNotesReviewsCompleted: number;
    packsCompleted: number;
    packsIncomplete: number;
  };
  more: {
    classesCreated: number;
    lecturesUploaded: number;
    packsCreated: number;
    totalPages: number;
    slidesReviewed: number;
    milestones: string[];
  };
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const confidenceValue = (confidence: FlashcardConfidence) => confidence === 'known' ? 88 : confidence === 'learning' ? 52 : 8;
const confidenceRank = (confidence?: FlashcardConfidence) => confidence === 'known' ? 2 : confidence === 'learning' ? 1 : 0;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function dayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayStart(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(now: Date, days: number): Date {
  const date = dayStart(now);
  date.setDate(date.getDate() - days);
  return date;
}

function hourLabel(hour: number): string {
  const normalized = hour % 24;
  if (normalized === 0) return '12 AM';
  if (normalized === 12) return '12 PM';
  return normalized > 12 ? `${normalized - 12} PM` : `${normalized} AM`;
}

function minutesFor(event: StudyEvent): number {
  return Math.max(0, event.durationMinutes ?? 0);
}

function packCompletion(deck: StudyPack, events: StudyEvent[]): number {
  const notes = deck.notes.length ? deck.reviewedNoteIds.length / deck.notes.length : 1;
  const cards = deck.flashcards.length
    ? deck.flashcards.filter((card) => card.confidence !== 'new').length / deck.flashcards.length
    : 1;
  const quiz = deck.quiz.length ? (deck.quizAttempts.length ? 1 : 0) : 1;
  const words = deck.quickReview.split(/\s+/).filter(Boolean).length;
  const storedAudio = words ? Math.min(1, deck.audioPosition / words) : 1;
  const eventAudio = Math.max(0, ...events
    .filter((event) => event.type === 'audio' && event.deckId === deck.id)
    .map((event) => (event.completionPercent ?? 0) / 100));
  const audio = Math.max(storedAudio, eventAudio);
  return clamp((notes * 0.3 + cards * 0.35 + quiz * 0.25 + audio * 0.1) * 100);
}

function accuracy(answers: QuizAnswerRecord[]): number | null {
  return answers.length ? clamp((answers.reduce((sum, answer) => sum + (answer.partialCredit ?? (answer.correct ? 1 : 0)), 0) / answers.length) * 100) : null;
}

function groupAccuracy<T extends string>(answers: QuizAnswerRecord[], values: readonly T[], select: (answer: QuizAnswerRecord) => T): BreakdownValue[] {
  return values.map((value) => {
    const matching = answers.filter((answer) => select(answer) === value);
    return { label: value, value: accuracy(matching), count: matching.length };
  });
}

function makeDistribution(labels: string[], values: string[]): DistributionValue[] {
  return labels.map((label) => {
    const count = values.filter((value) => value === label).length;
    return { label, count, percent: values.length ? clamp((count / values.length) * 100) : 0 };
  });
}

interface StudySession {
  events: StudyEvent[];
  minutes: number;
}

function studySessions(events: StudyEvent[]): StudySession[] {
  const timed = events.filter((event) => minutesFor(event) > 0).sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));
  const sessions: Array<StudySession & { endedAt: number }> = [];
  timed.forEach((event) => {
    const time = +new Date(event.occurredAt);
    const last = sessions[sessions.length - 1];
    if (!last || time - last.endedAt > 35 * 60 * 1000) sessions.push({ endedAt: time, minutes: minutesFor(event), events: [event] });
    else {
      last.endedAt = time;
      last.minutes += minutesFor(event);
      last.events.push(event);
    }
  });
  return sessions;
}

function sessionDurations(events: StudyEvent[]): number[] {
  return studySessions(events).map((session) => session.minutes);
}

function scoresWithLegacy(state: StudyBoltState, quizEvents: StudyEvent[]): number[] {
  return state.decks.flatMap((deck) => {
    const recorded = quizEvents.filter((event) => event.deckId === deck.id && typeof event.quizScore === 'number');
    return recorded.length ? recorded.map((event) => event.quizScore as number) : [...deck.quizAttempts, ...(deck.testAttempts ?? [])];
  });
}

export function buildAnalytics(state: StudyBoltState, now = new Date()): AnalyticsSnapshot {
  const events = state.activityEvents
    .filter((event) => Number.isFinite(+new Date(event.occurredAt)))
    .sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));
  const quizEvents = events.filter((event) => event.type === 'quiz');
  const cardEvents = events.filter((event) => event.type === 'flashcard-review' && event.deckId && event.cardId);
  const allAnswers = quizEvents.flatMap((event) => event.quizAnswers ?? []);
  const weekStart = daysAgo(now, 6);
  const monthStart = daysAgo(now, 29);
  const todayKey = dayKey(now);
  const recentEvents = events.filter((event) => +new Date(event.occurredAt) >= +monthStart);
  const activeDayKeys = [...new Set(recentEvents.filter((event) => minutesFor(event) > 0).map((event) => dayKey(event.occurredAt)))];
  const reviewDays = [...new Set(cardEvents.map((event) => dayKey(event.occurredAt)))];
  const totalReviewedConcepts = new Set(cardEvents.map((event) => `${event.deckId}:${event.cardId}`)).size;
  const evidenceLevel: EvidenceLevel = quizEvents.length >= 5 && reviewDays.length >= 5 ? 'strong' : quizEvents.length >= 2 && activeDayKeys.length >= 2 ? 'building' : 'early';
  const historyMessage = evidenceLevel === 'strong'
    ? 'Strong history: estimates use repeated retrieval across several days.'
    : evidenceLevel === 'building'
      ? 'Building history: estimates will stabilize with more spaced reviews.'
      : 'Early estimate: complete quizzes and review concepts on different days to unlock retention insights.';

  const answerByDeckAndSection = new Map<string, QuizAnswerRecord[]>();
  const latestQuizEvidenceAt = new Map<string, string>();
  quizEvents.forEach((event) => (event.quizAnswers ?? []).forEach((answer) => {
    const key = `${answer.sourceDeckId ?? event.deckId}:${answer.sourceSectionId}`;
    answerByDeckAndSection.set(key, [...(answerByDeckAndSection.get(key) ?? []), answer]);
    latestQuizEvidenceAt.set(key, answer.answeredAt ?? event.occurredAt);
  }));

  const conceptDecks = state.decks.filter((deck) => deck.fileType !== 'demo' || deck.id === 'biology-cells');
  const concepts: ConceptInsight[] = conceptDecks.flatMap((deck) => deck.flashcards.map((card) => {
    const matching = cardEvents.filter((event) => event.deckId === deck.id && event.cardId === card.id);
    const quizEvidence = answerByDeckAndSection.get(`${deck.id}:${card.source.sectionId}`) ?? [];
    const selfRating = confidenceValue(card.confidence);
    const quizAccuracy = accuracy(quizEvidence);
    const stored = state.conceptMastery?.find((item) => item.sourceDeckId === deck.id && item.sourceSectionId === card.source.sectionId);
    const derivedMastery = quizAccuracy === null ? selfRating : selfRating * 0.6 + quizAccuracy * 0.4;
    const mastery = clamp(stored ? stored.mastery * 0.7 + derivedMastery * 0.3 : derivedMastery);
    const latest = matching[matching.length - 1];
    const hadKnown = matching.some((event) => event.confidence === 'known' || event.previousConfidence === 'known');
    const declined = hadKnown && card.confidence !== 'known';
    const improved = matching.some((event) => confidenceRank(event.confidence) > confidenceRank(event.previousConfidence));
    const unseen = matching.length === 0 && card.confidence === 'new' && quizEvidence.length === 0;
    const latestQuizAt = latestQuizEvidenceAt.get(`${deck.id}:${card.source.sectionId}`);
    const lastEvidenceAt = [latest?.occurredAt, latestQuizAt]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => +new Date(b) - +new Date(a))[0] ?? null;
    const lastDate = lastEvidenceAt ? dayStart(new Date(lastEvidenceAt)) : null;
    const elapsed = lastDate ? Math.max(0, (+now - +new Date(lastEvidenceAt as string)) / 86400000) : null;
    const interval = card.confidence === 'known' ? 7 : card.confidence === 'learning' ? 1 : 0;
    const advancedSchedule = state.retentionMode !== 'standard'
      ? getRetentionCardSchedule(state, deck.id, card.id, state.retentionMode, now)
      : null;
    const due = advancedSchedule ? advancedSchedule.due : elapsed === null ? card.confidence !== 'known' : elapsed >= interval;
    const evidenceCount = matching.length + quizEvidence.length;
    const stabilityDays = Math.max(0.75, 1 + Math.pow(mastery / 100, 2) * 18 + Math.min(6, evidenceCount) * 1.5);
    const recallProbability = advancedSchedule?.hasEvidence && advancedSchedule.retrievability !== null
      ? clamp(advancedSchedule.retrievability * 100)
      : elapsed === null || unseen ? null : clamp(mastery * Math.pow(0.5, elapsed / stabilityDays));
    let status: ConceptStatus = mastery >= 80 ? 'mastered' : mastery < 45 ? 'weak' : 'learning';
    if (unseen) status = 'unseen';
    else if (declined && card.confidence === 'new') status = 'forgotten';
    else if (declined) status = 'at-risk';
    else if (improved && mastery < 80) status = 'improving';
    return {
      id: `${deck.id}:${card.id}`,
      title: card.front,
      deckId: deck.id,
      deckTitle: deck.title,
      courseName: deck.courseName,
      mastery,
      status,
      reviewCount: matching.length,
      due,
      recallProbability,
      forgettingRisk: recallProbability === null ? null : 100 - recallProbability,
      lastEvidenceAt,
    };
  }));

  const masteredCount = concepts.filter((concept) => concept.mastery >= 80).length;
  const learningCount = concepts.filter((concept) => concept.mastery < 80).length;
  const dueTodayCount = concepts.filter((concept) => concept.due).length;
  const weakConcepts = concepts.filter((concept) => concept.mastery < 65).sort((a, b) => a.mastery - b.mastery).slice(0, 6);
  const strongestConcepts = [...concepts].filter((concept) => concept.mastery >= 70).sort((a, b) => b.mastery - a.mastery).slice(0, 6);
  const unseenConcepts = concepts.filter((concept) => concept.status === 'unseen');
  const atRiskConcepts = evidenceLevel === 'early' ? null : concepts.filter((concept) => concept.status === 'at-risk');
  const improvingConcepts = evidenceLevel === 'early' ? null : concepts.filter((concept) => concept.status === 'improving').sort((a, b) => b.mastery - a.mastery);
  const forgottenConcepts = evidenceLevel === 'early' ? null : concepts.filter((concept) => concept.status === 'forgotten');

  const topicMastery = conceptDecks.flatMap((deck) => deck.outline.map((section) => {
    const sectionConcepts = concepts.filter((concept) => concept.deckId === deck.id && deck.flashcards.find((card) => card.id === concept.id.split(':')[1])?.source.sectionId === section.id);
    const sectionAnswers = answerByDeckAndSection.get(`${deck.id}:${section.id}`) ?? [];
    const answerScore = accuracy(sectionAnswers);
    const values = sectionConcepts.map((concept) => concept.mastery);
    if (answerScore !== null) values.push(answerScore);
    return { id: `${deck.id}:${section.id}`, title: section.title, courseName: deck.courseName, value: values.length ? clamp(average(values)) : 0 };
  })).sort((a, b) => b.value - a.value);

  const packRows = state.decks.map((deck) => {
    const completion = packCompletion(deck, events);
    return {
      id: deck.id,
      title: deck.title,
      courseName: deck.courseName,
      color: deck.color,
      completion,
      remaining: 100 - completion,
      studyMinutes: events.filter((event) => event.deckId === deck.id).reduce((sum, event) => sum + minutesFor(event), 0),
    };
  });
  const packCompletionAverage = clamp(average(packRows.map((pack) => pack.completion)));
  const overallMastery = calculateCourseMastery(state.decks);

  const repeatedCardAttempts: Array<{ success: boolean; gapDays: number }> = [];
  const cardGroups = new Map<string, StudyEvent[]>();
  cardEvents.forEach((event) => {
    const key = `${event.deckId}:${event.cardId}`;
    cardGroups.set(key, [...(cardGroups.get(key) ?? []), event]);
  });
  cardGroups.forEach((group) => group.forEach((event, index) => {
    if (index === 0) return;
    const prior = group[index - 1];
    if (!prior) return;
    const gapDays = (+new Date(event.occurredAt) - +new Date(prior.occurredAt)) / 86400000;
    if (gapDays >= 0.75) repeatedCardAttempts.push({ success: event.confidence === 'known', gapDays });
  }));
  const retentionRate = repeatedCardAttempts.length >= 3
    ? clamp((repeatedCardAttempts.filter((attempt) => attempt.success).length / repeatedCardAttempts.length) * 100)
    : null;
  const longTerm = repeatedCardAttempts.filter((attempt) => attempt.gapDays >= 6.5);
  const longTermSuccess = longTerm.length >= 3 ? clamp((longTerm.filter((attempt) => attempt.success).length / longTerm.length) * 100) : null;
  const retentionConfidence = evidenceLevel === 'strong' && retentionRate !== null
    ? clamp(retentionRate * 0.75 + Math.min(100, repeatedCardAttempts.length * 8) * 0.25)
    : null;

  const scores = scoresWithLegacy(state, quizEvents);
  const eventScores = quizEvents.map((event) => event.quizScore).filter((score): score is number => typeof score === 'number');
  const recentScores = eventScores.length ? eventScores.slice(-5) : scores.slice(-5);
  const firstAnswers = new Map<string, QuizAnswerRecord>();
  const repeatAnswers: QuizAnswerRecord[] = [];
  quizEvents.forEach((event) => (event.quizAnswers ?? []).forEach((answer) => {
    const key = `${answer.sourceDeckId ?? event.deckId}:${answer.originQuestionId ?? answer.questionId}`;
    if (!firstAnswers.has(key)) firstAnswers.set(key, answer);
    else repeatAnswers.push(answer);
  }));
  const missGroups = new Map<string, { misses: number; deckId?: string }>();
  quizEvents.forEach((event) => (event.quizAnswers ?? []).forEach((answer) => {
    if (answer.correct) return;
    const answerDeckId = answer.sourceDeckId ?? event.deckId;
    const key = `${answerDeckId}:${answer.originQuestionId ?? answer.questionId}`;
    const current = missGroups.get(key) ?? { misses: 0, deckId: answerDeckId };
    current.misses += 1;
    missGroups.set(key, current);
  }));
  const repeatedMisses = [...missGroups.entries()].filter(([, value]) => value.misses >= 2).map(([key, value]) => {
    const questionId = key.slice(key.indexOf(':') + 1);
    const deck = state.decks.find((item) => item.id === value.deckId);
    return {
      id: key,
      prompt: deck?.quiz.find((question) => question.id === questionId)?.prompt ?? 'Repeatedly missed question',
      misses: value.misses,
      deckTitle: deck?.title ?? 'Study Pack',
    };
  }).sort((a, b) => b.misses - a.misses);

  const sevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = daysAgo(now, 6 - index);
    const key = dayKey(date);
    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
      minutes: events.filter((event) => dayKey(event.occurredAt) === key).reduce((sum, event) => sum + minutesFor(event), 0),
    };
  });
  const thirtyDays = Array.from({ length: 30 }, (_, index) => {
    const date = daysAgo(now, 29 - index);
    const key = dayKey(date);
    return { key, minutes: events.filter((event) => dayKey(event.occurredAt) === key).reduce((sum, event) => sum + minutesFor(event), 0) };
  });
  const todayMinutes = events.filter((event) => dayKey(event.occurredAt) === todayKey).reduce((sum, event) => sum + minutesFor(event), 0);
  const weekMinutes = events.filter((event) => +new Date(event.occurredAt) >= +weekStart).reduce((sum, event) => sum + minutesFor(event), 0);
  const monthMinutes = recentEvents.reduce((sum, event) => sum + minutesFor(event), 0);
  const legacyTotal = Math.max(state.focusMinutes, state.decks.reduce((sum, deck) => sum + deck.studyMinutes, 0));
  const totalMinutes = Math.max(legacyTotal, events.reduce((sum, event) => sum + minutesFor(event), 0));
  const sessions = sessionDurations(events);
  const daysThisWeek = sevenDays.filter((day) => day.minutes > 0).length;
  let streakDays = 0;
  for (let index = 0; index < 365; index += 1) {
    if (events.some((event) => dayKey(event.occurredAt) === dayKey(daysAgo(now, index)) && minutesFor(event) > 0)) streakDays += 1;
    else if (index === 0) continue;
    else break;
  }
  if (!events.length) streakDays = state.streakDays;

  const weekdayTotals = new Map<string, number>();
  const timeTotals = new Map<string, number>();
  recentEvents.forEach((event) => {
    const date = new Date(event.occurredAt);
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const period = date.getHours() < 12 ? 'Morning' : date.getHours() < 17 ? 'Afternoon' : 'Evening';
    weekdayTotals.set(weekday, (weekdayTotals.get(weekday) ?? 0) + minutesFor(event));
    timeTotals.set(period, (timeTotals.get(period) ?? 0) + minutesFor(event));
  });
  const productiveDay = [...weekdayTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const productiveTime = activeDayKeys.length >= 5 ? [...timeTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;

  const classRows = state.classes.map((studyClass) => {
    const decks = state.decks.filter((deck) => deck.courseId === studyClass.id);
    return {
      id: studyClass.id,
      name: studyClass.name,
      emoji: studyClass.emoji,
      color: studyClass.color,
      mastery: calculateCourseMastery(decks),
      studyMinutes: events.filter((event) => event.courseId === studyClass.id).reduce((sum, event) => sum + minutesFor(event), 0),
    };
  });

  const reviewedUnits = state.decks.reduce((sum, deck) => sum + deck.reviewedNoteIds.length + deck.flashcards.filter((card) => card.confidence !== 'new').length, 0);
  const totalUnits = state.decks.reduce((sum, deck) => sum + deck.notes.length + deck.flashcards.length, 0);
  const coverage = totalUnits ? clamp((reviewedUnits / totalUnits) * 100) : 0;
  const firstTry = accuracy([...firstAnswers.values()]);
  const recentQuizAverage = recentScores.length ? clamp(average(recentScores)) : null;
  const gapHealth = clamp(100 - (learningCount / Math.max(1, concepts.length)) * 100);
  const spacedRetention = retentionRate ?? 0;
  const readinessComponents = [
    { label: 'Material coverage', value: coverage, weight: 20 },
    { label: 'Concept mastery', value: overallMastery, weight: 25 },
    { label: 'Recent quizzes', value: recentQuizAverage ?? 0, weight: 20 },
    { label: 'First-try recall', value: firstTry ?? 0, weight: 15 },
    { label: 'Spaced retention', value: spacedRetention, weight: 15 },
    { label: 'Weak/unseen gaps', value: gapHealth, weight: 5 },
  ];
  const readinessAvailable = quizEvents.length >= 2 && activeDayKeys.length >= 2 && totalReviewedConcepts >= 2;
  const readiness = readinessAvailable
    ? clamp(readinessComponents.reduce((sum, component) => sum + component.value * (component.weight / 100), 0))
    : null;

  const recallConcepts = concepts.filter((concept) => concept.recallProbability !== null);
  const recallProbability = recallConcepts.length >= 2
    ? clamp(average(recallConcepts.map((concept) => concept.recallProbability as number)))
    : null;
  const forgettingRisk = [...recallConcepts]
    .filter((concept) => concept.due || (concept.recallProbability ?? 100) < 70)
    .sort((a, b) => (b.forgettingRisk ?? 0) - (a.forgettingRisk ?? 0))
    .slice(0, 6);

  const cardSectionById = new Map<string, string>();
  state.decks.forEach((deck) => deck.flashcards.forEach((card) => cardSectionById.set(`${deck.id}:${card.id}`, card.source.sectionId)));
  const recallSectionKeys = new Set(cardEvents.map((event) => {
    const sectionId = cardSectionById.get(`${event.deckId}:${event.cardId}`);
    return sectionId ? `${event.deckId}:${sectionId}` : '';
  }).filter(Boolean));
  const recognitionAnswers = quizEvents.flatMap((event) => (event.quizAnswers ?? []).filter((answer) => recallSectionKeys.has(`${event.deckId}:${answer.sourceSectionId}`)));
  const recognitionSectionKeys = new Set(quizEvents.flatMap((event) => (event.quizAnswers ?? []).map((answer) => `${event.deckId}:${answer.sourceSectionId}`)));
  const recallComparisons = cardEvents.filter((event) => {
    const sectionId = cardSectionById.get(`${event.deckId}:${event.cardId}`);
    return Boolean(sectionId && recognitionSectionKeys.has(`${event.deckId}:${sectionId}`));
  });
  const recognitionAccuracy = accuracy(recognitionAnswers);
  const recallAccuracy = recallComparisons.length
    ? clamp((recallComparisons.filter((event) => event.confidence === 'known').length / recallComparisons.length) * 100)
    : null;
  const recognitionRecallGap = recognitionAnswers.length >= 3 && recallComparisons.length >= 3 && recognitionAccuracy !== null && recallAccuracy !== null
    ? recognitionAccuracy - recallAccuracy
    : null;

  const confidenceAnswers = allAnswers.filter((answer) => answer.confidence);
  const confidenceProbability = { unsure: 0.35, 'somewhat-sure': 0.65, 'very-sure': 0.9 } as const;
  const calibrationScore = confidenceAnswers.length >= 5
    ? clamp(100 - average(confidenceAnswers.map((answer) => Math.abs(confidenceProbability[answer.confidence!] - (answer.correct ? 1 : 0)))) * 100)
    : null;

  type GainRecord = { at: string; gain: number; minutes: number; method: string; courseName: string; unitId: string };
  const gainRecords: GainRecord[] = [];
  const priorQuizScoreByDeck = new Map<string, number>();
  events.forEach((event) => {
    const deck = state.decks.find((item) => item.id === event.deckId);
    if (event.type === 'flashcard-review' && event.confidence && event.previousConfidence) {
      gainRecords.push({
        at: event.occurredAt,
        gain: (confidenceRank(event.confidence) - confidenceRank(event.previousConfidence)) * 50,
        minutes: Math.max(0.1, minutesFor(event)),
        method: 'Flashcards',
        courseName: deck?.courseName ?? 'Unassigned',
        unitId: `${event.deckId}:${event.cardId}`,
      });
    }
    if (event.type === 'quiz' && event.deckId && typeof event.quizScore === 'number') {
      const prior = priorQuizScoreByDeck.get(event.deckId);
      if (prior !== undefined) {
        gainRecords.push({
          at: event.occurredAt,
          gain: event.quizScore - prior,
          minutes: Math.max(0.1, minutesFor(event)),
          method: event.assessmentKind === 'comprehensive' ? 'Full tests' : 'Quizzes',
          courseName: deck?.courseName ?? 'Unassigned',
          unitId: `${event.deckId}:${event.assessmentKind ?? 'practice'}`,
        });
      }
      priorQuizScoreByDeck.set(event.deckId, event.quizScore);
    }
  });
  const velocityRecords = gainRecords.filter((record) => +new Date(record.at) >= +daysAgo(now, 27));
  const velocitySpanWeeks = velocityRecords.length
    ? Math.max(1, Math.min(4, (+now - Math.min(...velocityRecords.map((record) => +new Date(record.at)))) / (7 * 86400000)))
    : 1;
  const velocityUnits = new Set(velocityRecords.map((record) => record.unitId)).size;
  const learningVelocity = velocityRecords.length >= 3 && velocityUnits >= 2
    ? Math.round((velocityRecords.reduce((sum, record) => sum + record.gain, 0) / velocityUnits / velocitySpanWeeks) * 10) / 10
    : null;

  const gainRateBy = (key: 'method' | 'courseName') => {
    const groups = new Map<string, GainRecord[]>();
    gainRecords.forEach((record) => groups.set(record[key], [...(groups.get(record[key]) ?? []), record]));
    return [...groups.entries()].map(([label, records]) => {
      const units = new Set(records.map((record) => record.unitId)).size;
      const hours = records.reduce((sum, record) => sum + record.minutes, 0) / 60;
      return {
        label,
        samples: records.length,
        units,
        value: Math.round((records.reduce((sum, record) => sum + record.gain, 0) / Math.max(1, units) / Math.max(0.1, hours)) * 10) / 10,
      };
    }).filter((row) => row.samples >= 2 && row.units >= 2).sort((a, b) => b.value - a.value);
  };
  const methodGain = gainRateBy('method')[0];
  const courseGain = gainRateBy('courseName')[0];

  const confusionMap = new Map<string, { selected: string; correct: string; count: number }>();
  allAnswers.filter((answer) => !answer.correct && answer.selectedAnswer && answer.correctAnswer).forEach((answer) => {
    const key = `${answer.selectedAnswer}\u0000${answer.correctAnswer}`;
    const current = confusionMap.get(key) ?? { selected: answer.selectedAnswer as string, correct: answer.correctAnswer as string, count: 0 };
    current.count += 1;
    confusionMap.set(key, current);
  });
  const confusionPairs = [...confusionMap.entries()]
    .filter(([, pair]) => pair.count >= 2)
    .map(([id, pair]) => ({ id, ...pair }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const flashcardAccuracy = cardEvents.length ? clamp((cardEvents.filter((event) => event.confidence === 'known').length / cardEvents.length) * 100) : null;
  const questionTypePerformance: BreakdownValue[] = [
    { label: 'flashcard recall', value: flashcardAccuracy, count: cardEvents.length },
    ...groupAccuracy(allAnswers, ['multiple-choice', 'true-false', 'short-answer', 'fill-blank', 'application'] as const, (answer) => answer.questionType as QuizQuestionType),
  ];

  const timedObservations: Array<{ ms: number; correct: boolean; at: string }> = [];
  quizEvents.forEach((event) => (event.quizAnswers ?? []).forEach((answer) => {
    if (typeof answer.responseTimeMs === 'number' && answer.responseTimeMs >= 0) {
      timedObservations.push({ ms: answer.responseTimeMs, correct: answer.correct, at: answer.answeredAt ?? event.occurredAt });
    }
  }));
  cardEvents.forEach((event) => {
    if (typeof event.responseTimeMs === 'number' && event.responseTimeMs >= 0) {
      timedObservations.push({ ms: event.responseTimeMs, correct: event.confidence === 'known', at: event.occurredAt });
    }
  });
  const responseTimes = timedObservations.map((item) => item.ms);
  const averageResponseSeconds = responseTimes.length >= 3 ? Math.round((average(responseTimes) / 1000) * 10) / 10 : null;
  const medianResponseSeconds = responseTimes.length >= 3 ? Math.round((median(responseTimes) / 1000) * 10) / 10 : null;
  const totalTimedMinutes = responseTimes.reduce((sum, value) => sum + value, 0) / 60000;
  const fluency = timedObservations.length >= 5 && totalTimedMinutes > 0
    ? Math.round((timedObservations.filter((item) => item.correct).length / totalTimedMinutes) * 10) / 10
    : null;

  const timeWindows = new Map<number, Array<{ correct: boolean }>>();
  timedObservations.forEach((item) => {
    const hour = new Date(item.at).getHours();
    const start = Math.floor(hour / 2) * 2;
    timeWindows.set(start, [...(timeWindows.get(start) ?? []), item]);
  });
  const bestTime = [...timeWindows.entries()].map(([start, observations]) => ({
    label: `${hourLabel(start)}–${hourLabel(start + 2)}`,
    accuracy: clamp((observations.filter((item) => item.correct).length / observations.length) * 100),
    samples: observations.length,
  })).filter((window) => window.samples >= 5).sort((a, b) => b.accuracy - a.accuracy || b.samples - a.samples)[0] ?? null;

  const longQuizRuns = quizEvents.filter((event) => (event.quizAnswers?.length ?? 0) >= 8);
  const earlySessionAnswers = longQuizRuns.flatMap((event) => {
    const answers = event.quizAnswers ?? [];
    return answers.slice(0, Math.max(1, Math.ceil(answers.length / 3)));
  });
  const lateSessionAnswers = longQuizRuns.flatMap((event) => {
    const answers = event.quizAnswers ?? [];
    return answers.slice(-Math.max(1, Math.ceil(answers.length / 3)));
  });
  const earlySessionAccuracy = accuracy(earlySessionAnswers);
  const lateSessionAccuracy = accuracy(lateSessionAnswers);
  const sessionFatigue = longQuizRuns.length >= 2 && earlySessionAccuracy !== null && lateSessionAccuracy !== null
    ? { drop: earlySessionAccuracy - lateSessionAccuracy, earlyAccuracy: earlySessionAccuracy, lateAccuracy: lateSessionAccuracy, samples: earlySessionAnswers.length + lateSessionAnswers.length }
    : null;

  const sessionBands = [
    { label: 'Under 15 min', min: 0, max: 15 },
    { label: '15–25 min', min: 15, max: 25 },
    { label: '26–35 min', min: 25, max: 35 },
    { label: '36–50 min', min: 35, max: 50 },
    { label: 'Over 50 min', min: 50, max: Infinity },
  ];
  const scoredSessions = studySessions(events).map((session) => {
    const answers = session.events.flatMap((event) => event.quizAnswers ?? []);
    const reviews = session.events.filter((event) => event.type === 'flashcard-review' && event.confidence);
    const observations = [...answers.map((answer) => answer.correct), ...reviews.map((event) => event.confidence === 'known')];
    return { minutes: session.minutes, accuracy: observations.length >= 3 ? clamp((observations.filter(Boolean).length / observations.length) * 100) : null };
  }).filter((session): session is { minutes: number; accuracy: number } => session.accuracy !== null);
  const idealSessionLength = sessionBands.map((band) => {
    const matching = scoredSessions.filter((session) => session.minutes >= band.min && session.minutes < band.max);
    return { label: band.label, accuracy: matching.length ? clamp(average(matching.map((session) => session.accuracy))) : 0, sessions: matching.length };
  }).filter((band) => band.sessions >= 2).sort((a, b) => b.accuracy - a.accuracy || b.sessions - a.sessions)[0] ?? null;

  const activeWeeks = new Set(activeDayKeys.map((key) => {
    const date = dayStart(new Date(`${key}T12:00:00`));
    const first = daysAgo(now, 27);
    return Math.min(3, Math.floor((+date - +first) / (7 * 86400000)));
  })).size;
  const consistencyScore = clamp(Math.min(1, activeDayKeys.length / 16) * 70 + Math.min(1, activeWeeks / 4) * 30);

  const reviewIntervalsHours: number[] = [];
  cardGroups.forEach((group) => group.forEach((event, index) => {
    const previous = group[index - 1];
    if (previous) reviewIntervalsHours.push(Math.max(0, (+new Date(event.occurredAt) - +new Date(previous.occurredAt)) / 3600000));
  }));
  const spacedIntervals = reviewIntervalsHours.filter((hours) => hours >= 20 && hours <= 14 * 24).length;
  const spacingQuality = reviewIntervalsHours.length >= 3 ? clamp((spacedIntervals / reviewIntervalsHours.length) * 100) : null;

  const plannedMinutes = state.plan.days.flatMap((day) => day.blocks).reduce((sum, block) => sum + block.minutes, 0);
  const completedMinutes = state.plan.days.flatMap((day) => day.blocks).filter((block) => block.complete).reduce((sum, block) => sum + block.minutes, 0);
  const planAdherence = plannedMinutes ? clamp((completedMinutes / plannedMinutes) * 100) : null;

  let crammingIndex: AdvancedAnalytics['crammingIndex'] = null;
  if (state.plan.createdAt && state.plan.targetDate) {
    const start = +new Date(state.plan.createdAt);
    const target = +new Date(state.plan.targetDate);
    const finalWindowStart = target - 86400000;
    if (+now >= finalWindowStart) {
      const scopedEvents = events.filter((event) => {
        const inScope = state.plan.scope.type === 'deck' ? event.deckId === state.plan.scope.id : event.courseId === state.plan.scope.id;
        const occurred = +new Date(event.occurredAt);
        return inScope && occurred >= start && occurred <= target && minutesFor(event) > 0;
      });
      const planStudyMinutes = scopedEvents.reduce((sum, event) => sum + minutesFor(event), 0);
      const finalWindowMinutes = scopedEvents.filter((event) => +new Date(event.occurredAt) >= finalWindowStart).reduce((sum, event) => sum + minutesFor(event), 0);
      if (planStudyMinutes > 0) crammingIndex = { value: clamp((finalWindowMinutes / planStudyMinutes) * 100), finalWindowMinutes, totalMinutes: planStudyMinutes };
    }
  }

  const tomorrowEnd = dayStart(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);
  const sevenDayEnd = dayStart(now);
  sevenDayEnd.setDate(sevenDayEnd.getDate() + 8);
  const dueDates = state.decks.flatMap((deck) => deck.flashcards.map((card) => {
    if (state.retentionMode !== 'standard') return new Date(getRetentionCardSchedule(state, deck.id, card.id, state.retentionMode, now).dueAt);
    const matching = cardGroups.get(`${deck.id}:${card.id}`) ?? [];
    const latest = matching[matching.length - 1];
    if (!latest) return dayStart(now);
    const due = new Date(latest.occurredAt);
    due.setDate(due.getDate() + (card.confidence === 'known' ? 7 : card.confidence === 'learning' ? 1 : 0));
    return due;
  }));
  const reviewLoad = {
    tomorrow: dueDates.filter((date) => +date < +tomorrowEnd).length,
    nextSevenDays: dueDates.filter((date) => +date < +sevenDayEnd).length,
  };

  const masteryDistribution = makeDistribution(
    ['New', 'Learning', 'Familiar', 'Strong', 'Mastered'],
    concepts.map((concept) => concept.mastery < 20 ? 'New' : concept.mastery < 45 ? 'Learning' : concept.mastery < 65 ? 'Familiar' : concept.mastery < 80 ? 'Strong' : 'Mastered'),
  );
  const difficultyDistribution = makeDistribution(
    ['Easy', 'Moderate', 'Hard'],
    concepts.map((concept) => concept.mastery >= 80 ? 'Easy' : concept.mastery >= 55 ? 'Moderate' : 'Hard'),
  );

  const targetDate = state.plan.targetDate ? new Date(state.plan.targetDate) : null;
  const daysRemaining = targetDate ? Math.max(0, Math.ceil((+targetDate - +now) / 86400000)) : 0;
  const readinessForecast = readiness !== null && targetDate && +targetDate > +now && learningVelocity !== null
    ? { value: clamp(readiness + learningVelocity * (daysRemaining / 7)), targetDate: targetDate.toISOString(), daysRemaining }
    : null;

  const efficiencyFor = (records: GainRecord[]) => {
    const units = new Set(records.map((record) => record.unitId)).size;
    const hours = records.reduce((sum, record) => sum + record.minutes, 0) / 60;
    return records.length >= 2 && units >= 2
      ? records.reduce((sum, record) => sum + record.gain, 0) / units / Math.max(0.1, hours)
      : null;
  };
  const recentEfficiency = efficiencyFor(gainRecords.filter((record) => +new Date(record.at) >= +daysAgo(now, 6)));
  const previousEfficiency = efficiencyFor(gainRecords.filter((record) => +new Date(record.at) >= +daysAgo(now, 13) && +new Date(record.at) < +daysAgo(now, 6)));
  const efficiencyTrend = recentEfficiency !== null && previousEfficiency !== null && previousEfficiency > 0
    ? { changePercent: Math.round(((recentEfficiency - previousEfficiency) / previousEfficiency) * 100), recent: Math.round(recentEfficiency * 10) / 10, previous: Math.round(previousEfficiency * 10) / 10 }
    : null;

  const latestAudioByDeck = new Map<string, number>();
  events.filter((event) => event.type === 'audio' && event.deckId).forEach((event) => {
    latestAudioByDeck.set(event.deckId as string, event.completionPercent ?? 0);
  });
  const milestones: string[] = [];
  if (scores.length >= 1) milestones.push('First quiz completed');
  if (scores.some((score) => score === 100)) milestones.push('Perfect quiz');
  if (masteredCount >= 5) milestones.push('5 concepts mastered');
  if (streakDays >= 5) milestones.push('5-day study streak');

  return {
    evidenceLevel,
    historyMessage,
    readiness: { score: readiness, components: readinessComponents },
    overallMastery,
    recentQuizAverage,
    studyTimeThisWeek: weekMinutes,
    streakDays,
    masteredCount,
    learningCount,
    dueTodayCount,
    weakConcepts,
    strongestConcepts,
    unseenConcepts,
    atRiskConcepts,
    improvingConcepts,
    forgottenConcepts,
    topicMastery,
    classes: classRows,
    packs: packRows,
    packCompletion: packCompletionAverage,
    materialRemaining: 100 - packCompletionAverage,
    advanced: {
      recallProbability: { value: recallProbability, concepts: recallConcepts.length },
      forgettingRisk,
      recognitionRecallGap: { value: recognitionRecallGap, recognition: recognitionAccuracy, recall: recallAccuracy, samples: recognitionAnswers.length + recallComparisons.length },
      confidenceCalibration: {
        score: calibrationScore,
        samples: confidenceAnswers.length,
        confidentlyRight: confidenceAnswers.filter((answer) => answer.confidence === 'very-sure' && answer.correct).length,
        confidentlyWrong: confidenceAnswers.filter((answer) => answer.confidence === 'very-sure' && !answer.correct).length,
        unsureRight: confidenceAnswers.filter((answer) => answer.confidence === 'unsure' && answer.correct).length,
        unsureWrong: confidenceAnswers.filter((answer) => answer.confidence === 'unsure' && !answer.correct).length,
      },
      learningVelocity: { pointsPerWeek: learningVelocity, samples: velocityRecords.length },
      masteryGainPerHour: {
        topMethod: methodGain?.label ?? null,
        topMethodValue: methodGain?.value ?? null,
        topCourse: courseGain?.label ?? null,
        topCourseValue: courseGain?.value ?? null,
      },
      confusionPairs,
      questionTypePerformance,
      responseTime: { averageSeconds: averageResponseSeconds, medianSeconds: medianResponseSeconds, samples: responseTimes.length },
      fluency: { correctPerMinute: fluency, samples: timedObservations.length },
      bestStudyTime: bestTime,
      sessionFatigue,
      idealSessionLength,
      consistency: { score: consistencyScore, activeDays: activeDayKeys.length, activeWeeks },
      spacingQuality: { score: spacingQuality, spaced: spacedIntervals, total: reviewIntervalsHours.length },
      crammingIndex,
      planAdherence: { value: planAdherence, completedMinutes, plannedMinutes },
      reviewLoad,
      masteryDistribution,
      difficultyDistribution,
      readinessForecast,
      efficiencyTrend,
    },
    retention: {
      rate: retentionRate,
      confidence: retentionConfidence,
      longTermSuccess,
      spacedAttempts: repeatedCardAttempts.length,
    },
    quizzes: {
      overallAccuracy: accuracy(allAnswers),
      averageScore: scores.length ? clamp(average(scores)) : null,
      bestScore: scores.length ? Math.max(...scores) : null,
      recentResults: [...quizEvents].reverse().slice(0, 5).map((event) => ({
        id: event.id,
        deckTitle: state.decks.find((deck) => deck.id === event.deckId)?.title ?? 'Study Pack',
        score: event.quizScore ?? 0,
        date: event.occurredAt,
      })),
      answered: allAnswers.length,
      correct: allAnswers.filter((answer) => answer.correct).length,
      incorrect: allAnswers.filter((answer) => !answer.correct).length,
      firstTryAccuracy: accuracy([...firstAnswers.values()]),
      repeatAccuracy: accuracy(repeatAnswers),
      repeatedMisses,
      byDifficulty: groupAccuracy(allAnswers, ['easy', 'medium', 'hard'] as const, (answer) => answer.difficulty as QuizDifficulty),
      byType: groupAccuracy(allAnswers, ['multiple-choice', 'true-false', 'short-answer', 'fill-blank', 'application'] as const, (answer) => answer.questionType as QuizQuestionType),
      perfectQuizzes: scores.filter((score) => score === 100).length,
      completed: scores.length,
      trend: (eventScores.length ? eventScores : scores).slice(-7),
    },
    activity: {
      today: todayMinutes,
      week: weekMinutes,
      month: monthMinutes,
      total: totalMinutes,
      averageDaily: activeDayKeys.length ? Math.round(monthMinutes / activeDayKeys.length) : 0,
      averageSession: sessions.length ? Math.round(average(sessions)) : 0,
      longestSession: sessions.length >= 3 ? Math.max(...sessions) : null,
      sessions: sessions.length,
      daysThisWeek,
      activeDays: activeDayKeys.length,
      sevenDays,
      thirtyDays,
      productiveDay,
      productiveTime,
    },
    methods: {
      notesMinutes: events.filter((event) => event.type === 'note-review').reduce((sum, event) => sum + minutesFor(event), 0),
      notesSectionsReviewed: events.filter((event) => event.type === 'note-review').length,
      flashcardsReviewed: cardEvents.length,
      flashcardsMastered: masteredCount,
      flashcardsLearning: learningCount,
      quizzesCompleted: scores.length,
      questionsAnswered: allAnswers.length,
      listeningMinutes: events.filter((event) => event.type === 'audio').reduce((sum, event) => sum + minutesFor(event), 0),
      listeningCompletion: latestAudioByDeck.size ? clamp(average([...latestAudioByDeck.values()])) : null,
      quickReviewsCompleted: events.filter((event) => event.type === 'audio' && event.audioMode === 'summary' && (event.completionPercent ?? 0) >= 90).length,
      fullNotesReviewsCompleted: state.decks.filter((deck) => deck.notes.length > 0 && deck.reviewedNoteIds.length >= deck.notes.length).length,
      packsCompleted: packRows.filter((pack) => pack.completion >= 90).length,
      packsIncomplete: packRows.filter((pack) => pack.completion < 90).length,
    },
    more: {
      classesCreated: state.classes.length,
      lecturesUploaded: state.decks.filter((deck) => deck.fileType !== 'demo').length,
      packsCreated: state.decks.length,
      totalPages: state.decks.reduce((sum, deck) => sum + deck.pageCount, 0),
      slidesReviewed: Math.round(state.decks.reduce((sum, deck) => sum + deck.pageCount * (packCompletion(deck, events) / 100), 0)),
      milestones,
    },
  };
}
