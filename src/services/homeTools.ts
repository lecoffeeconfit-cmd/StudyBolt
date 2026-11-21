import type { StudyPack } from '../models';

export type HomeTool = 'flashcards' | 'quiz' | 'audio' | 'coach';

/** Match the content and material gates on the destination tabs. */
export function isHomeToolReady(pack: StudyPack, tool: HomeTool): boolean {
  if (tool === 'coach') return pack.notes.length > 0;
  const hasContent = tool === 'audio' ? Boolean(pack.audioSummary?.trim() || pack.quickReview?.trim() || pack.flashcards.length) : pack[tool].length > 0;
  return hasContent && (!pack.generation || pack.generation.materials[tool]?.status === 'ready');
}
