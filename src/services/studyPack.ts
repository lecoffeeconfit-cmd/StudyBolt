import type { StudyPack } from '../models';
import { createQueuedStudyPackGeneration, StudyBoltProcessingError } from './documentProcessor';

const MAX_INTEGRATED_SECTIONS = 160;
const MAX_INTEGRATED_SOURCE_CHARACTERS = 360_000;

export function combineImportedPowerPoints(decks: StudyPack[], courseId: string, courseName: string): StudyPack {
  if (decks.length < 2 || decks.some((deck) => deck.fileType !== 'pptx')) {
    throw new Error('Choose at least two PowerPoint Study Packs to combine.');
  }

  const stamp = Date.now().toString();
  const sourceFileNames = decks.map((deck) => deck.fileName);
  const outline = decks.flatMap((deck, deckIndex) => deck.outline.map((section) => ({
    id: `source-${deckIndex + 1}-${section.id}`,
    title: `${deck.title} · ${section.title}`,
    range: `${deck.fileName} · ${section.range}`,
  })));
  const source = decks.map((deck, index) => {
    const sectionMap = deck.outline.map((section) => `- source-${index + 1}-${section.id}: ${section.title} (${section.range})`).join('\n');
    return [
      `PRESENTATION ${index + 1}: ${deck.title}`,
      `SOURCE FILE: ${deck.fileName}`,
      `SECTION ID MAP:\n${sectionMap}`,
      `NORMALIZED SOURCE:\n${deck.processedSource || deck.originalText}`,
    ].join('\n');
  }).join('\n\n');
  if (outline.length > MAX_INTEGRATED_SECTIONS) {
    throw new StudyBoltProcessingError(
      'Integrated PowerPoint set has too many sections',
      'These presentations cover too many topics for one Study Pack. Select fewer presentations and build smaller study sets.',
    );
  }
  if (source.length > MAX_INTEGRATED_SOURCE_CHARACTERS) {
    throw new StudyBoltProcessingError(
      'Integrated PowerPoint source is too large',
      'These presentations contain too much text for one Study Pack. Select fewer presentations and try again.',
    );
  }

  return {
    ...decks[0]!,
    id: `integrated-powerpoints-${stamp}`,
    courseId,
    courseName,
    title: `${decks.length}-PowerPoint Integrated Review`,
    subtitle: `One connected study set from ${decks.length} presentations · ${decks.reduce((sum, deck) => sum + deck.pageCount, 0)} slides`,
    fileName: `${decks.length}-powerpoint-study-set`,
    sourceFileNames,
    pageCount: decks.reduce((sum, deck) => sum + deck.pageCount, 0),
    createdAt: new Date().toISOString(),
    order: 0,
    emoji: '⚡',
    outline,
    overview: '',
    originalText: source,
    processedSource: source,
    quickReview: '',
    notes: [],
    detailedNotes: [],
    flashcards: [],
    quiz: [],
    quizAttempts: [],
    testAttempts: [],
    reviewedNoteIds: [],
    audioPosition: 0,
    studyMinutes: 0,
    visuals: decks.flatMap((deck) => (deck.visuals ?? []).map((visual) => ({
      ...visual,
      slideTitle: `${deck.title} · ${visual.slideTitle}`,
    }))),
    visualSummary: undefined,
    generation: createQueuedStudyPackGeneration(),
  };
}

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
    sourceFileNames: decks.flatMap((deck) => deck.sourceFileNames?.length ? deck.sourceFileNames : [deck.fileName]),
    pageCount: decks.reduce((sum, deck) => sum + deck.pageCount, 0),
    createdAt: new Date().toISOString(),
    order: Math.max(...decks.map((deck) => deck.order)) + 1,
    emoji: '⚡',
    overview: `An exam review built from ${decks.map((deck) => deck.title).join(', ')} in course order.`,
    originalText: decks.map((deck) => `${deck.title}. ${deck.originalText}`).join('\n\n'),
    quickReview: decks.map((deck) => `${deck.title}. ${deck.quickReview}`).join('\n\n'),
    audioSummary: decks.map((deck) => `${deck.title}. ${deck.audioSummary || deck.quickReview}`).join('\n\n'),
    processedSource: undefined,
    generation: undefined,
    outline: decks.map((deck, index) => ({ id: `review-outline-${stamp}-${deck.id}`, title: deck.title, range: `Deck ${index + 1} · ${deck.pageCount} slides` })),
    notes: decks.flatMap((deck) => deck.notes.map((note) => ({ ...note, id: `${deck.id}-${note.id}`, title: `${deck.title} · ${note.title}` }))),
    detailedNotes: decks.flatMap((deck) => deck.detailedNotes.map((note) => ({ ...note, id: `${deck.id}-${note.id}`, title: `${deck.title} · ${note.title}` }))),
    flashcards: decks.flatMap((deck) => deck.flashcards.map((card) => ({ ...card, id: `${deck.id}-${card.id}`, confidence: 'new' as const }))),
    quiz: decks.flatMap((deck) => deck.quiz.map((question) => ({ ...question, id: `${deck.id}-${question.id}` }))),
    quizAttempts: [],
    testAttempts: [],
    reviewedNoteIds: [],
    audioPosition: 0,
    studyMinutes: 0,
  };
}
