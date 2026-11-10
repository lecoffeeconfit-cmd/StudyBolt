// Temporary isolated local review entry. Removed after validation.
import { registerRootComponent } from 'expo';
import App from './App';
import { initialState } from './src/data/mockStudyPacks';
import type { StudyBoltState, StudyPack, StudyEvent } from './src/models';
const params = new URLSearchParams(window.location.search);
const mode = params.get('state') ?? 'history';
const base = structuredClone(initialState.decks[0]!);
const pack: StudyPack = { ...base, id: 'review-biology', courseId: 'review-bio-class', courseName: 'Biology', title: 'Cell Structure & Function', fileType: 'pptx', generation: undefined, quizAttempts: [], studyMinutes: 0, reviewedNoteIds: [], audioPosition: 0 };
pack.quiz = pack.outline.flatMap(section => [0, 1].map(n => ({ ...base.quiz[0]!, id: `${section.id}-q${n}`, question: `${section.title}: practice question ${n + 1}`, source: { sectionId: section.id, label: section.title } })));
pack.flashcards = pack.outline.flatMap(section => [0, 1].map(n => ({ ...base.flashcards[0]!, id: `${section.id}-c${n}`, front: `${section.title} recall ${n + 1}`, confidence: 'known' as const, source: { sectionId: section.id, label: section.title } })));
const chem: StudyPack = { ...structuredClone(pack), id: 'review-chemistry', courseId: 'review-chem-class', courseName: 'Chemistry', title: 'Chemical Bonds', fileName: 'Chemical_Bonds.pdf', fileType: 'pdf', flashcards: pack.flashcards.map(card => ({ ...card, confidence: 'new' })) };
const events: StudyEvent[] = [];
const days = [24, 12, 6, 2];
if (mode === 'history' || mode === 'limited') for (const [i, daysAgo] of (mode === 'limited' ? [2] : days).entries()) {
 const at = new Date(); at.setDate(at.getDate() - daysAgo); at.setHours(12, 0, 0, 0);
 const quizAnswers = pack.quiz.map((q, n) => ({ questionId: q.id, sourceDeckId: pack.id, sourceSectionId: q.source.sectionId, correct: n < 4 + i * 2, questionType: 'multiple-choice' as const, difficulty: 'medium' as const, confidence: n % 2 ? 'very-sure' as const : 'unsure' as const, answeredAt: at.toISOString(), responseTimeMs: 8000 }));
 events.push({ id: `review-quiz-${i}`, type: 'quiz', deckId: pack.id, courseId: pack.courseId, occurredAt: at.toISOString(), quizScore: (4 + i * 2) * 10, durationMinutes: 6, quizAnswers });
 if (mode === 'history') for (const [n, card] of pack.flashcards.entries()) events.push({ id: `review-card-${i}-${n}`, type: 'flashcard-review', deckId: pack.id, cardId: card.id, occurredAt: at.toISOString(), confidence: n < 6 ? 'known' : 'learning', reviewRating: n < 6 ? 'good' : 'hard', durationMinutes: 0.5 });
}
if (mode === 'processing' || mode === 'failed') pack.generation = { materials: Object.fromEntries(['simpleNotes', 'detailedNotes', 'keyConcepts', 'flashcards', 'audio', 'quiz'].map(key => [key, { status: key === 'quiz' || key === 'flashcards' ? mode === 'failed' ? 'failed' : 'generating' : 'ready', updatedAt: new Date().toISOString() }])) as NonNullable<StudyPack['generation']>['materials'] };
const classes = [{ id: pack.courseId, name: params.has('long') ? 'Biology, Neuroscience & Advanced Molecular Mechanisms' : 'Biology', emoji: '🦠', color: pack.color, createdAt: pack.createdAt }, { id: chem.courseId, name: 'Chemistry', emoji: '🧪', color: chem.color, createdAt: chem.createdAt }, { id: 'review-history', name: 'History', emoji: '📜', color: '#CCAA88', createdAt: pack.createdAt }];
const fixture: StudyBoltState = { ...initialState, classes: mode === 'none' ? [] : mode === 'empty' ? classes.slice(0, 1) : classes, decks: ['none', 'empty'].includes(mode) ? [] : [pack, chem], theme: params.has('dark') ? 'dark' : 'light', hasCompletedOnboarding: true, activityEvents: events, flaggedItems: [], examAttempts: [], conceptMastery: [], focusMinutes: 0, plan: { ...initialState.plan, days: [], createdAt: undefined, targetDate: undefined } };
window.localStorage.setItem('@studybolt/state/v2/guest', JSON.stringify(fixture));
registerRootComponent(App);
