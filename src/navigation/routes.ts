import type { ImportAsset, StudyTool } from '../models';

export type Route =
  | { type: 'main' }
  | { type: 'onboarding' }
  | { type: 'auth' }
  | { type: 'account' }
  | { type: 'legal' }
  | { type: 'reset-password' }
  | { type: 'deck'; deckId: string; tool?: StudyTool }
  | { type: 'shared'; token: string }
  | { type: 'processing'; asset: ImportAsset; courseId?: string; courseName?: string };
