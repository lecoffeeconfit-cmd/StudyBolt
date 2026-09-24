import type { ImportAsset, StudyTool } from '../models';
import type { SmartStudyMode } from '../services/adaptiveStudy';

export type Route =
  | { type: 'main' }
  | { type: 'onboarding' }
  | { type: 'account-onboarding' }
  | { type: 'auth' }
  | { type: 'account' }
  | { type: 'widgets' }
  | { type: 'legal' }
  | { type: 'reset-password' }
  | { type: 'smart-study'; mode?: SmartStudyMode; deckId?: string }
  | { type: 'exam'; deckId?: string }
  | { type: 'mistakes' }
  | { type: 'flagged' }
  | { type: 'deck'; deckId: string; tool?: StudyTool }
  | { type: 'visual-review'; deckId: string }
  | { type: 'shared'; token: string }
  | { type: 'community-class'; classId: string }
  | { type: 'processing'; asset: ImportAsset; courseId?: string; courseName?: string };
