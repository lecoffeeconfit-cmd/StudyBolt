import type { Flashcard, VisualKnowledge } from '../models';
import { supabase } from './auth';

const NON_STUDY_VISUALS = new Set<VisualKnowledge['visualType']>(['decorative', 'logo', 'background', 'icon']);
const VISUAL_BUCKET = 'studybolt-visuals';

export function isUsefulVisual(visual: VisualKnowledge): boolean {
  return !NON_STUDY_VISUALS.has(visual.visualType) && visual.educationalImportance >= 0.35;
}

export function usefulVisuals(visuals: VisualKnowledge[] | undefined): VisualKnowledge[] {
  const seen = new Set<string>();
  return (visuals ?? [])
    .filter(isUsefulVisual)
    .filter((visual) => {
      if (seen.has(visual.imageHash)) return false;
      seen.add(visual.imageHash);
      return true;
    })
    .sort((a, b) => a.slideNumber - b.slideNumber);
}

export function immediateVisualImageUri(visual: Pick<VisualKnowledge, 'imageDataUrl' | 'imageUrl'>): string | undefined {
  return visual.imageDataUrl || visual.imageUrl;
}

export function immediateFlashcardImageUri(card: Pick<Flashcard, 'imageUrl'>): string | undefined {
  return card.imageUrl;
}

export async function resolveStoredVisualImageUri(imagePath: string | undefined, fallback?: string): Promise<string | undefined> {
  if (!imagePath || !supabase) return fallback;
  try {
    const { data, error } = await supabase.storage.from(VISUAL_BUCKET).createSignedUrl(imagePath, 60 * 60);
    return error ? fallback : data.signedUrl;
  } catch {
    return fallback;
  }
}
