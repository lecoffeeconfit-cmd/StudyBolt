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
      summary: 'Cell theory explains what living things are made of and how new cells arise.',
      bullets: [
        'All living organisms are made of one or more cells.',
        'The cell is the basic unit of structure and organization in living things.',
        'All new cells arise from pre-existing cells.',
      ],
      keyIdea: 'Cell theory links every organism through the same basic unit: the cell.',
      recallPrompts: ['What are the three claims of cell theory?', 'Why does “new cells come from existing cells” matter for continuity of life?'],
      source: { sectionId: 'cell-intro', label: 'Slides 2–4' },
    },
    {
      id: 'note-membrane',
      title: 'The Cell Membrane',
      summary: 'The plasma membrane is a flexible, selectively permeable boundary whose structure controls exchange.',
      bullets: [
        'A selectively permeable phospholipid bilayer separates the cell from its environment.',
        'Hydrophilic heads face the fluid inside and outside the cell; hydrophobic tails face inward.',
        'Membrane proteins support transport, signaling, recognition, and attachment.',
      ],
      keyIdea: 'Structure explains function: the bilayer forms a flexible barrier while proteins handle specialized tasks.',
      recallPrompts: ['Sketch the bilayer and label which parts face water.', 'How does membrane structure make selective transport possible?'],
      source: { sectionId: 'membrane', label: 'Slides 5–10' },
    },
    {
      id: 'note-organelles',
      title: 'Organelles: Structure Meets Function',
      summary: 'Organelles divide the cell’s work into specialized but connected jobs.',
      bullets: [
        'Nucleus — stores DNA and directs cell activity.',
        'Ribosome — assembles amino acids into proteins.',
        'Mitochondrion — produces most cellular ATP through cellular respiration.',
        'Rough ER modifies proteins; smooth ER helps synthesize lipids.',
        'Golgi apparatus modifies, sorts, and packages proteins and lipids; lysosomes digest materials.',
        'Plant cells use chloroplasts for photosynthesis and a cell wall for structural support.',
      ],
      keyIdea: 'Learn organelles as a coordinated system, not as an isolated vocabulary list.',
      recallPrompts: ['Trace a protein from genetic instructions to packaging.', 'Which structures distinguish the plant-cell functions described here?'],
      source: { sectionId: 'organelles', label: 'Slides 11–20' },
    },
    {
      id: 'note-transport',
      title: 'Moving Across the Membrane',
      summary: 'Transport is classified by the direction of the concentration gradient and whether cellular energy is required.',
      bullets: [
        'Passive transport moves material down its concentration gradient and does not require cellular energy.',
        'Diffusion, facilitated diffusion, and osmosis are forms of passive transport.',
        'Active transport requires energy, usually ATP, to move material against a concentration gradient.',
      ],
      keyIdea: 'Ask two questions: Which direction is the gradient, and is ATP required?',
      recallPrompts: ['Compare passive and active transport without looking.', 'Why does movement against a gradient require energy?'],
      source: { sectionId: 'processes', label: 'Slides 21–32' },
    },
    {
      id: 'note-review',
      title: 'Putting the Cell System Together',
      summary: 'Cell survival depends on coordinated boundaries, information, energy, production, transport, and recycling.',
      bullets: [
        'The membrane regulates exchange while organelles carry out specialized internal work.',
        'DNA instructions, protein synthesis, modification, packaging, and energy production operate as a connected system.',
        'The most useful review strategy is to connect each structure to its function and to the processes it supports.',
      ],
      keyIdea: 'A complete explanation links structures together instead of memorizing each one alone.',
      recallPrompts: ['Explain how three organelles cooperate to make and deliver a protein.', 'Build a structure → function → process chain for the cell membrane.'],
      source: { sectionId: 'review', label: 'Slides 33–42' },
    },
  ],
  detailedNotes: [
    {
      id: 'note-cell-theory',
      title: 'Cell Theory and the Organization of Life',
      summary: 'Cell theory provides a shared framework for describing the composition, organization, and continuity of all living things.',
      bullets: [
        'Every organism contains one or more cells.',
        'A cell is the smallest basic unit that provides biological structure and organization.',
        'Cellular continuity depends on new cells arising from cells that already exist.',
      ],
      sections: [
        {
          heading: 'The three claims',
          points: [
            'Composition: all living things are composed of one or more cells.',
            'Organization: the cell is the basic unit of structure and organization in organisms.',
            'Continuity: new cells arise from pre-existing cells rather than appearing independently.',
          ],
        },
        {
          heading: 'How the claims work together',
          points: [
            'The first two claims connect organisms of every size through a common structural unit.',
            'The third claim explains how cellular life continues as existing cells produce new cells.',
            'Together, the claims describe both what living systems are made of and how their basic units persist over time.',
          ],
        },
      ],
      connections: [
        'Cell theory is the organizing idea for the rest of the lecture: membranes and organelles explain how the basic unit of life functions.',
      ],
      examples: ['A multicellular organism contains many cells, while a single-celled organism still satisfies cell theory with one cell.'],
      keyIdea: 'Do not memorize the claims as three isolated lines—connect composition, organization, and continuity.',
      recallPrompts: ['State all three claims from memory, then explain how each answers a different question about life.', 'How does cell theory prepare you to study membranes and organelles?'],
      source: { sectionId: 'cell-intro', label: 'Slides 1–4' },
    },
    {
      id: 'note-membrane',
      title: 'Plasma Membrane: Architecture and Selectivity',
      summary: 'The plasma membrane’s phospholipid arrangement creates a flexible boundary, while embedded proteins add specialized control and communication functions.',
      bullets: [
        'The membrane is a selectively permeable phospholipid bilayer.',
        'Water-attracting heads face fluid; water-repelling tails face inward.',
        'Membrane proteins extend the boundary’s role beyond a simple barrier.',
      ],
      sections: [
        {
          heading: 'Bilayer organization',
          points: [
            'A phospholipid has a hydrophilic head and hydrophobic tails.',
            'Because the cell interior and exterior are watery, heads orient toward fluid on both sides.',
            'The hydrophobic tails turn away from water and face one another inside the bilayer.',
            'This arrangement produces a continuous, flexible boundary between the cell and its environment.',
          ],
        },
        {
          heading: 'Selective permeability',
          points: [
            'Selective permeability means some substances cross more readily than others.',
            'The phospholipid interior forms the basic barrier, so exchange is controlled rather than unrestricted.',
            'Embedded proteins support specialized transport, signaling, recognition, and attachment roles.',
          ],
        },
      ],
      connections: [
        'Membrane architecture creates the conditions for passive and active transport.',
        'Selective exchange helps the cell maintain an internal environment that differs from its surroundings.',
      ],
      examples: ['When a substance cannot pass freely through the bilayer, a membrane transport protein may provide a selective route.'],
      keyIdea: 'The membrane’s function follows from its structure: the bilayer forms the boundary and proteins provide specialized pathways and signals.',
      recallPrompts: ['Draw and label the bilayer from memory, including the watery environments on both sides.', 'Explain why “selectively permeable” is more accurate than “sealed.”'],
      source: { sectionId: 'membrane', label: 'Slides 5–10' },
    },
    {
      id: 'note-organelles',
      title: 'Organelles as a Coordinated Cellular System',
      summary: 'Organelles specialize in information storage, synthesis, energy conversion, packaging, digestion, and—within plant cells—photosynthesis and structural support.',
      bullets: [
        'The nucleus stores DNA; ribosomes use genetic instructions to synthesize proteins.',
        'The ER and Golgi process cellular products, while mitochondria supply most cellular ATP.',
        'Lysosomes digest material; chloroplasts and cell walls support plant-specific functions described in the lecture.',
      ],
      sections: [
        {
          heading: 'Information and protein production',
          points: [
            'The nucleus stores DNA and directs cell activity through genetic information.',
            'Ribosomes assemble amino acids into proteins.',
            'The rough endoplasmic reticulum modifies proteins associated with its ribosomes.',
            'The Golgi apparatus further modifies, sorts, and packages proteins and lipids for delivery.',
          ],
        },
        {
          heading: 'Energy and lipid synthesis',
          points: [
            'Mitochondria produce most cellular ATP through cellular respiration.',
            'ATP provides usable energy for cellular work, including energy-requiring transport.',
            'The smooth endoplasmic reticulum helps synthesize lipids.',
          ],
        },
        {
          heading: 'Digestion and plant-cell structures',
          points: [
            'Lysosomes contain digestive enzymes that break down macromolecules and worn-out cell parts.',
            'Chloroplasts carry out photosynthesis, converting light energy into chemical energy in plant cells.',
            'A plant cell wall provides structural support outside the plasma membrane.',
          ],
        },
      ],
      connections: [
        'A useful protein pathway is nucleus → ribosome → rough ER → Golgi → destination.',
        'Mitochondrial ATP links energy production to active transport and other cellular work.',
        'The membrane controls exchange for the whole cell while organelles manage specialized internal tasks.',
      ],
      examples: ['A protein intended for delivery is assembled by a ribosome, modified through the rough ER and Golgi, then packaged for transport.'],
      keyIdea: 'Study organelles as an interacting network: ask what each structure contributes and which structure acts next.',
      recallPrompts: ['Reconstruct the protein pathway and state the job performed at each step.', 'Compare the roles of mitochondria and chloroplasts.', 'Which organelle handles digestion, and what does it break down?'],
      source: { sectionId: 'organelles', label: 'Slides 11–20' },
    },
    {
      id: 'note-transport',
      title: 'Membrane Transport and Concentration Gradients',
      summary: 'Transport mechanisms differ according to whether material moves with or against its concentration gradient and whether cellular energy is used.',
      bullets: [
        'Passive transport moves down a concentration gradient without cellular energy.',
        'Diffusion, facilitated diffusion, and osmosis are passive mechanisms.',
        'Active transport uses energy, commonly ATP, to move against a concentration gradient.',
      ],
      sections: [
        {
          heading: 'Passive transport',
          points: [
            'A concentration gradient is a difference in the amount of a substance across space or across a membrane.',
            'Moving down the gradient means moving from an area of higher concentration toward lower concentration.',
            'Passive transport does not require the cell to spend energy for the movement.',
            'Diffusion, facilitated diffusion, and osmosis all follow this general pattern.',
          ],
        },
        {
          heading: 'Active transport',
          points: [
            'Moving against the gradient means moving from lower concentration toward higher concentration.',
            'This movement requires an energy input, usually supplied by ATP.',
            'Active transport allows the cell to maintain concentration differences that passive movement alone would reduce.',
          ],
        },
        {
          heading: 'A decision framework',
          points: [
            'First identify the direction of movement relative to the concentration gradient.',
            'Then determine whether the cell must use energy.',
            'Down the gradient without energy indicates passive transport; against the gradient with energy indicates active transport.',
          ],
        },
      ],
      connections: [
        'The selectively permeable membrane determines which transport route a substance can use.',
        'Mitochondrial ATP can power transport processes that cannot occur passively.',
      ],
      examples: ['If a substance moves from high to low concentration without ATP, classify the process as passive even when a membrane protein assists it.'],
      keyIdea: 'Direction plus energy separates the two major transport categories.',
      recallPrompts: ['Create a two-column comparison of passive and active transport from memory.', 'Why can facilitated diffusion use a protein and still remain passive?', 'Predict the transport type when a cell moves a substance from low to high concentration.'],
      source: { sectionId: 'processes', label: 'Slides 21–32' },
    },
    {
      id: 'note-review',
      title: 'Integrated Review: From Structure to Cell Function',
      summary: 'A complete model of the cell links its boundary, genetic information, organelles, energy supply, and transport processes into one coordinated system.',
      bullets: [
        'Structure predicts function at both the membrane and organelle levels.',
        'Cell processes depend on coordinated sequences rather than isolated structures.',
        'Strong explanations compare mechanisms and trace causal or sequential relationships.',
      ],
      sections: [
        {
          heading: 'Structure → function',
          points: [
            'The phospholipid bilayer’s orientation creates a selective boundary.',
            'Each organelle’s specialized structure supports a particular cellular job.',
            'Plant-cell chloroplasts and cell walls add photosynthetic and structural functions.',
          ],
        },
        {
          heading: 'Function → process',
          points: [
            'DNA in the nucleus provides information used in protein production.',
            'Ribosomes, rough ER, and Golgi form a sequence for producing, modifying, sorting, and packaging proteins.',
            'Mitochondria generate ATP that supports energy-requiring cellular processes.',
            'The plasma membrane and its proteins regulate movement into and out of the cell.',
          ],
        },
        {
          heading: 'High-value comparisons',
          points: [
            'Passive versus active transport: down versus against the gradient; no cellular energy versus energy required.',
            'Rough versus smooth ER: protein modification versus lipid synthesis.',
            'Mitochondria versus chloroplasts: ATP production through cellular respiration versus photosynthesis in plant cells.',
          ],
        },
      ],
      connections: [
        'Cell theory identifies the cell as life’s basic unit; the remaining concepts explain how that unit stays organized and performs work.',
        'Membrane transport and organelle function meet at energy use: ATP makes movement against a gradient possible.',
      ],
      examples: ['To explain protein export, connect DNA storage, ribosome synthesis, rough-ER modification, Golgi packaging, and membrane delivery in order.'],
      keyIdea: 'For durable understanding, reconstruct the system from memory and explain the links between parts.',
      recallPrompts: ['Teach the whole cell as a connected system in two minutes without looking.', 'Explain three structure–function relationships from the lecture.', 'Which comparisons would you use to distinguish the most easily confused concepts?'],
      source: { sectionId: 'review', label: 'Slides 33–42' },
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
  flaggedItems: [],
  librarySort: 'default',
  theme: 'system',
  retentionMode: 'standard',
  hasCompletedOnboarding: false,
  quizQuestionCount: 10,
  plan: {
    createdAt: recentTimestamp(0, 8),
    targetDate: recentTimestamp(-2, 23, 59),
    durationDays: 3,
    scope: { type: 'deck', id: 'biology-cells' },
    modalities: ['notes', 'audio', 'flashcards', 'quiz', 'test'],
    quizQuestionCount: 10,
    remindersEnabled: false,
    days: [
      {
        id: 'today',
        date: recentTimestamp(0, 12),
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
        date: recentTimestamp(-1, 12),
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
        date: recentTimestamp(-2, 12),
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
