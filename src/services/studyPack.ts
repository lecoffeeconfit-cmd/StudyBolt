import type { StudyPack } from '../models';

export function combineStudyPacks(decks: StudyPack[]): StudyPack {
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
    testAttempts: [],
    reviewedNoteIds: [],
    audioPosition: 0,
    studyMinutes: 0,
  };
}
