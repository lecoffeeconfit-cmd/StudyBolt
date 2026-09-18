export type ThemePreference = 'system' | 'light' | 'dark';
export type RetentionMode = 'standard' | 'fsrs' | 'sm2';
export type StudyType = 'college' | 'graduate_school' | 'professional' | 'other';
export type FlashcardConfidence = 'new' | 'learning' | 'known';
export type QuizQuestionType = 'multiple-choice' | 'multiple-select' | 'true-false' | 'short-answer' | 'fill-blank' | 'definition' | 'application';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type AnswerConfidence = 'unsure' | 'somewhat-sure' | 'very-sure';
export type StudyTool = 'overview' | 'notes' | 'flashcards' | 'quiz' | 'audio' | 'coach';
export type QuizQuestionCount = 10 | 15 | 20;
export type LibrarySort = 'default' | 'recent' | 'oldest' | 'alphabetical';
export type SharedStudyPackVisibility = 'private' | 'link' | 'public';
export type DiscoverSort = 'newest' | 'popular' | 'saved';
export type AiTutorAction = 'explain' | 'teach' | 'quick-answer' | 'deep-dive' | 'simplify' | 'example' | 'quiz' | 'socratic' | 'ask' | 'teach-back' | 'important' | 'confuse' | 'visual-analysis';
export type VisualType = 'decorative' | 'logo' | 'background' | 'icon' | 'photo_educational' | 'microscopy_image' | 'diagram' | 'labeled_diagram' | 'flowchart' | 'graph' | 'chart_image' | 'table_image' | 'screenshot' | 'equation' | 'text_image' | 'handwritten' | 'unknown';
export type VisualAnalysisSource = 'pptx_native' | 'accessibility' | 'ocr' | 'local' | 'ai_economy' | 'ai_deep' | 'user_confirmed';
export type VisualStatus = 'resolved_native' | 'resolved_accessibility' | 'resolved_ocr' | 'resolved_local' | 'needs_review' | 'analyzing_ai' | 'resolved_ai' | 'skipped_by_user' | 'analysis_failed' | 'allowance_unavailable';
export type VisualReviewReason = 'complex_diagram' | 'unreadable_labels' | 'low_confidence' | 'complex_graph' | 'scientific_image' | 'equation_unresolved' | 'handwriting' | 'microscopy_detail' | 'insufficient_context' | 'unknown_visual';
export type AiTutorDepth = 'quick' | 'normal' | 'deep';
export type AiRequestChannel = 'text' | 'voice' | 'exam';
export type StudyModality = 'notes' | 'audio' | 'flashcards' | 'quiz' | 'test';
export type FlaggedItemKind = 'note' | 'flashcard' | 'quiz';
export type StudyScope =
  | { type: 'deck'; id: string }
  | { type: 'course'; id: string };

export interface SourceReference {
  sectionId: string;
  label: string;
}

export interface FlaggedItem {
  id: string;
  deckId: string;
  deckTitle: string;
  courseId: string;
  courseName: string;
  kind: FlaggedItemKind;
  itemId: string;
  title: string;
  prompt: string;
  answer: string;
  explanation?: string;
  source: SourceReference;
  flaggedAt: string;
}

export type FlaggedItemInput = Omit<FlaggedItem, 'id' | 'flaggedAt'> & { id?: string };

export function getFlaggedItemId(deckId: string, kind: FlaggedItemKind, itemId: string): string {
  return `${deckId}:${kind}:${itemId}`;
}

export interface DeckOutlineItem {
  id: string;
  title: string;
  range: string;
}

export interface NoteBlock {
  id: string;
  title: string;
  summary?: string;
  bullets: string[];
  sections?: Array<{
    heading: string;
    points: string[];
  }>;
  connections?: string[];
  examples?: string[];
  recallPrompts?: string[];
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
  correctIndices?: number[];
  explanation: string;
  source: SourceReference;
  difficulty?: QuizDifficulty;
  sourceDeckId?: string;
  conceptId?: string;
  conceptTitle?: string;
  importance?: number;
  masteryImpact?: number;
  examId?: string;
  aiGenerated?: boolean;
  createdAt?: string;
  acceptedAnswers?: string[];
  /** Stable source-pool ID used to avoid repeating a prior generated variant. */
  originQuestionId?: string;
}

export interface QuizAnswerRecord {
  questionId: string;
  originQuestionId?: string;
  sourceSectionId: string;
  correct: boolean;
  questionType: QuizQuestionType;
  difficulty: QuizDifficulty;
  selectedIndex?: number;
  correctIndex?: number;
  selectedAnswer?: string;
  correctAnswer?: string;
  responseTimeMs?: number;
  answeredAt?: string;
  confidence?: AnswerConfidence;
  sequence?: number;
  selectedIndices?: number[];
  openAnswer?: string;
  partialCredit?: number;
  skipped?: boolean;
  flagged?: boolean;
  sourceDeckId?: string;
  conceptId?: string;
  examId?: string;
  gradingFeedback?: string;
  missingIdeas?: string[];
  gradingProvider?: 'local' | 'cloud';
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
  | 'shared-pack-saved'
  | 'ai-tutor-question'
  | 'tutor-quiz'
  | 'exam-created'
  | 'exam-started'
  | 'exam-completed'
  | 'exam-abandoned'
  | 'exam-retake'
  | 'weak-area-exam-started'
  | 'ask-ai-from-exam'
  | 'voice-tutor-started'
  | 'voice-tutor-completed'
  | 'voice-tutor-interrupted'
  | 'ai-limit-warning';

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
  responseTimeMs?: number;
  quizScore?: number;
  quizAnswers?: QuizAnswerRecord[];
  assessmentKind?: 'practice' | 'comprehensive' | 'adaptive' | 'targeted';
  examId?: string;
  examAttemptId?: string;
  examName?: string;
  sourceDeckIds?: string[];
  masteryBefore?: number;
  masteryAfter?: number;
  audioMode?: 'original' | 'summary';
  completionPercent?: number;
  tutorAction?: AiTutorAction;
  tutorQuizCorrect?: boolean;
}

export type StudyEventInput = Omit<StudyEvent, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string };

export interface StudyPack {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  subtitle: string;
  fileName: string;
  fileType: 'pptx' | 'pdf' | 'notes' | 'demo';
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
  detailedNotes: NoteBlock[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  quizAttempts: number[];
  testAttempts?: number[];
  reviewedNoteIds: string[];
  audioPosition: number;
  studyMinutes: number;
  /** Local-only source file reference. Never included in shared content. */
  originalUri?: string;
  visuals?: VisualKnowledge[];
  visualSummary?: VisualProcessingSummary;
  sharedFromToken?: string;
  originalSetId?: string;
  originalCreatorId?: string;
  communityClassId?: string;
}

export interface VisualKnowledge {
  id: string;
  documentId?: string;
  slideNumber: number;
  slideTitle: string;
  imageHash: string;
  imageReference?: string;
  imageDataUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageX?: number;
  imageY?: number;
  altText?: string;
  accessibilityText?: string;
  nearbyText?: string;
  visualType: VisualType;
  educationalImportance: number;
  localConfidence: number;
  needsUserReview: boolean;
  reason?: VisualReviewReason;
  description?: string;
  extractedText?: string;
  labels?: string[];
  concepts?: string[];
  relationships?: string[];
  studyRelevance?: string;
  analysisSource: VisualAnalysisSource;
  status: VisualStatus;
  analyzedAt?: string;
  cacheHit?: boolean;
  analysisAvoided?: boolean;
  aiError?: string;
}

export interface VisualProcessingSummary {
  totalSlides: number;
  totalImages: number;
  totalNativeTables?: number;
  totalNativeCharts?: number;
  decorativeImagesIgnored: number;
  nativeVisualsResolved: number;
  accessibilityVisualsResolved: number;
  ocrVisualsResolved: number;
  locallyResolved: number;
  visualsNeedingReview: number;
  userAIVisualsAnalyzed: number;
  cachedAnalysesUsed: number;
}

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
  detailedNotes: NoteBlock[];
  flashcards: Array<Omit<Flashcard, 'confidence'>>;
  quiz: QuizQuestion[];
}

export interface SharedStudyPackLink {
  deckId: string;
  token: string;
  url: string;
  visibility: SharedStudyPackVisibility;
  createdAt: string;
  classId?: string;
  revokedAt?: string;
}

export interface SharedStudyPackMetadata {
  token: string;
  creatorDisplayName: string;
  description: string;
  itemCount: number;
  saveCount: number;
  shareCount: number;
  visibility: Exclude<SharedStudyPackVisibility, 'private'>;
  classId?: string;
  originalSetId?: string;
}

export interface SharedStudyPackPreview {
  content: SharedStudyPackContent;
  metadata: SharedStudyPackMetadata;
}

export interface CommunityClass {
  id: string;
  schoolName: string;
  courseCode: string;
  courseName: string;
  subject: string;
  instructorName?: string;
  term?: string;
  memberCount: number;
  setCount: number;
  joined: boolean;
}

export interface DiscoverStudySet {
  token: string;
  title: string;
  courseName: string;
  subject: string;
  description: string;
  creatorDisplayName: string;
  itemCount: number;
  pageCount: number;
  saveCount: number;
  shareCount: number;
  updatedAt: string;
  classId?: string;
  classLabel?: string;
}

export interface AiTutorContextChunk {
  id: string;
  title: string;
  text: string;
}

export interface AiTutorContext {
  studySetTitle: string;
  subject: string;
  currentChunk: AiTutorContextChunk;
  nearbyChunks: AiTutorContextChunk[];
  currentQuestion?: {
    prompt: string;
    userAnswer?: string;
    correctAnswer?: string;
    concept?: string;
    source?: string;
  };
  mastery?: number;
}

export interface AiTutorQuota {
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  plan: 'free' | 'premium';
  softWarning?: boolean;
}

export interface AiTutorConversation {
  summary?: string;
  turns?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AiTutorQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AiTutorResponse {
  kind: 'answer' | 'quiz';
  answer: string;
  quiz?: AiTutorQuiz;
  quota?: AiTutorQuota;
  provider: 'on-device' | 'cloud';
}

export interface AiVisualAnalysisRequest {
  documentId: string;
  visualId: string;
  imageDataUrl: string;
  slideNumber: number;
  slideTitle: string;
  slideText?: string;
  previousSlideContext?: string;
  nextSlideContext?: string;
  accessibilityDescription?: string;
  ocrText?: string;
  subject?: string;
}

export interface AiVisualAnalysis {
  visualType: VisualType;
  description: string;
  extractedText: string[];
  labels: string[];
  concepts: string[];
  relationships: string[];
  studyRelevance: string;
  confidence: number;
}

export type ExamMode = 'adaptive' | 'standard' | 'targeted';
export type ExamDifficulty = QuizDifficulty | 'balanced' | 'adaptive';
export type ExamLengthPreset = 'quick' | 'standard' | 'full' | 'custom';

export interface ExamSettings {
  title: string;
  sourceDeckIds: string[];
  sourceSectionIds?: string[];
  questionCount: number;
  lengthPreset: ExamLengthPreset;
  difficulty: ExamDifficulty;
  questionTypes: QuizQuestionType[];
  timeLimitMinutes?: number;
  immediateFeedback: boolean;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  mode: ExamMode;
  targetedConceptIds?: string[];
  excludedQuestionIds?: string[];
}

export interface ExamAttempt {
  id: string;
  examId: string;
  title: string;
  sourceDeckIds: string[];
  sourceLabels: string[];
  createdAt: string;
  completedAt?: string;
  status: 'completed' | 'abandoned';
  score: number;
  correctCount: number;
  questionCount: number;
  durationSeconds: number;
  masteryBefore: number;
  masteryAfter: number;
  improvement: number;
  weakTopics: string[];
  strongestTopics: string[];
  flaggedQuestionIds: string[];
  settings: ExamSettings;
  questions: QuizQuestion[];
  answers: QuizAnswerRecord[];
  conceptResults?: ExamConceptResult[];
  scoreChangeFromPrevious?: number;
  gradingMode?: 'local' | 'cloud-assisted';
}

export interface ExamConceptResult {
  conceptId: string;
  title: string;
  sourceDeckId: string;
  sourceLabel: string;
  score: number;
  responseTimeMs: number;
  masteryBefore: number;
  masteryAfter: number;
  improvement: number;
  evidenceCount: number;
}

export interface ConceptMasteryRecord {
  conceptId: string;
  title: string;
  sourceDeckId: string;
  sourceSectionId: string;
  mastery: number;
  evidenceCount: number;
  correctStreak: number;
  lastAnsweredAt: string;
  lastDifficulty: QuizDifficulty;
  lastQuestionType: QuizQuestionType;
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
  date?: string;
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
  createdAt?: string;
  targetDate?: string;
  durationDays: number;
  scope: StudyScope;
  modalities: StudyModality[];
  quizQuestionCount: QuizQuestionCount;
  remindersEnabled: boolean;
  days: StudyPlanDay[];
}

export interface StudyBoltState {
  classes: StudyClass[];
  decks: StudyPack[];
  flaggedItems: FlaggedItem[];
  librarySort: LibrarySort;
  theme: ThemePreference;
  retentionMode: RetentionMode;
  hasCompletedOnboarding: boolean;
  quizQuestionCount: QuizQuestionCount;
  plan: StudyPlan;
  focusMinutes: number;
  streakDays: number;
  activityEvents: StudyEvent[];
  dailyStudyGoalMinutes: number;
  examAttempts?: ExamAttempt[];
  conceptMastery?: ConceptMasteryRecord[];
}

export interface ImportAsset {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
  file?: unknown;
}
