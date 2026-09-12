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
}

export interface BreakdownValue {
  label: string;
  value: number | null;
  count: number;
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
  return answers.length ? clamp((answers.filter((answer) => answer.correct).length / answers.length) * 100) : null;
}

function groupAccuracy<T extends string>(answers: QuizAnswerRecord[], values: readonly T[], select: (answer: QuizAnswerRecord) => T): BreakdownValue[] {
  return values.map((value) => {
    const matching = answers.filter((answer) => select(answer) === value);
    return { label: value, value: accuracy(matching), count: matching.length };
  });
}

function sessionDurations(events: StudyEvent[]): number[] {
  const timed = events.filter((event) => minutesFor(event) > 0).sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));
  const sessions: Array<{ endedAt: number; minutes: number }> = [];
  timed.forEach((event) => {
    const time = +new Date(event.occurredAt);
    const last = sessions[sessions.length - 1];
    if (!last || time - last.endedAt > 35 * 60 * 1000) sessions.push({ endedAt: time, minutes: minutesFor(event) });
    else {
      last.endedAt = time;
      last.minutes += minutesFor(event);
    }
  });
  return sessions.map((session) => session.minutes);
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
  quizEvents.forEach((event) => (event.quizAnswers ?? []).forEach((answer) => {
    const key = `${event.deckId}:${answer.sourceSectionId}`;
    answerByDeckAndSection.set(key, [...(answerByDeckAndSection.get(key) ?? []), answer]);
  }));

  const conceptDecks = state.decks.filter((deck) => deck.fileType !== 'demo' || deck.id === 'biology-cells');
  const concepts: ConceptInsight[] = conceptDecks.flatMap((deck) => deck.flashcards.map((card) => {
    const matching = cardEvents.filter((event) => event.deckId === deck.id && event.cardId === card.id);
    const quizEvidence = answerByDeckAndSection.get(`${deck.id}:${card.source.sectionId}`) ?? [];
    const selfRating = confidenceValue(card.confidence);
    const quizAccuracy = accuracy(quizEvidence);
    const mastery = clamp(quizAccuracy === null ? selfRating : selfRating * 0.6 + quizAccuracy * 0.4);
    const latest = matching[matching.length - 1];
    const hadKnown = matching.some((event) => event.confidence === 'known' || event.previousConfidence === 'known');
    const declined = hadKnown && card.confidence !== 'known';
    const improved = matching.some((event) => confidenceRank(event.confidence) > confidenceRank(event.previousConfidence));
    const unseen = matching.length === 0 && card.confidence === 'new' && quizEvidence.length === 0;
    const lastDate = latest ? dayStart(new Date(latest.occurredAt)) : null;
    const elapsed = lastDate ? Math.floor((+dayStart(now) - +lastDate) / 86400000) : null;
    const interval = card.confidence === 'known' ? 7 : card.confidence === 'learning' ? 1 : 0;
    const due = elapsed === null ? card.confidence !== 'known' : elapsed >= interval;
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
    const key = `${event.deckId}:${answer.questionId}`;
    if (!firstAnswers.has(key)) firstAnswers.set(key, answer);
    else repeatAnswers.push(answer);
  }));
  const missGroups = new Map<string, { misses: number; deckId?: string }>();
  quizEvents.forEach((event) => (event.quizAnswers ?? []).forEach((answer) => {
    if (answer.correct) return;
    const key = `${event.deckId}:${answer.questionId}`;
    const current = missGroups.get(key) ?? { misses: 0, deckId: event.deckId };
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
      byType: groupAccuracy(allAnswers, ['multiple-choice', 'true-false'] as const, (answer) => answer.questionType as QuizQuestionType),
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
