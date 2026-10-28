import type { ImportAsset, StudyTool } from '../models';
import type { SmartStudyMode } from '../services/adaptiveStudy';

export type Route =
  | { type: 'main' }
  | { type: 'onboarding' }
  | { type: 'account-onboarding' }
  | { type: 'auth' }
  | { type: 'account' }
  | { type: 'admin' }
  | { type: 'feedback' }
  | { type: 'premium' }
  | { type: 'widgets' }
  | { type: 'legal' }
  | { type: 'reset-password' }
  | { type: 'smart-study'; mode?: SmartStudyMode; deckId?: string; sectionIds?: string[] }
  | { type: 'speed-review'; deckId?: string; courseId?: string; returnDeckId?: string }
  | { type: 'exam'; deckId?: string }
  | { type: 'mistakes'; itemIds?: string[] }
  | { type: 'flagged' }
  | { type: 'deck'; deckId: string; tool?: StudyTool; cardIds?: string[] }
  | { type: 'visual-review'; deckId: string }
  | { type: 'shared'; token: string }
  | { type: 'community-class'; classId: string }
  | { type: 'processing'; assets: ImportAsset[]; courseId?: string; courseName?: string };
