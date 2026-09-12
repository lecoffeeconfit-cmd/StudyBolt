import type { QuizQuestion, StudyPack } from '../models';

export type AssessmentKind = 'practice' | 'comprehensive';

const fallbackDistractors = [
  'It is unrelated to the source material.',
  'It reverses the relationship described in the lecture.',
  'It applies only outside the scope of this presentation.',
];

function withAnswer(correct: string, candidates: string[], seed: number): { options: string[]; correctIndex: number } {
  const distractors = [...new Set(candidates.filter((candidate) => candidate && candidate !== correct))].slice(0, 3);
  while (distractors.length < 3) distractors.push(fallbackDistractors[distractors.length] ?? 'None of these');
  const correctIndex = seed % 4;
  const options = [...distractors];
  options.splice(correctIndex, 0, correct);
  return { options, correctIndex };
}

function practiceQuestions(deck: StudyPack): QuizQuestion[] {
  const answerPool = deck.flashcards.map((card) => card.back);
  const bulletPool = deck.notes.flatMap((note) => note.bullets);
  const cards = deck.flashcards.map((card, index) => {
    const answer = withAnswer(card.back, [...answerPool, ...bulletPool], index + 1);
    return {
      id: `practice-card-${deck.id}-${card.id}`,
      type: 'multiple-choice' as const,
      prompt: `Which answer best fits this recall prompt: ${card.front}`,
      ...answer,
      explanation: card.explanation ?? card.back,
      source: card.source,
    };
  });
  const notes = deck.notes.flatMap((note, noteIndex) => note.bullets.slice(0, 3).map((bullet, bulletIndex) => {
    const otherTopicBullets = deck.notes.filter((item) => item.id !== note.id).flatMap((item) => item.bullets);
    const prompts = [
      `Which detail correctly belongs with “${note.title}”?`,
      `Which source-backed statement should be kept in a summary of “${note.title}”?`,
      `While reviewing “${note.title},” which idea should you retrieve?`,
    ];
    const answer = withAnswer(bullet, otherTopicBullets, noteIndex + bulletIndex + 2);
    return {
      id: `practice-note-${deck.id}-${note.id}-${bulletIndex}`,
      type: 'multiple-choice' as const,
      prompt: prompts[bulletIndex] ?? `Which detail correctly belongs with “${note.title}”?`,
      ...answer,
      explanation: note.keyIdea ?? bullet,
      source: note.source,
    };
  }));
  return [...deck.quiz, ...cards, ...notes];
}

function comprehensiveQuestions(deck: StudyPack): QuizQuestion[] {
  const noteQuestions = deck.notes.flatMap((note, noteIndex) => note.bullets.map((bullet, bulletIndex) => {
    const otherTopicBullets = deck.notes.filter((item) => item.id !== note.id).flatMap((item) => item.bullets);
    const prompts = [
      `Which statement is supported by the presentation’s “${note.title}” section?`,
      `Which detail correctly belongs in a complete explanation of “${note.title}”?`,
      `A student is reviewing “${note.title}.” Which claim should they keep?`,
      `Which source-backed idea about “${note.title}” is accurate?`,
      `For a cumulative exam, which statement best represents “${note.title}”?`,
      `Which claim from “${note.title}” is consistent with the lecture?`,
    ];
    const answer = withAnswer(bullet, otherTopicBullets, noteIndex * 3 + bulletIndex);
    return {
      id: `test-note-${deck.id}-${note.id}-${bulletIndex}`,
      type: 'multiple-choice' as const,
      prompt: prompts[bulletIndex] ?? prompts[bulletIndex % prompts.length] ?? `Which source-backed idea about “${note.title}” is accurate?`,
      ...answer,
      explanation: `${bullet} Source: ${note.source.label}.`,
      source: note.source,
    };
  }));
  const cardQuestions = deck.flashcards.map((card, index) => {
    const answer = withAnswer(card.back, deck.flashcards.map((item) => item.back), index + 2);
    return {
      id: `test-card-${deck.id}-${card.id}`,
      type: 'multiple-choice' as const,
      prompt: `On a cumulative test, what is the strongest explanation for: ${card.front}`,
      ...answer,
      explanation: card.explanation ?? card.back,
      source: card.source,
    };
  });
  const coveredSections = new Set([...noteQuestions, ...cardQuestions].map((question) => question.source.sectionId));
  const coverageQuestions = deck.outline
    .filter((section) => !coveredSections.has(section.id))
    .map((section, index) => {
      const correct = `Review the concepts summarized in ${section.title}.`;
      const answer = withAnswer(correct, deck.outline.filter((item) => item.id !== section.id).map((item) => `Review only ${item.title}.`), index);
      return {
        id: `test-coverage-${deck.id}-${section.id}`,
        type: 'multiple-choice' as const,
        prompt: `Which review action best ensures the “${section.title}” section is included in your full-presentation test?`,
        ...answer,
        explanation: `${section.title} is part of the source outline (${section.range}), so it remains in the cumulative coverage map.`,
        source: { sectionId: section.id, label: section.range },
      };
    });
  return [...noteQuestions, ...cardQuestions, ...coverageQuestions];
}

export function buildAssessment(deck: StudyPack, kind: AssessmentKind, requestedCount?: number): QuizQuestion[] {
  const questions = kind === 'practice' ? practiceQuestions(deck) : comprehensiveQuestions(deck);
  if (!requestedCount) return questions;
  return questions.slice(0, Math.min(requestedCount, questions.length));
}

export function getAssessmentCoverage(deck: StudyPack, questions: QuizQuestion[]): { covered: number; total: number } {
  const covered = new Set(questions.map((question) => question.source.sectionId));
  return {
    covered: deck.outline.filter((section) => covered.has(section.id)).length,
    total: deck.outline.length,
  };
}
