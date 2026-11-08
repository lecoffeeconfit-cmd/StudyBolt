import type { HomeDashboard } from './homeDashboard';

export interface TodaysPlanFocus {
  title: string;
  reason: string;
  source: string | null;
  tip: string;
  count: number | null;
  countLabel: string;
  actionLabel: string;
  actionDetail: string | null;
  medium: 'practice' | 'audio' | 'notes' | 'materials' | 'pack';
  examLabel: string | null;
}

/** Presentation for the existing Home action; counts describe work, never predicted grades. */
export function getTodaysPlanFocus(dashboard: HomeDashboard): TodaysPlanFocus {
  const next = dashboard.recommendation;
  const deck = dashboard.decks.find((item) => item.id === next.deckId);
  const source = deck ? `${deck.courseName} · ${deck.title}` : null;
  const exam = deck && dashboard.exam?.deckIds.includes(deck.id) ? dashboard.exam : null;
  const examLabel = exam ? exam.daysRemaining === 0 ? 'Test today' : exam.daysRemaining === 1 ? 'Test tomorrow' : `Test in ${exam.daysRemaining} days` : null;
  const base = { source, examLabel, medium: 'practice' as const };
  if (next.kind === 'materials') return {
    ...base, title: 'Start with one class',
    reason: 'Add lecture slides, a PDF, or your notes. Turn them into a Study Pack you can practice.',
    tip: 'Pick the lecture or topic you want to understand next.',
    count: null, countLabel: 'start here', actionLabel: 'Add course material', actionDetail: null, medium: 'materials',
  };
  if (next.kind === 'pack') return {
    ...base, title: next.title, reason: next.why,
    tip: 'Each study tool keeps its own progress and retry options.',
    count: null, countLabel: 'study tools', actionLabel: 'View Study Pack', actionDetail: null, medium: 'pack',
  };
  if (next.kind === 'resume') return {
    ...base, title: 'Pick up your StudyCast', reason: 'Continue from your saved listening position.',
    tip: 'Pause after a key idea and explain it in your own words.', count: null, countLabel: 'saved spot',
    actionLabel: 'Resume StudyCast', actionDetail: 'Saved position', medium: 'audio',
  };
  if (next.kind === 'mistakes') {
    const count = dashboard.mistakeIds.length;
    const courses = [...new Set(dashboard.decks.filter((pack) => dashboard.mistakeIds.some((id) => id.startsWith(`${pack.id}:`))).map((pack) => pack.courseName))];
    return {
      ...base, source: courses.length ? courses.join(' · ') : null,
      title: `Revisit ${count} missed ${count === 1 ? 'question' : 'questions'}`, reason: 'These questions were missed repeatedly. Review the explanation, then check your understanding in the pack quiz.',
      tip: 'Explain the correction before you move on.', count, countLabel: 'to revisit',
      actionLabel: 'Review missed questions', actionDetail: `${count} ${count === 1 ? 'question' : 'questions'}`,
    };
  }
  if (next.kind === 'due') {
    const count = next.cardIds?.filter((id) => deck?.flashcards.some((card) => card.id === id)).length ?? 0;
    return {
      ...base, title: `Review ${count} due ${count === 1 ? 'flashcard' : 'flashcards'}`,
      reason: 'Start with your oldest scheduled reviews to keep earlier material in reach.',
      tip: 'Try to recall the answer before you flip the card.', count, countLabel: 'in this set',
      actionLabel: 'Start review', actionDetail: `${count} ${count === 1 ? 'card' : 'cards'}`,
    };
  }
  const cards = deck?.flashcards.filter((card) => next.kind !== 'weak' || card.source.sectionId === next.sectionId) ?? [];
  // Smart Study opens with its existing 10-minute setting: ceil(10 / 1.4) = 8 prompts.
  const count = cards.length ? Math.min(8, cards.length) : null;
  if (count === null) return {
    ...base, title: next.kind === 'weak' ? next.title : `Review ${deck?.courseName ?? 'your class'} notes`,
    reason: 'Review a section, then look away and explain the main idea from memory.',
    tip: 'Use your notes to check what you missed.', count: null, countLabel: 'read & recall',
    actionLabel: 'Review notes', actionDetail: null, medium: 'notes',
  };
  return {
    ...base, title: next.kind === 'weak' || next.kind === 'exam' ? next.title : `Practice ${deck?.courseName ?? 'your material'}`,
    reason: next.kind === 'weak' ? next.why : next.kind === 'exam'
      ? 'Practice your selected exam material and check what you can explain without notes.'
      : 'A short recall check helps you see what you know and where to focus next.',
    tip: 'Try first. Check the explanation. Learn from the miss.', count, countLabel: 'planned prompts',
    actionLabel: 'Start study session', actionDetail: `${count} ${count === 1 ? 'prompt' : 'prompts'}`,
  };
}

/** Completion describes the existing dated plan only, never all available study. */
export function getTodaysPlanStatus(dashboard: HomeDashboard) {
  const today = dashboard.today;
  const complete = today.planTotal > 0 && today.planCompleted === today.planTotal;
  const hasActivity = today.reviewedCards > 0 || today.quizSessions > 0 || today.totalAnswers > 0 || today.completedAudio > 0 || today.focusSessions > 0;
  if (today.planTotal > 0) return {
    complete, hasActivity,
    title: complete ? 'Your planned work is complete' : 'Your plan today',
    detail: `${today.planCompleted} of ${today.planTotal} plan tasks marked complete`,
  };
  return {
    complete: false, hasActivity,
    title: hasActivity ? 'A useful step forward today' : dashboard.decks.length ? 'A good place to begin' : 'Built around your material',
    detail: hasActivity ? 'Your recorded work appears in Learning progress below.' : dashboard.decks.length ? 'Start small. Your answers will guide what comes next.' : 'Add one lecture to turn your material into practice.',
  };
}
