import type { StudyBoltState, StudyClass, StudyEvent, StudyPack } from '../models';

function recentTimestamp(daysAgo: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

const biology: StudyPack = {
  id: 'biology-cells',
  courseId: 'biology-101',
  courseName: 'Biology 101',
  title: 'Cell Structure & Function',
  subtitle: 'Chapter 5',
  fileName: 'Biology_Ch5_Slides.pptx',
  fileType: 'demo',
  pageCount: 42,
  createdAt: '2026-09-10T21:20:00.000Z',
  order: 1,
  color: '#39BFA3',
  emoji: '🦠',
  outline: [
    { id: 'cell-intro', title: 'Introduction to Cells', range: 'Slides 1–4' },
    { id: 'membrane', title: 'Cell Membrane', range: 'Slides 5–10' },
    { id: 'organelles', title: 'Organelles', range: 'Slides 11–20' },
    { id: 'processes', title: 'Cell Processes', range: 'Slides 21–32' },
    { id: 'review', title: 'Review & Key Concepts', range: 'Slides 33–42' },
  ],
  overview:
    'Cells are the basic units of life. This lecture connects cell structure to function, explains how membranes regulate movement, and compares the jobs of major organelles.',
  originalText:
    'Chapter five: Cell Structure and Function. All living things are composed of one or more cells. The cell is the basic unit of structure and organization in organisms. New cells arise from existing cells. The plasma membrane is a selectively permeable phospholipid bilayer. Its hydrophilic heads face watery environments while hydrophobic tails face inward. Passive transport moves substances down a concentration gradient without cellular energy. Active transport uses energy to move substances against a gradient. The nucleus stores DNA. Ribosomes synthesize proteins. Mitochondria produce most cellular ATP through cellular respiration. The rough endoplasmic reticulum modifies proteins, while the smooth endoplasmic reticulum helps synthesize lipids. The Golgi apparatus modifies, sorts, and packages cellular products. Lysosomes contain digestive enzymes. In plant cells, chloroplasts carry out photosynthesis and a cell wall provides structural support.',
  quickReview:
    'Here is your quick review. Cells are the basic units of life, and their structures are specialized for different jobs. The cell membrane is a phospholipid bilayer that controls what enters and leaves. Passive transport follows a concentration gradient without energy, while active transport uses energy to move against it. The nucleus stores DNA, ribosomes make proteins, mitochondria generate ATP, and the Golgi modifies and packages cell products. Connect each structure to its function, because those relationships are the most testable ideas in this chapter.',
  notes: [
    {
      id: 'note-cell-theory',
      title: 'Cell Theory',
      bullets: [
        'All living organisms are made of one or more cells.',
        'The cell is the basic unit of structure and organization in living things.',
        'All new cells arise from pre-existing cells.',
      ],
      keyIdea: 'Cell theory links every organism through the same basic unit: the cell.',
      source: { sectionId: 'cell-intro', label: 'Slides 2–4' },
    },
    {
      id: 'note-membrane',
      title: 'The Cell Membrane',
      bullets: [
        'A selectively permeable phospholipid bilayer separates the cell from its environment.',
        'Hydrophilic heads face the fluid inside and outside the cell; hydrophobic tails face inward.',
        'Membrane proteins support transport, signaling, recognition, and attachment.',
      ],
      keyIdea: 'Structure explains function: the bilayer forms a flexible barrier while proteins handle specialized tasks.',
      source: { sectionId: 'membrane', label: 'Slides 5–10' },
    },
    {
      id: 'note-transport',
      title: 'Moving Across the Membrane',
      bullets: [
        'Passive transport moves material down its concentration gradient and does not require cellular energy.',
        'Diffusion, facilitated diffusion, and osmosis are forms of passive transport.',
        'Active transport requires energy, usually ATP, to move material against a concentration gradient.',
      ],
      keyIdea: 'Ask two questions: Which direction is the gradient, and is ATP required?',
      source: { sectionId: 'processes', label: 'Slides 21–27' },
    },
    {
      id: 'note-organelles',
      title: 'Organelles: Structure Meets Function',
      bullets: [
        'Nucleus — stores DNA and directs cell activity.',
        'Ribosome — assembles amino acids into proteins.',
        'Mitochondrion — produces most cellular ATP through cellular respiration.',
        'Golgi apparatus — modifies, sorts, and packages proteins and lipids.',
        'Lysosome — uses enzymes to break down macromolecules and worn-out cell parts.',
        'Chloroplast — converts light energy into chemical energy in plant cells.',
      ],
      keyIdea: 'Learn organelles as a coordinated system, not as an isolated vocabulary list.',
      source: { sectionId: 'organelles', label: 'Slides 11–20' },
    },
  ],
  flashcards: [
    {
      id: 'card-1',
      front: 'What are the three parts of cell theory?',
      back: 'Living things are made of cells; cells are the basic unit of life; and new cells come from existing cells.',
      explanation: 'These ideas describe both the organization and continuity of life.',
      confidence: 'known',
      source: { sectionId: 'cell-intro', label: 'Slides 2–4' },
    },
    {
      id: 'card-2',
      front: 'Why is the plasma membrane selectively permeable?',
      back: 'Its phospholipid bilayer and embedded proteins allow some substances to cross more easily than others.',
      confidence: 'learning',
      source: { sectionId: 'membrane', label: 'Slides 5–7' },
    },
    {
      id: 'card-3',
      front: 'How do passive and active transport differ?',
      back: 'Passive transport moves down a concentration gradient without cellular energy. Active transport uses energy to move against a gradient.',
      confidence: 'new',
      source: { sectionId: 'processes', label: 'Slides 21–27' },
    },
    {
      id: 'card-4',
      front: 'What is the main function of mitochondria?',
      back: 'They produce most of the cell’s ATP through cellular respiration.',
      confidence: 'known',
      source: { sectionId: 'organelles', label: 'Slide 15' },
    },
    {
      id: 'card-5',
      front: 'What does the Golgi apparatus do?',
      back: 'It modifies, sorts, and packages proteins and lipids for delivery.',
      confidence: 'learning',
      source: { sectionId: 'organelles', label: 'Slide 17' },
    },
    {
      id: 'card-6',
      front: 'Which organelle assembles proteins?',
      back: 'Ribosomes assemble amino acids into proteins.',
      confidence: 'new',
      source: { sectionId: 'organelles', label: 'Slide 13' },
    },
  ],
  quiz: [
    {
      id: 'quiz-1',
      type: 'multiple-choice',
      prompt: 'Which structure produces most cellular ATP?',
      options: ['Golgi apparatus', 'Mitochondrion', 'Lysosome', 'Nucleus'],
      correctIndex: 1,
      explanation: 'Mitochondria convert energy from nutrients into ATP during cellular respiration.',
      source: { sectionId: 'organelles', label: 'Slide 15' },
    },
    {
      id: 'quiz-2',
      type: 'true-false',
      prompt: 'Active transport moves substances against a concentration gradient and requires energy.',
      options: ['True', 'False'],
      correctIndex: 0,
      explanation: 'Moving against the gradient requires an energy input, commonly ATP.',
      source: { sectionId: 'processes', label: 'Slides 24–27' },
    },
    {
      id: 'quiz-3',
      type: 'multiple-choice',
      prompt: 'Which best explains the arrangement of a phospholipid bilayer?',
      options: [
        'Tails face water on both sides',
        'Heads and tails alternate randomly',
        'Heads face water and tails face inward',
        'Proteins form the entire barrier',
      ],
      correctIndex: 2,
      explanation: 'The water-attracting heads face fluid, while water-repelling tails cluster inward.',
      source: { sectionId: 'membrane', label: 'Slides 5–7' },
    },
    {
      id: 'quiz-4',
      type: 'multiple-choice',
      prompt: 'A cell is packaging a protein for export. Which organelle is directly involved?',
      options: ['Golgi apparatus', 'Chloroplast', 'Nucleolus', 'Cell wall'],
      correctIndex: 0,
      explanation: 'The Golgi modifies and packages proteins into vesicles for delivery.',
      source: { sectionId: 'organelles', label: 'Slide 17' },
    },
  ],
  quizAttempts: [75, 88],
  reviewedNoteIds: ['note-cell-theory', 'note-membrane'],
  audioPosition: 0,
  studyMinutes: 126,
};

function supportingDeck(
  id: string,
  courseId: string,
  courseName: string,
  title: string,
  subtitle: string,
  pageCount: number,
  emoji: string,
  color: string,
  order: number,
): StudyPack {
  const deck = { ...biology };
  return {
    ...deck,
    id,
    courseId,
    courseName,
    title,
    subtitle,
    pageCount,
    emoji,
    color,
    order,
    fileName: `${title.replaceAll(' ', '_')}.pdf`,
    fileType: 'demo',
    overview: `A concise StudyBolt demo pack for ${title}. Open Biology 101 for the fully developed interactive sample.`,
    quickReview: `This is a short review of ${title}. The production processor will generate a grounded spoken summary from the uploaded source.`,
    originalText: `Original extracted material for ${title} will remain in lecture order after secure document processing.`,
    quizAttempts: order % 2 === 0 ? [71] : [82, 90],
    reviewedNoteIds: order % 2 === 0 ? ['note-cell-theory'] : ['note-cell-theory', 'note-membrane', 'note-transport'],
    studyMinutes: 38 + order * 9,
  };
}

export const initialState: StudyBoltState = {
  classes: [
    { id: 'biology-101', name: 'Biology 101', emoji: '🦠', color: '#39BFA3', createdAt: '2026-09-08T21:20:00.000Z' },
    { id: 'psychology', name: 'Psychology', emoji: '🧠', color: '#F26D8B', createdAt: '2026-09-07T21:20:00.000Z' },
    { id: 'chemistry', name: 'Chemistry', emoji: '⚗️', color: '#418DFF', createdAt: '2026-09-06T21:20:00.000Z' },
  ] satisfies StudyClass[],
  decks: [
    biology,
    supportingDeck('psych-biases', 'psychology', 'Psychology', 'Cognitive Biases', 'Lecture 3', 28, '🧠', '#F26D8B', 2),
    supportingDeck('chem-reactions', 'chemistry', 'Chemistry', 'Organic Reactions', 'Unit 3', 35, '⚗️', '#418DFF', 3),
    supportingDeck('biology-genetics', 'biology-101', 'Biology 101', 'Intro to Genetics', 'Chapter 6', 31, '🧬', '#39BFA3', 4),
  ],
  theme: 'system',
  hasCompletedOnboarding: false,
  quizQuestionCount: 10,
  plan: {
    durationDays: 3,
    scope: { type: 'deck', id: 'biology-cells' },
    modalities: ['notes', 'audio', 'flashcards', 'quiz', 'test'],
    quizQuestionCount: 10,
    remindersEnabled: false,
    days: [
      {
        id: 'today',
        label: 'Today',
        subtitle: 'Build the foundation',
        minutes: 35,
        complete: false,
        blocks: [
          { id: 'today-notes', modality: 'notes', label: 'Simplified Notes', minutes: 25, complete: false },
          { id: 'today-audio', modality: 'audio', label: 'Quick Review Audio', minutes: 10, complete: false },
        ],
      },
      {
        id: 'tomorrow',
        label: 'Tomorrow',
        subtitle: 'Retrieve, then review',
        minutes: 35,
        complete: false,
        blocks: [
          { id: 'tomorrow-cards', modality: 'flashcards', label: 'Active Recall Cards', minutes: 20, complete: false },
          { id: 'tomorrow-quiz', modality: 'quiz', label: 'Practice Quiz', minutes: 15, complete: false },
        ],
      },
      {
        id: 'review-day',
        label: 'Review Day',
        subtitle: 'Final confidence check',
        minutes: 30,
        complete: false,
        blocks: [
          { id: 'review-cards', modality: 'flashcards', label: 'Weak-card Review', minutes: 10, complete: false },
          { id: 'review-test', modality: 'test', label: 'Full PowerPoint Test', minutes: 20, complete: false },
        ],
      },
    ],
  },
  focusMinutes: 347,
  streakDays: 5,
  dailyStudyGoalMinutes: 30,
  activityEvents: [
    { id: 'seed-focus-6', type: 'focus', occurredAt: recentTimestamp(6, 18), durationMinutes: 32 },
    { id: 'seed-card-6-1', type: 'flashcard-review', occurredAt: recentTimestamp(6, 18, 34), deckId: 'biology-cells', courseId: 'biology-101', cardId: 'card-1', confidence: 'known', previousConfidence: 'learning', durationMinutes: 2 },
    { id: 'seed-card-6-2', type: 'flashcard-review', occurredAt: recentTimestamp(6, 18, 37), deckId: 'biology-cells', courseId: 'biology-101', cardId: 'card-2', confidence: 'known', previousConfidence: 'learning', durationMinutes: 2 },
    { id: 'seed-notes-5', type: 'note-review', occurredAt: recentTimestamp(5, 10), deckId: 'biology-cells', courseId: 'biology-101', noteId: 'note-cell-theory', durationMinutes: 12 },
    { id: 'seed-quiz-5', type: 'quiz', occurredAt: recentTimestamp(5, 10, 18), deckId: 'biology-cells', courseId: 'biology-101', durationMinutes: 7, quizScore: 75, quizAnswers: [
      { questionId: 'quiz-1', sourceSectionId: 'organelles', correct: true, questionType: 'multiple-choice', difficulty: 'easy' },
      { questionId: 'quiz-2', sourceSectionId: 'processes', correct: true, questionType: 'true-false', difficulty: 'medium' },
      { questionId: 'quiz-3', sourceSectionId: 'membrane', correct: false, questionType: 'multiple-choice', difficulty: 'medium' },
      { questionId: 'quiz-4', sourceSectionId: 'organelles', correct: true, questionType: 'multiple-choice', difficulty: 'hard' },
    ] },
    { id: 'seed-audio-4', type: 'audio', occurredAt: recentTimestamp(4, 20), deckId: 'psych-biases', courseId: 'psychology', durationMinutes: 18, audioMode: 'summary', completionPercent: 100 },
    { id: 'seed-focus-3', type: 'focus', occurredAt: recentTimestamp(3, 16), durationMinutes: 25 },
    { id: 'seed-card-3-1', type: 'flashcard-review', occurredAt: recentTimestamp(3, 16, 27), deckId: 'biology-cells', courseId: 'biology-101', cardId: 'card-1', confidence: 'known', previousConfidence: 'known', durationMinutes: 2 },
    { id: 'seed-card-3-2', type: 'flashcard-review', occurredAt: recentTimestamp(3, 16, 29), deckId: 'biology-cells', courseId: 'biology-101', cardId: 'card-2', confidence: 'learning', previousConfidence: 'known', durationMinutes: 2 },
    { id: 'seed-notes-2', type: 'note-review', occurredAt: recentTimestamp(2, 9), deckId: 'chem-reactions', courseId: 'chemistry', noteId: 'note-cell-theory', durationMinutes: 14 },
    { id: 'seed-quiz-2', type: 'quiz', occurredAt: recentTimestamp(2, 9, 20), deckId: 'biology-cells', courseId: 'biology-101', durationMinutes: 7, quizScore: 75, quizAnswers: [
      { questionId: 'quiz-1', sourceSectionId: 'organelles', correct: true, questionType: 'multiple-choice', difficulty: 'easy' },
      { questionId: 'quiz-2', sourceSectionId: 'processes', correct: true, questionType: 'true-false', difficulty: 'medium' },
      { questionId: 'quiz-3', sourceSectionId: 'membrane', correct: false, questionType: 'multiple-choice', difficulty: 'medium' },
      { questionId: 'quiz-4', sourceSectionId: 'organelles', correct: true, questionType: 'multiple-choice', difficulty: 'hard' },
    ] },
    { id: 'seed-focus-1', type: 'focus', occurredAt: recentTimestamp(1, 14), durationMinutes: 25 },
    { id: 'seed-card-1-1', type: 'flashcard-review', occurredAt: recentTimestamp(1, 14, 27), deckId: 'biology-cells', courseId: 'biology-101', cardId: 'card-1', confidence: 'known', previousConfidence: 'known', durationMinutes: 2 },
    { id: 'seed-card-1-3', type: 'flashcard-review', occurredAt: recentTimestamp(1, 14, 29), deckId: 'biology-cells', courseId: 'biology-101', cardId: 'card-3', confidence: 'learning', previousConfidence: 'new', durationMinutes: 2 },
    { id: 'seed-quiz-1', type: 'quiz', occurredAt: recentTimestamp(1, 14, 34), deckId: 'biology-cells', courseId: 'biology-101', durationMinutes: 7, quizScore: 100, quizAnswers: [
      { questionId: 'quiz-1', sourceSectionId: 'organelles', correct: true, questionType: 'multiple-choice', difficulty: 'easy' },
      { questionId: 'quiz-2', sourceSectionId: 'processes', correct: true, questionType: 'true-false', difficulty: 'medium' },
      { questionId: 'quiz-3', sourceSectionId: 'membrane', correct: true, questionType: 'multiple-choice', difficulty: 'medium' },
      { questionId: 'quiz-4', sourceSectionId: 'organelles', correct: true, questionType: 'multiple-choice', difficulty: 'hard' },
    ] },
    { id: 'seed-audio-today', type: 'audio', occurredAt: recentTimestamp(0, 8), deckId: 'biology-cells', courseId: 'biology-101', durationMinutes: 9, audioMode: 'summary', completionPercent: 100 },
  ] satisfies StudyEvent[],
};
