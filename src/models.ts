export type ThemePreference = 'system' | 'light' | 'dark';
export type FlashcardConfidence = 'new' | 'learning' | 'known';
export type QuizQuestionType = 'multiple-choice' | 'true-false';
export type StudyTool = 'overview' | 'notes' | 'flashcards' | 'quiz' | 'audio';

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
}

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
  reviewedNoteIds: string[];
  audioPosition: number;
  studyMinutes: number;
}

export interface StudyPlanDay {
  id: string;
  label: string;
  subtitle: string;
  minutes: number;
  blocks: Array<{ label: string; minutes: number }>;
  complete: boolean;
}

export interface StudyPlan {
  target: 'tomorrow' | 'two-days' | 'one-week' | 'custom';
  remindersEnabled: boolean;
  days: StudyPlanDay[];
}

export interface StudyBoltState {
  decks: StudyPack[];
  theme: ThemePreference;
  hasCompletedOnboarding: boolean;
  plan: StudyPlan;
  focusMinutes: number;
  streakDays: number;
}

export interface ImportAsset {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
  file?: unknown;
}
