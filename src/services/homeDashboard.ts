import type { QuizAnswerRecord, StudyBoltState, StudyEvent, StudyPack } from '../models';

export const WEAK_TOPIC_RULE = 'Below 60% correct across at least 3 different questions in at least 2 completed sessions, using the last 5 sessions for each topic.';
export const MISTAKE_RULE = 'Distinct source questions missed at least twice whose latest recorded answer is still incorrect.';

export interface HomeDueReview { deck: StudyPack; cardIds: string[]; dueAt: string }
export interface HomeWeakTopic { deck: StudyPack; sectionId: string; title: string; correct: number; total: number; sessions: number; cardIds: string[] }
export interface HomeActivity { id: string; at: string; title: string; detail: string; course: string; recovered: number; kind: 'quiz' | 'review' | 'audio' | 'focus' }
export interface HomeExam { title: string; course: string; date: string; daysRemaining: number; completed: number; total: number; progress: number | null; deckIds: string[]; attentionTopics: string[] }
export interface HomeRecommendation {
  kind: 'resume' | 'mistakes' | 'due' | 'weak' | 'exam' | 'practice' | 'materials';
  title: string; why: string; actionLabel: string; minutes: number | null;
  deckId?: string; sectionId?: string; cardIds?: string[];
}
export interface HomeDashboard {
  decks: StudyPack[]; due: HomeDueReview[]; dueCount: number; weak: HomeWeakTopic[];
  mistakeIds: string[]; activity: HomeActivity[]; exam: HomeExam | null;
  recommendation: HomeRecommendation; accuracy: { correct: number; total: number; sessions: number };
}
type ScheduleReader = (deckId: string, cardId: string) => { hasEvidence: boolean; dueAt: string };
type RecordedAnswer = { deck: StudyPack; answer: QuizAnswerRecord; questionId: string; key: string };

/** Calendar dates are compared in the student's local calendar, including across DST. */
export function examCalendarDays(date: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const parsed = new Date(year, month - 1, day, 12);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}

function answersFor(event: StudyEvent, decks: Map<string, StudyPack>, now: Date): RecordedAnswer[] {
  const unique = new Map<string, RecordedAnswer>();
  for (const answer of Array.isArray(event.quizAnswers) ? event.quizAnswers : []) {
    const deck = decks.get(answer.sourceDeckId ?? event.deckId ?? '');
    const questionId = answer.originQuestionId ?? answer.questionId;
    const at = Date.parse(answer.answeredAt ?? event.occurredAt);
    if (!deck || !questionId || typeof answer.correct !== 'boolean' || answer.skipped || !Number.isFinite(at) || at > +now) continue;
    const key = JSON.stringify([deck.id, questionId]);
    unique.set(key, { deck, answer, questionId, key });
  }
  return [...unique.values()];
}

/** Pure, local selectors. Demo fixtures and uncompleted/invalid/future events never become academic statistics. */
export function buildHomeDashboard(state: StudyBoltState, options: { now?: Date; scheduleCard?: ScheduleReader; resumeDeckId?: string } = {}): HomeDashboard {
  const now = options.now ?? new Date();
  const decks = state.decks.filter((deck) => deck.fileType !== 'demo');
  const byDeck = new Map(decks.map((deck) => [deck.id, deck]));
  const events = [...new Map(state.activityEvents.filter((event) => event.id && !event.id.startsWith('seed-')
    && Number.isFinite(Date.parse(event.occurredAt)) && Date.parse(event.occurredAt) <= +now).map((event) => [event.id, event])).values()]
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
  const quizzes = events.filter((event) => event.type === 'quiz').map((event) => ({ event, answers: answersFor(event, byDeck, now) })).filter((quiz) => quiz.answers.length);

  const reviews = new Map<string, StudyEvent>();
  for (const event of events) if (event.type === 'flashcard-review' && event.deckId && event.cardId && event.confidence) reviews.set(JSON.stringify([event.deckId, event.cardId]), event);
  const due: HomeDueReview[] = [];
  const answeredSections = new Set(quizzes.flatMap((quiz) => quiz.answers.map((record) => JSON.stringify([record.deck.id, record.answer.sourceSectionId]))));
  for (const deck of decks) {
    const cards: Array<{ id: string; at: string }> = [];
    for (const card of deck.flashcards) {
      let dueAt: string | undefined;
      if (state.retentionMode === 'standard') {
        const last = reviews.get(JSON.stringify([deck.id, card.id]));
        if (last) {
          const date = new Date(last.occurredAt);
          // Same standard 0/1/7-day interval used by the existing analytics review-load calculation.
          date.setDate(date.getDate() + (card.confidence === 'known' ? 7 : card.confidence === 'learning' ? 1 : 0));
          dueAt = date.toISOString();
        }
      } else {
        if (!reviews.has(JSON.stringify([deck.id, card.id])) && !answeredSections.has(JSON.stringify([deck.id, card.source.sectionId]))) continue;
        const schedule = options.scheduleCard?.(deck.id, card.id);
        if (schedule?.hasEvidence) dueAt = schedule.dueAt;
      }
      if (dueAt && Number.isFinite(Date.parse(dueAt)) && Date.parse(dueAt) <= +now) cards.push({ id: card.id, at: dueAt });
    }
    cards.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
    if (cards.length) due.push({ deck, cardIds: cards.map((card) => card.id), dueAt: cards[0]!.at });
  }
  due.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.deck.id.localeCompare(b.deck.id));

  const questionHistory = new Map<string, { deck: StudyPack; questionId: string; misses: number; correct: boolean }>();
  const topicHistory = new Map<string, { deck: StudyPack; sectionId: string; title: string; sessions: Array<{ id: string; answers: RecordedAnswer[] }> }>();
  const recovery = new Map<string, number>();
  for (const quiz of quizzes) {
    let recovered = 0;
    const sessionTopics = new Map<string, RecordedAnswer[]>();
    for (const record of quiz.answers) {
      const previous = questionHistory.get(record.key);
      if (previous?.correct === false && record.answer.correct) recovered += 1;
      questionHistory.set(record.key, { deck: record.deck, questionId: record.questionId, misses: (previous?.misses ?? 0) + Number(!record.answer.correct), correct: record.answer.correct });
      const section = record.deck.outline.find((item) => item.id === record.answer.sourceSectionId);
      if (!section) continue;
      const key = JSON.stringify([record.deck.id, section.id]);
      sessionTopics.set(key, [...(sessionTopics.get(key) ?? []), record]);
      if (!topicHistory.has(key)) topicHistory.set(key, { deck: record.deck, sectionId: section.id, title: section.title, sessions: [] });
    }
    for (const [key, answers] of sessionTopics) topicHistory.get(key)!.sessions.push({ id: quiz.event.id, answers });
    recovery.set(quiz.event.id, recovered);
  }
  const weak = [...topicHistory.values()].flatMap((topic): HomeWeakTopic[] => {
    const sessions = topic.sessions.slice(-5);
    const answers = sessions.flatMap((session) => session.answers);
    const distinct = new Set(answers.map((record) => record.questionId));
    const correct = answers.filter((record) => record.answer.correct).length;
    return sessions.length >= 2 && distinct.size >= 3 && correct / answers.length < 0.6
      ? [{ ...topic, sessions: sessions.length, correct, total: answers.length, cardIds: topic.deck.flashcards.filter((card) => card.source.sectionId === topic.sectionId).map((card) => card.id) }]
      : [];
  }).sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total || a.sectionId.localeCompare(b.sectionId));
  const mistakeIds = [...questionHistory.values()].filter((record) => {
    if (record.correct || record.misses < 2) return false;
    const smartPrefix = `smart-${record.deck.id}-`;
    return record.deck.quiz.some((question) => question.id === record.questionId)
      || record.questionId.startsWith(smartPrefix) && record.deck.flashcards.some((card) => card.id === record.questionId.slice(smartPrefix.length));
  }).map((record) => `${record.deck.id}:${record.questionId}`);

  let exam: HomeExam | null = null;
  const enteredExam = state.plan.exam;
  const examDays = enteredExam && typeof enteredExam.date === 'string' ? examCalendarDays(enteredExam.date, now) : null;
  const scoped = decks.filter((deck) => state.plan.scope.type === 'deck' ? deck.id === state.plan.scope.id : deck.courseId === state.plan.scope.id);
  if (enteredExam && examDays !== null && examDays >= 0 && scoped.length) {
    const blocks = state.plan.days.flatMap((day) => day.blocks);
    const completed = blocks.filter((block) => block.complete).length;
    exam = { title: typeof enteredExam.title === 'string' && enteredExam.title.trim() || 'Planned test', course: scoped[0]!.courseName, date: enteredExam.date, daysRemaining: examDays,
      completed, total: blocks.length, progress: blocks.length ? Math.round(completed / blocks.length * 100) : null,
      deckIds: scoped.map((deck) => deck.id), attentionTopics: weak.filter((topic) => scoped.some((deck) => deck.id === topic.deck.id)).slice(0, 2).map((topic) => topic.title) };
  }
  const byEvent = new Map(quizzes.map((quiz) => [quiz.event.id, quiz]));
  const activity = events.flatMap((event): HomeActivity[] => {
    const deck = byDeck.get(event.deckId ?? '');
    const quiz = byEvent.get(event.id);
    if (quiz) {
      const correct = quiz.answers.filter((record) => record.answer.correct).length;
      const recovered = recovery.get(event.id) ?? 0;
      const course = [...new Set(quiz.answers.map((record) => record.deck.courseName))].join(' · ');
      return [{ id: event.id, at: event.occurredAt, title: 'Practice completed', course, detail: `${correct} of ${quiz.answers.length} answers correct`, recovered, kind: 'quiz' }];
    }
    if (deck && event.type === 'flashcard-review' && deck.flashcards.some((card) => card.id === event.cardId)) return [{ id: event.id, at: event.occurredAt, title: 'Flashcard reviewed', course: deck.courseName, detail: deck.title, recovered: 0, kind: 'review' }];
    if (deck && event.type === 'audio' && (event.completionPercent ?? 0) >= 100) return [{ id: event.id, at: event.occurredAt, title: 'StudyCast completed', course: deck.courseName, detail: deck.title, recovered: 0, kind: 'audio' }];
    if (event.type === 'focus' && (event.durationMinutes ?? 0) > 0) return [{ id: event.id, at: event.occurredAt, title: 'Focus session completed', course: 'Focus time', detail: `${Math.round(event.durationMinutes!)} minutes`, recovered: 0, kind: 'focus' }];
    return [];
  }).reverse().slice(0, 3);
  const latestQuizzes = quizzes.slice(-3);
  const accuracy = { correct: latestQuizzes.flatMap((quiz) => quiz.answers).filter((record) => record.answer.correct).length, total: latestQuizzes.reduce((sum, quiz) => sum + quiz.answers.length, 0), sessions: latestQuizzes.length };

  const resume = byDeck.get(options.resumeDeckId ?? '');
  const firstDue = due[0];
  const firstWeak = weak[0];
  const firstStudy = (exam ? decks.filter((deck) => exam.deckIds.includes(deck.id)) : decks).find((deck) => deck.flashcards.length || deck.notes.length);
  let recommendation: HomeRecommendation;
  if (resume) recommendation = { kind: 'resume', title: `Continue ${resume.title}`, why: 'Your StudyCast has a saved listening position. Pick up where you left off.', actionLabel: 'Resume StudyCast', deckId: resume.id, minutes: null };
  else if (mistakeIds.length) recommendation = { kind: 'mistakes', title: 'Revisit your missed questions', why: `${mistakeIds.length} repeatedly missed ${mistakeIds.length === 1 ? 'question is' : 'questions are'} ready for another look.`, actionLabel: 'Review missed questions', minutes: null };
  else if (firstDue) recommendation = { kind: 'due', title: `Review ${firstDue.deck.courseName}`, why: `${firstDue.cardIds.length} scheduled ${firstDue.cardIds.length === 1 ? 'review is' : 'reviews are'} due. Start with the oldest.`, actionLabel: 'Start study session', minutes: Math.max(1, Math.ceil(Math.min(10, firstDue.cardIds.length) * 0.75)), deckId: firstDue.deck.id, cardIds: firstDue.cardIds.slice(0, 10) };
  else if (firstWeak) recommendation = { kind: 'weak', title: `Practice ${firstWeak.title}`, why: `Your recorded answers show this topic needs another pass: ${firstWeak.correct} of ${firstWeak.total} correct across ${firstWeak.sessions} sessions.`, actionLabel: 'Start study session', minutes: firstWeak.cardIds.length ? Math.max(5, Math.round(Math.min(8, firstWeak.cardIds.length) * 1.4)) : null, deckId: firstWeak.deck.id, sectionId: firstWeak.sectionId, cardIds: firstWeak.cardIds };
  else if (firstStudy) recommendation = { kind: exam ? 'exam' : 'practice', title: exam ? `Prepare for ${exam.title}` : `Build a baseline in ${firstStudy.courseName}`, why: exam ? `Study your selected material before ${exam.date}.` : 'A focused practice session helps you find what to study next.', actionLabel: 'Start study session', minutes: firstStudy.flashcards.length ? Math.max(5, Math.round(Math.min(8, firstStudy.flashcards.length) * 1.4)) : null, deckId: firstStudy.id };
  else recommendation = { kind: 'materials', title: 'Start with your course material', why: 'Add a lecture, PDF, or your own notes. Your next step will be built from what you are learning.', actionLabel: 'Choose study material', minutes: null };
  return { decks, due, dueCount: due.reduce((sum, group) => sum + group.cardIds.length, 0), weak, mistakeIds, activity, exam, recommendation, accuracy };
}
