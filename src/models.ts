export type ThemePreference = 'system' | 'light' | 'dark';
export type FlashcardConfidence = 'new' | 'learning' | 'known';
export type QuizQuestionType = 'multiple-choice' | 'true-false';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type StudyTool = 'overview' | 'notes' | 'flashcards' | 'quiz' | 'audio';
export type QuizQuestionCount = 10 | 15 | 20;
export type StudyModality = 'notes' | 'audio' | 'flashcards' | 'quiz' | 'test';
export type StudyScope =
  | { type: 'deck'; id: string }
  | { type: 'course'; id: string };

export interface SourceReference {
  sectionId: string;
  label: string;
}

export interface DeckOutlineItem {
  id: string;
  title: string;
  range: string;
}

export interface NoteBlock {
  id: string;
  title: string;
  bullets: string[];
  keyIdea?: string;
  source: SourceReference;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  explanation?: string;
  confidence: FlashcardConfidence;
  source: SourceReference;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  source: SourceReference;
  difficulty?: QuizDifficulty;
}

export interface QuizAnswerRecord {
  questionId: string;
  sourceSectionId: string;
  correct: boolean;
  questionType: QuizQuestionType;
  difficulty: QuizDifficulty;
}

export type StudyEventType =
  | 'note-review'
  | 'flashcard-review'
  | 'quiz'
  | 'audio'
  | 'focus'
  | 'pack-created'
  | 'share-link-created'
  | 'share-sheet-opened'
  | 'shared-pack-opened'
  | 'shared-pack-saved';

export interface StudyEvent {
  id: string;
  type: StudyEventType;
  occurredAt: string;
  deckId?: string;
  courseId?: string;
  durationMinutes?: number;
  noteId?: string;
  cardId?: string;
  confidence?: FlashcardConfidence;
  previousConfidence?: FlashcardConfidence;
  quizScore?: number;
  quizAnswers?: QuizAnswerRecord[];
  audioMode?: 'original' | 'summary';
  completionPercent?: number;
}

export type StudyEventInput = Omit<StudyEvent, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string };

export interface StudyPack {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  subtitle: string;
  fileName: string;
  fileType: 'pptx' | 'pdf' | 'demo';
  pageCount: number;
  createdAt: string;
  order: number;
  color: string;
  emoji: string;
  outline: DeckOutlineItem[];
  overview: string;
  originalText: string;
  quickReview: string;
  notes: NoteBlock[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  quizAttempts: number[];
  testAttempts?: number[];
  reviewedNoteIds: string[];
  audioPosition: number;
  studyMinutes: number;
  sharedFromToken?: string;
}

export type SharedStudyPackVisibility = 'private' | 'link';

/**
 * The only Study Pack fields allowed to leave the owner’s device. Progress,
 * attempts, source uploads, and account data intentionally have no place here.
 */
export interface SharedStudyPackContent {
  courseId: string;
  courseName: string;
  title: string;
  subtitle: string;
  fileType: StudyPack['fileType'];
  pageCount: number;
  color: string;
  emoji: string;
  outline: DeckOutlineItem[];
  overview: string;
  quickReview: string;
  notes: NoteBlock[];
  flashcards: Array<Omit<Flashcard, 'confidence'>>;
  quiz: QuizQuestion[];
}

export interface SharedStudyPackLink {
  deckId: string;
  token: string;
  url: string;
  visibility: SharedStudyPackVisibility;
  createdAt: string;
  revokedAt?: string;
}

export interface StudyClass {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: string;
}

export interface StudyPlanDay {
  id: string;
  label: string;
  subtitle: string;
  minutes: number;
  blocks: Array<{
    id: string;
    modality: StudyModality;
    label: string;
    minutes: number;
    complete: boolean;
  }>;
  complete: boolean;
}

export interface StudyPlan {
  durationDays: 1 | 3 | 7 | 14;
  scope: StudyScope;
  modalities: StudyModality[];
  quizQuestionCount: QuizQuestionCount;
  remindersEnabled: boolean;
  days: StudyPlanDay[];
}

export interface StudyBoltState {
  classes: StudyClass[];
  decks: StudyPack[];
  theme: ThemePreference;
  hasCompletedOnboarding: boolean;
  quizQuestionCount: QuizQuestionCount;
  plan: StudyPlan;
  focusMinutes: number;
  streakDays: number;
  activityEvents: StudyEvent[];
  dailyStudyGoalMinutes: number;
}

export interface ImportAsset {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
  file?: unknown;
}
